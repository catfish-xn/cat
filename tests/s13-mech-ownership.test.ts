import { describe, expect, it } from 'vitest';
import { room } from './tp-helpers';
import { freeze } from './combat-helpers';
import { createOwnershipState, transactOwnership, assertOwnershipConservation, serializeOwnership, restoreOwnership, previewDuplicator,
  type OwnershipState, type OwnershipOperation, type OwnershipAuthority, type OwnershipBoundary, type OwnershipTransaction } from '../src/simulation/owned-resources';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { deriveTraits } from '../src/simulation/trait-snapshot';

function setup(lastSettledRoundId: string | null = null) {
  const { pool, states } = room();
  const boundary: OwnershipBoundary = { pool, states, lastSettledRoundId };
  const authority: OwnershipAuthority = { grants: [
    { id: 'two-units', seatId: 'seat-0', resources: [{ kind: 'unit', definitionId: 'maddie' }, { kind: 'unit', definitionId: 'maddie' }] },
    { id: 'equipment-tools', seatId: 'seat-0', resources: [{ kind: 'item', definitionId: 'bow' }, { kind: 'duplicator', maxCost: 3 }] },
    { id: 'one-unit', seatId: 'seat-0', resources: [{ kind: 'unit', definitionId: 'lux' }] },
    { id: 'fill', seatId: 'seat-0', resources: Array.from({ length: 9 }, () => ({ kind: 'unit' as const, definitionId: 'lux' })) },
    { id: 'bad-middle', seatId: 'seat-0', resources: [{ kind: 'item', definitionId: 'bow' }, { kind: 'unit', definitionId: 'unknown' }] },
  ] };
  return { boundary, authority, state: createOwnershipState(boundary) };
}
function commit(state: OwnershipState, authority: OwnershipAuthority, id: string, ...operations: OwnershipOperation[]) {
  const result = transactOwnership(freeze(state), { id, operations }, freeze(authority));
  if (!result.ok) throw new Error(result.reason);
  oracle(result.state); return result.state;
}
function reject(state: OwnershipState, authority: OwnershipAuthority, id: string, reason: string, ...operations: OwnershipOperation[]) {
  const before = structuredClone(state);
  const result = transactOwnership(freeze(state), { id, operations }, authority);
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state); expect(result.state).toEqual(before);
}
/** Independent sum of physical visible/held shares, with original reservation categories. */
function oracle(state: OwnershipState) {
  for (const [id, initial] of Object.entries(state.pool.initial)) {
    const visible = state.seats.flatMap(s => s.preparation.units).filter(u => u.team === 'player' && u.definitionId === id)
      .reduce((n, u) => n + 3 ** (u.starLevel - 1), 0);
    const held = state.held.filter(h => h.kind === 'unit' && h.unit.definitionId === id)
      .reduce((n, h) => n + (h.kind === 'unit' ? 3 ** (h.unit.starLevel - 1) : 0), 0);
    expect(state.pool.available[id] + visible + held + state.pool.shops.filter(s => s.definitionId === id).length
      + state.pool.pending.filter(p => p.definitionId === id).length
      + state.pool.carouselReservations.filter(r => r.definitionId === id).length).toBe(initial);
  }
  assertOwnershipConservation(state);
}
const acquire = (grantId: string, full: 'hold' | 'reject' = 'hold'): OwnershipOperation => ({ kind: 'acquire', grantId, full });
const settle = (ordinal: number): OwnershipOperation => ({ kind: 'settle', roundId: getMultiplayerRoundByOrdinal(ordinal).roundId });

describe('D3 resource ownership transactions (Q3/Q5)', () => {
  it('over-encumbered grants and returns stay held when the sole bench slot is full despite board space', () => {
    const { boundary: original, authority } = setup();
    const boundary: OwnershipBoundary = { ...original, states: original.states.map((s, i) => i ? s : {
      ...s, level: 9, preparation: { ...s.preparation, usableBenchSlots: 1, overflowUnitIds: [],
        units: s.preparation.units.map((u, col) => u.team === 'player'
          ? { ...u, location: { kind: 'board' as const, cell: { row: 4, col } } } : u) },
    }) };
    const state = createOwnershipState(boundary);
    const granted = commit(state, authority, 'restricted-grant', acquire('two-units'));
    const seat = granted.seats[0];
    expect(seat.preparation.units.filter(u => u.location.kind === 'bench')).toHaveLength(1);
    expect(seat.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length).toBeLessThan(seat.deploymentCap);
    expect(granted.held).toHaveLength(1);
    const held = granted.held[0];
    const waiting = commit(granted, authority, 'restricted-return', { kind: 'claim', seatId: 'seat-0', holdingId: held.id, full: 'hold' });
    expect(waiting.held).toEqual(granted.held);expect(waiting.seats).toEqual(granted.seats);
    reject(waiting, authority, 'reject-return', 'full-seat', { kind: 'claim', seatId: 'seat-0', holdingId: held.id, full: 'reject' });
    const bench = seat.preparation.units.find(u => u.location.kind === 'bench')!;
    const returned = commit(waiting, authority, 'vacate-and-return', { kind: 'sell', seatId: 'seat-0', unitId: bench.id });
    expect(returned.held).toEqual([]);
    expect(returned.seats[0].preparation.units.find(u => held.kind === 'unit' && u.id === held.unit.id)?.location).toEqual({ kind: 'bench', slot: 0 });
    expect(restoreOwnership(serializeOwnership(returned, boundary, authority, returned.transactions), boundary, authority, returned.transactions)).toEqual(returned);
  });
  it.each(['merge-live', 'settle', 'claim'] as const)('persists a successful %s no-op ID without events and rejects changed retries', kind => {
    const { state: initial, authority, boundary } = setup('1-2');
    const state = kind === 'claim' ? commit(initial, authority, 'full', acquire('fill'), acquire('two-units')) : initial;
    const operation: OwnershipOperation = kind === 'merge-live' ? { kind, seatId: 'seat-0' }
      : kind === 'settle' ? settle(state.settledOrdinal)
      : { kind, seatId: 'seat-0', holdingId: state.held[0].id, full: 'hold' };
    const tx: OwnershipTransaction = { id: 'accepted-no-op', operations: [operation] };
    // This is the caller's accepted-command log, including the successful no-op.
    const verified = [...state.transactions, tx];
    const result = transactOwnership(freeze(state), tx, authority);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events).toEqual([]);
    expect(result.state).toEqual({ ...state, transactions: verified });
    expect(transactOwnership(result.state, tx, authority)).toEqual({ ok: true, state: result.state, events: [] });
    expect(transactOwnership(result.state, tx, authority).state).toBe(result.state);
    reject(result.state, authority, tx.id, 'receipt-conflict', acquire('equipment-tools'));
    expect(restoreOwnership(result.state, boundary, authority, verified)).toEqual(result.state);
    const saved = serializeOwnership(result.state, boundary, authority, verified);
    const restored = restoreOwnership(saved, boundary, authority, verified);
    expect(restored).toEqual(result.state);
    reject(restored, authority, tx.id, 'receipt-conflict', acquire('equipment-tools'));
    oracle(result.state);
  });
  it('replays a trusted mixed log containing first-time no-ops without dropping receipts', () => {
    const { state, boundary, authority } = setup();
    const verified: OwnershipTransaction[] = [
      { id: 'empty-merge', operations: [{ kind: 'merge-live', seatId: 'seat-0' }] },
      { id: 'grant', operations: [acquire('equipment-tools')] },
      { id: 'still-empty-merge', operations: [{ kind: 'merge-live', seatId: 'seat-0' }] },
      { id: 'round', operations: [settle(1)] },
      { id: 'repeat-round', operations: [settle(1)] },
    ];
    let current = state;
    for (const [index, tx] of verified.entries()) {
      const result = transactOwnership(freeze(current), tx, authority);
      if (!result.ok) throw new Error(result.reason);
      expect(result.events).toHaveLength([0, 2, 4].includes(index) ? 0 : 1);
      current = result.state;
      expect(current.transactions).toEqual(verified.slice(0, index + 1));
    }
    const restored = restoreOwnership(serializeOwnership(current, boundary, authority, verified), boundary, authority, verified);
    expect(restored).toEqual(current);
    expect(transactOwnership(restored, verified[0], authority)).toEqual({ ok: true, state: restored, events: [] });
    const next: OwnershipTransaction = { id: 'next', operations: [acquire('two-units')] };
    expect(transactOwnership(restored, next, authority)).toEqual(transactOwnership(current, next, authority));
  });
  it('takes two real shares exactly once and keeps every other player unchanged', () => {
    const { state, authority } = setup();
    const after = commit(state, authority, 'choice', acquire('two-units'));
    expect(after.pool.available.maddie).toBe(state.pool.available.maddie - 2);
    expect(after.seats[0].nextUnitSerial).toBe(state.seats[0].nextUnitSerial + 2);
    expect(after.seats[1]).toEqual(state.seats[1]);
    const duplicate = transactOwnership(after, { id: 'choice', operations: [acquire('two-units')] }, authority);
    expect(duplicate).toEqual({ ok: true, state: after, events: [] }); expect(duplicate.state).toBe(after);
    reject(after, authority, 'different-choice', 'already-acquired', acquire('two-units'));
    reject(after, authority, 'choice', 'receipt-conflict', acquire('one-unit'));
  });
  it('holds two unique owned instances on full seats; claiming never takes another share or ID', () => {
    const { state, authority } = setup();
    const full = commit(state, authority, 'fill', acquire('fill'));
    const held = commit(full, authority, 'reward', acquire('two-units'));
    expect(held.held).toHaveLength(2);
    expect(new Set(held.held.map(h => h.kind === 'unit' && h.unit.id)).size).toBe(2);
    expect(held.pool.available.maddie).toBe(full.pool.available.maddie - 2);
    const again = commit(held, authority, 'try-full', { kind: 'claim', seatId: 'seat-0', holdingId: held.held[0].id, full: 'hold' });
    expect(again.held).toEqual(held.held); expect(again.pool).toEqual(held.pool);
    reject(held, authority, 'reject-full', 'full-seat', { kind: 'claim', seatId: 'seat-0', holdingId: held.held[0].id, full: 'reject' });
    const vacated = commit(held, authority, 'away', { kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-1', rounds: 2 });
    const claimed = commit(vacated, authority, 'claim', { kind: 'claim', seatId: 'seat-0', holdingId: held.held[0].id, full: 'reject' });
    const unit = held.held[0]; expect(unit.kind).toBe('unit');
    expect(claimed.seats[0].preparation.units.some(u => unit.kind === 'unit' && u.id === unit.unit.id)).toBe(true);
    expect(claimed.pool).toEqual(held.pool); expect(claimed.seats[0].nextUnitSerial).toBe(held.seats[0].nextUnitSerial);
  });
  it('rejects a full acquisition and rolls back a partially planned item/unit batch', () => {
    const { state, authority } = setup();
    const full = commit(state, authority, 'fill', acquire('fill'));
    reject(full, authority, 'reward', 'full-seat', acquire('two-units', 'reject'));
    reject(state, authority, 'middle', 'invalid-target', acquire('bad-middle'));
    reject(state, authority, 'late', 'unknown-unit', acquire('equipment-tools'), acquire('two-units'),
      { kind: 'hold-unit', seatId: 'seat-0', unitId: 'missing', rounds: 1 });
  });
  it('pool exhaustion in the second acquisition rolls back the first share and all allocated IDs', () => {
    const { state, boundary } = setup();
    const authority: OwnershipAuthority = { grants: [{ id: 'too-many', seatId: 'seat-0',
      resources: Array.from({ length: boundary.pool.initial.caitlyn + 1 }, () => ({ kind: 'unit' as const, definitionId: 'caitlyn' })) }] };
    reject(state, authority, 'empty', 'pool-empty', acquire('too-many'));
  });
  it('temporary absence carries the same unit, equipped items, star and binding; no active trait/population', () => {
    const { boundary, authority } = setup();
    const unit = boundary.states[0].preparation.units.find(u => u.id === 'unit-1')!;
    const equippedBoundary: OwnershipBoundary = { ...boundary, states: boundary.states.map((s, i) => i ? s : {
      ...s, items: [{ id: 'item-1', definitionId: 'bow', location: { kind: 'unit', unitId: unit.id, slot: 0 } }], nextItemSerial: 2,
      anomalyBinding: { definitionId: 'test-mechanism-only', unitId: unit.id, choiceId: 'verified-boundary', boundRound: 1 },
      preparation: { ...s.preparation, units: s.preparation.units.map(u => u.id === unit.id ? { ...u, location: { kind: 'board', cell: { col: 0, row: 4 } } } : u) },
    }) };
    const state = createOwnershipState(equippedBoundary);
    const away = commit(state, authority, 'away', { kind: 'hold-unit', seatId: 'seat-0', unitId: unit.id, rounds: 2 });
    expect(away.seats[0].preparation.units.filter(u => u.team === 'player')).toEqual([]);
    expect(deriveTraits(away.seats[0].preparation, 'player').every(t => t.count === 0 && t.tier === 0)).toBe(true); expect(away.seats[0].items).toEqual([]);
    expect(away.seats[0].anomalyBinding).toEqual(state.seats[0].anomalyBinding);
    reject(away, authority, 'early', 'not-returnable', { kind: 'claim', seatId: 'seat-0', holdingId: away.held[0].id, full: 'hold' });
    reject(away, authority, 'copy-absent', 'unknown-duplicator', { kind: 'duplicate', seatId: 'seat-0', unitId: unit.id, duplicatorId: 'missing', full: 'hold' });
    const one = commit(away, authority, 'round-1', settle(1)); expect(one.held).toHaveLength(1);
    const returned = commit(one, authority, 'round-2', settle(2)); expect(returned.held).toEqual([]);
    expect(returned.seats[0].preparation.units.find(u => u.id === unit.id)?.definitionId).toBe(unit.definitionId);
    expect(returned.seats[0].items).toEqual(state.seats[0].items); expect(returned.pool).toEqual(state.pool);
    expect(restoreOwnership(serializeOwnership(away, equippedBoundary, authority, away.transactions), equippedBoundary, authority, away.transactions)).toEqual(away);
  });
  it('Q3 expires into continuing custody on full seats and returns the same instance after space opens', () => {
    const { state, authority } = setup();
    const away = commit(state, authority, 'away', { kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-1', rounds: 1 });
    const full = commit(away, authority, 'fill', acquire('fill'), acquire('one-unit'));
    const expired = commit(full, authority, 'round-1', settle(1)); expect(expired.held).toHaveLength(1);
    const opened = commit(expired, authority, 'away-other', { kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-2', rounds: 2 });
    const returned = commit(opened, authority, 'claim', { kind: 'claim', seatId: 'seat-0', holdingId: away.held[0].id, full: 'hold' });
    expect(returned.seats[0].preparation.units.some(u => u.id === 'unit-1')).toBe(true);
    expect(returned.pool).toEqual(opened.pool);
  });
  it.each(['2-3', '6-7'])('Q3 counts the next round after %s, including carousel or overtime', last => {
    const { state, authority } = setup(last);
    const away = commit(state, authority, 'away', { kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-1', rounds: 1 });
    const returned = commit(away, authority, 'next', settle(state.settledOrdinal + 1));
    expect(returned.held).toEqual([]);
    const repeated = commit(returned, authority, 'repeat-step', settle(returned.settledOrdinal));
    expect(repeated.seats).toEqual(returned.seats); expect(repeated.pool).toEqual(returned.pool);
    reject(returned, authority, 'jump', 'invalid-round', settle(returned.settledOrdinal + 2));
  });
  it('equipment and duplicators have unique hold/return paths and held tools cannot be spent', () => {
    const { state, authority } = setup();
    const acquired = commit(state, authority, 'tools', acquire('equipment-tools'));
    const held = commit(acquired, authority, 'hold', { kind: 'hold-item', seatId: 'seat-0', itemId: 'item-1' },
      { kind: 'hold-duplicator', seatId: 'seat-0', duplicatorId: 'duplicator-1' });
    expect(held.seats[0].items).toEqual([]); expect(held.seats[0].duplicators).toEqual([]);
    reject(held, authority, 'use-held', 'unknown-duplicator', { kind: 'duplicate', seatId: 'seat-0', unitId: 'unit-1', duplicatorId: 'duplicator-1', full: 'hold' });
    const returned = commit(held, authority, 'return', ...held.held.map(h => ({ kind: 'claim' as const, seatId: 'seat-0', holdingId: h.id, full: 'reject' as const })));
    expect(returned.seats).toEqual(acquired.seats); expect(returned.held).toEqual([]);
  });
  it('a manual duplicator births a fresh 1-star share with no equipment copying and consumes once', () => {
    const { state, authority } = setup();
    const acquired = commit(state, authority, 'tools', acquire('equipment-tools'));
    const original = acquired.seats[0].preparation.units.find(u => u.id === 'unit-1')!;
    expect(UNIT_DEFINITIONS[original.definitionId].cost).toBeLessThanOrEqual(3);
    const use: OwnershipOperation = { kind: 'duplicate', seatId: 'seat-0', unitId: original.id, duplicatorId: 'duplicator-1', full: 'hold' };
    const snapshot = structuredClone(acquired);
    expect(previewDuplicator(freeze(acquired), 'seat-0', 'duplicator-1', original.id, 'hold')).toEqual({ ok: true, definitionId: original.definitionId, destination: 'preparation' });
    expect(acquired).toEqual(snapshot);
    const copied = commit(acquired, authority, 'copy', use);
    expect(copied.seats[0].duplicators).toEqual([]); expect(copied.seats[0].nextUnitSerial).toBe(acquired.seats[0].nextUnitSerial + 1);
    expect(copied.pool.available[original.definitionId]).toBe(acquired.pool.available[original.definitionId] - 1);
    expect(copied.seats[0].preparation.units.find(u => u.id === 'unit-2')).toMatchObject({ definitionId: original.definitionId, starLevel: 1 });
    expect(copied.seats[0].items).toEqual(acquired.seats[0].items);
    reject(copied, authority, 'copy-again', 'unknown-duplicator', use);
  });
  it('full-seat duplicate rejects without spending, or holds its uniquely owned result', () => {
    const { state, authority } = setup();
    const full = commit(state, authority, 'fill-tools', acquire('fill'), acquire('equipment-tools'));
    reject(full, authority, 'rejected-copy', 'full-seat', { kind: 'duplicate', seatId: 'seat-0', unitId: 'unit-1', duplicatorId: 'duplicator-1', full: 'reject' });
    expect(previewDuplicator(full, 'seat-0', 'duplicator-1', 'unit-1', 'reject')).toEqual({ ok: false, reason: 'full-seat' });
    expect(previewDuplicator(full, 'seat-0', 'duplicator-1', 'unit-1', 'hold')).toMatchObject({ ok: true, destination: 'holding' });
    const held = commit(full, authority, 'held-copy', { kind: 'duplicate', seatId: 'seat-0', unitId: 'unit-1', duplicatorId: 'duplicator-1', full: 'hold' });
    expect(held.held).toHaveLength(1); expect(held.seats[0].duplicators).toEqual([]);
  });
  it('rejects a higher-cost manual target and an absent target without spending a tool', () => {
    const { state, authority } = setup();
    const auth: OwnershipAuthority = { grants: [...authority.grants, { id: 'expensive', seatId: 'seat-0', resources: [{ kind: 'unit', definitionId: 'caitlyn' }] }] };
    const acquired = commit(state, auth, 'tools-high', acquire('equipment-tools'), acquire('expensive'));
    reject(acquired, auth, 'high', 'invalid-target', { kind: 'duplicate', seatId: 'seat-0', unitId: 'unit-2', duplicatorId: 'duplicator-1', full: 'hold' });
    const away = commit(acquired, auth, 'away', { kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-1', rounds: 1 });
    reject(away, auth, 'absent', 'unknown-unit', { kind: 'duplicate', seatId: 'seat-0', unitId: 'unit-1', duplicatorId: 'duplicator-1', full: 'hold' });
  });
  it('object/JSON restore replays real held identities and exactly the same continuation/events', () => {
    const { state, authority, boundary } = setup();
    const full = commit(state, authority, 'fill-tools', acquire('fill'), acquire('equipment-tools'));
    const held = commit(full, authority, 'reward', acquire('two-units'));
    for (const candidate of [held, serializeOwnership(held, boundary, authority, held.transactions)]) {
      const restored = restoreOwnership(candidate, boundary, authority, held.transactions);
      expect(restored).toEqual(held);
      const tx: OwnershipTransaction = { id: 'away', operations: [{ kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-1', rounds: 1 }] };
      expect(transactOwnership(restored, tx, authority)).toEqual(transactOwnership(held, tx, authority));
      expect(transactOwnership(restored, { id: 'reward', operations: [acquire('two-units')] }, authority)).toEqual({ ok: true, state: restored, events: [] });
    }
  });
  it('candidate receipts and coordinated deletions cannot authorize another acquisition', () => {
    const { state, authority, boundary } = setup();
    const held = commit(commit(state, authority, 'fill', acquire('fill')), authority, 'reward', acquire('two-units'));
    const bad = structuredClone(held); (bad.acquiredGrantIds as string[]).pop();
    expect(() => restoreOwnership(bad, boundary, authority, held.transactions)).toThrow();
    const omitted = structuredClone(held); (omitted.held as unknown[]).pop();
    expect(() => restoreOwnership(omitted, boundary, authority, held.transactions)).toThrow();
    const edited = structuredClone(held); (edited.transactions as OwnershipTransaction[]).push({ id: 'regrant', operations: [acquire('two-units')] });
    expect(() => restoreOwnership(edited, boundary, authority, held.transactions)).toThrow();
    expect(() => restoreOwnership(held, boundary, { grants: [] }, held.transactions)).toThrow();
    expect(() => restoreOwnership(state, boundary, authority, held.transactions)).toThrow();
    const noFacts = { ...held, transactions: [] }; expect(() => restoreOwnership(noFacts, boundary, authority, held.transactions)).toThrow();
    const changedPlan = { grants: authority.grants.map(g => g.id === 'two-units' ? { ...g, resources: [{ kind: 'unit' as const, definitionId: 'lux' }] } : g) };
    expect(() => restoreOwnership(held, boundary, changedPlan, held.transactions)).toThrow();
  });
  it.each([3, 9])('explicit live merges preserve %i source shares; selling returns them once', copies => {
    const { state, authority, boundary } = setup();
    const auth: OwnershipAuthority = { grants: [...authority.grants, { id: 'copies', seatId: 'seat-0',
      resources: Array.from({ length: copies }, () => ({ kind: 'unit' as const, definitionId: 'maddie' })) }] };
    const acquired = commit(state, auth, 'copies', acquire('copies'));
    const merged = commit(acquired, auth, 'merge', { kind: 'merge-live', seatId: 'seat-0' });
    const unit = merged.seats[0].preparation.units.find(u => u.definitionId === 'maddie')!;
    expect(unit.starLevel).toBe(copies === 3 ? 2 : 3);
    expect(merged.pool.holdings.find(h => h.seatId === 'seat-0' && h.unitId === unit.id)?.sources).toHaveLength(copies);
    const held = commit(merged, auth, 'away-star', { kind: 'hold-unit', seatId: 'seat-0', unitId: unit.id, rounds: 1 });
    expect(held.held[0]).toMatchObject({ kind: 'unit', unit: { id: unit.id, starLevel: unit.starLevel } });
    expect(held.pool).toEqual(merged.pool);
    const returned = commit(held, auth, 'round', settle(1));
    expect(returned.seats[0].preparation.units.find(u => u.id === unit.id)?.starLevel).toBe(unit.starLevel);
    const sold = commit(returned, auth, 'sell', { kind: 'sell', seatId: 'seat-0', unitId: unit.id });
    expect(sold.pool.available.maddie).toBe(state.pool.available.maddie);
    expect(sold.seats[0].gold - state.seats[0].gold).toBe(copies);
    reject(sold, auth, 'sell-again', 'unknown-unit', { kind: 'sell', seatId: 'seat-0', unitId: unit.id });
    expect(restoreOwnership(serializeOwnership(sold, boundary, auth, sold.transactions), boundary, auth, sold.transactions)).toEqual(sold);
  });
  it('Q3 forbids selling, equipping and merging held units; active merges inherit equipment', () => {
    const { state, authority } = setup();
    const a = commit(state, authority, 'items-units', acquire('equipment-tools'), acquire('two-units'));
    const equipped = commit(a, authority, 'equip', { kind: 'equip', seatId: 'seat-0', unitId: 'unit-2', itemId: 'item-1', slot: 0 });
    const away = commit(equipped, authority, 'away', { kind: 'hold-unit', seatId: 'seat-0', unitId: 'unit-2', rounds: 2 });
    reject(away, authority, 'sell-away', 'unknown-unit', { kind: 'sell', seatId: 'seat-0', unitId: 'unit-2' });
    reject(away, authority, 'equip-away', 'invalid-target', { kind: 'equip', seatId: 'seat-0', unitId: 'unit-2', itemId: 'item-1', slot: 0 });
    reject(away, authority, 'strip-away', 'unknown-item', { kind: 'hold-item', seatId: 'seat-0', itemId: 'item-1' });
    const thirdAuth = { grants: [...authority.grants, { id: 'third', seatId: 'seat-0', resources: [{ kind: 'unit' as const, definitionId: 'maddie' }] }] };
    const more = commit(away, thirdAuth, 'third', acquire('third'), { kind: 'merge-live', seatId: 'seat-0' });
    expect(more.held).toEqual(away.held);
    expect(more.seats[0].preparation.units.filter(u => u.definitionId === 'maddie').every(u => u.starLevel === 1)).toBe(true);
    const returned = commit(more, thirdAuth, 'return', settle(1), settle(2), { kind: 'merge-live', seatId: 'seat-0' });
    const merged = returned.seats[0].preparation.units.find(u => u.definitionId === 'maddie')!;
    expect(merged.starLevel).toBe(2);
    expect(returned.seats[0].items[0].location).toMatchObject({ kind: 'unit', unitId: merged.id });
    const sold = commit(returned, thirdAuth, 'sell', { kind: 'sell', seatId: 'seat-0', unitId: merged.id });
    expect(sold.seats[0].items[0]).toMatchObject({ id: 'item-1', location: { kind: 'inventory' } });
  });
  it('selling or deploying opens a slot and claims existing custody without new shares', () => {
    const { state, authority } = setup();
    const full = commit(state, authority, 'full', acquire('fill'), acquire('two-units'));
    const first = full.held[0]; expect(first.kind).toBe('unit');
    const after = commit(full, authority, 'sell-and-claim', { kind: 'sell', seatId: 'seat-0', unitId: 'unit-1' });
    expect(after.held).toHaveLength(1);
    expect(after.seats[0].preparation.units.some(u => first.kind === 'unit' && u.id === first.unit.id)).toBe(true);
    expect(after.seats[0].nextUnitSerial).toBe(full.seats[0].nextUnitSerial);
    const boardUnit = after.seats[0].preparation.units.find(u => u.team === 'player' && u.location.kind === 'board')!;
    // Move to occupied bench: a swap opens no capacity, so no duplicate claim.
    const swapped = commit(after, authority, 'deploy', { kind: 'deploy', seatId: 'seat-0', unitId: boardUnit.id, location: { kind: 'bench', slot: 0 } });
    expect(swapped.held).toHaveLength(1); expect(swapped.pool).toEqual(after.pool);
  });
  it('an unknown grant and unknown operation fail as a whole', () => {
    const { state, authority } = setup();
    reject(state, authority, 'untrusted', 'unauthorized-grant', acquire('invented'));
    reject(state, authority, 'invalid-round', 'invalid-round', { kind: 'settle', roundId: 'missing' });
    reject(state, authority, 'missing-policy', 'invalid-transaction', { kind: 'acquire', grantId: 'two-units' } as OwnershipOperation);
    reject(state, authority, 'bad-op', 'invalid-transaction', { kind: 'invented', seatId: 'seat-0' } as unknown as OwnershipOperation);
  });
});

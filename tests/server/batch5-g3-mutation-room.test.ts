import { afterAll, expect, it } from 'vitest';
import { SEATS, TIMINGS, runUntilClaiming, claimAllOrbs } from './helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { getDeploymentCap } from '../../src/simulation/match';
import { augmentNeedsHistory } from '../../src/simulation/augment-history-owners';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { proposeSettlement } from '../../src/simulation/two-sided-battle';
import { readG23Progress } from '../../src/simulation/g2-3-state';
import { rewardPlan, mutationLabsExpected } from '../fixtures/m5/augment-rewards-oracle.cjs';
import type { MatchState } from '../../src/simulation/match-types';

const clock = new ManualClock();
const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' as const })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, roomId: 'test-room', seed: 42, clock, resolver: new TwoSidedBattleResolver() });
const match = (id: string) => room.state.seats.find(s => s.seatId === id)!.match;
const experiment = (id: string) => UNIT_DEFINITIONS[id]?.traits.includes('experiment');
let seatId: string, donorId: string, donorItems: MatchState['items'];
afterAll(() => room.dispose());

/** Real finite-pool purchases only; budgets are counts of commands, not seed scans. */
function recruit(id: string, count: number): void {
  for (let attempts = 0; attempts < 18; attempts++) {
    const state = match(id), owned = new Set(state.preparation.units.filter(u => u.team === 'player' && experiment(u.definitionId)).map(u => u.definitionId));
    if (owned.size >= count) return;
    const slot = state.shop.slots.findIndex(s => s.status === 'available' && experiment(s.definitionId) && !owned.has(s.definitionId) && UNIT_DEFINITIONS[s.definitionId].cost <= state.gold);
    if (slot >= 0) { const r = room.handle(id, { type: 'buy', slot, generation: state.shop.generation }); expect(r, r.ok ? '' : r.reason).toMatchObject({ ok: true }); }
    else {
      expect(state.gold).toBeGreaterThanOrEqual(2);
      expect(room.handle(id, { type: 'reroll' })).toMatchObject({ ok: true });
    }
  }
  throw new Error(`could not recruit ${count} different Experiments for ${id}`);
}
function field(id: string, unitId: string, col: number, row: number): void {
  const state = match(id), moving = state.preparation.units.find(u => u.id === unitId)!;
  if (moving.location.kind === 'bench' && state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= getDeploymentCap(state)) {
    const other = state.preparation.units.find(u => u.team === 'player' && u.location.kind === 'board' && u.id !== unitId && u.id !== donorId && u.definitionId !== 'trainer-golem')!;
    expect(room.handle(id, { type: 'deploy', unitId: other.id, target: { kind: 'bench', slot: moving.location.slot } })).toMatchObject({ ok: true });
  }
  const occupant = match(id).preparation.units.find(u => u.location.kind === 'board' && u.location.cell.col === col && u.location.cell.row === row && u.id !== unitId);
  if (occupant?.definitionId === 'trainer-golem') expect(room.handle(id, { type: 'deploy', unitId: occupant.id, target: { kind: 'board', cell: { col: 6, row: 7 } } })).toMatchObject({ ok: true });
  const r = room.handle(id, { type: 'deploy', unitId, target: { kind: 'board', cell: { col, row } } }); expect(r, r.ok ? '' : r.reason).toMatchObject({ ok: true });
}
it('starts the online mutation route', () => { room.start(); });
for (const round of ['1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1']) it(`reaches ${round} through the room`, () => {
  runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation');
  if (round === '2-1') for (const seat of room.state.seats) {
    const c = match(seat.seatId).pendingChoice!;
    const definitionId = c.offers.find(id => !augmentNeedsHistory(id))!; expect(definitionId).toBeDefined();
    expect(room.handle(seat.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId })).toMatchObject({ ok: true });
  }
});
it('fields real Experiments before the 3-2 tailored offer snapshot', () => {
  for (const seat of room.state.seats.filter(s => s.alive)) {
    recruit(seat.seatId, 1);
    const unit = match(seat.seatId).preparation.units.find(u => u.team === 'player' && experiment(u.definitionId))!;
    field(seat.seatId, unit.id, 0, 4);
  }
});
it('reaches 3-2 and finds an offered mutation with the permitted one-reroll-per-slot commands', () => {
  runUntilClaiming(room, clock, s => s.roundId === '3-2' && s.phase === 'preparation');
  for (const seat of room.state.seats.filter(s => s.alive)) {
    for (let slot = 0; slot < 3 && !room.state.seats.some(s => s.match.pendingChoice?.offers.includes('natural-selection')); slot++) {
      const choice = match(seat.seatId).pendingChoice!;
      expect(room.handle(seat.seatId, { type: 'rerollAugment', choiceId: choice.choiceId, generation: choice.generation, optionIndex: slot })).toMatchObject({ ok: true });
    }
  }
  const owner = room.state.seats.find(s => s.match.pendingChoice?.offers.includes('natural-selection'));
  expect(owner).toBeDefined(); if (!owner) throw new Error('mutation absent from real room offers'); seatId = owner.seatId;
});
it('chooses mutation, grants exactly three independently derived Experiments, and deploys/equips the sacrifice', () => {
  for (const u of match(seatId).preparation.units.filter(u => u.location.kind === 'bench' && !experiment(u.definitionId))) expect(room.handle(seatId, { type: 'sell', unitId: u.id })).toMatchObject({ ok: true });
  const choice = match(seatId).pendingChoice!;
  expect(room.handle(seatId, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'natural-selection' })).toMatchObject({ ok: true });
  const owned = match(seatId).augments.find(a => a.definitionId === 'natural-selection')!;
  const expected = rewardPlan({ ...match(seatId), augments: [owned] }, {}).gifts;
  expect(expected).toHaveLength(3);
  for (const gift of expected) {
    expect(experiment(gift.definitionId)).toBe(true);
    expect(match(seatId).seatMechanics!.receipts).toContainEqual(expect.objectContaining({ receiptId: gift.receiptId, definitionId: gift.definitionId, kind: 'unit' }));
  }
  claimAllOrbs(room, [seatId]); claimAllOrbs(room, [seatId]); recruit(seatId, 3);
  const units = match(seatId).preparation.units.filter(u => u.team === 'player' && experiment(u.definitionId));
  donorId = units[0].id;
  const different = new Map(units.filter(u => u.definitionId !== units[0].definitionId).map(u => [u.definitionId, u]));
  const receivers = [...different.values()].slice(0, 2); expect(receivers).toHaveLength(2);
  const wanted = new Set([donorId, ...receivers.map(u => u.id)]);
  for (const u of match(seatId).preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && !wanted.has(u.id) && u.definitionId !== 'trainer-golem')) {
    const slot = Array.from({ length: 9 }, (_, i) => i).find(i => !match(seatId).preparation.units.some(b => b.location.kind === 'bench' && b.location.slot === i))!;
    expect(room.handle(seatId, { type: 'deploy', unitId: u.id, target: { kind: 'bench', slot } })).toMatchObject({ ok: true });
  }
  field(seatId, donorId, 3, 6);
  const labs = mutationLabsExpected(readG23Progress(match(seatId))!.seed, 3);
  expect(labs.length).toBeGreaterThanOrEqual(2); expect(labs).not.toContainEqual({ col: 3, row: 6 });
  for (const [index, u] of receivers.entries()) field(seatId, u.id, labs[index].col, labs[index].row);
  expect(match(seatId).seatMechanics!.seat.experimentCells).toEqual(labs);
  const loose = match(seatId).items.find(i => i.location.kind === 'inventory');
  expect(loose).toBeDefined();
  expect(room.handle(seatId, { type: 'equip', itemId: loose!.id, unitId: donorId, slot: 0 })).toMatchObject({ ok: true });
  donorItems = match(seatId).items.filter(i => i.location.kind === 'unit' && i.location.unitId === donorId);
  expect(donorItems.length).toBeGreaterThan(0);
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  for (const encode of [(s: unknown) => s, (s: unknown) => JSON.stringify(s), (s: unknown) => canonicalContent(s)]) {
    expect(restoreSharedOrbSnapshot(room.state.pool, encode(match(seatId)), room.augmentHistoryAuthority(seatId))).toEqual(match(seatId));
    const bad: any = structuredClone(match(seatId)); bad.seatMechanics.receipts.find((r: any) => r.receiptId === expected[0].receiptId).definitionId = 'darius';
    expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(bad), room.augmentHistoryAuthority(seatId))).toThrow();
  }
});
it('excludes the donor from real online combat without a death, preserves its items and authenticates donation', () => {
  runUntilClaiming(room, clock, s => s.roundId === '3-2' && s.phase === 'settlement');
  const result = room.state.battles.find(b => b.kind === 'two-sided' && b.participants.includes(seatId));
  expect(result?.kind).toBe('two-sided'); if (!result || result.kind !== 'two-sided') throw new Error('no mutation battle');
  const battle = result.battle, combatId = battle.mapping.find(m => m.seatId === seatId && m.originalId === donorId)!.combatId;
  expect(battle.initial.units.some(u => u.id === combatId)).toBe(false); expect(battle.terminal.units.some(u => u.id === combatId)).toBe(false);
  expect(battle.events.some(e => e.type === 'death' && e.unitId === combatId)).toBe(false);
  expect(battle.initial.units.some(u => u.mechanics?.some(m => m.mechanic === 'g23Experiment'))).toBe(true);
  expect(match(seatId).preparation.units.some(u => u.id === donorId)).toBe(true);
  expect(match(seatId).items.filter(i => i.location.kind === 'unit' && i.location.unitId === donorId)).toEqual(donorItems);
  expect(proposeSettlement(JSON.parse(JSON.stringify(battle)))).toEqual(result.proposals);
  // structuredClone(battle) preserves shared initial/terminal mechanics: mutating one would also
  // forge the trusted replay baseline. A serialized battle has independent copies at that boundary.
  const forged = JSON.parse(JSON.stringify(battle));
  const initialText = canonicalContent(forged.initial);
  forged.terminal.units.find((u: any) => u.mechanics?.some((m: any) => m.mechanic === 'g23Experiment')).mechanics.find((m: any) => m.mechanic === 'g23Experiment').values.zyra++;
  expect(canonicalContent(forged.initial)).toBe(initialText);
  for (const input of [forged, JSON.parse(JSON.stringify(forged)), JSON.parse(canonicalContent(forged))]) {
    expect(() => proposeSettlement(input)).toThrow('invalid-result');
  }
});
it('returns the sacrificed unit with its equipment on the next online preparation and round-trips the save', () => {
  runUntilClaiming(room, clock, s => s.roundId === '3-3' && s.phase === 'preparation');
  expect(match(seatId).preparation.units.find(u => u.id === donorId)).toMatchObject({ location: { kind: 'board', cell: { col: 3, row: 6 } } });
  expect(match(seatId).items.filter(i => i.location.kind === 'unit' && i.location.unitId === donorId)).toEqual(donorItems);
  for (const input of [match(seatId), JSON.stringify(match(seatId)), canonicalContent(match(seatId))]) expect(restoreSharedOrbSnapshot(room.state.pool, input, room.augmentHistoryAuthority(seatId))).toEqual(match(seatId));
});

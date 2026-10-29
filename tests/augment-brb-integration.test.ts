import { afterAll, expect, it, vi } from 'vitest';
// D2 is deliberately unregistered in production. Only this isolated module graph
// adds its declaration/tier, so selection and restore use genuine public commands.
vi.mock('../src/simulation/content/augments', async importOriginal => {
  const original = await importOriginal<typeof import('../src/simulation/content/augments')>();
  const { BRB_DEFINITION } = await import('../src/simulation/content/augment-brb');
  const { 'manaflow-ii': replaced, ...definitions } = original.AUGMENT_DEFINITIONS;
  return { ...original, AUGMENT_DEFINITIONS: { ...definitions, brb: BRB_DEFINITION } };
});
vi.mock('../src/simulation/content/augment-policy', async importOriginal => {
  const original = await importOriginal<typeof import('../src/simulation/content/augment-policy')>();
  const { 'manaflow-ii': replaced, ...tiers } = original.AUGMENT_TIERS;
  return { ...original, AUGMENT_TIERS: { ...tiers, brb: 'gold' } };
});
import { sellPendingCarouselUnit } from '../src/simulation/carousel';
import { validateB8Resources } from '../src/simulation/b8-restore';
import { brbGiftPlan, brbShopDisabled } from '../src/simulation/augment-brb';
import { buyUnit, buyXp, deployMatchUnit, nextRound, openAnvil, rerollShop, sellUnit, setShopLock, startMatchCombat, selectChoice, type MatchState } from '../src/simulation/match';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { firstNodeSeed } from './augment-stage-helpers';
import { accepted, emptyBoard, finish, reachRound, resolveM5Choices } from './match-helpers';
import { roomOffer } from './augment-pool-batch5-h12-helpers';
import { runUntil } from './server/helpers';

let chosen: MatchState;
const gifts = (s: MatchState) => s.seatMechanics?.receipts.filter(r => r.receiptId.includes('"brb"')) ?? [];
it('selects BRB through the public command with no immediate gift and authenticates its acquisition', () => {
  const before = reachRound('2-1', false, firstNodeSeed('brb', 1000));
  const c = before.pendingChoice!;
  chosen = accepted(selectChoice(before, c.choiceId, c.generation, 'brb'));
  expect(brbShopDisabled(chosen)).toBe(true); expect(gifts(chosen)).toHaveLength(0);
  expect(chosen.augmentHistory!.facts).toContainEqual(expect.objectContaining({ kind: 'acquire', definitionId: 'brb', round: 4 }));
  expect(restoreMatch(serializeMatch(chosen))).toEqual(chosen);
});
it('keeps formation editable, auto-fields the offline bench, advances three rounds, then grants two usable anvils once', () => {
  let state = chosen;
  for (let offset = 0; offset < 3; offset++) {
    expect(state.round).toBe(4 + offset); expect(brbShopDisabled(state)).toBe(true);
    const unit = state.preparation.units.find(u => u.team === 'player')!;
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: 2, row: 4 } }));
    state = emptyBoard(state);
    for (const r of [buyUnit(state, 0, state.shop.generation), buyXp(state), rerollShop(state), sellUnit(state, unit.id), setShopLock(state, true, state.shop.generation)]) {
      expect(r).toMatchObject({ ok: false, reason: 'wrong-phase' }); expect(r.state).toBe(state);
    }
    const before = state;
    state = accepted(startMatchCombat(state));
    expect(state.combatInputBasis!.inputs.preparation.units.some(u => u.team === 'player' && u.location.kind === 'board')).toBe(true);
    state = resolveM5Choices(finish(state));
    expect(gifts(state)).toHaveLength(0);
    state = accepted(nextRound(state, state.round));
    expect(state.shop.generation).toBeGreaterThan(before.shop.generation);
    expect(state.level * 100 + state.xp).toBeGreaterThan(before.level * 100 + before.xp);
  }
  expect(state.roundDefinitionId).toBe('2-4'); expect(brbShopDisabled(state)).toBe(false);
  expect(gifts(state)).toHaveLength(2);
  expect(new Set(gifts(state).map(r => r.receiptId)).size).toBe(2);
  expect(drainBatch1Gifts(state)).toEqual(state);
  state = resolveM5Choices(state);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  // Exercise resource admission directly too: a forged ordinary hero cannot
  // borrow BRB's supply-round anvil exception even before history validation.
  const fakeHero = structuredClone(state);
  (fakeHero.seatMechanics!.receipts.find(r => r.receiptId.includes('"brb"')) as any).definitionId = 'irelia';
  expect(() => validateB8Resources(fakeHero)).toThrow(/Invalid anvil birth/);
  state = accepted(nextRound(state, state.round)); // Existing anvils open on the next non-supply round.
  const anvil = state.preparation.units.find(u => u.definitionId === 'TFT_ArmoryKeyCompleted')!;
  expect({ phase: state.phase, pending: state.pendingChoice?.kind, hp: state.playerHp }).toEqual({ phase: 'preparation', pending: undefined, hp: state.playerHp });
  state = accepted(openAnvil(state, anvil.id)); expect(state.pendingChoice!.offers).toHaveLength(4);
  state = resolveM5Choices(state);
  expect(gifts(state)).toHaveLength(2); expect(rerollShop(state).ok).toBe(true); expect(buyXp(state).ok).toBe(true);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  const bad = structuredClone(state); (bad.seatMechanics!.receipts.find(r => r.receiptId.includes('"brb"')) as any).definitionId = 'TFT_ArmoryKeyOrnn';
  for (const input of [() => bad, () => JSON.stringify(bad), () => serializeMatch(bad)]) expect(() => restoreMatch(input())).toThrow();
});
it('retains a full-bench entitlement, retries after space opens, and never rewards an elimination during BRB', () => {
  // Isolated capacity/elimination vectors; the real selection/round traversal is tested above.
  const due = { ...chosen, round: 7 };
  const army = Array.from({ length: 9 }, (_, slot) => ({ id: `capacity-${slot}`, definitionId: 'irelia', starLevel: 1 as const, team: 'player' as const, location: { kind: 'bench' as const, slot } }));
  let state = drainBatch1Gifts({ ...due, preparation: { ...due.preparation, units: army } });
  expect(gifts(state)).toHaveLength(0); expect(brbGiftPlan(state)).toHaveLength(2);
  state = accepted(deployMatchUnit(state, army[0].id, { kind: 'board', cell: { col: 2, row: 4 } }));
  expect(gifts(state)).toHaveLength(1);
  state = accepted(deployMatchUnit(state, army[1].id, { kind: 'board', cell: { col: 3, row: 4 } }));
  expect(gifts(state)).toHaveLength(2); expect(drainBatch1Gifts(state)).toEqual(state);
  expect(brbGiftPlan({ ...due, roundResults: [...chosen.roundResults, { ...chosen.roundResults.at(-1)!, round: 6, hpAfter: 0 }] })).toEqual([]);
});

let ctx: ReturnType<typeof roomOffer>;
afterAll(() => {
  ctx?.room.dispose();
  vi.doUnmock('../src/simulation/content/augments');
  vi.doUnmock('../src/simulation/content/augment-policy');
});
it('finds a real room offer in the bounded public seed search', () => { ctx = roomOffer('brb'); });
for (const roundId of ['1-3', '1-4', '2-1']) it(`reaches ${roundId} on normal deadlines`, () => {
  runUntil(ctx.room, ctx.clock, s => s.roundId === roundId && s.phase === 'preparation');
});
it('real Room accepts a pending-choice deployment, selects BRB and preserves atomic shop refusals', () => {
  const { room, seatId } = ctx;
  const get = () => room.state.seats.find(s => s.seatId === seatId)!.match;
  const unit = get().preparation.units.find(u => u.team === 'player')!;
  expect(room.handle(seatId, { type: 'deploy', unitId: unit.id, target: { kind: 'board', cell: { col: 2, row: 4 } } })).toMatchObject({ ok: true });
  const c = get().pendingChoice!;
  expect(room.handle(seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'brb' })).toMatchObject({ ok: true });
  expect(room.handle(seatId, { type: 'deploy', unitId: unit.id, target: { kind: 'bench', slot: 8 } })).toMatchObject({ ok: true });
  for (const command of [{ type: 'buy' as const, slot: 0, generation: get().shop.generation }, { type: 'reroll' as const }, { type: 'buyXp' as const }, { type: 'sell' as const, unitId: unit.id }, { type: 'shopLock' as const, locked: true, generation: get().shop.generation }]) {
    const before = room.state;
    expect(room.handle(seatId, command)).toMatchObject({ ok: false, reason: 'wrong-phase' }); expect(room.state).toBe(before);
  }
  const refusedHeldSale = sellPendingCarouselUnit(room.state.pool, get(), unit.id);
  expect(refusedHeldSale).toMatchObject({ ok: false, reason: 'wrong-phase' });
  expect(refusedHeldSale.state).toBe(get()); expect(refusedHeldSale.pool).toBe(room.state.pool);
  expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(get()), room.augmentHistoryAuthority(seatId))).toEqual(get());
});
for (const roundId of ['2-2', '2-3', '2-4']) it(`real deadlines, auto-deployment and settlement reach ${roundId} without a room fault`, () => {
  const { room, clock, seatId } = ctx;
  runUntil(room, clock, s => s.roundId === roundId && (s.phase === 'preparation' || s.phase === 'carousel'));
  const state = room.state.seats.find(s => s.seatId === seatId)!.match;
  expect(room.state.fault).toBeNull(); expect(brbShopDisabled(state)).toBe(roundId !== '2-4');
  expect(gifts(state)).toHaveLength(roundId === '2-4' ? 2 : 0);
  if (roundId === '2-2') expect(state.preparation.units.some(u => u.team === 'player' && u.location.kind === 'board')).toBe(true);
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(state), room.augmentHistoryAuthority(seatId))).toEqual(state);
});
it('keeps the normal carousel walk and automatic timeout pick alive', () => {
  const { room, clock, seatId } = ctx;
  expect(room.state.phase).toBe('carousel');
  const release = room.state.carousel!.startedAt + room.state.carousel!.state.releaseAtMs[seatId];
  clock.advance(Math.max(0, release - clock.now()));
  expect(room.walkLegend(seatId, { scene: 'carousel', to: { x: 0.5, y: 0.5 } })).toMatchObject({ ok: true });
  runUntil(room, clock, s => s.roundId === '2-5' && s.phase === 'preparation');
  expect(room.state.fault).toBeNull();
  const state = room.state.seats.find(s => s.seatId === seatId)!.match;
  expect(state.carousel!.receipts.some(r => r.carouselId.endsWith(':carousel:2-4'))).toBe(true);
  expect(gifts(state)).toHaveLength(2);
});

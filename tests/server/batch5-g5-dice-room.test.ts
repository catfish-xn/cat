import { createRequire } from 'node:module';
import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { findG5RoomOffer } from '../augment-pool-batch5-g5-helpers';
import { freeRerollsAvailable } from '../../src/simulation/free-rerolls';
import { expectedUnexpectednessRolls, batch5G5GiftPlan } from '../../src/simulation/augment-pool-batch5-g5';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { runSharedMatchCommand } from '../../src/simulation/shared-pool';
import * as m5Oracle from '../fixtures/m5/oracle.g2.cjs';
import { CATALOG, ROUNDS, freeRerollCredits } from '../fixtures/m5/oracle.g2.cjs';
import { rewardPlan, validateRewards } from '../fixtures/m5/augment-rewards-oracle.cjs';

const require = createRequire(import.meta.url), oracle = require('../fixtures/m5/augment-batch5-g5-oracle.cjs');
const pools = require('../augment-reward-pools-oracle-data.cjs').pools;
const route = findG5RoomOffer('expected-unexpectedness', s => oracle.expectedRolls(s)[0].rerolls === 7);
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: route.seed });
afterAll(() => room.dispose());
const mine = () => room.state.seats.find(s => s.seatId === route.seatId)!.match;
// runNext drains every callback at one clock time, including eight PvE jobs.
// Keep every real scheduler callback/result and pause only between those jobs.
function pveCheckpoints(roundId: string) {
  it(`freezes ${roundId} before resolving the eight PvE seats`, () => {
    for (let fired = 0; room.state.phase !== 'frozen' && fired < 2_000; fired++)
      expect(clock.fireNext()).toBe(true);
    expect(room.state.roundId).toBe(roundId);
    expect(room.state.phase).toBe('frozen');
    expect(room.state.fault).toBeNull();
  });
  for (let callback = 1; callback <= 8; callback++) it(`advances ${roundId} PvE scheduler callback ${callback}/8`, () => {
    if (room.state.phase === 'frozen') expect(clock.fireNext()).toBe(true);
    expect(room.state.roundId).toBe(roundId);
    expect(room.state.fault).toBeNull();
  });
}
it('starts the room', () => { room.start(); });
for (const [previous, roundId] of [['1-2','1-3'], ['1-3','1-4'], ['1-4','2-1']]) {
  pveCheckpoints(previous);
  it(`enters ${roundId} through the real room scheduler`, () => {
    runUntil(room, clock, s => s.roundId === roundId && s.phase === 'preparation');
  });
}
it('selects B5-82 through a real offered card, grants seven credits and pays no gold for its first reroll', () => {
  for (let slot = 0; slot < route.rerolls; slot++) {
    const c = mine().pendingChoice!;
    expect(room.handle(route.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
  }
  const before = mine(), c = before.pendingChoice!; expect(c.offers).toContain('expected-unexpectedness');
  const selected = runSharedMatchCommand(room.state.pool, before, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'expected-unexpectedness' });
  expect(selected.ok).toBe(true); if (!selected.ok) throw new Error(selected.reason);
  validateRewards(before, selected.state, { type: 'select', choiceId: c.choiceId, generation: c.generation, definitionId: 'expected-unexpectedness' }, selected.events, m5Oracle);
  expect(room.handle(route.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'expected-unexpectedness' })).toMatchObject({ ok: true });
  expect(freeRerollsAvailable(mine())).toBe(7); expect(mine().gold).toBe(before.gold);
  const gold = mine().gold, generation = mine().shop.generation;
  expect(room.handle(route.seatId, { type: 'reroll' })).toMatchObject({ ok: true });
  expect(mine().shop.generation).toBe(generation + 1); expect(mine().gold).toBe(gold); expect(freeRerollsAvailable(mine())).toBe(6);
  const current = mine(), pool = room.state.pool;
  const stale = runSharedMatchCommand(pool, current, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'expected-unexpectedness' });
  expect(stale.ok).toBe(false); expect(stale.state).toBe(current); expect(stale.pool).toBe(pool);
  expect(restoreSharedOrbSnapshot(pool, JSON.stringify(current), room.augmentHistoryAuthority(route.seatId))).toEqual(current);
  expect(() => restoreSharedOrbSnapshot(pool, current)).toThrow('missing independent server authority');
});
for (const roundId of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '4-1']) {
  if (roundId === '3-1') pveCheckpoints('2-7');
  if (roundId === '4-1') pveCheckpoints('3-7');
  it(`enters ${roundId}; only 3-1/4-1 add one dice result`, () => {
    runUntil(room, clock, s => s.roundId === roundId && (roundId.endsWith('-4') || s.phase === 'preparation'));
    const s = mine(), expected = oracle.expectedRolls(s);
    expect(expectedUnexpectednessRolls(s)).toHaveLength(Number(roundId[0]) - 1);
    expect(expectedUnexpectednessRolls(s).map(r => [r.dice, r.band])).toEqual(expected.map((r: any) => [r.dice, r.band]));
    const gifts = batch5G5GiftPlan(s), plan = rewardPlan(s, { CATALOG, ROUNDS, pools });
    for (const gift of gifts) expect(s.seatMechanics?.receipts).toContainEqual(expect.objectContaining({ receiptId: gift.receiptId, definitionId: gift.definitionId }));
    for (const r of plan.gold.filter(g => g.source === 'augment-pool-batch5-g5')) expect(s.seatMechanics?.receipts).toContainEqual(expect.objectContaining(r));
    expect(freeRerollCredits({ ...s, augments: s.augments.filter(a => a.definitionId === 'expected-unexpectedness') })).toBe(7);
    expect(room.state.fault).toBeNull(); assertSharedPoolConservation(room.state.pool, room.state.seats.map(x => x.match));
  });
}
it('authenticates the full online round trip and rejects owner/credit/receipt changes in object and JSON saves', () => {
  const s = mine(), authority = room.augmentHistoryAuthority(route.seatId);
  for (const input of [s, JSON.stringify(s)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, authority)).toEqual(s);
  const mutations = [
    (b: any) => { b.gold++; },
    (b: any) => { delete b.augmentHistory; },
    (b: any) => { b.seatMechanics.seat['free-shop-rerolls'].used++; },
    (b: any) => { b.seatMechanics.receipts.find((r: any) => r.source === 'augment-pool-batch5-g5').amount++; },
    (b: any) => { b.seatMechanics.receipts = b.seatMechanics.receipts.filter((r: any) => r.source !== 'augment-pool-batch5-g5'); },
    (b: any) => { b.augments = b.augments.filter((a: any) => a.definitionId !== 'expected-unexpectedness'); },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(s); mutate(bad);
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
  }
});

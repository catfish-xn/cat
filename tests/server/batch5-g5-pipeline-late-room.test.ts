import { createRequire } from 'node:module';
import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, claimAllOrbs, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { pipelineExtraOrbs, pipelineBonusPlan } from '../../src/simulation/augment-pool-batch5-g5-pipeline';
import { readLootView } from '../../src/simulation/match';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';

const require = createRequire(import.meta.url), oracle = require('../fixtures/m5/augment-batch5-g5-oracle.cjs');
// First prismatic-party candidate in the bounded 0..100 probe: s0's unrerolled 3-2 offer is Pipeline.
// v26 D5 (7953c99a) and the 14.24 neutrals moved the room draws (old seed 28). Re-probed room seeds 0..60 on the same
// runUntil route: seed 54 is the first whose s0 (human) is offered Pipeline at 3-2 without rerolling.
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 54 });
afterAll(() => room.dispose());
const mine = () => room.state.seats.find(s => s.seatId === 's0')!.match;
it('starts the room', () => { room.start(); });
for (const roundId of ['1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '3-1', '3-2']) it(`enters ${roundId}`, () => {
  runUntil(room, clock, s => s.roundId === roundId && (roundId.endsWith('-4') || s.phase === 'preparation'));
});
it('selects B5-85 at the real 3-2 offer, fixes the late table, and schedules only 3-7', () => {
  const c = mine().pendingChoice!; expect(c.offers).toContain('prismatic-pipeline');
  expect(room.handle('s0', { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'prismatic-pipeline' })).toMatchObject({ ok: true });
  expect(mine().augments.find(a => a.definitionId === 'prismatic-pipeline')!.acquiredRound).toBe(12);
  expect(pipelineExtraOrbs(mine())).toEqual([]); expect(pipelineBonusPlan(mine())).toEqual([]);
});
for (const roundId of ['3-3', '3-4', '3-5', '3-6', '3-7']) it(`enters ${roundId} and buys a legal PvE army`, () => {
  runUntil(room, clock, s => s.roundId === roundId && (roundId === '3-4' || s.phase === 'preparation'));
  if (room.state.phase !== 'preparation') return;
  answerOpenChoices(room); claimAllOrbs(room, ['s0']);
  for (let buys = 0; buys < 5; buys++) {
    const s = mine(), slot = s.shop.slots.findIndex(o => o.status === 'available' && UNIT_DEFINITIONS[o.definitionId].cost <= s.gold);
    if (slot < 0 || s.preparation.units.filter(u => u.team === 'player').length >= 8) break;
    expect(room.handle('s0', { type: 'buy', slot, generation: s.shop.generation })).toMatchObject({ ok: true });
  }
});
it('loses 3-7 and carries the pipeline orb to 4-7', () => {
  const extra = pipelineExtraOrbs(mine()); expect(extra).toHaveLength(1); expect(extra[0].roundId).toBe('3-7');
  expect(extra).toEqual(oracle.pipelineOrbs(mine())); const orbId = extra[0].orbId;
  runUntil(room, clock, s => s.roundId === '3-7' && s.phase === 'settlement');
  // v26 PvE loot carryover (8f794062, docs/CURSOR_pve-loot-carryover.md): s0's bought army now loses the 14.24 wolves
  // (568eeea4), so every unkilled 3-7 drop, including Pipeline's extra orb, is carried to the next PvE, 4-7, where the
  // orb becomes claimable from the start of preparation. (v25: s0 won 3-7 and claimed it in 3-7 settlement.)
  expect(mine().roundResults.at(-1)).toMatchObject({ roundId: '3-7', result: 'enemyWin' });
  expect(readLootView(mine()).unclaimedOrbs?.some(o => o.orbId === orbId)).toBe(false);
  const carried = (mine().m8.loot.carry ?? []).filter(row => extra[0].entries.some(entry => entry.dropId === row.dropId));
  expect(carried.map(row => row.deliverRoundId)).toEqual(extra[0].entries.map(() => '4-7'));
});
// One case used to play 4-1..4-6 inside the claim (local ~3.4s, over the 5s limit once CI shares the machine).
// Same room and source order as the earlier `enters` cases: each round is its own case, and the claim case only
// walks 4-6 → 4-7. v26 carryover (8f794062) is why the claim is no longer inside 3-7 settlement.
for (const roundId of ['4-1', '4-2', '4-3', '4-4', '4-5', '4-6']) it(`enters ${roundId} before the carried pipeline orb can be opened`, () => {
  runUntil(room, clock, s => s.roundId === roundId && (roundId.endsWith('-4') || s.phase === 'preparation'));
  const extra = pipelineExtraOrbs(mine()); expect(extra).toHaveLength(1); expect(extra[0].roundId).toBe('3-7');
  expect(readLootView(mine()).unclaimedOrbs?.some(o => o.orbId === extra[0].orbId)).toBe(false);
  const carried = (mine().m8.loot.carry ?? []).filter(row => extra[0].entries.some(entry => entry.dropId === row.dropId));
  expect(carried.map(row => row.deliverRoundId)).toEqual(extra[0].entries.map(() => '4-7'));
});
it('opens the independently sampled late PvE orb and grants exactly its weighted bonus', () => {
  const extra = pipelineExtraOrbs(mine()); expect(extra).toHaveLength(1); const orbId = extra[0].orbId;
  runUntil(room, clock, s => s.roundId === '4-7' && s.phase === 'preparation');
  expect(mine().roundDefinitionId).toBe('4-7');
  expect(readLootView(mine()).unclaimedOrbs?.some(o => o.orbId === orbId)).toBe(true);
  const result = room.handle('s0', { type: 'claimOrb', round: mine().round, orbId }); expect(result).toMatchObject({ ok: true });
  const s = mine(), p = pipelineBonusPlan(s), independent = oracle.pipelineBonuses(s);
  expect(p).toHaveLength(1); expect(p[0].reward.gold).toBe(independent[0].gold);
  expect([0, 6, 16]).toContain(p[0].reward.gold); expect(p[0].reward.gold).not.toBe(8);
  for (const gift of p[0].reward.gifts) expect(['random-item', 'random-unit']).toContain(gift.kind);
  const authority = room.augmentHistoryAuthority('s0');
  expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(s), authority)).toEqual(s);
  const bad = structuredClone(s) as any; bad.augmentHistory!.facts.find((f: any) => f.kind === 'orb-opened')!.round--;
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
});

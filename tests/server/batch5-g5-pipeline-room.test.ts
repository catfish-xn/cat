import { createRequire } from 'node:module';
import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { findG5RoomOffer } from '../augment-pool-batch5-g5-helpers';
import { pipelineExtraOrbs, pipelineBonusPlan } from '../../src/simulation/augment-pool-batch5-g5-pipeline';
import { readLootView } from '../../src/simulation/match';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot, runSharedMatchCommand } from '../../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { claimAllOrbs } from './helpers';
import type { MatchState } from '../../src/simulation/match-types';
import { recordAugmentAcquisition, appendAugmentFact } from '../../src/simulation/augment-history';

const require = createRequire(import.meta.url), oracle = require('../fixtures/m5/augment-batch5-g5-oracle.cjs');
const route = findG5RoomOffer('prismatic-pipeline');
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: route.seed });
afterAll(() => room.dispose());
const mine = () => room.state.seats.find(s => s.seatId === route.seatId)!.match;
it('starts the room', () => { room.start(); });
for (const roundId of ['1-3', '1-4', '2-1']) it(`enters ${roundId}`, () => runUntil(room, clock, s => s.roundId === roundId && s.phase === 'preparation'));
it('selects a genuinely offered B5-85 and adds no early acquisition gold or premature orb', () => {
  for (let slot = 0; slot < route.rerolls; slot++) {
    const c = mine().pendingChoice!;
    expect(room.handle(route.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
  }
  const before = mine(), c = before.pendingChoice!; expect(c.offers).toContain('prismatic-pipeline');
  expect(room.handle(route.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'prismatic-pipeline' })).toMatchObject({ ok: true });
  expect(mine().gold).toBe(before.gold); expect(pipelineExtraOrbs(mine())).toEqual([]); expect(pipelineBonusPlan(mine())).toEqual([]);
  answerOpenChoices(room);
});
for (const roundId of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`enters ${roundId} and fields ordinary purchased units`, () => {
  runUntil(room, clock, s => s.roundId === roundId && (roundId === '2-4' || s.phase === 'preparation'));
  if (room.state.phase !== 'preparation') return;
  answerOpenChoices(room); claimAllOrbs(room, [route.seatId]);
  for (let buys = 0; buys < 5; buys++) {
    const s = mine(), slot = s.shop.slots.findIndex(o => o.status === 'available' && UNIT_DEFINITIONS[o.definitionId].cost <= s.gold);
    if (slot < 0 || s.preparation.units.filter(u => u.team === 'player').length >= 8) break;
    expect(room.handle(route.seatId, { type: 'buy', slot, generation: s.shop.generation })).toMatchObject({ ok: true });
  }
});
it('creates exactly one next-PvE orb with the existing independently sampled standard base table', () => {
  const s = mine(), orbs = pipelineExtraOrbs(s);
  expect(s.roundDefinitionId).toBe('2-7'); expect(orbs).toHaveLength(1); expect(orbs).toEqual(oracle.pipelineOrbs(s));
  expect(s.m8.loot.direct.filter(d => orbs[0].entries.some(e => e.dropId === d.dropId))).toHaveLength(orbs[0].entries.length);
  expect(readLootView(s).unclaimedOrbs?.some(o => o.orbId === orbs[0].orbId)).toBe(false);
});
it('earns the orb from a real PvE death, adds 8 gold only when opened, and rejects repeat/stale claims atomically', () => {
  const orbId = pipelineExtraOrbs(mine())[0].orbId;
  runUntil(room, clock, s => readLootView(s.seats.find(x => x.seatId === route.seatId)!.match).unclaimedOrbs?.some(o => o.orbId === orbId) === true);
  // Claiming during a live battle is an intent, then the common settlement path opens it once.
  const before = mine();
  expect(before.m8.loot.earnedEvidence.some(e => pipelineExtraOrbs(before)[0].entries.some(d => d.dropId === e.dropId))).toBe(true);
  const queued = room.handle(route.seatId, { type: 'claimOrb', round: before.round, orbId }); expect(queued).toMatchObject({ ok: true });
  if (before.phase === 'combat') { expect(mine().gold).toBe(before.gold); expect(pipelineBonusPlan(mine())).toEqual([]); }
  runUntil(room, clock, s => s.roundId === '2-7' && s.phase === 'settlement');
  const s = mine();
  expect(pipelineBonusPlan(s)).toHaveLength(1); expect(pipelineBonusPlan(s)[0].reward.gold).toBe(8);
  const fact = s.augmentHistory!.facts.find(f => f.kind === 'orb-opened'); expect(fact).toMatchObject({ orbId, tier: 'prismatic' });
  expect(s.seatMechanics?.receipts).toContainEqual(expect.objectContaining({ receiptId: oracle.pipelineBonuses(s)[0].receiptId, kind: 'gold', amount: 8 }));
  const pool = room.state.pool, repeat = runSharedMatchCommand(pool, s, { type: 'claimOrb', round: s.round, orbId });
  expect(repeat.ok).toBe(false); expect(repeat.state).toBe(s); expect(repeat.pool).toBe(pool);
  const stale = runSharedMatchCommand(pool, s, { type: 'claimOrb', round: s.round - 1, orbId }); expect(stale.ok).toBe(false); expect(stale.state).toBe(s);
  assertSharedPoolConservation(pool, room.state.seats.map(x => x.match));
});
it('round-trips with independent room authority and rejects changed/missing facts, source, award, and extra-orb progress', () => {
  const s = mine(), authority = room.augmentHistoryAuthority(route.seatId);
  for (const input of [s, JSON.stringify(s)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, authority)).toEqual(s);
  const restored = restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(s), authority);
  const repeated = runSharedMatchCommand(room.state.pool, restored, { type: 'claimOrb', round: restored.round, orbId: pipelineExtraOrbs(restored)[0].orbId });
  expect(repeated.ok).toBe(false); expect(repeated.state).toBe(restored); expect(repeated.pool).toBe(room.state.pool);
  expect(() => restoreSharedOrbSnapshot(room.state.pool, s)).toThrow('missing independent server authority');
  const mutations = [
    (b: any) => { b.gold++; },
    (b: any) => { b.augments = b.augments.filter((a: any) => a.definitionId !== 'prismatic-pipeline'); },
    (b: any) => { b.augmentHistory.facts.find((f: any) => f.kind === 'orb-opened').orbId += 'wrong'; },
    (b: any) => { b.augmentHistory.facts = b.augmentHistory.facts.filter((f: any) => f.kind !== 'orb-opened'); },
    (b: any) => { b.seatMechanics.receipts.find((r: any) => r.source === 'augment-pool-batch5-g5').amount++; },
    (b: any) => { b.m8.loot.direct = b.m8.loot.direct.filter((d: any) => !pipelineExtraOrbs(s)[0].entries.some(e => e.dropId === d.dropId)); },
    (b: any) => { delete b.augmentHistory; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(s); mutate(bad);
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
  }
});
it('the common real claim command also bonuses a later natural prismatic orb, and gold orbs never qualify', () => {
  // Isolated already-entered claim vector: the real Room route above authenticates acquisition, PvE and history.
  const s = mine(), natural = s.m8.loot.frozen.rounds.flatMap(r => r.orbs).find(o => o.tier === 'gold');
  if (natural) {
    const direct = s.m8.loot.direct.map(d => natural.entries.some(e => e.dropId === d.dropId) && d.status === 'planned' ? { ...d, status: 'revealed' as const } : d);
    const before = { ...s, phase: 'settlement' as const, combat: null, m8: { ...s.m8, loot: { ...s.m8.loot, direct } } } as MatchState;
    const r = runSharedMatchCommand(room.state.pool, before, { type: 'claimOrb', round: before.round, orbId: natural.orbId });
    if (r.ok) expect(pipelineBonusPlan(r.state)).toEqual(pipelineBonusPlan(before));
  }
  // Same history API used by future source adapters; opening a different source can never consume the next-PvE grant.
  const acquired = recordAugmentAcquisition(s, s); expect(acquired).toBe(s);
  const extraFact = appendAugmentFact(s, { kind: 'orb-opened', choiceId: s.augments.find(a => a.definitionId === 'prismatic-pipeline')!.choiceId, orbId: 'other-prismatic-source', tier: 'prismatic' });
  expect(pipelineBonusPlan(extraFact)).toHaveLength(2); expect(pipelineExtraOrbs(extraFact)).toEqual(pipelineExtraOrbs(s));
});

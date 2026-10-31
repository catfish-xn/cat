import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';
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
import * as m5Oracle from '../fixtures/m5/oracle.g2.cjs';
import { validateRewards } from '../fixtures/m5/augment-rewards-oracle.cjs';

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
describe('2-7 orb queued in the next 3-1 battle', () => {
  // 14.24 neutrals (568eeea4) + PvE loot carryover (8f794062): on the old route (seed 16, s2) the 2-7 source survives, so the
  // pipeline orb is carried to 3-7 instead of being claimable at 3-1. Seed 38, s0 still kills it at 2-7.
  const reviewRoute = findG5RoomOffer('prismatic-pipeline', s => s.augmentTierSeed === 38 && s.multiplayer?.seatId === 's0');
  const session = makeRoom(new TwoSidedBattleResolver(), { seed: reviewRoute.seed });
  const current = () => session.room.state.seats.find(s => s.seatId === reviewRoute.seatId)!.match;
  afterAll(() => session.room.dispose());
  let orbId: string, before: MatchState;
  it('starts the review room', () => { session.room.start(); });
  for (const roundId of ['1-3', '1-4', '2-1']) it(`enters ${roundId}`, () => {
    runUntil(session.room, session.clock, s => s.roundId === roundId && s.phase === 'preparation');
  });
  it('selects the actually offered augment', () => {
    for (let slot = 0; slot < reviewRoute.rerolls; slot++) {
      const c = current().pendingChoice!;
      expect(session.room.handle(reviewRoute.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
    }
    const choice = current().pendingChoice!;
    expect(choice.offers).toContain('prismatic-pipeline');
    expect(session.room.handle(reviewRoute.seatId, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'prismatic-pipeline' })).toMatchObject({ ok: true });
    answerOpenChoices(session.room);
  });
  for (const roundId of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`enters ${roundId} and fields units`, () => {
    runUntil(session.room, session.clock, s => s.roundId === roundId && (roundId === '2-4' || s.phase === 'preparation'));
    if (session.room.state.phase !== 'preparation') return;
    answerOpenChoices(session.room); claimAllOrbs(session.room, [reviewRoute.seatId]);
    for (let buys = 0; buys < 5; buys++) {
      const s = current(), slot = s.shop.slots.findIndex(o => o.status === 'available' && UNIT_DEFINITIONS[o.definitionId].cost <= s.gold);
      if (slot < 0 || s.preparation.units.filter(u => u.team === 'player').length >= 8) break;
      expect(session.room.handle(reviewRoute.seatId, { type: 'buy', slot, generation: s.shop.generation })).toMatchObject({ ok: true });
    }
  });
  it('leaves the earned orb unclaimed after 2-7', () => {
    orbId = oracle.pipelineOrbs(current())[0].orbId;
    runUntil(session.room, session.clock, s => s.roundId === '2-7' && s.phase === 'settlement');
  });
  it('enters 3-1 with that orb still available', () => {
    runUntil(session.room, session.clock, s => s.roundId === '3-1' && s.phase === 'preparation');
    expect(readLootView(current()).unclaimedOrbs).toEqual(expect.arrayContaining([expect.objectContaining({ orbId, queued: false })]));
  });
  it('queues it during the locked 3-1 battle without paying', () => {
    runUntil(session.room, session.clock, s => s.roundId === '3-1' && s.phase === 'battle');
    const preClaim = current();
    expect(preClaim.multiplayer?.combatRosterLocked).toBe(true);
    const queued = session.room.handle(reviewRoute.seatId, { type: 'claimOrb', round: preClaim.round, orbId });
    expect(queued).toMatchObject({ ok: true, events: [] });
    before = current();
    expect(before.m8.loot.queuedOrbClaims).toEqual([orbId]);
    expect(before.gold).toBe(preClaim.gold); expect(pipelineBonusPlan(before)).toEqual([]);
  });
  it('authenticates the settlement, reward and queue origin', () => {
    runUntil(session.room, session.clock, s => s.roundId === '3-1' && s.phase === 'settlement');
    const seat = session.room.state.seats.find(s => s.seatId === reviewRoute.seatId)!, after = seat.match, events = seat.serverEvents!.events;
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'roundSettled', round: before.round })]));
    expect(after.m8.loot.queuedOrbClaims ?? []).toEqual([]);
    expect(oracle.pipelineBonuses(after)).toEqual([expect.objectContaining({ round: before.round, gold: 8 })]);
    expect(after.seatMechanics?.receipts).toContainEqual(expect.objectContaining({ receiptId: oracle.pipelineBonuses(after)[0].receiptId, kind: 'gold', amount: 8 }));
    const checkRewards = (state: MatchState, ev = events) => validateRewards(before, state, null, ev, {
      ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(before.m8.loot.receipts.length),
    });
    expect(() => checkRewards(after)).not.toThrow();
    const amount = 2 + m5Oracle.benchXp(before), expectedXp = m5Oracle.xp(before.level, before.xp, amount);
    expect([after.level, after.xp]).toEqual([expectedXp.level, expectedXp.xp]);
    const forgedXp = structuredClone(after) as any, extraXp = m5Oracle.xp(before.level, before.xp, amount + 1);
    forgedXp.level = extraXp.level; forgedXp.xp = extraXp.xp;
    Object.assign(forgedXp.roundResults.at(-1), { xpRequested:amount + 1, xpAwarded:extraXp.xpApplied, levelAfter:extraXp.level, xpAfter:extraXp.xp });
    expect(() => checkRewards(forgedXp)).toThrow(/independent XP state/);
    expect(() => oracle.validatePipelineClaim(before, after, null, events)).not.toThrow();
    const noQueue = { ...before, m8: { ...before.m8, loot: { ...before.m8.loot, queuedOrbClaims: [] } } };
    expect(() => oracle.validatePipelineClaim(noQueue, after, null, events)).toThrow();
    expect(() => oracle.validatePipelineClaim(before, after, null, events.filter(e => e.type !== 'roundSettled'))).toThrow();
    const queueRemains = { ...after, m8: { ...after.m8, loot: { ...after.m8.loot, queuedOrbClaims: [orbId] } } };
    expect(() => oracle.validatePipelineClaim(before, queueRemains, null, events)).toThrow(/drains the claim queue/);
    const alteredEvents = structuredClone(events) as any[];
    const grant = alteredEvents.find(e => e.type === 'lootGranted' && JSON.parse(e.receipt.dropId)[0] === orbId);
    expect(grant).toBeDefined(); grant.receipt.payload.quantity++;
    expect(() => oracle.validatePipelineClaim(before, after, null, alteredEvents)).toThrow(/loot event must match/);
    const bad = structuredClone(after) as any;
    bad.augmentHistory.facts.find((f: any) => f.kind === 'orb-opened').orbId += '-forged';
    expect(() => oracle.validatePipelineClaim(before, bad, null, events)).toThrow();
  });
});

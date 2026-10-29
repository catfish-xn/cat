import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { createMatch } from '../src/simulation/match';
import { appendAugmentFact, recordAugmentAcquisition } from '../src/simulation/augment-history';
import { pipelineExtraOrbs, pipelineBonusPlan, pipelineBonusForTicket, recordPipelineOpening } from '../src/simulation/augment-pool-batch5-g5-pipeline';
import { batch5G5GiftPlan } from '../src/simulation/augment-pool-batch5-g5';
import { augmentPool, CATALOG, ROUNDS } from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import type { MatchState } from '../src/simulation/match-types';

const require = createRequire(import.meta.url), oracle = require('./fixtures/m5/augment-batch5-g5-oracle.cjs');
const pools = require('./augment-reward-pools-oracle-data.cjs').pools;
function ownerAt(round: number, seed = 0): MatchState {
  const initial = enableMultiplayerSettlement(createMatch(seed), 's0');
  if (!initial.ok) throw new Error(initial.reason);
  const before = { ...initial.state, round, roundDefinitionId: round === 4 ? '2-1' : '3-2' };
  return recordAugmentAcquisition(before, { ...before, augments: [{ definitionId: 'prismatic-pipeline', choiceId: `round:${before.roundDefinitionId}:augment`, acquiredRound: round }] });
}
it('B5-85 is prismatic at 2-1/3-2 and retains the 14.24 4-2 ban', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    expect(augmentOfferAllowed('prismatic-pipeline', [], { node, fieldedTraits: [], blocked: [] })).toBe(node !== '4-2');
    expect(augmentPool('prismatic', [], [], `round:${node}:augment`, []).includes('prismatic-pipeline')).toBe(node !== '4-2');
    expect(augmentPool('gold', [], [], `round:${node}:augment`, []).includes('prismatic-pipeline')).toBe(false);
  }
});
it('the late bonus has exactly 34/33/33 integer weight slots; early always has eight gold', () => {
  const counts = { gold: 0, components: 0, heroes: 0 };
  for (let ticket = 0; ticket < 100; ticket++) {
    expect(pipelineBonusForTicket(true, ticket)).toEqual({ gold: 8, gifts: [] });
    const r = pipelineBonusForTicket(false, ticket);
    if (r.gold === 16) { counts.gold++; expect(r.gifts).toEqual([]); }
    else if (r.gold === 0) { counts.components++; expect(r.gifts).toEqual([{ kind: 'random-item', pool: 'component', count: 2 }]); }
    else { counts.heroes++; expect(r).toEqual({ weight: 33, gold: 6, gifts: [{ kind: 'random-unit', cost: 5, count: 2 }] }); }
  }
  expect(counts).toEqual({ gold: 34, components: 33, heroes: 33 });
  expect(() => pipelineBonusForTicket(false, 100)).toThrow();
});
it('independently derives the extra base orb and every bonus without reading production reward receipts', () => {
  const seen = new Set<number>();
  for (const acquiredRound of [4, 12]) for (let seed = 0; seed <= 100; seed++) {
    let state = ownerAt(acquiredRound, seed);
    expect(pipelineExtraOrbs(state)).toEqual([]);
    state = { ...state, round: 17, roundDefinitionId: '3-7', m8: { ...state.m8, loot: prepareMatchLoot(seed, 17, state.m8.loot) } };
    expect(pipelineExtraOrbs(state)).toEqual(oracle.pipelineOrbs(state));
    const owner = state.augments[0], orbId = pipelineExtraOrbs(state)[0].orbId;
    const rng = state.rngState, loot = state.m8.loot;
    state = appendAugmentFact(state, { kind: 'orb-opened', choiceId: owner.choiceId, orbId, tier: 'prismatic' });
    const p = pipelineBonusPlan(state), independent = oracle.pipelineBonuses(state);
    expect(p.map(p => [p.receiptId, p.round, p.reward.gold])).toEqual(independent.map((p: any) => [p.receiptId, p.round, p.gold]));
    expect(batch5G5GiftPlan(state).map(g => ({ ...g, source: 'augment-pool-batch1', starLevel: g.starLevel ?? 1 })))
      .toEqual(rewardPlan(state, { CATALOG, ROUNDS, pools }).gifts);
    if (acquiredRound === 12) seen.add(p[0].reward.gold);
    expect(state.rngState).toBe(rng); expect(state.m8.loot).toBe(loot);
  }
  expect([...seen].sort((a, b) => a - b)).toEqual([0, 6, 16]);
});
it('opening history is created only once, after a complete prismatic opening while already owning the augment', () => {
  const owned = ownerAt(4), changed = { ...owned, gold: owned.gold + 1 }, orb = { orbId: 'source-independent-orb', tier: 'prismatic' };
  expect(recordPipelineOpening(owned, changed, orb, true)).toBe(changed);
  expect(recordPipelineOpening(owned, owned, orb, false)).toBe(owned);
  expect(recordPipelineOpening(owned, changed, { ...orb, tier: 'gold' }, false)).toBe(changed);
  const plain = createMatch(0);
  expect(recordPipelineOpening(plain, owned, orb, false)).toBe(owned);
  const opened = recordPipelineOpening(owned, changed, orb, false);
  expect(opened.augmentHistory!.facts.filter(f => f.kind === 'orb-opened')).toHaveLength(1);
  expect(recordPipelineOpening(opened, { ...opened }, orb, false).augmentHistory).toBe(opened.augmentHistory);
});

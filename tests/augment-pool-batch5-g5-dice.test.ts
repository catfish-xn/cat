import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import type { MatchState } from '../src/simulation/match-types';
import { createMatch } from '../src/simulation/match';
import { expectedDiceBand, expectedUnexpectednessRolls, batch5G5GiftPlan, expectedUnexpectednessRerolls } from '../src/simulation/augment-pool-batch5-g5';
import { EXPECTED_UNEXPECTEDNESS_REWARDS } from '../src/simulation/content/augment-pool-batch5-g5';
import { augmentPool, CATALOG, ROUNDS, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { fullBench } from './tp-helpers';
import { recordAugmentAcquisition } from '../src/simulation/augment-history';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { validateBatch1Gifts } from '../src/simulation/restore-checks/batch1-gifts-check';

const require = createRequire(import.meta.url);
const independent = require('./fixtures/m5/augment-batch5-g5-oracle.cjs');
const pools = require('./augment-reward-pools-oracle-data.cjs').pools;
it('B5-82 is prismatic and offered only at 2-1, independently in the oracle', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    expect(augmentOfferAllowed('expected-unexpectedness', [], { node, fieldedTraits: [], blocked: [] })).toBe(node === '2-1');
    expect(augmentPool('prismatic', [], [], `round:${node}:augment`, []).includes('expected-unexpectedness')).toBe(node === '2-1');
    expect(augmentPool('gold', [], [], `round:${node}:augment`, []).includes('expected-unexpectedness')).toBe(false);
  }
});
it('keeps an anvil reward pending on a full online bench while gold and tools are granted and authenticated', () => {
  const full = fullBench().state, before = { ...full, round: 4, roundDefinitionId: '2-1' };
  let candidate: MatchState | undefined;
  // Isolated capacity vector, not an offer/restore fixture. The room suite covers the actual scheduled acquisition.
  for (let i = 0; i <= 100; i++) {
    const owned = { ...before, augments: [{ definitionId: 'expected-unexpectedness', choiceId: `capacity:${i}`, acquiredRound: 4 }] };
    if (independent.expectedRolls(owned)[0].band === 'forge') { candidate = recordAugmentAcquisition(before, owned); break; }
  }
  expect(candidate).toBeDefined(); const state = drainBatch1Gifts(candidate!);
  const anvil = batch5G5GiftPlan(state).find(g => g.kind === 'unit')!;
  expect(state.seatMechanics?.receipts.some(r => r.receiptId === anvil.receiptId)).toBe(false);
  expect(state.consumables.filter(c => c.definitionId === 'reforger')).toHaveLength(3);
  expect(state.gold).toBe(before.gold + 2);
  expect(() => validateBatch1Gifts(state)).not.toThrow();
});
it('classifies every 3d6 combination, including all six triples before looking at the sum', () => {
  const counts = { economy: 0, units: 0, forge: 0, equipment: 0, jackpot: 0 };
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const band = expectedDiceBand([a, b, c]); counts[band]++;
    if (a === b && b === c) expect(band).toBe('jackpot');
  }
  expect(counts).toEqual({ economy: 54, units: 78, forge: 69, equipment: 9, jackpot: 6 });
  expect(() => expectedDiceBand([1, 1, 0])).toThrow();
  expect(() => expectedDiceBand([1, 1])).toThrow();
});
it('uses exactly the approved table and independently derives all dice/gifts/gold/free rolls without production receipts', () => {
  const base = createMatch(0);
  const seen = new Set<string>();
  for (let seed = 0; seed <= 100; seed++) {
    const state = { ...base, seed, round: 18, multiplayer: { seatId: 's0', status: 'active' as const, settledBattles: [] },
      augments: [{ definitionId: 'expected-unexpectedness', choiceId: 'round:2-1:augment', acquiredRound: 4 }] } as unknown as MatchState;
    const rolls = expectedUnexpectednessRolls(state), oracle = independent.expectedRolls(state);
    expect(rolls.map(r => ({ stage: r.stage, round: r.round, dice: r.dice, band: r.band, gold: r.reward.gold ?? 0, rerolls: r.reward.rerolls ?? 0 })))
      .toEqual(oracle.map((r: any) => ({ stage: r.stage, round: r.round, dice: r.dice, band: r.band, gold: r.gold, rerolls: r.rerolls })));
    const production = batch5G5GiftPlan(state).map(g => ({ ...g, source: 'augment-pool-batch1', starLevel: g.starLevel ?? 1 }));
    expect(production).toEqual(rewardPlan(state, { CATALOG, ROUNDS, pools }).gifts);
    expect(expectedUnexpectednessRerolls(state)).toBe(freeRerollCredits(state));
    for (const r of rolls) seen.add(`${r.stage}:${r.band}`);
    expect(state.rngState).toBe(base.rngState);
  }
  expect(seen.size).toBe(15);
  expect([2, 3, 4].map(s => EXPECTED_UNEXPECTEDNESS_REWARDS[s as 2 | 3 | 4].economy)).toEqual([
    { rerolls: 7, gifts: [] }, { gold: 15, gifts: [] }, { gold: 20, gifts: [] },
  ]);
});

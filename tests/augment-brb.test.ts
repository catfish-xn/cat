import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BRB_RULES, brbShopDisabled } from '../src/simulation/augment-brb';
import { BRB_DEFINITION } from '../src/simulation/content/augment-brb';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { createMatch, buyUnit, buyXp, rerollShop, sellUnit, setShopLock } from '../src/simulation/match';

it('D2 leaves BRB absent from every production candidate pool', () => {
  expect(AUGMENT_DEFINITIONS.brb).toBeUndefined();
  for (const node of ['2-1', '3-2', '4-2']) for (const tier of ['silver', 'gold', 'prismatic'] as const)
    expect(augmentCandidates(tier, [], [], null, { node, fieldedTraits: [], blocked: [] })).not.toContain('brb');
});
it('includes acquisition and every natural round, independently of combat kind', () => {
  const augments = [{ definitionId: 'brb', choiceId: 'test', acquiredRound: 4 }];
  expect([3, 4, 5, 6, 7].map(round => brbShopDisabled({ augments, round }))).toEqual([false, true, true, true, false]);
  // Isolated ordinal vectors put PvE 2-7 and carousel 3-4 inside the same three-round policy.
  for (const acquiredRound of [9, 13])
    expect([0, 1, 2, 3].map(offset => brbShopDisabled({ augments: [{ ...augments[0], acquiredRound }], round: acquiredRound + offset }))).toEqual([true, true, true, false]);
});
it('refuses every player shop command without resources, events or RNG changes', () => {
  const base = createMatch(42), state = { ...base, round: 4, augments: [{ definitionId: 'brb', choiceId: 'test', acquiredRound: 4 }] };
  for (const r of [buyUnit(state, 0, state.shop.generation), buyXp(state), rerollShop(state), sellUnit(state, 'unit-1'), setShopLock(state, true, state.shop.generation)]) {
    expect(r).toEqual({ ok: false, state, reason: 'wrong-phase' }); expect(r.state).toBe(state);
  }
});
const research = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(research))('uses the independent 14.24 BRB values and original text', () => {
  const row = JSON.parse(readFileSync(research, 'utf8')).find((r: { apiName: string }) => r.apiName === 'TFT_Augment_BRB');
  expect(BRB_DEFINITION.description).toBe(row.description_zh_cn);
  expect({ RoundsToSkip: BRB_RULES.rounds, anvils: BRB_RULES.anvils }).toEqual(row.effects);
});

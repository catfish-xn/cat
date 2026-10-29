import { expect, it } from 'vitest';
import { readAugmentGrowth } from '../src/simulation/augment-history';
import type { MatchState } from '../src/simulation/match-types';

// Isolate the persisted multiplayer merge lineage, including merges nested in one receipt.
const upgrade = (survivorId: string, consumedIds: string[], fromStar = 1) => ({
  type: 'unitUpgraded', survivorId, consumedIds, definitionId: 'lux', fromStar, toStar: fromStar + 1,
  location: {kind:'bench',slot:0},
});
function fixture(kind: string, upgrades: ReturnType<typeof upgrade>[]) {
  return {
    resourceProvenance: {entries: [{kind, upgrades, sequence:0, roundId:'2-5'}]},
    augmentHistory: {facts: [{kind:'growth', deltas: ['first','second','unrelated'].map(unitId => ({
      unitId, healthFlat:0, healthBps:0, attackDamageBps:150, abilityPowerCenti:150,
    }))}]},
  } as unknown as MatchState;
}
it.each(['carousel-preparation-settled','carousel-unit-claimed'])('%s retains two 150 grants as 300 after merging', kind => {
  const s = fixture(kind, [upgrade('first',['second','new-carousel-card'])]);
  expect(readAugmentGrowth(s,'first')).toEqual({unitId:'first',healthFlat:0,healthBps:0,attackDamageBps:300,abilityPowerCenti:300});
  expect(readAugmentGrowth(s,'first',0)).toMatchObject({attackDamageBps:150,abilityPowerCenti:150});
  expect(readAugmentGrowth(s,'new-purchase')).toMatchObject({attackDamageBps:0,abilityPowerCenti:0});
});
it.each(['carousel-preparation-settled','carousel-unit-claimed'])('%s follows recursive merges backwards through a consumed intermediate survivor', kind => {
  const s = fixture(kind, [upgrade('first',['second','new-carousel-card']), upgrade('final',['first','other-two-star'],2)]);
  const original = structuredClone(s);
  const expected={unitId:'final',healthFlat:0,healthBps:0,attackDamageBps:300,abilityPowerCenti:300};
  expect(readAugmentGrowth(s,'final')).toEqual(expected);
  expect(readAugmentGrowth(s,'final')).toEqual(expected);
  expect(s).toEqual(original);
});

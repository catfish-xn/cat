import type { CostTier } from './unit-types';
export const MATCH_RULES = Object.freeze({ initialGold: 10, rerollCost: 2, roundIncome: 5, shopSize: 5,
  initialLevel: 3, maxLevel: 9, initialHp: 100, xpPurchaseCost: 4, xpPurchaseAmount: 4, roundXp: 2 });
export const DEFAULT_MATCH_SEED = 42;
export const XP_TO_NEXT_LEVEL: Readonly<Record<number, number>> = Object.freeze({ 1:2, 2:2, 3:6, 4:10, 5:20, 6:36, 7:48, 8:76 });
export const SHOP_ODDS: Readonly<Record<number, readonly [number, number, number, number, number]>> = Object.freeze({
  1:[100,0,0,0,0], 2:[100,0,0,0,0], 3:[75,25,0,0,0], 4:[55,30,15,0,0], 5:[45,33,20,2,0],
  6:[30,40,25,5,0], 7:[19,30,40,10,1], 8:[18,25,32,22,3], 9:[15,20,25,30,10],
});
for (const row of Object.values(SHOP_ODDS)) Object.freeze(row);
export const SHOP_CATALOG_BY_COST: Readonly<Record<CostTier, readonly string[]>> = Object.freeze({
  1: Object.freeze(['darius','irelia','lux','maddie','zyra']), 2: Object.freeze(['leona','rell','tristana','urgot','vander']),
  3: Object.freeze(['ezreal','kogmaw','loris','nami','scar']), 4: Object.freeze(['corki','garen','zoe']), 5: Object.freeze(['caitlyn']),
});
export const SHOP_CATALOG: readonly string[] = Object.freeze(Object.values(SHOP_CATALOG_BY_COST).flat());
/** Standard stage damage in the frozen 14.24b reference; M5 supports stages 2–6. */
export const STAGE_PLAYER_DAMAGE: Readonly<Record<number, number>> = Object.freeze({ 2:2, 3:5, 4:8, 5:10, 6:12 });
export const ECONOMY_RULES = Object.freeze({ interestDivisor: 10, interestCap: 5, victoryGold: 1, pveFailureDamage: 3,
  streakThresholds: Object.freeze([Object.freeze({ count: 2, gold: 1 }), Object.freeze({ count: 4, gold: 2 }), Object.freeze({ count: 6, gold: 3 })]) });

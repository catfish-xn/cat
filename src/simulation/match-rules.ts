import type { CostTier } from './unit-types';
export const MATCH_RULES = Object.freeze({ initialGold: 10, rerollCost: 2, roundIncome: 5, shopSize: 5,
  initialLevel: 3, maxLevel: 9, initialHp: 100, xpPurchaseCost: 4, xpPurchaseAmount: 4, roundXp: 2 });
export const DEFAULT_MATCH_SEED = 42;
export const XP_TO_NEXT_LEVEL: Readonly<Record<number, number>> = Object.freeze({ 1:2, 2:2, 3:6, 4:10, 5:20, 6:36, 7:56, 8:80 });
export const SHOP_ODDS: Readonly<Record<number, readonly [number, number, number, number, number]>> = Object.freeze({
  1:[100,0,0,0,0], 2:[100,0,0,0,0], 3:[75,25,0,0,0], 4:[55,30,15,0,0], 5:[45,33,20,2,0],
  6:[30,40,25,5,0], 7:[19,30,40,10,1], 8:[18,25,32,22,3], 9:[10,20,25,35,10],
});
for (const row of Object.values(SHOP_ODDS)) Object.freeze(row);
export const SHOP_CATALOG_BY_COST: Readonly<Record<CostTier, readonly string[]>> = Object.freeze({
  1: Object.freeze(['sentinel','ranger','mystic']), 2: Object.freeze(['bulwark','archer']),
  3: Object.freeze(['arcanist','duelist']), 4: Object.freeze(['warden','tempest']), 5: Object.freeze(['colossus','oracle']),
});
export const SHOP_CATALOG: readonly string[] = Object.freeze(Object.values(SHOP_CATALOG_BY_COST).flat());

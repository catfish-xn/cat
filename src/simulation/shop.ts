import { MATCH_RULES, SHOP_CATALOG_BY_COST } from './match-rules';
import type { Shop, ShopSlot } from './match-types';
import type { CostTier } from './unit-types';
import { getShopOdds } from './progression';
import { nextRandom, validateSeed } from './rng';

/** Two fixed draws per slot: one cost tier, then one member of that tier. */
export function generateShop(rngState: number, generation: number, level: number): { readonly shop: Shop; readonly rngState: number } {
  validateSeed(rngState);
  if (!Number.isSafeInteger(generation) || generation < 1) throw new RangeError('Invalid shop generation');
  const odds = getShopOdds(level), slots: ShopSlot[] = [];
  for (let slot = 0; slot < MATCH_RULES.shopSize; slot++) {
    const tierDraw = nextRandom(rngState);
    let roll = Math.floor(tierDraw.word * 100 / 4294967296), tier = 0;
    while (roll >= odds[tier]) roll -= odds[tier++];
    const unitDraw = nextRandom(tierDraw.state);
    rngState = unitDraw.state;
    const catalog = SHOP_CATALOG_BY_COST[(tier + 1) as CostTier];
    slots.push({ status: 'available', definitionId: catalog[Math.floor(unitDraw.word * catalog.length / 4294967296)] });
  }
  return { shop: { generation, slots, locked: false }, rngState };
}

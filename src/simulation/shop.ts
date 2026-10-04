import { MATCH_RULES, SHOP_CATALOG } from './match-rules';
import type { Shop, ShopSlot } from './match-types';
import { nextRandom } from './rng';

export function generateShop(rngState: number, generation: number): { readonly shop: Shop; readonly rngState: number } {
  const slots: ShopSlot[] = [];
  for (let slot = 0; slot < MATCH_RULES.shopSize; slot++) {
    const next = nextRandom(rngState);
    rngState = next.state;
    slots.push({ status: 'available', definitionId: SHOP_CATALOG[Math.floor(next.word / 4294967296 * SHOP_CATALOG.length)] });
  }
  return { shop: { generation, slots }, rngState };
}

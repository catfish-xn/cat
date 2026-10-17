import { freezeContent } from './freeze';
import { ITEM_DEFINITIONS as ORDINARY } from './items';
import { G23_SPECIAL_ITEM_POOLS } from './g2-3-special-item-source';
import { G24_ARTIFACT_ITEMS } from './g2-4-artifacts';
import { G24_SUPPORT_ITEMS } from './g2-4-support-items';

/** G24-FORGE-03 (user approved): keep the 29 source identities, admit only the 21 executable artifacts.
 * Trial: likewise admit only the 13 executable supports from the intact 17-identity source pool. */
export const G24_FORGE_POOLS = freezeContent({
  TFT_ArmoryKeyCompleted: Object.values(ORDINARY).filter(item => item.kind === 'completed' && item.recipe).map(item => item.id).sort(),
  TFT_ArmoryKeySupport: G23_SPECIAL_ITEM_POOLS.SUPPORTITEMS.filter(id => Object.hasOwn(G24_SUPPORT_ITEMS, id)).sort(),
  TFT_ArmoryKeyOrnn: G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6.filter(id => Object.hasOwn(G24_ARTIFACT_ITEMS, id)).sort(),
});
export const G24_FORGE_POLICY = freezeContent({
  revision: 'g24-forge-v1', choices: 4,
  pools: G24_FORGE_POOLS,
  artifactSource: G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6,
  artifactExclusions: G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6.filter(id => !Object.hasOwn(G24_ARTIFACT_ITEMS, id)).sort(),
  supportSource: G23_SPECIAL_ITEM_POOLS.SUPPORTITEMS,
  supportExclusions: G23_SPECIAL_ITEM_POOLS.SUPPORTITEMS.filter(id => !Object.hasOwn(G24_SUPPORT_ITEMS, id)).sort(),
  deferredSelectors: [],
  sampling: 'sorted-id-uniform-without-replacement', crossOfferExclusions: false, ownedItemExclusions: false,
  timeout: 'first-offer', seed: 'g23-seed-and-atom-id-lcg32-v1',
  conventionIds: ['G24-FORGE-01', 'G24-FORGE-02', 'G24-FORGE-03', 'G24-FORGE-05', 'G24-FORGE-06', 'G24-FORGE-07'],
});
for (const pool of Object.values(G24_FORGE_POOLS)) {
  if (pool.length < G24_FORGE_POLICY.choices || new Set(pool).size !== pool.length) throw new RangeError('Invalid G24 forge pool');
}
/** Explicit selector boundary; no unimplemented/unknown selector may issue a partial or cross-category offer. */
export function resolveG24ForgePool(api: string): readonly string[] {
  if (!Object.hasOwn(G24_FORGE_POOLS, api)) throw new RangeError('Unadmitted G24 forge selector ' + api);
  return G24_FORGE_POOLS[api as keyof typeof G24_FORGE_POOLS];
}

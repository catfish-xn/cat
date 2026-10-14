import { ITEM_DEFINITIONS, COMPONENT_IDS } from './content/items';
import type { ItemDefinition } from './strategy-types';
export const COMPONENT_POOL_VERSION = 'm8b-components-v1' as const;
export const COMPONENT_POOL = Object.freeze([
  ['TFT_Item_BFSword','sword'], ['TFT_Item_ChainVest','vest'], ['TFT_Item_GiantsBelt','belt'], ['TFT_Item_NeedlesslyLargeRod','rod'],
  ['TFT_Item_NegatronCloak','cloak'], ['TFT_Item_RecurveBow','bow'], ['TFT_Item_SparringGloves','gloves'], ['TFT_Item_TearOfTheGoddess','tear'],
].map(([apiName,definitionId])=>Object.freeze({apiName,definitionId})));
export function validateComponentPool(catalog: Readonly<Record<string,ItemDefinition>> = ITEM_DEFINITIONS): void {
  const components=Object.values(catalog).filter(i=>i.kind==='component');
  if(components.length!==8 || new Set(components.map(i=>i.apiName)).size!==8 || COMPONENT_POOL.some(p=>catalog[p.definitionId]?.kind!=='component'||catalog[p.definitionId].apiName!==p.apiName))throw new RangeError('Invalid m8b-components-v1 mapping');
}
/** Exact versioned set, canonical API-name order; no RNG or resource writes. */
export function validateComponentCandidates(ids: readonly string[], version: string = COMPONENT_POOL_VERSION): void {
  validateComponentPool();
  if(version!==COMPONENT_POOL_VERSION || ids.length!==8 || ids.some((id,i)=>id!==COMPONENT_POOL[i].definitionId) || new Set(ids).size!==8)throw new RangeError('Invalid component candidates');
}
validateComponentCandidates(COMPONENT_IDS);

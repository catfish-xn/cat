import { ITEM_DEFINITIONS } from './content/items';
import { SOURCE_MANIFEST } from './content/source-manifest';
import type { ItemCatalogEntry } from './m8/ui-contracts';
/** Development catalogue revision; B9/B10 own the final M8 save/version switch. */
export type RuntimeItemCatalogEntry = Omit<ItemCatalogEntry,'contentVersion'> & { readonly contentVersion: string };
const statNames={maxHp:'最大生命',attackDamage:'攻击力',armor:'护甲',magicResist:'魔抗',initialMana:'初始法力',abilityAmount:'技能数值',abilityPower:'法强'};
export function readItemCatalog(): readonly RuntimeItemCatalogEntry[] {
 return Object.freeze(Object.values(ITEM_DEFINITIONS).sort((a,b)=>a.apiName!<b.apiName!?-1:1).map(i=>Object.freeze({
  id:i.id,apiName:i.apiName!,name:i.name,localizationStatus:'temporary-unverified' as const,kind:i.kind,recipe:i.recipe ?? null,
  effectDescriptions:Object.freeze([...i.effects.flatMap(e=>e.kind==='statFlat'?[`${statNames[e.stat]} +${e.amount}`]:e.kind==='statPercentBps'?[`${statNames[e.stat]} +${e.bps/100}%`]:e.kind==='attackSpeedBps'?[`攻速 +${e.bps/100}%`]:[]),...i.effectDescriptions ?? []]),
  unique:i.unique ?? false,slotCost:i.slotCost ?? 1,referencePatch:'14.24b' as const,contentVersion:SOURCE_MANIFEST.equipmentCatalogVersion,
  evidenceStatus:'source-reviewed' as const,conventionIds:i.conventionIds ?? [],
 })));
}

import { EMBLEM_ITEMS, CRAFTING_ITEMS } from './content/emblems';
import { G23_SPECIAL_ITEMS } from './content/g2-3-item-registry';
import type {ItemDefinition} from './strategy-types';
import { ITEM_DEFINITIONS } from './content/items';
import type { ItemCatalogEntry } from './m8/ui-contracts';
/** Same text as SOURCE_MANIFEST.equipmentCatalogVersion. The manifest's URLs, hashes and archives are not read at runtime. */
const EQUIPMENT_CATALOG_VERSION = 's13-14.24b-m8-b5-v1';
/** Development catalogue revision; B9/B10 own the final M8 save/version switch. */
export type RuntimeItemCatalogEntry = Omit<ItemCatalogEntry,'contentVersion'> & { readonly contentVersion: string };
const statNames={maxHp:'最大生命',attackDamage:'攻击力',armor:'护甲',magicResist:'魔抗',initialMana:'初始法力',abilityAmount:'技能数值',abilityPower:'法强'};
export function readItemCatalog(): readonly RuntimeItemCatalogEntry[] { return projectCatalog({...ITEM_DEFINITIONS,...CRAFTING_ITEMS,...EMBLEM_ITEMS}); }
/** Reward-only catalogue; finite passives and convention IDs are explicit. */
export function readG23RewardItemCatalog(): readonly RuntimeItemCatalogEntry[] { return projectCatalog(G23_SPECIAL_ITEMS); }
function projectCatalog(catalog:Readonly<Record<string,ItemDefinition>>): readonly RuntimeItemCatalogEntry[] {
 return Object.freeze(Object.values(catalog).sort((a,b)=>a.apiName!<b.apiName!?-1:1).map(i=>Object.freeze({
  id:i.id,apiName:i.apiName!,name:i.name,localizationStatus:'temporary-unverified' as const,kind:i.kind,recipe:i.recipe ?? null,
  effectDescriptions:Object.freeze([...i.effects.flatMap(e=>e.kind==='statFlat'?[`${statNames[e.stat]} +${e.amount}`]:e.kind==='statPercentBps'?[`${statNames[e.stat]} +${e.bps/100}%`]:e.kind==='attackSpeedBps'?[`攻速 +${e.bps/100}%`]:[]),...i.effectDescriptions ?? []]),
  unique:i.unique ?? false,slotCost:i.slotCost ?? 1,referencePatch:'14.24b' as const,contentVersion:EQUIPMENT_CATALOG_VERSION,
  evidenceStatus:i.evidenceStatus ?? 'source-reviewed' as const,conventionIds:i.conventionIds ?? [],
 })));
}

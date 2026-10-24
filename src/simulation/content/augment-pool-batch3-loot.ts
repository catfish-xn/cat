import { freezeContent } from './freeze';

/** 14.24 map22 loot tables (a-level, s13-missing-values-research-2026-10-24): GoldenEggLootDistribution A–I and
 * ExaltedAdventureLootDistribution A–F, copied with their raw float weights and apiName contents. */
export interface Batch3LootTable {
 readonly name:string; readonly weight:number; readonly Gold?:number;
 readonly Item?:readonly string[]; readonly Consumable?:readonly string[]; readonly ItemByKey?:readonly string[];
 readonly RandomUnit?:readonly string[]; readonly MeepTypeUnit?:readonly string[];
}
export const GOLDEN_EGG_LOOT:readonly Batch3LootTable[]=freezeContent([
 {
  "name": "GoldenEggLootA",
  "weight": 0.10000000149011612,
  "Gold": 60,
  "Item": [
   "TFT_Item_ForceOfNature"
  ]
 },
 {
  "name": "GoldenEggLootB",
  "weight": 0.15000000596046448,
  "Item": [
   "TFT_Item_ForceOfNature",
   "TFT_Item_ForceOfNature",
   "TFT_Item_ThiefsGloves"
  ],
  "Gold": 20
 },
 {
  "name": "GoldenEggLootC",
  "weight": 0.10000000149011612,
  "Item": [
   "TFT_Item_ForceOfNature",
   "TFT_Item_ZekesHerald",
   "TFT_Item_Chalice"
  ],
  "Gold": 25
 },
 {
  "name": "GoldenEggLootD",
  "weight": 0.10000000149011612,
  "Item": [
   "TFT4_Item_OrnnInfinityForce",
   "TFT4_Item_OrnnZhonyasParadox",
   "TFT4_Item_OrnnAnimaVisage"
  ],
  "Consumable": [
   "TFT_Consumable_NeekosHelp",
   "TFT_Consumable_ItemRemover",
   "TFT_Consumable_ItemRemover"
  ],
  "Gold": 25
 },
 {
  "name": "GoldenEggLootE",
  "weight": 0.15000000596046448,
  "Item": [
   "TFT_Item_ForceOfNature",
   "TFT5_Item_ThiefsGlovesRadiant",
   "TFT_Item_ThiefsGloves"
  ],
  "Gold": 25
 },
 {
  "name": "GoldenEggLootF",
  "weight": 0.10000000149011612,
  "ItemByKey": [
   "ORNNARTIFACTS_SET6",
   "RADIANTITEMS_SET5",
   "COMPLETEDITEMS"
  ],
  "Gold": 10,
  "Consumable": [
   "TFT_Consumable_ItemRemover"
  ],
  "Item": [
   "TFT_Item_ForceOfNature"
  ]
 },
 {
  "name": "GoldenEggLootG",
  "weight": 0.10000000149011612,
  "Item": [
   "TFT_Item_ForceOfNature"
  ],
  "Gold": 30,
  "Consumable": [
   "TFT_Consumable_NeekosHelp",
   "TFT_Consumable_NeekosHelp"
  ],
  "RandomUnit": [
   "FiveCostUnit",
   "FiveCostUnit",
   "FiveCostUnit",
   "FiveCostUnit"
  ]
 },
 {
  "name": "GoldenEggLootH",
  "weight": 0.10000000149011612,
  "ItemByKey": [
   "RADIANTITEMS_SET5",
   "RADIANTITEMS_SET5"
  ],
  "Gold": 10,
  "Item": [
   "TFT_Item_ForceOfNature"
  ]
 },
 {
  "name": "GoldenEggLootI",
  "weight": 0.10000000149011612,
  "Item": [
   "TFT_Item_InfinityEdge",
   "TFT_Item_JeweledGauntlet",
   "TFT_Item_PowerGauntlet",
   "TFT_Item_ForceOfNature",
   "TFT_Item_UnstableConcoction",
   "TFT_Item_Quicksilver"
  ],
  "Gold": 10,
  "Consumable": [
   "TFT_Consumable_ItemRemover"
  ]
 }
]);
export const EXALTED_ADVENTURE_LOOT:readonly Batch3LootTable[]=freezeContent([
 {
  "name": "AdventureLootA",
  "weight": 0.1599999964237213,
  "Item": [
   "TFT_Item_GargoyleStoneplate",
   "TFT4_Item_OrnnDeathsDefiance",
   "TFT4_Item_OrnnInfinityForce"
  ],
  "Consumable": [
   "TFT9_Consumable_GoldenItemRemover"
  ],
  "MeepTypeUnit": [
   "TFT_ArmoryKeySupport"
  ],
  "Gold": 10
 },
 {
  "name": "AdventureLootB",
  "weight": 0.1599999964237213,
  "Item": [
   "TFT_Item_ForceOfNature",
   "TFT4_Item_OrnnAnimaVisage"
  ],
  "MeepTypeUnit": [
   "TFT_ArmoryKeyCompleted",
   "TFT_ArmoryKeyCompleted"
  ],
  "Gold": 10
 },
 {
  "name": "AdventureLootC",
  "weight": 0.18000000715255737,
  "Item": [
   "TFT_Consumable_MasterworkUpgrade"
  ],
  "MeepTypeUnit": [
   "TFT_ArmoryKeyCompleted",
   "TFT_ArmoryKeySupport",
   "TFT_ArmoryKeyCompleted"
  ],
  "Consumable": [
   "TFT9_Consumable_GoldenItemRemover"
  ],
  "Gold": 10
 },
 {
  "name": "AdventureLootD",
  "weight": 0.18000000715255737,
  "Item": [
   "TFT5_Item_WarmogsArmorRadiant",
   "TFT5_Item_GiantSlayerRadiant"
  ],
  "MeepTypeUnit": [
   "TFT_ArmoryKeySupport"
  ],
  "Gold": 5,
  "Consumable": [
   "TFT_Consumable_ItemReroller",
   "TFT_Consumable_ItemReroller"
  ]
 },
 {
  "name": "AdventureLootE",
  "weight": 0.1599999964237213,
  "MeepTypeUnit": [
   "TFT_ArmoryKeyOrnn"
  ],
  "Consumable": [
   "TFT9_Consumable_GoldenItemRemover",
   "TFT_Consumable_ItemReroller"
  ],
  "Gold": 20,
  "Item": [
   "TFT5_Item_ThiefsGlovesRadiant"
  ]
 },
 {
  "name": "AdventureLootF",
  "weight": 0.1599999964237213,
  "Consumable": [
   "TFT_Consumable_ItemRemover",
   "TFT_Consumable_ItemRemover"
  ],
  "Item": [
   "TFT5_Item_CrownguardRadiant",
   "TFT_Item_Artifact_UnendingDespair",
   "TFT_Item_Moonstone"
  ],
  "Gold": 20
 }
]);

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
/** TFT9_Augment_Spoils_Tier{1,2,3}Table{0..6} (14.24 map22, a-level): [key, gold] where every key is a multiple of 3
 * up to 249 and every token is 1GOLD/2GOLD/3GOLD. P 2026-10-24 reading: key/3 is the kill ordinal (83 slots, matching the
 * 25/30/40% drop rates), one table per seat per augment, cycling after slot 83; BonusLoot{1,2,3} is not applied. */
export const SPOILS_OF_WAR_TABLES:Readonly<Record<1|2|3,readonly (readonly (readonly [number,number])[])[]>>=freezeContent({"1": [[[3, 1], [12, 1], [33, 1], [48, 1], [51, 1], [69, 1], [102, 1], [108, 1], [129, 1], [141, 1], [147, 1], [150, 1], [159, 1], [165, 1], [183, 1], [186, 1], [189, 1], [192, 1], [207, 1], [213, 1], [225, 1], [228, 1], [234, 1]], [[6, 1], [18, 1], [36, 1], [72, 1], [75, 1], [78, 1], [84, 1], [90, 1], [93, 1], [117, 1], [120, 1], [138, 1], [153, 1], [174, 1], [198, 1], [204, 1], [207, 1], [213, 1], [225, 1], [237, 1], [240, 1]], [[6, 1], [21, 1], [24, 1], [36, 1], [39, 1], [45, 1], [51, 1], [60, 1], [69, 1], [81, 1], [84, 1], [96, 1], [108, 1], [144, 1], [153, 1], [156, 1], [159, 1], [165, 1], [168, 1], [171, 1], [174, 1], [222, 1], [225, 1], [228, 1], [243, 1]], [[9, 1], [18, 1], [42, 1], [69, 1], [72, 1], [78, 1], [90, 1], [111, 1], [114, 1], [132, 1], [135, 1], [138, 1], [150, 1], [171, 1], [180, 1], [183, 3], [189, 1], [201, 1], [213, 1], [237, 1], [246, 1], [249, 1]], [[3, 1], [15, 1], [33, 1], [36, 1], [39, 1], [48, 1], [54, 1], [69, 1], [93, 1], [96, 1], [108, 1], [111, 1], [117, 1], [141, 1], [156, 1], [201, 1], [210, 1], [216, 1], [219, 1], [228, 1], [234, 1], [240, 1], [249, 1]], [[12, 1], [18, 1], [57, 1], [63, 3], [69, 1], [81, 1], [84, 1], [99, 1], [108, 1], [114, 1], [117, 1], [126, 1], [129, 1], [132, 1], [144, 1], [147, 1], [150, 1], [162, 1], [180, 1], [186, 1], [192, 1], [198, 1], [222, 1], [234, 1], [237, 1], [243, 1]], [[9, 1], [12, 1], [33, 1], [48, 1], [78, 1], [93, 1], [96, 1], [99, 1], [120, 1], [126, 1], [132, 1], [141, 1], [144, 1], [171, 1], [174, 1], [183, 1], [204, 1], [222, 1], [228, 1], [231, 1]]], "2": [[[6, 1], [18, 1], [42, 1], [51, 1], [63, 1], [75, 1], [87, 2], [105, 1], [117, 2], [126, 1], [132, 1], [141, 1], [144, 1], [168, 1], [183, 1], [186, 1], [192, 1], [201, 1], [228, 1], [246, 1]], [[9, 1], [12, 1], [15, 1], [33, 3], [39, 2], [45, 1], [57, 2], [60, 1], [69, 1], [75, 1], [96, 1], [105, 2], [108, 1], [114, 1], [117, 1], [141, 1], [162, 1], [174, 1], [180, 1], [198, 1], [201, 2], [204, 1], [219, 1], [225, 1], [237, 2], [246, 2], [249, 1]], [[3, 1], [6, 1], [24, 1], [33, 2], [36, 1], [39, 1], [54, 1], [66, 1], [84, 1], [87, 2], [90, 1], [96, 1], [99, 1], [129, 1], [132, 1], [138, 1], [144, 1], [147, 2], [150, 1], [177, 3], [189, 1], [195, 1], [198, 1], [225, 3], [228, 1], [249, 1]], [[3, 1], [12, 1], [21, 1], [24, 1], [36, 1], [51, 1], [54, 1], [60, 1], [75, 1], [105, 1], [117, 1], [120, 1], [123, 1], [138, 1], [159, 2], [162, 1], [165, 1], [174, 1], [177, 1], [183, 1], [189, 1], [192, 1], [198, 1], [201, 1], [204, 1], [216, 3], [243, 1], [249, 1]], [[3, 2], [6, 1], [12, 1], [36, 1], [45, 1], [60, 1], [63, 1], [75, 1], [78, 1], [84, 1], [99, 1], [102, 1], [114, 2], [123, 1], [129, 1], [135, 2], [147, 1], [165, 1], [177, 1], [186, 1], [192, 1], [195, 2], [204, 2], [207, 1], [216, 1], [219, 1], [222, 1], [231, 1]], [[3, 1], [9, 2], [27, 1], [36, 1], [42, 1], [51, 1], [66, 1], [78, 1], [93, 1], [105, 1], [111, 2], [117, 1], [126, 2], [132, 1], [141, 2], [144, 1], [153, 1], [159, 2], [180, 1], [216, 1], [222, 1], [225, 1], [243, 2], [246, 1]], [[6, 1], [18, 1], [21, 1], [42, 1], [57, 1], [66, 1], [75, 1], [90, 1], [96, 1], [105, 1], [129, 1], [132, 1], [135, 1], [141, 2], [153, 2], [156, 1], [165, 1], [180, 1], [186, 2], [195, 2], [201, 1], [213, 1], [234, 1], [240, 1]]], "3": [[[9, 2], [15, 1], [24, 1], [42, 1], [54, 1], [63, 1], [69, 1], [75, 1], [81, 2], [96, 1], [99, 1], [102, 1], [105, 2], [108, 1], [111, 2], [120, 1], [135, 2], [144, 1], [156, 1], [165, 1], [174, 1], [186, 1], [189, 1], [192, 1], [198, 1], [213, 1], [222, 1], [231, 1], [234, 1], [240, 1], [249, 1]], [[9, 1], [15, 1], [21, 1], [27, 1], [30, 1], [33, 1], [36, 3], [45, 1], [48, 1], [51, 1], [54, 1], [60, 2], [63, 1], [66, 1], [72, 1], [75, 1], [78, 1], [84, 1], [99, 1], [114, 1], [126, 1], [132, 1], [135, 1], [138, 1], [150, 1], [153, 1], [159, 1], [162, 1], [168, 1], [171, 1], [174, 1], [180, 1], [186, 2], [189, 2], [195, 1], [201, 1], [213, 1], [222, 1], [228, 1], [237, 1], [240, 1]], [[3, 1], [6, 1], [12, 1], [15, 1], [27, 1], [63, 1], [66, 1], [69, 1], [72, 3], [75, 2], [78, 1], [114, 1], [123, 1], [132, 1], [135, 2], [138, 1], [147, 1], [150, 1], [153, 1], [156, 1], [159, 1], [162, 1], [165, 1], [171, 2], [174, 1], [186, 1], [204, 1], [210, 1], [219, 1], [222, 1], [234, 2], [237, 3], [240, 2], [243, 1]], [[3, 1], [6, 1], [9, 1], [18, 1], [30, 1], [33, 1], [42, 1], [48, 1], [51, 1], [54, 1], [60, 1], [69, 1], [72, 1], [78, 1], [96, 1], [102, 1], [105, 1], [108, 1], [117, 1], [123, 1], [129, 1], [135, 2], [138, 1], [141, 1], [144, 1], [150, 2], [159, 1], [162, 1], [174, 2], [177, 1], [180, 2], [189, 1], [237, 1], [243, 1], [246, 1]], [[3, 1], [6, 1], [9, 2], [24, 1], [36, 2], [39, 1], [57, 1], [72, 1], [87, 1], [90, 1], [93, 1], [96, 1], [99, 2], [105, 2], [111, 1], [117, 1], [123, 1], [126, 3], [129, 1], [132, 1], [138, 1], [144, 1], [147, 2], [162, 1], [177, 1], [180, 2], [186, 1], [195, 1], [198, 2], [201, 2], [204, 2], [210, 1], [219, 1], [228, 1], [231, 1]], [[6, 1], [15, 1], [21, 1], [39, 1], [42, 1], [51, 1], [54, 2], [57, 1], [60, 1], [69, 2], [81, 1], [84, 1], [93, 1], [102, 1], [108, 1], [111, 2], [114, 1], [117, 1], [129, 1], [132, 1], [135, 1], [138, 1], [141, 1], [147, 2], [150, 1], [153, 1], [162, 2], [165, 2], [168, 2], [174, 1], [180, 2], [186, 1], [195, 1], [201, 2], [216, 1], [219, 1], [222, 1], [234, 2], [237, 1]], [[3, 1], [15, 2], [21, 3], [24, 1], [27, 1], [39, 1], [42, 1], [54, 1], [60, 2], [75, 2], [78, 2], [81, 1], [84, 1], [96, 2], [99, 1], [102, 1], [105, 1], [120, 1], [132, 1], [135, 1], [153, 1], [159, 1], [168, 1], [171, 1], [177, 1], [186, 1], [201, 1], [207, 3], [210, 1], [213, 1], [219, 1], [222, 1], [234, 1], [243, 1]]]} as any);

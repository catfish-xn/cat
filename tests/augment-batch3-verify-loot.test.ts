import { expect, it } from 'vitest';
import { GOLDEN_EGG_LOOT, EXALTED_ADVENTURE_LOOT, SPOILS_OF_WAR_TABLES } from '../src/simulation/content/augment-pool-batch3-loot';

// Hand-transcribed from augment-crossversion-research-2026-10-24/raw/common/14.24-map22.bin.json.
// Each tuple below names a record, not an implementation-derived expected value.
const crown='TFT_Item_ForceOfNature',gloves='TFT_Item_ThiefsGloves',remove='TFT_Consumable_ItemRemover';
it('GoldenEggLootDistribution {95529e6b}: nine weights and complete A-I contents',()=>{
 expect(GOLDEN_EGG_LOOT.map(x=>({...x,weight:Number(x.weight.toFixed(6))}))).toEqual([
  // {94f3596c}, {97f35e25}, {96f35c92}, {91f354b3}, {90f35320},
  // {93f357d9}, {92f35646}, {9df36797}, {9cf36604}.
  {name:'GoldenEggLootA',weight:.1,Gold:60,Item:[crown]},
  {name:'GoldenEggLootB',weight:.15,Gold:20,Item:[crown,crown,gloves]},
  {name:'GoldenEggLootC',weight:.1,Gold:25,Item:[crown,'TFT_Item_ZekesHerald','TFT_Item_Chalice']},
  {name:'GoldenEggLootD',weight:.1,Gold:25,Item:['TFT4_Item_OrnnInfinityForce','TFT4_Item_OrnnZhonyasParadox','TFT4_Item_OrnnAnimaVisage'],Consumable:['TFT_Consumable_NeekosHelp',remove,remove]},
  {name:'GoldenEggLootE',weight:.15,Gold:25,Item:[crown,'TFT5_Item_ThiefsGlovesRadiant',gloves]},
  {name:'GoldenEggLootF',weight:.1,Gold:10,ItemByKey:['ORNNARTIFACTS_SET6','RADIANTITEMS_SET5','COMPLETEDITEMS'],Consumable:[remove],Item:[crown]},
  {name:'GoldenEggLootG',weight:.1,Gold:30,Item:[crown],Consumable:['TFT_Consumable_NeekosHelp','TFT_Consumable_NeekosHelp'],RandomUnit:['FiveCostUnit','FiveCostUnit','FiveCostUnit','FiveCostUnit']},
  {name:'GoldenEggLootH',weight:.1,Gold:10,ItemByKey:['RADIANTITEMS_SET5','RADIANTITEMS_SET5'],Item:[crown]},
  {name:'GoldenEggLootI',weight:.1,Gold:10,Item:['TFT_Item_InfinityEdge','TFT_Item_JeweledGauntlet','TFT_Item_PowerGauntlet',crown,'TFT_Item_UnstableConcoction','TFT_Item_Quicksilver'],Consumable:[remove]},
 ]);
});
it('ExaltedAdventureLootDistribution {b1c71adb}: six weights and complete A-F contents',()=>{
 const goldenRemove='TFT9_Consumable_GoldenItemRemover',reforge='TFT_Consumable_ItemReroller';
 expect(EXALTED_ADVENTURE_LOOT.map(x=>({...x,weight:Number(x.weight.toFixed(6))}))).toEqual([
  // {1f7039a5}, {1c7034ec}, {1d70367f}, {1a7031c6}, {1b703359}, {18702ea0}.
  {name:'AdventureLootA',weight:.16,Gold:10,Item:['TFT_Item_GargoyleStoneplate','TFT4_Item_OrnnDeathsDefiance','TFT4_Item_OrnnInfinityForce'],Consumable:[goldenRemove],MeepTypeUnit:['TFT_ArmoryKeySupport']},
  {name:'AdventureLootB',weight:.16,Gold:10,Item:[crown,'TFT4_Item_OrnnAnimaVisage'],MeepTypeUnit:['TFT_ArmoryKeyCompleted','TFT_ArmoryKeyCompleted']},
  {name:'AdventureLootC',weight:.18,Gold:10,Item:['TFT_Consumable_MasterworkUpgrade'],MeepTypeUnit:['TFT_ArmoryKeyCompleted','TFT_ArmoryKeySupport','TFT_ArmoryKeyCompleted'],Consumable:[goldenRemove]},
  {name:'AdventureLootD',weight:.18,Gold:5,Item:['TFT5_Item_WarmogsArmorRadiant','TFT5_Item_GiantSlayerRadiant'],MeepTypeUnit:['TFT_ArmoryKeySupport'],Consumable:[reforge,reforge]},
  {name:'AdventureLootE',weight:.16,Gold:20,Item:['TFT5_Item_ThiefsGlovesRadiant'],MeepTypeUnit:['TFT_ArmoryKeyOrnn'],Consumable:[goldenRemove,reforge]},
  {name:'AdventureLootF',weight:.16,Gold:20,Item:['TFT5_Item_CrownguardRadiant','TFT_Item_Artifact_UnendingDespair','TFT_Item_Moonstone'],Consumable:[remove,remove]},
 ]);
});
// Source: same research package excerpts/clones_loot/14.24-spoils-values-and-table-audit.json
// gold_table_field_inventory, records TFT9_Augment_Spoils_Tier{1,2,3}Table{0..6}.
// Only checks what those data confirm: explicit table fields, not runtime table selection or key semantics.
it.each([
 [1,[[23,0,0],[21,0,0],[25,0,0],[21,0,1],[23,0,0],[25,0,1],[20,0,0]]],
 [2,[[18,2,0],[20,6,1],[21,3,2],[26,1,1],[23,5,0],[18,6,0],[20,4,0]]],
 [3,[[26,5,0],[37,3,1],[27,5,2],[31,4,0],[25,9,1],[29,10,0],[27,5,2]]],
] as const)('Spoils tier %i: all seven independent 1/2/3-gold field inventories',(tier,expected)=>{
 const tables=SPOILS_OF_WAR_TABLES[tier];expect(tables).toHaveLength(7);
 expect(tables.map(t=>[1,2,3].map(g=>t.filter(([,gold])=>gold===g).length))).toEqual(expected);
 for(const table of tables){expect(new Set(table.map(([key])=>key)).size).toBe(table.length);for(const [key] of table)expect(key%3).toBe(0);}
});
it('Spoils Table0 sparse opening keys: preserve absent fields as well as present records',()=>{
 // raw map22 {dd92c261}, {583e76e4}, {05d241c7}, keys <=30.
 expect(([1,2,3] as const).map(t=>SPOILS_OF_WAR_TABLES[t][0][0])).toEqual([[3,1],[6,1],[9,2]]);
 expect(SPOILS_OF_WAR_TABLES[1][0].filter(([key])=>key<=30)).toEqual([[3,1],[12,1]]);
 expect(SPOILS_OF_WAR_TABLES[2][0].filter(([key])=>key<=30)).toEqual([[6,1],[18,1]]);
 expect(SPOILS_OF_WAR_TABLES[3][0].filter(([key])=>key<=30)).toEqual([[9,2],[15,1],[24,1]]);
});

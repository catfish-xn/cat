import { expect, it } from 'vitest';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed, augmentCandidates } from '../src/simulation/augment-offers';

// HAND TRANSCRIBED, never loaded from implementation or the existing batch-3 oracle.
// Source: /home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json
// Tuple: zero-based record index, pool id, apiName, Chinese name, tier, effects.
// Only float32 archive noise is normalized (six decimals); keys/nulls stay exact.
const rows: readonly [number,string,string,string,1|2|3,Record<string,number|null>][] = [
 [3,'blade-dance','TFT13_Augment_IreliaCarry','刀锋之舞',1,{TOOLTIPBonusAS:.4}],
 [10,'field-medic','TFT13_Augment_FishCarry','战地医生',1,{ManaReduction:10,TOOLTIPONLYModifiedDamage:.65,TOOLTIPONLYOmnivamp:30}],
 [12,'corrosion','TFT_Augment_Corrosion','腐蚀',1,{ResistLoss:3,Time:2}],
 [18,'eye-for-an-eye','TFT_Augment_EyeForAnEye','以眼还眼',1,{AllyDeaths:15,NumComponents:4,'{a6cb80ca}':null}],
 [19,'eye-for-an-eye-plus','TFT_Augment_EyeForAnEyePlus','以眼还眼+',1,{AllyDeaths:13,NumComponents:3,'{a6cb80ca}':1}],
 [25,'wealthy-rehab-i','TFT_Augment_WealthyRehab1','健康就是财富 I',1,{Gold:8,HealingThreshold:10000,Omnivamp:.1}],
 [31,'latent-forge','TFT9_Augment_LongTimeCrafting','休眠锻炉',1,{Numberofcombats:8}],
 [55,'rolling-for-days-i','TFT9_Augment_Commander_RollingForDays','D个痛快！ I',1,{Numrolls:11}],
 [57,'spoils-of-war-i','TFT9_Augment_DravenSpoilsOfWar','战争财宝 I',1,{LootDropChance:.25,'{ac7ef35a}':.25}],
 [58,'superstars-i','TFT_Augment_SuperstarsSilver','超级巨星 I',1,{BaseBonusDamage:.05,BonusDamagePer3Star:.02,Rerolls:2}],
 [59,'support-mining','TFT_Augment_SupportMining','辅助挖矿',1,{NumDeaths:7}],
 [60,'support-mining-plus','TFT_Augment_SupportMiningPlus','辅助挖矿+',1,{NumDeaths:4}],
 [63,'team-building','TFT9_Augment_ArmyBuilding','团队建设',1,{PlayerCombatNum:7}],
 [66,'shocking-troll','TFT13_Augment_TrundleCarry','震惊巨魔',1,{ManaReduction:50,TOOLTIPONLYADPerCast:1.5,TOOLTIPONLYAS:140,TOOLTIPONLYDuration:5}],
 [81,'bad-luck-protection','TFT_Augment_BadLuckProtection','厄运保护',2,{ADPerCrit:.01,CritChancePercent:1,'{1a2d5ea3}':null}],
 [85,'blazing-soul-i','TFT_Augment_BlazingSoul','炽热灵魂 I',2,{AbilityPower:20,AttackSpeed:.2,TransferDuration:3}],
 [89,'savage-revenge','TFT13_Augment_ChainsawCarry','残暴复仇',2,{TOOLTIPAbilityDamage:1.1,TOOLTIPHexDistance:2,TOOLTIPManaReduction:10,'{9dff3ac5}':.3}],
 [103,'blood-pact','TFT13_Augment_VladCarry','血色契约',2,{BonusMana:3,IncRange:3,TOOLTIPDamageAmp:.1,TooltipBonusDamage:.8,'{256e31ce}':50}],
 [119,'all-out','TFT13_Augment_PrimeCarry','卯足全力',2,{TOOLTIPONLYSplashPerc:.25,TooltipBonusDamage:.85,'{8cfa39af}':60}],
 [120,'gold-for-dummies','TFT_Augment_GoldForDummies','假人金币',2,{GoldAmount:1,GoldDuration:10}],
 [122,'wealthy-rehab-ii','TFT_Augment_WealthyRehab2','健康就是财富 II',2,{Gold:15,HealingThreshold:10000,Omnivamp:.15}],
 [139,'noble-sacrifice','TFT_Augment_NobleSacrifice','高贵牺牲',2,{BaseResists:25,SharePerc:.1}],
 [153,'prizefighter','TFT11_Augment_Prizefighter','赏金战士',2,{WinsNeeded:5,component:2}],
 [168,'scapegoat','TFT10_Augment_Scapegoat','替罪羊',2,{Gold:1,InitialGold:4}],
 [182,'spoils-of-war-ii','TFT9_Augment_DravenSpoilsOfWar2','战争财宝 II',2,{LootDropChance:.3,'{ac7ef35a}':.3}],
 [185,'superstars-ii','TFT_Augment_Superstars','超级巨星 II',2,{BaseBonusDamage:.07,BonusDamagePer3Star:.05,Rerolls:4}],
 [192,'tower-defense','TFT_Augment_TowerDefense','塔防游戏',2,{Gold:null,NumOfEmblems:1,'{103ddd87}':.4,'{fd3dbf9e}':60}],
 [193,'trade-sector','TFT6_Augment_TradeSector','DD街区',2,{Gold:1}],
 [209,'wandering-trainer-i','TFT11_Augment_WanderingTrainerGold','漫游训练师 I',2,{Gold:1,NumOfEmblems:2}],
 [214,'what-doesnt-kill-you','TFT9_Augment_WhatDoesntKillYou','在失败中变强',2,{Gold:2,RoundsPerComponent:4}],
 [216,'worth-the-wait','TFT_Augment_WorthTheWaitGold','值得等待',2,{AdditionalCopies:99,Delay:2,UnitTier:1,'{3a9ff59a}':3}],
 [220,'an-exalted-adventure','TFT_Augment_AnExaltedAdventure','崇高冒险',3,{NumUnits:3}],
 [229,'blazing-soul-ii','TFT_Augment_BlazingSoul2','炽热灵魂 II',3,{AbilityPower:35,AttackSpeed:.3,TransferDuration:3}],
 [235,'building-a-collection-iii','TFT9_Augment_BuildingACollectionPlusPlus','珍藏财宝 III',3,{Gold:null,roundsofbonusitems:6}],
 [242,'dark-alley-dealings','TFT_Augment_DarkAlleyDealings','暗巷交易',3,{CombatNum:3}],
 [251,'flexible','TFT_Augment_Flexible','灵活摇摆',3,{BonusStages:99,HPPerEmblem:40,StartingEmblems:1}],
 [266,'living-forge','TFT7_Augment_LivingForge','活体锻炉',3,{Numberofcombats:9}],
 [272,'phreaky-friday','TFT9_Augment_PhreakyFriday','成吨的伤害',3,{CombatNum:5}],
 [273,'phreaky-friday-plus','TFT9_Augment_PhreakyFridayPlus','成吨的伤害+',3,{CombatNum:3}],
 [287,'shimmerscale-essence','TFT_Augment_ShimmerscaleEssence','金鳞精粹',3,{CombatNum:5}],
 [291,'spoils-of-war-iii','TFT9_Augment_DravenSpoilsOfWar3','战争财宝 III',3,{LootDropChance:.4,'{ac7ef35a}':.4}],
 [296,'the-golden-egg','TFT6_Augment_TheGoldenEgg','金蛋',3,{EggTurns:11,'{ecb4463d}':null}],
 [308,'wandering-trainer-ii','TFT9_Augment_WanderingTrainer','漫游训练师 II',3,{Gold:6,NumOfEmblems:3}],
 [311,'worth-the-wait-ii','TFT_Augment_WorthTheWaitPrismatic','值得等待 II',3,{AdditionalCopies:99,Delay:null,UnitTier:2,'{3a9ff59a}':1}],
];
it('independent source transcription covers all 44 finished rows, no silent omissions',()=>{
 expect(Object.keys(AUGMENT_BATCH3).sort()).toEqual(rows.map(r=>r[1]).sort());
});
it.each(rows)('14.24 record %i: %s identity/tier/all constants',(_record,id,api,name,tier,values)=>{
 const t=(['silver','gold','prismatic'] as const)[tier-1];
 expect([AUGMENT_POOL_API_NAMES[id],AUGMENT_DEFINITIONS[id].name,AUGMENT_TIERS[id]]).toEqual([api,name,t]);
 expect([AUGMENT_BATCH3[id].apiName,AUGMENT_BATCH3[id].name,AUGMENT_BATCH3[id].tier]).toEqual([api,name,t]);
 expect(Object.fromEntries(Object.entries(AUGMENT_BATCH3[id].source.values).map(([k,v])=>[k,v===null?null:Number(v.toFixed(6))]))).toEqual(values);
 expect(augmentCandidates(t,[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]})).toContain(id);
 expect(augmentCandidates(t,[{definitionId:id,choiceId:'old',acquiredRound:1}])).not.toContain(id);
});
// Crime maps to chem-baron, corroborated by ChembaronCrest (not Steb's roster traits).
// Same archive associatedTraits records 3/10/66/89/103/119. Internal trait ids mapped by names.
it.each([
 ['blade-dance',['sentinel','rebel']],['field-medic',['sentinel','chem-baron']],
 ['shocking-troll',['bruiser','scrap']],['savage-revenge',['bruiser']],
 ['blood-pact',['sorcerer','watcher']],['all-out',['watcher']],
] as const)('%s: each individual linked trait admits it; unrelated/empty board excludes at both tailored nodes',(id,traits)=>{
 for(const node of ['3-2','4-2']){
  for(const fieldedTraits of [[],['academy']])expect(augmentOfferAllowed(id,[],{node,fieldedTraits,blocked:[]})).toBe(false);
  for(const trait of traits)expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[trait],blocked:[]})).toBe(true);
 }
 expect(augmentOfferAllowed(id,[],{node:'2-1',fieldedTraits:[],blocked:[]})).toBe(true);
});
// Reciprocal hero exclusions also come from TFT13_TeamupAugment_Geniuses.mutually_exclusive_item_nodes_raw.
// Hand resolved map22_node -> apiName from the same records, including asymmetric edges.
it.each([
 ['eye-for-an-eye','eye-for-an-eye-plus'],['wealthy-rehab-i','wealthy-rehab-ii'],
 ['superstars-i','superstars-ii'],['support-mining','support-mining-plus'],
 ['blazing-soul-i','blazing-soul-ii'],['phreaky-friday','phreaky-friday-plus'],
 ['dark-alley-dealings','phreaky-friday-plus'],['tower-defense','wandering-trainer-i'],
 ['tower-defense','wandering-trainer-ii'],['wandering-trainer-i','wandering-trainer-ii'],
 ['field-medic','geniuses'],['blade-dance','geniuses'],['shocking-troll','geniuses'],
 ['savage-revenge','geniuses'],['all-out','geniuses'],['blood-pact','geniuses'],
 ['bad-luck-protection','piercing-lotus-i'],['bad-luck-protection','piercing-lotus-ii'],
] as const)('source mutex %s / %s is enforced in both directions',(a,b)=>{
 for(const [candidate,owned] of [[a,b],[b,a]])expect(augmentOfferAllowed(candidate,[{definitionId:owned,choiceId:'old',acquiredRound:1}],{node:'3-2',fieldedTraits:[],blocked:[]})).toBe(false);
});
it.each(rows.filter(r=>!['blade-dance','field-medic','shocking-troll','savage-revenge','blood-pact','all-out'].includes(r[1])))('record %i %s has no trait tailoring',(_record,id)=>{
 for(const node of ['3-2','4-2'])expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(true);
 expect(augmentOfferAllowed(id,[],{node:'2-1',fieldedTraits:[],blocked:[id]})).toBe(false);
});
it('absence of source mutex also matters: basic Friday and Dark Alley may coexist',()=>{
 for(const [a,b] of [['dark-alley-dealings','phreaky-friday'],['team-building','latent-forge'],['spoils-of-war-i','spoils-of-war-ii']])expect(augmentOfferAllowed(a,[{definitionId:b,choiceId:'old',acquiredRound:1}])).toBe(true);
});

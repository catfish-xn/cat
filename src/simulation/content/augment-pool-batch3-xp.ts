import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

interface Batch3XpContent {
 readonly apiName:string; readonly name:string; readonly tier:'silver'|'gold'|'prismatic'; readonly description:string;
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number>>;readonly description_en_us:string};
 /** Source keys: XP and gold on acquisition. */
 readonly acquisitionXp?:string; readonly gold?:string;
 /** Stage start after the acquisition round: XP and free rerolls (Epoch). Acquisition also grants `stageRerolls` once. */
 readonly stageXp?:string; readonly stageRerolls?:string;
 /** XP at the next round entry after each player combat from the acquisition round on (Patient Study). */
 readonly pvpXp?:{readonly win:string;readonly loss:string};
 /** Extra XP per bought XP purchase (Level Up!). */
 readonly purchaseXp?:string;
 /** Per level reached after acquisition: free rerolls (`'level'` = the new level, Shopping Spree; else a source key)
  * and player health (Upward Mobility). */
 readonly levelUpRerolls?:'level'|string; readonly levelUpHealth?:string;
 /** Gold off each XP purchase; the description's literal 1 (Upward Mobility has no source key for it). */
 readonly xpCostReduction?:number;
 /** Kingslayer: gold per player-combat win, `bonus` instead when that opponent had more health. */
 readonly kingslayer?:{readonly win:string;readonly bonus:string};
}
const ARCHIVE='augments-research-2026-10-23/data/augments-14.24.json';
/** classification.json batch 3: XP grants, XP-purchase rules and player-health readings. Every amount is the 14.24 zh_cn/en_us source value.
 * Project readings (P 2026-10-24, docs/S13_RULES_GAP.md): Patient Study pays at the next round entry and a draw counts as a
 * loss (the streak rule); Shopping Spree counts levels reached after acquisition and leaves the unnamed `{a9ad6d1b}=8` unused;
 * Upward Mobility heals only a living player, capped at 100, and a round entry's level-up heals after the opening encounter;
 * Kingslayer compares the opponent's battle-start health with this seat's health at settlement, and an offline opponent has none.
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH3_XP:Readonly<Record<string,Batch3XpContent>>=freezeContent({
 'patient-study':{apiName:'TFT9_Augment_LearningFromExperience2',name:'耐心学习',tier:'gold',
  description:'在与玩家的战斗后，如果你赢了则获得2经验，如果你输了则获得3经验。',
  source:{patch:'14.24',archive:ARCHIVE,values:{lossxp:3,winxp:2},description_en_us:'After player combat, gain 2 XP if you won or 3 XP if you lost.'},
  pvpXp:{win:'winxp',loss:'lossxp'}},
 epoch:{apiName:'TFT11_Augment_Epoch',name:'新纪元',tier:'gold',
  description:'现在以及每个阶段开始时，获得6经验值和2次免费刷新。',
  source:{patch:'14.24',archive:ARCHIVE,values:{Rerolls:2,XP:6},description_en_us:'Now, and at the start of every stage, gain 6 XP and 2 free rerolls.'},
  acquisitionXp:'XP',stageXp:'XP',stageRerolls:'Rerolls'},
 'epoch-plus':{apiName:'TFT11_Augment_EpochPlus',name:'新纪元+',tier:'gold',
  description:'现在以及每个阶段开始时，获得8经验值和3次免费刷新。',
  source:{patch:'14.24',archive:ARCHIVE,values:{Rerolls:3,XP:8},description_en_us:'Now, and at the start of every stage, gain 8 XP and 3 free rerolls.'},
  acquisitionXp:'XP',stageXp:'XP',stageRerolls:'Rerolls'},
 'level-up':{apiName:'TFT6_Augment_MaxLevel10',name:'升级咯！',tier:'prismatic',
  description:'在你购买经验值的时候，获得额外的2经验值。立刻获得12经验值。',
  source:{patch:'14.24',archive:ARCHIVE,values:{InitialXP:12,XP:2},description_en_us:'When you buy XP, gain an additional 2. Gain 12 immediately.'},
  acquisitionXp:'InitialXP',purchaseXp:'XP'},
 'shopping-spree':{apiName:'TFT9_Augment_HighEndSector',name:'大买特买',tier:'prismatic',
  description:'在你升级时，获得相当于你等级数的免费商店刷新次数。获得4金币。 ',
  source:{patch:'14.24',archive:ARCHIVE,values:{Gold:4,'{a9ad6d1b}':8},description_en_us:'When you level up, gain a number of free shop refreshes equal to your level. Gain 4 gold. '},
  gold:'Gold',levelUpRerolls:'level'},
 'upward-mobility':{apiName:'TFT_Augment_UpwardMobility',name:'上进心',tier:'prismatic',
  description:'购买经验的费用降低1。每当你升级时，获得2生命值和3次免费刷新。',
  source:{patch:'14.24',archive:ARCHIVE,values:{Health:2,Rerolls:3},description_en_us:'Buying XP costs 1 less. Gain 2 Health and 3 free rerolls whenever you level up.'},
  levelUpRerolls:'Rerolls',levelUpHealth:'Health',xpCostReduction:1},
 kingslayer:{apiName:'TFT_Augment_Kingslayer',name:'弑君突刺',tier:'silver',
  description:'在赢得玩家对战回合后，获得1金币。如果该玩家的生命值高于你，则获得4金币作为替代。即刻获得1金币。',
  source:{patch:'14.24',archive:ARCHIVE,values:{Gold:1,WinBonusGold:4,WinGold:1},description_en_us:'After winning player combat, gain 1 gold. If they had more health than you, gain 4 Gold instead. Gain 1 gold now.'},
  gold:'Gold',kingslayer:{win:'WinGold',bonus:'WinBonusGold'}},
});
/** Disabled rows never enter definitions, tiers or API offer mappings. */
export const AUGMENT_BATCH3_XP_BLOCKED:Readonly<Record<string,string>>=freezeContent({});
export function batch3XpValue(id:string,key:string):number {
 const n=AUGMENT_BATCH3_XP[id]?.source.values[key];
 if(!Number.isSafeInteger(n)||n!<1)throw new RangeError(`Batch3 XP source value ${id}.${key}`);return n!;
}
export const AUGMENT_BATCH3_XP_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3_XP).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
  ...(row.acquisitionXp?[{kind:'mechanic' as const,mechanic:'acquisitionXp',values:{amount:batch3XpValue(id,row.acquisitionXp)}}]:[]),
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:batch3XpValue(id,row.gold)}}]:[])],
}])));
export const AUGMENT_BATCH3_XP_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3_XP).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH3_XP_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3_XP).map(([id,row])=>[id,row.apiName])));

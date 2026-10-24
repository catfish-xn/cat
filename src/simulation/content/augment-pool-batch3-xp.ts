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
 /** Shopping Spree: each level reached after acquisition grants that many free rerolls. */
 readonly levelUpRerolls?:'level';
}
const ARCHIVE='augments-research-2026-10-23/data/augments-14.24.json';
/** classification.json batch 3: XP grants and XP-purchase rules. Every amount is the 14.24 zh_cn/en_us source value.
 * Project readings (P 2026-10-24, docs/S13_RULES_GAP.md): Patient Study pays at the next round entry and a draw counts as a
 * loss (the streak rule); Shopping Spree counts levels reached after acquisition and leaves the unnamed `{a9ad6d1b}=8` unused.
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
});
/** Disabled rows never enter definitions, tiers or API offer mappings. */
export const AUGMENT_BATCH3_XP_BLOCKED=freezeContent({
 'upward-mobility':'TFT_Augment_UpwardMobility（上进心，彩）：Health=2、Rerolls=3 与买经验-1金齐；缺的是实现：升级回血要接进玩家血量恢复校验链（备战/结算/阵亡后升级、100上限与其他回血的先后），本批只扩展了经验链，未接血量链，暂不入池。',
});
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

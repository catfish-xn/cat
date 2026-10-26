import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

interface Batch3XpContent {
 readonly apiName:string; readonly tier:'silver'|'gold'|'prismatic';
 /** UI name/description: src/presentation/augment-pool-text.ts (lazy); archive columns: scripts/augment-content-archive.ts. */
 /** Augment rounds this card may be offered at (P 2026-10-24): the 14.24 ItemTags {d02ae323}/{d12ae4b6}/{d22ae649}
  * read as "not at 2-1/3-2/4-2". The reading matches every known case: Black Rose crest/crown carry only the 2-1 tag
  * (patch notes: never at 2-1), Risky Moves carries 3-2 and 4-2 (only at 2-1, user 2026-10-24), Epoch 2-1 / Epoch+ 3-2. */
 readonly nodes:readonly ('2-1'|'3-2'|'4-2')[];
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number>>};
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
 /** Risky Moves: player health lost on selection (P: never below 1) and gold once after that many player combats. */
 readonly acquisitionHealthLoss?:string; readonly pvpCombatGold?:{readonly combats:string;readonly gold:string};
}
const ARCHIVE='augments-research-2026-10-23/data/augments-14.24.json';
/** classification.json batch 3: XP grants, XP-purchase rules and player-health readings. Every amount is the 14.24 zh_cn/en_us source value.
 * Project readings (P 2026-10-24, docs/S13_RULES_GAP.md): Patient Study pays at the next round entry and a draw counts as a
 * loss (the streak rule); Shopping Spree counts levels reached after acquisition and leaves the unnamed `{a9ad6d1b}=8` unused;
 * Upward Mobility heals only a living player, capped at 100, and a round entry's level-up heals after the opening encounter;
 * Kingslayer compares the opponent's battle-start health with this seat's health at settlement, and an offline opponent has none;
 * Risky Moves loses its health on selection but never below 1, and counts player combats (any result) from the acquisition round.
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH3_XP:Readonly<Record<string,Batch3XpContent>>=freezeContent({
 'patient-study':{apiName:'TFT9_Augment_LearningFromExperience2',tier:'gold',nodes:['2-1'],
  source:{patch:'14.24',archive:ARCHIVE,values:{lossxp:3,winxp:2}},
  pvpXp:{win:'winxp',loss:'lossxp'}},
 epoch:{apiName:'TFT11_Augment_Epoch',tier:'gold',nodes:['2-1'],
  source:{patch:'14.24',archive:ARCHIVE,values:{Rerolls:2,XP:6}},
  acquisitionXp:'XP',stageXp:'XP',stageRerolls:'Rerolls'},
 'epoch-plus':{apiName:'TFT11_Augment_EpochPlus',tier:'gold',nodes:['3-2'],
  source:{patch:'14.24',archive:ARCHIVE,values:{Rerolls:3,XP:8}},
  acquisitionXp:'XP',stageXp:'XP',stageRerolls:'Rerolls'},
 'level-up':{apiName:'TFT6_Augment_MaxLevel10',tier:'prismatic',nodes:['2-1'],
  source:{patch:'14.24',archive:ARCHIVE,values:{InitialXP:12,XP:2}},
  acquisitionXp:'InitialXP',purchaseXp:'XP'},
 'shopping-spree':{apiName:'TFT9_Augment_HighEndSector',tier:'prismatic',nodes:['2-1'],
  source:{patch:'14.24',archive:ARCHIVE,values:{Gold:4,'{a9ad6d1b}':8}},
  gold:'Gold',levelUpRerolls:'level'},
 'upward-mobility':{apiName:'TFT_Augment_UpwardMobility',tier:'prismatic',nodes:['2-1','3-2','4-2'],
  source:{patch:'14.24',archive:ARCHIVE,values:{Health:2,Rerolls:3}},
  levelUpRerolls:'Rerolls',levelUpHealth:'Health',xpCostReduction:1},
 kingslayer:{apiName:'TFT_Augment_Kingslayer',tier:'silver',nodes:['2-1','3-2'],
  source:{patch:'14.24',archive:ARCHIVE,values:{Gold:1,WinBonusGold:4,WinGold:1}},
  gold:'Gold',kingslayer:{win:'WinGold',bonus:'WinBonusGold'}},
 'risky-moves':{apiName:'TFT9_Augment_RiskyMoves',tier:'silver',nodes:['2-1'],
  source:{patch:'14.24',archive:ARCHIVE,values:{Gold:30,Health:20,PlayerCombatNum:7}},
  acquisitionHealthLoss:'Health',pvpCombatGold:{combats:'PlayerCombatNum',gold:'Gold'}},
});
/** Disabled rows never enter definitions, tiers or API offer mappings. */
export const AUGMENT_BATCH3_XP_BLOCKED:Readonly<Record<string,string>>=freezeContent({});
export function batch3XpValue(id:string,key:string):number {
 const n=AUGMENT_BATCH3_XP[id]?.source.values[key];
 if(!Number.isSafeInteger(n)||n!<1)throw new RangeError(`Batch3 XP source value ${id}.${key}`);return n!;
}
export const AUGMENT_BATCH3_XP_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3_XP).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
  ...(row.acquisitionXp?[{kind:'mechanic' as const,mechanic:'acquisitionXp',values:{amount:batch3XpValue(id,row.acquisitionXp)}}]:[]),
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:batch3XpValue(id,row.gold)}}]:[])],
}])));
/** Offer-rule node bans for these rows, keyed by apiName like AUGMENT_OFFER_RULES.nodeBans. */
export const AUGMENT_BATCH3_XP_NODE_BANS:Readonly<Record<string,readonly string[]>>=freezeContent(Object.fromEntries(Object.values(AUGMENT_BATCH3_XP)
 .map(row=>[row.apiName,(['2-1','3-2','4-2'] as const).filter(node=>!row.nodes.includes(node))] as const).filter(([,bans])=>bans.length)));
export const AUGMENT_BATCH3_XP_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3_XP).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH3_XP_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3_XP).map(([id,row])=>[id,row.apiName])));

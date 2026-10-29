import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
/** 14.24 source and P-B5-01/02 (2026-10-27). */
export const AUGMENT_BATCH5_S1A = freezeContent({
  'beggars-can-be-choosers': {apiName:'TFT_Augment_BeggarsCanBeChoosers', name:'乞亦有择', description:'你的所有其它强化符文选择获得+3刷新次数。获得7金币。', tier:'silver', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',description_en_us:'You get +3 Augment rerolls for all other augment choices. Gain 7 gold.',values:{ExtraRolls:3,Gold:7}}},
  'power-up': {apiName:'TFT_Augment_PowerUp', name:'威力提升', description:'你的下一个强化符文的位阶提高一阶。', tier:'silver', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',description_en_us:'Your next augment is one tier higher.',values:{}}},
} as const);
export const AUGMENT_BATCH5_S1A_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S1A).map(([id,row]):[string,ChoiceDefinition]=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},...('Gold' in row.source.values ? [{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.source.values.Gold}}] : [])]}])));
export const AUGMENT_BATCH5_S1A_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S1A).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_S1A_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S1A).map(([id,row])=>[id,row.apiName])));

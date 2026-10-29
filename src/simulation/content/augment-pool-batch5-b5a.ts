import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 source; fixed three-item forge, existing interest policy and glove behavior, P-B5-50/51/55 (2026-10-27). */
export const AUGMENT_BATCH5_B5A = freezeContent({
  'all-that-shimmers': { apiName:'TFT9_Augment_AllThatShimmers', tier:'gold', name:'闪若金鳞', description:'选择一件可产生金币的神器装备，并获得一个装备拆卸器。', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{ArmoryChoiceCount:3,InterestCap:5}}, gold:0, gifts:[] },
  'all-that-shimmers-plus': { apiName:'TFT_Augment_AllThatShimmersPlus', tier:'gold', name:'闪若金鳞+', description:'选择一件可产生金币的神器装备，获得一个装备拆卸器和4金币。', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{ArmoryChoiceCount:3,GoldGranted:4,InterestCap:5}}, gold:4, gifts:[] },
  'roll-the-dice': { apiName:'TFT9_Augment_RollTheDice', tier:'prismatic', name:'交给运气', description:'获得1个光明窃贼手套；临时装备遵循现有窃贼手套规则。', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{}}, gold:0, gifts:[{kind:'item',definitionId:'TFT5_Item_ThiefsGlovesRadiant'}] },
} as const);
export const AUGMENT_BATCH5_B5A_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_B5A).map(([id,row]):[string,ChoiceDefinition]=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.gold}}]:[])]}])));
export const AUGMENT_BATCH5_B5A_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_B5A).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_B5A_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_B5A).map(([id,row])=>[id,row.apiName])));

import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
/** 14.24 research archive; project conventions P-B5-75 and P-B5-77 (2026-10-27). */
export const AUGMENT_BATCH5_S11A = freezeContent({
  moonlight: { apiName:'TFT_Augment_Moonlight', name:'月光', description:'战斗开始时：1个随机的1费弈子在该回合中升为3星，并获得25%攻击力和25法术强度。', tier:'gold', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',description_en_us:'Combat start: 1 random 1-cost champion is upgraded to 3-star for that round and gains 25% Attack Damage and 25 Ability Power.\n',values:{ADBonus:0.25,APBonus:25,ItemBonus:null,NumUnits:1,'{51b72188}':null}}, gifts:[] },
  'greater-moonlight': { apiName:'TFT_Augment_GreaterMoonlight', name:'高级月光', description:'战斗开始时：1个随机的1费弈子在该回合中升为4星，并获得5%攻击力和5法术强度。', tier:'prismatic', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',description_en_us:'Combat Start: 1 random 1-cost champion is upgraded to 4-star for that round and gains 5% Attack Damage and 5 Ability Power.',values:{ADBonus:0.05000000074505806,APBonus:5,ItemBonus:null,NumUnits:1,'{51b72188}':1}}, gifts:[] },
} as const);
export const AUGMENT_BATCH5_S11A_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S11A).map(([id,r])=>[id,{id,name:r.name,description:r.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_S11A_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S11A).map(([id,r])=>[id,r.tier])));
export const AUGMENT_BATCH5_S11A_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S11A).map(([id,r])=>[id,r.apiName])));

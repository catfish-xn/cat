import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
/** P-B5-59, approved 2026-10-27; 14.24 source has no numeric effect. */
export const AUGMENT_BATCH5_S8A = freezeContent({
  pilfer: { apiName:'TFT_Augment_Pilfer', tier:'gold', name:'挖角',
    description:'每回合，获得你在上一场战斗中首先击杀的那个弈子的一个1星版本。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{Gold:null}}, gifts:[] },
} as const);
export const AUGMENT_BATCH5_S8A_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent({pilfer:{id:'pilfer',name:AUGMENT_BATCH5_S8A.pilfer.name,description:AUGMENT_BATCH5_S8A.pilfer.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}});
export const AUGMENT_BATCH5_S8A_TIERS=freezeContent({pilfer:'gold'} as const);
export const AUGMENT_BATCH5_S8A_API_NAMES=freezeContent({pilfer:'TFT_Augment_Pilfer'} as const);

import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive; project convention P-B5-65 (2026-10-27). */
export const AUGMENT_BATCH5_S8C = freezeContent({
  'hard-commit': { apiName:'TFT_Augment_HardCommit', tier:'prismatic', name:'硬性承诺',
    description:'获得1个随机纹章。现在以及每个阶段开始时，获得该羁绊的一个1星弈子，且该弈子的费用相当于当前阶段数(最多为5)。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{}} },
} as const);
export const AUGMENT_BATCH5_S8C_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(
 Object.entries(AUGMENT_BATCH5_S8C).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_S8C_TIERS = freezeContent({'hard-commit':'prismatic'} as const);
export const AUGMENT_BATCH5_S8C_API_NAMES = freezeContent({'hard-commit':'TFT_Augment_HardCommit'} as const);

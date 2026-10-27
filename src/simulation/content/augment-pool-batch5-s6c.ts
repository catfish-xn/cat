import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive; P-B5-48/49, 2026-10-27. */
export const AUGMENT_BATCH5_S6C = freezeContent({
  'tiniest-titan': {
    apiName:'TFT9_Augment_TiniestTitan', name:'最小巨人',
    description:'在每个玩家对战回合后获得2玩家生命值和1金币。你的小小英雄还会移动得更快。',
    tier:'prismatic', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us:'Gain 2 player health and 1 gold after every player combat. Your Tactician also moves faster.',values:{Gold:1,Heal:2}},
  },
  'tiniest-titan-plus': {
    apiName:'TFT9_Augment_TiniestTitanPlus', name:'最小巨人+',
    description:'在每个玩家对战回合后获得2玩家生命值和1金币。你的小小英雄还会移动得更快。\n\n即刻获得15金币。',
    tier:'prismatic', source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us:'Gain 2 player health and 1 gold after every player combat. Your Tactician also moves faster.\n\nGain 15 gold now.',values:{Gold:1,Heal:2,InitialGold:15}},
  },
} as const);
export const AUGMENT_BATCH5_S6C_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(
 Object.entries(AUGMENT_BATCH5_S6C).map(([id,row]):[string,ChoiceDefinition]=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},...('InitialGold' in row.source.values?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.source.values.InitialGold}}]:[])]}])));
export const AUGMENT_BATCH5_S6C_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S6C).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_S6C_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S6C).map(([id,row])=>[id,row.apiName])));

import { freezeContent } from './freeze';
import type { ChoiceDefinition, Effect } from '../strategy-types';
export const AUGMENT_BATCH5_H4_SOURCE = freezeContent({patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json'});
/** 14.24 archive values; P-B5-32/33/34, 2026-10-27. */
export const AUGMENT_BATCH5_H4 = freezeContent({
  'survivor': {apiName:'TFT_Augment_Survivor', name:'幸存者', description:'在3名其他玩家被淘汰后，获得60金币。', tier:'silver', values:{Gold:60, PlayersDead:3}},
  'diversified-portfolio-plus': {apiName:'TFT_Augment_DiversifiedPortfolio2', name:'多元化投资+', description:'每回合，每激活3个非唯一羁绊，获得1金币。获得4金币。', tier:'silver', values:{GoldRate:1, InstantGold:4, TraitsActive:3}},
  'diversified-portfolio': {apiName:'TFT_Augment_DiversifiedPortfolio1', name:'多元化投资', description:'每回合，每激活3个非唯一羁绊，获得1金币。获得1金币。', tier:'silver', values:{GoldRate:1, InstantGold:1, TraitsActive:3}},
} as const);
export const AUGMENT_BATCH5_H4_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H4).map(([id,row]): [string,ChoiceDefinition] => {
  const effects: Effect[] = [{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}];
  if ('InstantGold' in row.values) effects.push({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:row.values.InstantGold}});
  return [id,{id,name:row.name,description:row.description,effects}];
})));
export const AUGMENT_BATCH5_H4_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H4).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_H4_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H4).map(([id,row])=>[id,row.apiName])));

import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive; P-B5-45/46/47, 2026-10-27. Percentages execute as integer Bps. */
export const DHAMPYR_RULES = freezeContent({ playerHealBps: 2000, omnivampBps: 1200 });
export const AUGMENT_BATCH5_H8 = freezeContent({
  'dhampyr': {apiName:'TFT_Augment_Dhampyr',tier:'gold' as const,name:'吸血生机',description:'你的弈子获得12%全能吸血。对敌方玩家造成实际伤害后，治疗自身，数值为伤害的20%。',source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{Omnivamp:0.20000000298023224,OmnivampStatBonus:0.11999999731779099}}},
  'mirrored-monetization': {apiName:'TFT_Augment_MirroredMonetization',tier:'gold' as const, name:'恶意货币化',description:'获得2金币。接下来3个自然轮，正式敌方英雄每次死亡获得2金币，战后支付。',source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{GoldContained:2,PercCost:2,rounds:3}}},
  'forward-thinking': { apiName:'TFT_Augment_ForwardThinking', tier:'gold' as const,
    name:'前瞻思维', description:'失去所有金币；在6轮玩家对战后返还本金和额外70金币。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{BaseGold:70,rounds:6,'{8f9a1368}':1}} },
});
export const AUGMENT_BATCH5_H8_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H8).map(([id,row]):[string,ChoiceDefinition]=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},...(id==='mirrored-monetization'?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:AUGMENT_BATCH5_H8['mirrored-monetization'].source.values.GoldContained}}]:[]),...(id==='dhampyr'?[{kind:'mechanic' as const,mechanic:'wealthyRehab',values:{omnivampBps:DHAMPYR_RULES.omnivampBps}}]:[])]}])));
export const AUGMENT_BATCH5_H8_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H8).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_H8_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H8).map(([id,row])=>[id,row.apiName])));

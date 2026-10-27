import { freezeContent } from './freeze';
import { G24_FORGE_POOLS } from './g2-4-forges';
import type { ChoiceDefinition } from '../strategy-types';

/** Basis points. P-B5-69, user-corrected convention, 2026-10-27. */
export const LOOT_EXPLOSION_BASE_DROP_CHANCE = 1100;
/** 14.24 LootValue keys, integer percent weights. Missing mValue is deliberately absent. */
export const LOOT_EXPLOSION_LOOT_VALUES: Readonly<Record<number, readonly { readonly key: number; readonly mValue?: number }[]>> = freezeContent({
  2: [{key:1,mValue:80},{key:2,mValue:20}],
  3: [{key:1,mValue:30},{key:2,mValue:60},{key:3,mValue:5},{key:4,mValue:5}],
  4: [{key:1,mValue:30},{key:2,mValue:35},{key:3,mValue:25},{key:4,mValue:5},{key:5,mValue:5},{key:6}],
  5: [{key:1,mValue:15},{key:2,mValue:30},{key:3,mValue:35},{key:4,mValue:13},{key:5,mValue:5},{key:6,mValue:2},{key:7}],
  6: [{key:1,mValue:15},{key:2,mValue:30},{key:3,mValue:35},{key:4,mValue:13},{key:5,mValue:5},{key:6,mValue:2}],
  7: [{key:1,mValue:15},{key:2,mValue:30},{key:3,mValue:35},{key:4,mValue:13},{key:5,mValue:5},{key:6,mValue:2}],
  8: [{key:1,mValue:15},{key:2,mValue:30},{key:3,mValue:35},{key:4,mValue:13},{key:5,mValue:5},{key:6,mValue:2}],
});
export const LOOT_EXPLOSION_RULES = freezeContent({
  baseDropChanceBps: LOOT_EXPLOSION_BASE_DROP_CHANCE,
  dropChance: 'min(10000,1100+killerCritChanceBps)',
  valueCrit: 'one-independent-killerCritChanceBps-roll; tier+1; cap6; no-recursion',
  weights: LOOT_EXPLOSION_LOOT_VALUES,
  rewards: {1:{gold:1},2:{gold:2},3:{gold:3},4:{components:1},5:{components:2},6:{completed:1}},
  components: G24_FORGE_POOLS.TFT_ArmoryKeyComponent,
  completed: G24_FORGE_POOLS.TFT_ArmoryKeyCompleted,
  random: 'lcg32-v1; seed/seat/choice/round/combatId/deathEventSeq substream; uniform items with replacement',
  eligibility: 'ambusher last-hit on an opposing ordinary hero; no summons or copies; frozen effective membership, including emblems',
  payment: 'after combat, exactly once through mechanic gold/item receipts',
  convention: 'P-B5-69-2026-10-27; provisional numbers pending final user confirmation',
});
export const AUGMENT_BATCH5_G7 = freezeContent({
  'loot-explosion': {
    apiName:'TFT13_Augment_Ambusher', name:'战利品爆炸', tier:'gold' as const,
    description:'【伏击专家】击杀敌人时有几率掉落战利品，掉落几率受益于暴击几率。所获战利品的价值也可以触发暴击，从而提供更多战利品。获得1个【卡蜜尔】和1个【爆爆】。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{'{51972fee}':2,'{a59e2760}':0.5,'{c209103c}':0.10999999940395355,'{ca332ec1}':0.5,'{d89481f4}':1.75}},
    gifts:[{kind:'unit' as const,definitionId:'camille'},{kind:'unit' as const,definitionId:'powder'}],
  },
});
export const AUGMENT_BATCH5_G7_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G7).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_G7_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G7).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_G7_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G7).map(([id,row])=>[id,row.apiName])));

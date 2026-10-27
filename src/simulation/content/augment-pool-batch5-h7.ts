import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive numbers; P-B5-H7 (2026-10-27) defines the execution boundaries. */
export const AUGMENT_BATCH5_H7 = freezeContent({
  'titanic-titan': {
    apiName: 'TFT_Augment_TitanicTitan', tier: 'silver' as const,
    name: '巨型泰坦', description: '使你的当前玩家生命值和最大玩家生命值都提升20。你会在选秀中更早被放出，但速度要慢得多。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { Heal: 20 } },
  },
  'lunch-money': {
    apiName: 'TFT11_Augment_BloodBank', tier: 'silver' as const,
    name: '午餐钱', description: '你每对敌方小小英雄们造成8伤害，就会获得2金币。\n(当前：〔对局动态值〕)',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { Damage: 8, Gold: 2 } },
  },
  'good-for-something': {
    apiName: 'TFT10_Augment_GoodForSomethingSilver', tier: 'silver' as const,
    name: '有用之材 I', description: '未携带装备的弈子们在阵亡时有50%几率掉落1金币。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { DropChance: 0.5, Gold: 1 } },
  },
});
export const AUGMENT_BATCH5_H7_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_H7).map(([id, row]) => [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }] }]),
));
export const AUGMENT_BATCH5_H7_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H7).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_H7_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H7).map(([id, row]) => [id, row.apiName])));

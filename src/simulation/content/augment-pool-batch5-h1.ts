import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 source row; execution follows P-B5-07 (2026-10-27). */
export const AUGMENT_BATCH5_H1 = freezeContent({
  'shop-glitch': {
    enabled: false, apiName: 'TFT_Augment_ShopGlitch', name: '商店故障', tier: 'gold',
    description: '在非玩家对战回合期间，你的商店每2.5秒进行一次免费刷新，共持续30秒。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { RefreshTimer: 2.5, TotalTimer: 30 } }, gifts: [],
  },
  'two-much-value': {
    enabled: true, apiName: 'TFT_Augment_TwoMuchValue', name: '由二生D', tier: 'gold',
    description: '上一个对战回合中每登场过2个独特的2费弈子，就会获得1次刷新。获得2个2费弈子。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { FreeRerolls: 1, NumChampsToGrant: 2, UnitCost: 2, UnitCount: 2, augmentselectbonusgold: null, '{10307c7b}': null, '{d5279bbe}': 2, '{e0965628}': 2 } },
    gifts: [{kind:'random-unit',cost:2,count:2}],
  },
} as const);

const ENABLED = Object.entries(AUGMENT_BATCH5_H1).filter(([,row]) => row.enabled);
export const AUGMENT_BATCH5_H1_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(ENABLED.map(([id,row]) => [id, { id, name: row.name, description: row.description, effects: [{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}] }])));
export const AUGMENT_BATCH5_H1_TIERS = freezeContent(Object.fromEntries(ENABLED.map(([id,row]) => [id,row.tier])));
export const AUGMENT_BATCH5_H1_API_NAMES = freezeContent(Object.fromEntries(ENABLED.map(([id,row]) => [id,row.apiName])));

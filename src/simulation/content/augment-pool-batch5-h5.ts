import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 source values; stage restrictions remain in augment-stage-bans. */
export const AUGMENT_BATCH5_H5 = freezeContent({
  'table-scraps': {
    apiName: 'TFT_Augment_TableScraps', name: '餐桌剩菜', tier: 'silver',
    description: '在接下来的4个选秀回合后，获得1个未被选走的弈子和其装备。获得1金币。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us: 'After the next 4 carousels, gain one unit that was not taken and its item. Gain 1 gold.',
      values: { Gold: 1, NumStages: 4 } },
  },
  'young-and-wild-and-free': {
    apiName: 'TFT9_Augment_YoungAndWildAndFree', name: '不拘一格', tier: 'silver',
    description: '你在选秀回合中总能自由移动。获得2金币。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us: 'You can always move freely on Carousel rounds. Gain 2 gold.',
      values: { Gold: 2 } },
  },
} as const);
export const AUGMENT_BATCH5_H5_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(
  Object.fromEntries(Object.entries(AUGMENT_BATCH5_H5).map(([id, row]) => [id, {
    id, name: row.name, description: row.description,
    effects: [{kind:'mechanic', mechanic:'acquisitionGold', values:{amount:row.source.values.Gold}}],
  }])),
);
export const AUGMENT_BATCH5_H5_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H5).map(([id,row]) => [id,row.tier])));
export const AUGMENT_BATCH5_H5_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H5).map(([id,row]) => [id,row.apiName])));

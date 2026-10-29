import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** 14.24 archive values; execution follows P-B5-68/71-G3 (2026-10-27). */
export const AUGMENT_BATCH5_G3 = freezeContent({
  'aerial-warfare': {
    apiName: 'TFT13_Augment_Firelight', name: '空战', tier: 'gold',
    description: '在【野火帮】弈子们开始一次【野火帮】冲刺时，会获得9%攻击力和9法术强度。他们在该战斗中每移动一格还会获得另外的3%。获得1个【刀疤】和1个【泽丽】。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { Bonus: 3, FirelightBonusAD: 0.09000000357627869, FirelightBonusAP: 9, '{445a9cb6}': 99 } },
    gifts: [{ kind: 'unit', definitionId: 'scar' }, { kind: 'unit', definitionId: 'zeri' }] as readonly AugmentGiftSpec[],
  },
  'natural-selection': {
    apiName: 'TFT13_Augment_Experiment', name: '物竞天择', tier: 'gold',
    description: '【试验品】弈子们获得12%生命值并提供一个特殊格子。这个格子内的【试验品】弈子在战斗开始时会被击杀，从而将其【试验品】加成提供给其它的试验格。获得3个【试验品】弈子。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { Health: 0.11999999731779099, '{1b889d1c}': 100 } },
    // P-AG1's existing explicit-family gift stream: sorted, uniform, with replacement.
    gifts: [{ kind: 'random-unit-pool', definitions: ['zyra', 'urgot', 'nunu', 'drmundo', 'twitch', 'warwick'], count: 3 }] as readonly AugmentGiftSpec[],
  },
} as const);

export const B5_G3_FIELDS = freezeContent({ aerialWarfare: ['dashAdBps', 'dashAp', 'hexAdBps', 'hexAp', 'maxHexes'], mutationSurvives: ['healthBps'], mutationSacrifice: ['enabled'] } as const);
export const AUGMENT_BATCH5_G3_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent({
  'aerial-warfare': {
    id: 'aerial-warfare', name: AUGMENT_BATCH5_G3['aerial-warfare'].name, description: AUGMENT_BATCH5_G3['aerial-warfare'].description,
    effects: [{ kind: 'mechanic', mechanic: 'aerialWarfare', values: {
      dashAdBps: Math.round(AUGMENT_BATCH5_G3['aerial-warfare'].source.values.FirelightBonusAD * 10000),
      dashAp: AUGMENT_BATCH5_G3['aerial-warfare'].source.values.FirelightBonusAP,
      hexAdBps: AUGMENT_BATCH5_G3['aerial-warfare'].source.values.Bonus * 100,
      hexAp: AUGMENT_BATCH5_G3['aerial-warfare'].source.values.Bonus,
      maxHexes: AUGMENT_BATCH5_G3['aerial-warfare'].source.values['{445a9cb6}'],
    } }],
  },
  'natural-selection': {
    id: 'natural-selection', name: AUGMENT_BATCH5_G3['natural-selection'].name, description: AUGMENT_BATCH5_G3['natural-selection'].description,
    effects: [{ kind: 'mechanic', mechanic: 'mutationSurvives', values: { healthBps: Math.round(AUGMENT_BATCH5_G3['natural-selection'].source.values.Health * 10000) } }],
  },
});
export const AUGMENT_BATCH5_G3_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G3).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_G3_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G3).map(([id, row]) => [id, row.apiName])));

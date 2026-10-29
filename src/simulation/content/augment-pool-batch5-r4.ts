import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** B5-67: 14.24 source coefficients and P-B5-67 (2026-10-27). */
export const AUGMENT_BATCH5_R4 = freezeContent({
  'mad-chemist': {
    apiName: 'TFT13_Augment_SingedCarry',
    name: '炼金术士',
    tier: 'silver',
    source: {
      patch: '14.24',
      archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { TOOLTIPONLYOmnivamp: 20 },
    },
    gifts: [{ kind: 'unit', definitionId: 'singed' }],
    spell: {
      totalDamageByStar: [140, 210, 315, 420],
      damageDurationTicks: 100,
      cloudDurationTicks: 60,
      abilityDurationTicks: 80,
      moveSpeed: 250,
      omnivampBps: 2000,
      manaPerSecondPerAttackSpeed: 10,
      trailIntervalTicks: 10,
      trailWidthCells: 1,
    },
  },
} as const);

export const AUGMENT_BATCH5_R4_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent({
  'mad-chemist': {
    id: 'mad-chemist', name: '炼金术士',
    description: '获得1个辛吉德。最强的辛吉德无法攻击，朝最近敌人奔跑并留下1格宽毒迹，5秒共造成140/210/315/420魔法伤害（按法强缩放）。技能对自己提供20%全能吸血和250移动速度，持续4秒。',
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } },
      { kind: 'mechanic', mechanic: 'madChemist', values: { enabled: 1 } }],
  },
});
export const AUGMENT_BATCH5_R4_TIERS = freezeContent({ 'mad-chemist': 'silver' } as const);
export const AUGMENT_BATCH5_R4_API_NAMES = freezeContent({ 'mad-chemist': 'TFT13_Augment_SingedCarry' });

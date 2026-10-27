import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive values; execution follows P-B5-74 (2026-10-27). */
export const AUGMENT_BATCH5_R3 = freezeContent({
  'cloning-facility': {
    apiName: 'TFT_Augment_CloningFacility', name: '克隆设施', tier: 'gold' as const,
    description: '强化棋盘中心的一个格子。召唤格子上弈子的一个复制体，它拥有70%生命值，且法力消耗提升20%。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { HealthPercent: 0.699999988079071, ManaPercent: 0.20000000298023224, '{4074ec36}': 2, '{d47f9a80}': 4 } },
  },
  'hall-of-mirrors': {
    apiName: 'TFT_Augment_HallOfMirrors', name: '镜廊', tier: 'prismatic' as const,
    description: '战斗开始时：你的前排的所有弈子都会成为最中间弈子的复制体。复制体拥有100%的原生命值，并且造成的伤害降低40%。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { DamagePenalty: 0.4000000059604645, HealthRatio: 1 } },
  },
});
export const AUGMENT_BATCH5_R3_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_R3).map(([id, row]) => [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }] }])));
export const AUGMENT_BATCH5_R3_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_R3).map(([id,row]) => [id,row.tier])));
export const AUGMENT_BATCH5_R3_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_R3).map(([id,row]) => [id,row.apiName])));

import type { AugmentGiftSpec } from '../augment-gift-plan';
import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';

/** D4 implementation only. D5 owns offer/tier/API-name registration and epoch recording. */
export const RESTART_MISSION = freezeContent({
  apiName: 'TFT_Augment_RestartMission',
  source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
    values: { '1Cost': 1, '2Cost': 3, '3Cost': 2, NumUnits: 2 } },
  gifts: [
    { kind: 'random-unit', cost: 1, count: 1, starLevel: 2 },
    { kind: 'random-unit', cost: 2, count: 3, starLevel: 2 },
    { kind: 'random-unit', cost: 3, count: 2, starLevel: 2 },
  ] satisfies readonly AugmentGiftSpec[],
});
export const RESTART_MISSION_DEFINITION: ChoiceDefinition = freezeContent({
  id: 'restart-mission', name: '重启任务',
  description: '移除你场上和备战席上的所有弈子。获得2个随机的2星3费弈子、3个2星2费弈子和1个2星1费弈子。',
  effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }],
});

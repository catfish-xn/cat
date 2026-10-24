import { freezeContent } from './freeze';
import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';

/** Batch-3 Training Dummy (14.24 a-level panel: 550 HP, 30 armor/MR, 50 AD, 0.4 AS, range 180, 0 mana; it neither moves
 * nor attacks). P 2026-10-24: fixed one-star stats that never merge, deployable and benchable, counts toward population,
 * cannot be sold, equipped or targeted by consumables; while alive it counts like any unit for player damage. */
export const TRAINING_DUMMY_ID = 'training-dummy';
export const BATCH3_SUMMON_UNITS: Readonly<Record<string, UnitDefinition>> = freezeContent({
  [TRAINING_DUMMY_ID]: { id: TRAINING_DUMMY_ID, name: '训练假人', symbol: '假', color: 9993582, cost: 1, traits: [],
    summon: { sellable: false, countsTowardPopulation: true, fixedStarStats: true },
    baseStats: { health: 550, attack: 50, armor: 30, magicResist: 30 }, attackRange: 1, attackIntervalTicks: 50, baseAttackSpeedBps: 4000,
    initialMana: 0, maxMana: 0, abilityId: 'training-dummy-ability' },
});
export const BATCH3_SUMMON_ABILITIES: Readonly<Record<string, S13AbilityData>> = freezeContent({
  'training-dummy-ability': { id: 'training-dummy-ability', championId: TRAINING_DUMMY_ID, name: '训练假人',
    description: 'A stationary, non-attacking training dummy.', variables: {} },
});
export const isTrainingDummy = (unit: { readonly definitionId: string }): boolean => unit.definitionId === TRAINING_DUMMY_ID;

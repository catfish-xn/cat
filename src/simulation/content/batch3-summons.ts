import { freezeContent } from './freeze';
import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';

/** Batch-3 Training Dummy (14.24 a-level panel: 550 HP, 30 armor/MR, 50 AD, 0.4 AS, range 180, 0 mana; it neither moves
 * nor attacks). P 2026-10-24: fixed one-star stats that never merge, deployable and benchable, counts toward population,
 * cannot be sold, equipped or targeted by consumables; while alive it counts like any unit for player damage. */
export const TRAINING_DUMMY_ID = 'training-dummy';
export const TOWER_DUMMY_ID = 'tower-dummy';
export const BATCH3_SUMMON_UNITS: Readonly<Record<string, UnitDefinition>> = freezeContent({
  [TRAINING_DUMMY_ID]: { id: TRAINING_DUMMY_ID, name: '训练假人', symbol: '假', color: 9993582, cost: 1, traits: [],
    summon: { sellable: false, countsTowardPopulation: true, fixedStarStats: true },
    baseStats: { health: 550, attack: 50, armor: 30, magicResist: 30 }, attackRange: 1, attackIntervalTicks: 50, baseAttackSpeedBps: 4000,
    initialMana: 0, maxMana: 0, abilityId: 'training-dummy-ability' },
  /** Tower Defense's dummy: the dummy panel with DummyAD=60 and DummyAS=0.4 (hash-decoded 14.24 augment fields); it does
   * not move but shoots. P 2026-10-24: range 4 hexes (the spell's castRange 4000 ignores range checks, so no attack range
   * is published). */
  [TOWER_DUMMY_ID]: { id: TOWER_DUMMY_ID, name: '塔防假人', symbol: '塔', color: 9993582, cost: 1, traits: [],
    summon: { sellable: false, countsTowardPopulation: true, fixedStarStats: true },
    baseStats: { health: 550, attack: 60, armor: 30, magicResist: 30 }, attackRange: 4, attackIntervalTicks: 50, baseAttackSpeedBps: 4000,
    initialMana: 0, maxMana: 0, abilityId: 'tower-dummy-ability' },
});
export const BATCH3_SUMMON_ABILITIES: Readonly<Record<string, S13AbilityData>> = freezeContent({
  'training-dummy-ability': { id: 'training-dummy-ability', championId: TRAINING_DUMMY_ID, name: '训练假人',
    description: 'A stationary, non-attacking training dummy.', variables: {} },
  'tower-dummy-ability': { id: 'tower-dummy-ability', championId: TOWER_DUMMY_ID, name: '塔防假人',
    description: 'A stationary dummy that shoots for 100% AD plus an AP-scaled part.', variables: {} },
});
/** TFT_Augment_TowerDefense_Spell_Mis (14.24 map22 {2f117b44}, a-level): APRatio by tier 60/90/135; Upgrade1 at stage 3
 * gives 25% attack speed, Upgrade2 at stage 5 adds an arrow dealing 50%. */
export const TOWER_DEFENSE_SPELL = freezeContent({ apRatio: [60, 90, 135], upgrade1Stage: 3, upgrade1AsBps: 2500, upgrade2Stage: 5, upgrade2Bps: 5000 });
export const isTrainingDummy = (unit: { readonly definitionId: string }): boolean => unit.definitionId === TRAINING_DUMMY_ID;
/** Either batch-3 dummy: never sold, equipped, merged or targeted; replay-authenticated in combat. */
export const isBatch3Dummy = (definitionId: string): boolean => definitionId === TRAINING_DUMMY_ID || definitionId === TOWER_DUMMY_ID;

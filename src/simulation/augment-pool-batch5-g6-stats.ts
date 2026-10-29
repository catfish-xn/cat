import { CARRY_GOLEM, CARRY_GOLEM_UNIT } from './content/augment-pool-batch5-g6';
import { CARRY_GOLEM_ID } from './content/augment-pool-batch5-g6';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import type { Effect, OwnedAugment } from './strategy-types';
import type { Unit, ResolvedUnitStats, StarLevel } from './unit-types';

/** The original prototype coefficients, with normal 1.8x HP / 1.5x AD rank scaling.
 * Keep hundredths of AD through the existing combat arithmetic; truncate below a centi. */
export function carryGolemBaseStats(starLevel: StarLevel): ResolvedUnitStats {
  if (![1, 2, 3, 4].includes(starLevel)) throw new RangeError('Invalid carry golem star');
  const attack = CARRY_GOLEM.attackCenti[starLevel - 1];
  return { health: CARRY_GOLEM.health[starLevel - 1], attack: Math.floor(attack / 100), attackRemainderCenti: attack % 100,
    armor: 40, magicResist: 40, attackRange: 1, attackIntervalTicks: 37, baseAttackSpeedBps: 5500,
    initialMana: 30, maxMana: 100, abilityId: CARRY_GOLEM_UNIT.abilityId };
}

export function carryGolemGrowth(round: number, acquiredRound: number): number {
  return Math.max(0, getMultiplayerRoundByOrdinal(round).stage - getMultiplayerRoundByOrdinal(acquiredRound).stage);
}
export function carryGolemStar(round: number, acquiredRound: number): StarLevel {
  return Math.min(CARRY_GOLEM.maximumStar, 1 + carryGolemGrowth(round, acquiredRound)) as StarLevel;
}
/** Derived from the frozen round and owned acquisition; no mutable stage counter. */
export function carryGolemEffects(round: number, owner: OwnedAugment, unit: Unit): Effect[] {
  if (unit.definitionId !== CARRY_GOLEM_ID) return [];
  const stages = carryGolemGrowth(round, owner.acquiredRound);
  return [{ kind: 'statFlat', stat: 'maxHp', amount: stages * CARRY_GOLEM.healthPerStage },
    { kind: 'statPercentBps', stat: 'attackDamage', bps: stages * CARRY_GOLEM.attackDamageBpsPerStage }];
}

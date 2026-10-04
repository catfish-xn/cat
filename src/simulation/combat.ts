import type { GameState } from './game';
import { UNIT_DEFINITIONS } from './units';
import { compareIds, eliminationResult, MAX_COMBAT_TICKS, type CombatState, type CombatStep, type CombatUnit } from './combat-types';
import { advanceCombatTick } from './combat-tick';
export * from './combat-types';

/** Creates an isolated board-only battle. Preparation is never a combat write target. */
export function createCombat(preparationState: GameState): CombatState {
  const units: CombatUnit[] = preparationState.units.flatMap(unit => {
    if (unit.location.kind !== 'board') return [];
    const stats = UNIT_DEFINITIONS[unit.definitionId].baseStats;
    return [{ id: unit.id, definitionId: unit.definitionId, team: unit.team,
      cell: { ...unit.location.cell }, hp: stats.health, maxHp: stats.health,
      attackDamage: stats.attack, attackRange: unit.definitionId === 'ranger' ? 3 : 1,
      attackIntervalTicks: 20, cooldownTicks: 0, moveCooldownTicks: 0,
      alive: true, targetId: null }];
  }).sort(compareIds);
  const result = eliminationResult(units);
  return {
    board: { ...preparationState.board, deploymentZones: {
      player: { ...preparationState.board.deploymentZones.player },
      enemy: { ...preparationState.board.deploymentZones.enemy },
    } },
    units, tick: 0, maxTicks: MAX_COMBAT_TICKS,
    status: result === null ? 'running' : 'finished', result,
  };
}
export function stepCombat(state: CombatState): CombatStep {
  if (state.status === 'finished') return { state, events: [] };
  return advanceCombatTick(state);
}

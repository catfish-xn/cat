import type { StrategySnapshot } from './strategy-types';
import { initializeEffectRuntime } from './effects';
import { applyCombatStart } from './combat-effects';
import type { GameState } from './game';
import { getUnitStats } from './unit-stats';
import { resolveAbility } from './combat-abilities';
import { compareIds, eliminationResult, MAX_COMBAT_TICKS, type CombatState, type CombatStep, type CombatUnit } from './combat-types';
import { advanceCombatTick } from './combat-tick';
export * from './combat-types';

export type CombatStartFailure = 'missing-player' | 'missing-enemy' | 'missing-both';
/** Preparation gate only; terminal-state semantics of createCombat stay unchanged. */
export function validateCombatStart(preparation: GameState): CombatStartFailure | undefined {
  const deployed = preparation.units.filter(unit => unit.location.kind === 'board');
  const player = deployed.some(unit => unit.team === 'player');
  const enemy = deployed.some(unit => unit.team === 'enemy');
  if (!player && !enemy) return 'missing-both';
  if (!player) return 'missing-player';
  if (!enemy) return 'missing-enemy';
  return undefined;
}

/** Creates an isolated board-only battle. Preparation is never a combat write target. */
function snapshotCombat(preparationState: GameState, strategy?: StrategySnapshot, combatId = 'standalone'): CombatState {
  const units: CombatUnit[] = preparationState.units.flatMap(unit => {
    if (unit.location.kind !== 'board') return [];
    const resolved = strategy?.units.find(entry => entry.unitId === unit.id);
    if (strategy && !resolved) throw new Error(`Missing strategy unit: ${unit.id}`);
    const stats = resolved?.stats ?? getUnitStats(unit.definitionId, unit.starLevel);
    return [{ id: unit.id, definitionId: unit.definitionId, team: unit.team, starLevel: unit.starLevel,
      cell: { ...unit.location.cell }, hp: stats.health, maxHp: stats.health,
      attackDamage: stats.attack, attackRange: stats.attackRange,
      attackIntervalTicks: stats.attackIntervalTicks, cooldownTicks: 0, moveCooldownTicks: 0,
      armor: stats.armor, magicResist: stats.magicResist, mana: stats.initialMana, maxMana: stats.maxMana,
      shield: 0, shieldExpiresAtTick: null, ability: resolved ? structuredClone(resolved.ability) : resolveAbility(stats.abilityId, unit.starLevel),
      ...(resolved ? { sources: structuredClone(resolved.sources), triggers: structuredClone(resolved.triggers), effectRuntime: initializeEffectRuntime(resolved.triggers) } : {}),
      alive: true, targetId: null }];
  }).sort(compareIds);
  const result = eliminationResult(units);
  return {
    board: { ...preparationState.board, deploymentZones: {
      player: { ...preparationState.board.deploymentZones.player },
      enemy: { ...preparationState.board.deploymentZones.enemy },
    } },
    ...(strategy ? { strategy: structuredClone(strategy), combatId, nextEventSeq: 0, startEffectsApplied: false } : {}),
    units, tick: 0, maxTicks: MAX_COMBAT_TICKS,
    status: result === null ? 'running' : 'finished', result,
  };
}
export function createCombat(preparationState: GameState): CombatState { return snapshotCombat(preparationState); }
export function createCombatWithEvents(preparation: GameState, strategy: StrategySnapshot, combatId: string): CombatStep {
  return applyCombatStart(snapshotCombat(preparation, strategy, combatId));
}
export function stepCombat(state: CombatState): CombatStep {
  if (state.status === 'finished') return { state, events: [] };
  return advanceCombatTick(state);
}

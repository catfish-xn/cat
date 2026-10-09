import { COMPILED_NEUTRAL_ENCOUNTERS, readNeutralCombatUnit } from './neutral-encounter-compiler';
import { compileItemCrit, itemPrograms } from './m8/item-program';
import { compileUnitInputs } from './m8/unit-inputs';
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
function snapshotCombat(preparationState: GameState, strategy?: StrategySnapshot, combatId = 'standalone', rngState = 42): CombatState {
  const units: CombatUnit[] = preparationState.units.flatMap(unit => {
    if (unit.location.kind !== 'board') return [];
    const resolved = strategy?.units.find(entry => entry.unitId === unit.id);
    if (strategy && !resolved) throw new Error(`Missing strategy unit: ${unit.id}`);
    const stats = resolved?.stats ?? getUnitStats(unit.definitionId, unit.starLevel);
    const ability = resolved ? structuredClone(resolved.ability) : resolveAbility(stats.abilityId, unit.starLevel);
    const neutral = stats.unitKind === 'neutral' ? readNeutralCombatUnit(unit.id) : undefined;
    if (stats.unitKind === 'neutral' && (!neutral || neutral.definitionId !== unit.definitionId || neutral.encounterId !== unit.encounterId || unit.team !== 'enemy')) throw new RangeError('Invalid neutral combat identity');
    return [{ ...(neutral?.companionDefinitions ? {companionDefinitions:structuredClone(neutral.companionDefinitions)} : {}),
      ...(neutral?.attackCone ? {attackCone:structuredClone(neutral.attackCone)} : {}), ...compileUnitInputs(stats), ...(unit.encounterId ? { encounterId: unit.encounterId } : {}), id: unit.id, definitionId: unit.definitionId, team: unit.team, starLevel: unit.starLevel,
      cell: { ...unit.location.cell }, hp: Math.floor(stats.health * (resolved?.mechanics?.find(m => m.mechanic === 'glassCannon')?.values.startingHealthBps ?? 10000) / 10000), maxHp: stats.health,
      attackDamage: stats.attack, attackRange: stats.attackRange,
      attackIntervalTicks: stats.attackIntervalTicks, cooldownTicks: 0, moveCooldownTicks: 0,
      armor: stats.armor, magicResist: stats.magicResist, mana: stats.initialMana, maxMana: stats.maxMana,
      shield: 0, shieldExpiresAtTick: null, ability,
      ...(resolved ? { sources: structuredClone(resolved.sources), triggers: structuredClone(resolved.triggers), effectRuntime: initializeEffectRuntime(resolved.triggers) } : {}),
      ...(ability.kind === 's13' ? { attackDamageBase: resolved?.attackDamageBase ?? stats.attack, attackDamagePercentBps: resolved?.attackDamagePercentBps ?? 0, abilityPower: resolved?.abilityPower ?? 100,
        baseAttackSpeedBps: stats.baseAttackSpeedBps ?? Math.floor(200000 / stats.attackIntervalTicks),
        attackSpeedBonusBps: stats.attackSpeedBonusBps ?? 0,
        maxHpBasis: { base: getUnitStats(unit.definitionId, unit.starLevel).health,
          flat: (resolved?.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statFlat' && e.effect.stat === 'maxHp' ? e.effect.amount : 0), 0),
          bps: (resolved?.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statPercentBps' && e.effect.stat === 'maxHp' ? e.effect.bps : 0), 0), bonusBps: 0 },
        ...(resolved?.itemPrograms ? {itemPrograms:structuredClone(resolved.itemPrograms)} : {}),
        mechanics: structuredClone(resolved?.mechanics ?? []), shieldLayers: [], statuses: [], tasks: [],
        runtime: { attackCount: 0, castCount: 0, attackSpeedBps: 0, abilityPowerFlat: 0, rangeBonus: 0,
          nextAttackMagic: 0, nextAttackPhysical: 0, permanentAdBps: 0, buddyTriggered: false } } : {}),
      alive: true, targetId: null }];
  }).sort(compareIds);
  for (const unit of units) if (itemPrograms(unit).length) (unit as {spellCrit?: CombatUnit['spellCrit']}).spellCrit = compileItemCrit(unit);
  const result = eliminationResult(units);
  return {
    board: { ...preparationState.board, deploymentZones: {
      player: { ...preparationState.board.deploymentZones.player },
      enemy: { ...preparationState.board.deploymentZones.enemy },
    } },
    ...(strategy ? { strategy: structuredClone(strategy), combatId, nextEventSeq: 0, startEffectsApplied: false } : {}),
    ...(units.some(u=>u.unitKind==='neutral') ? {openingDefinitions:structuredClone(COMPILED_NEUTRAL_ENCOUNTERS.flatMap(e=>e.openingDefinitions).filter(d=>units.some(u=>u.id===d.source.ownerId)))} : {}),
    rngState, rngDraws: 0, nextActionSeq: 0, units, tick: 0, maxTicks: MAX_COMBAT_TICKS,
    status: result === null ? 'running' : 'finished', result,
  };
}
export function createCombat(preparationState: GameState): CombatState { return snapshotCombat(preparationState); }
export function createCombatWithEvents(preparation: GameState, strategy: StrategySnapshot, combatId: string, rngState = 42): CombatStep {
  return applyCombatStart(snapshotCombat(preparation, strategy, combatId, rngState));
}
export function stepCombat(state: CombatState): CombatStep {
  if (state.status === 'finished') return { state, events: [] };
  return advanceCombatTick(state);
}

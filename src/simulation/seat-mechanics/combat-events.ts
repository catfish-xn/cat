import { contains, sameCell, type HexCell, type Team } from '../board';
import type { CombatEvent, CombatOrigin, CombatState, CombatUnit } from '../combat-types';

/**
 * G2-3 combat ledger events (MATCH_CONTRACT「G2-3 机制通用接口」). They join CombatEventData and M8CombatEvent; the engine stamps them
 * like any other event. unitSpawned/unitRemoved must accompany every change of CombatState.units membership.
 */
export type G23CombatEventData =
  /** A unit entered combat after tick 0 (Gangplank barrel, Silco monster, anomaly summons). source.ownerId = summoner. */
  | { readonly type: 'unitSpawned'; readonly tick: number; readonly unitId: string; readonly definitionId: string; readonly team: Team; readonly cell: HexCell; readonly source: CombatOrigin }
  /** A unit left CombatState.units (barrel detonated, summon expired). Death of an ordinary unit stays 'death'. */
  | { readonly type: 'unitRemoved'; readonly tick: number; readonly unitId: string; readonly reason: string }
  /** One rolled ability result, e.g. High Roller: outcome 'rocket' | 'shield' | 'gold' | 'triple', subOutcomes for triple. */
  | { readonly type: 'castOutcome'; readonly tick: number; readonly unitId: string; readonly abilityKey: string; readonly outcome: string; readonly subOutcomes: readonly string[] }
  /** Sion bound (true) / broke free (false); reason e.g. 'combat-start' | 'casts' | 'hp-threshold'. */
  | { readonly type: 'bindingChanged'; readonly tick: number; readonly unitId: string; readonly bound: boolean; readonly reason: string };

export interface CombatMembershipChange { readonly state: CombatState; readonly events: readonly CombatEvent[] }

/**
 * Appends a fully built unit (stats, ability, mechanics already resolved by the rule side) at the end of state.units and
 * returns its unitSpawned event for the current step's event list. The replay keeps state.units order, so always append.
 * Throws on a duplicate id or an occupied/out-of-board cell; never moves another unit.
 */
export function spawnCombatUnit(state: CombatState, unit: CombatUnit, source: CombatOrigin, tick: number): CombatMembershipChange {
  if (state.units.some(other => other.id === unit.id)||state.removedUnitIds?.includes(unit.id)) throw new RangeError(`Duplicate combat unit ${unit.id}`);
  if (!contains(state.board, unit.cell) || state.units.some(other => other.alive && sameCell(other.cell, unit.cell)))
    throw new RangeError(`Spawn cell unavailable for ${unit.id}`);
  return { state: { ...state, units: [...state.units, unit] }, events: [{ type: 'unitSpawned', tick, unitId: unit.id,
    definitionId: unit.definitionId, team: unit.team, cell: { col: unit.cell.col, row: unit.cell.row }, source: { ...source } }] };
}

/** Removes a unit from state.units and clears other units' targetId pointing at it. */
export function removeCombatUnit(state: CombatState, unitId: string, reason: string, tick: number): CombatMembershipChange {
  if (!state.units.some(unit => unit.id === unitId)) throw new RangeError(`Unknown combat unit ${unitId}`);
  const units = state.units.filter(unit => unit.id !== unitId).map(unit => unit.targetId === unitId ? { ...unit, targetId: null } : unit);
  return { state: { ...state, units,removedUnitIds:[...state.removedUnitIds??[],unitId] }, events: [{ type: 'unitRemoved', tick, unitId, reason }] };
}

export function castOutcomeEvent(tick: number, unitId: string, abilityKey: string, outcome: string, subOutcomes: readonly string[] = []): CombatEvent {
  return { type: 'castOutcome', tick, unitId, abilityKey, outcome, subOutcomes: [...subOutcomes] };
}
export function bindingChangedEvent(tick: number, unitId: string, bound: boolean, reason: string): CombatEvent {
  return { type: 'bindingChanged', tick, unitId, bound, reason };
}

import { isOverflowUnit, usableBenchSlots } from './bench-capacity';
import { isAnvil } from './content/anvils';
import { contains, DEFAULT_BOARD, isDeploymentCell, sameCell, type Board } from './board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from './units';
import { countsTowardPopulation } from './seat-mechanics/forms';
export interface GameState { readonly board: Board; readonly benchSize: number; readonly usableBenchSlots?: number; readonly overflowUnitIds?: readonly string[]; readonly units: readonly Unit[] }
export type DeploymentFailure = 'unknown-unit' | 'enemy-unit' | 'invalid-location' | 'outside-deployment-zone' | 'occupied';
export type DeploymentResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly reason: DeploymentFailure; readonly state: GameState };
export function createGame(): GameState {
  const playerUnits: Unit[] = ['sentinel', 'ranger', 'mystic', 'sentinel', 'ranger'].map((definitionId, slot) => ({
    id: `unit-${slot + 1}`, definitionId, team: 'player', starLevel: 1, location: { kind: 'bench', slot },
  }));
  const enemyUnits: Unit[] = [
    { id: 'enemy-1', definitionId: 'sentinel', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 2, row: 1 } } },
    { id: 'enemy-2', definitionId: 'ranger', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 4, row: 2 } } },
  ];
  return { board: DEFAULT_BOARD, benchSize: 7, units: [...playerUnits, ...enemyUnits] };
}

function sameLocation(a: UnitLocation, b: UnitLocation): boolean {
  return a.kind === 'board' && b.kind === 'board' ? sameCell(a.cell, b.cell)
    : a.kind === 'bench' && b.kind === 'bench' && a.slot === b.slot;
}
function locationFailure(state: GameState, target: UnitLocation): DeploymentFailure | undefined {
  if (!target || typeof target !== 'object' || (target.kind !== 'board' && target.kind !== 'bench')
    || (target.kind === 'board' && (!target.cell || typeof target.cell !== 'object'))) return 'invalid-location';
  const valid = target.kind === 'board' ? contains(state.board, target.cell) : Number.isInteger(target.slot) && target.slot >= 0 && target.slot < usableBenchSlots(state);
  if (!valid) return 'invalid-location';
  if (target.kind === 'board' && !isDeploymentCell(state.board, 'player', target.cell)) return 'outside-deployment-zone';
  return undefined;
}
/** Player preparation placement; an allied occupant trades locations atomically. */
export function validateDeployment(state: GameState, unitId: string, target: UnitLocation): DeploymentFailure | undefined {
  // Preserve malformed-target precedence over source identity.
  if (!target || typeof target !== 'object' || (target.kind !== 'board' && target.kind !== 'bench')
    || (target.kind === 'board' && (!target.cell || typeof target.cell !== 'object'))) return 'invalid-location';
  const unit = state.units.find(unit => unit.id === unitId);
  if (!unit) return 'unknown-unit';
  if (unit.team !== 'player') return 'enemy-unit';
  if (isOverflowUnit(state, unitId) || state.units.some(u => u.id !== unitId && isOverflowUnit(state,u.id) && sameLocation(u.location,target))) return 'invalid-location';
  const reason = locationFailure(state, target);
  if (reason) return reason;
  if(['trainer-golem','carry-golem'].includes(unit.definitionId) && target.kind==='bench')return 'invalid-location';
  if(isAnvil(unit.definitionId)&&target.kind==='board')return 'invalid-location';
  const occupants = state.units.filter(other => other.id !== unitId && sameLocation(other.location, target));
  if(unit.location.kind==='board'&&occupants.some(u=>isAnvil(u.definitionId)))return 'invalid-location';
  if (occupants.length > 1 || occupants.some(other => other.team !== 'player')) return 'occupied';
  if(occupants.some(u=>['trainer-golem','carry-golem'].includes(u.definitionId)) && unit.location.kind==='bench')return 'invalid-location';
  // Both destinations must be legal; never swap an ally into an invalid/enemy-zone source.
  if (occupants.length) return locationFailure(state, unit.location);
  return undefined;
}
function copyLocation(location: UnitLocation): UnitLocation {
  return location.kind === 'board' ? { kind: 'board', cell: { ...location.cell } } : { ...location };
}
export function deployUnit(state: GameState, unitId: string, target: UnitLocation): DeploymentResult {
  const reason = validateDeployment(state, unitId, target);
  if (reason) return { ok: false, reason, state };
  const source = state.units.find(unit => unit.id === unitId)!;
  const occupant = state.units.find(unit => unit.id !== unitId && sameLocation(unit.location, target));
  return { ok: true, state: { ...state, units: state.units.map(unit => unit.id === unitId
    ? { ...unit, location: copyLocation(target) }
    : unit === occupant ? { ...unit, location: copyLocation(source.location) } : unit) } };
}
export function getPlayerDeploymentCount(state: GameState): number {
  return state.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board' && !isOverflowUnit(state,unit.id) && countsTowardPopulation(unit.definitionId)).length;
}
export function getDefinition(unit: Unit) { return UNIT_DEFINITIONS[unit.definitionId]; }

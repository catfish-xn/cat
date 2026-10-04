import { contains, DEFAULT_BOARD, isDeploymentCell, sameCell, type Board } from './board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from './units';
export interface GameState { readonly board: Board; readonly benchSize: number; readonly units: readonly Unit[] }
export type DeploymentFailure = 'unknown-unit' | 'enemy-unit' | 'invalid-location' | 'outside-deployment-zone' | 'occupied';
export type DeploymentResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly reason: DeploymentFailure; readonly state: GameState };
export function createGame(): GameState {
  const playerUnits: Unit[] = ['sentinel', 'ranger', 'mystic', 'sentinel', 'ranger'].map((definitionId, slot) => ({
    id: `unit-${slot + 1}`, definitionId, team: 'player', location: { kind: 'bench', slot },
  }));
  const enemyUnits: Unit[] = [
    { id: 'enemy-1', definitionId: 'sentinel', team: 'enemy', location: { kind: 'board', cell: { col: 2, row: 1 } } },
    { id: 'enemy-2', definitionId: 'ranger', team: 'enemy', location: { kind: 'board', cell: { col: 4, row: 2 } } },
  ];
  return { board: DEFAULT_BOARD, benchSize: 7, units: [...playerUnits, ...enemyUnits] };
}

/** Player preparation placement only. Future combat movement must use separate commands. */
export function validateDeployment(state: GameState, unitId: string, target: UnitLocation): DeploymentFailure | undefined {
  const unit = state.units.find(unit => unit.id === unitId);
  if (!unit) return 'unknown-unit';
  if (unit.team !== 'player') return 'enemy-unit';
  const valid = target.kind === 'board' ? contains(state.board, target.cell) : Number.isInteger(target.slot) && target.slot >= 0 && target.slot < state.benchSize;
  if (!valid) return 'invalid-location';
  if (target.kind === 'board' && !isDeploymentCell(state.board, 'player', target.cell)) return 'outside-deployment-zone';
  const occupied = state.units.some(unit => unit.id !== unitId && unit.location.kind === target.kind && (unit.location.kind === 'board' && target.kind === 'board' ? sameCell(unit.location.cell, target.cell) : unit.location.kind === 'bench' && target.kind === 'bench' && unit.location.slot === target.slot));
  if (occupied) return 'occupied';
  return undefined;
}

export function deployUnit(state: GameState, unitId: string, target: UnitLocation): DeploymentResult {
  const reason = validateDeployment(state, unitId, target);
  if (reason) return { ok: false, reason, state };
  const location: UnitLocation = target.kind === 'board' ? { kind: 'board', cell: { ...target.cell } } : { ...target };
  return { ok: true, state: { ...state, units: state.units.map(unit => unit.id === unitId ? { ...unit, location } : unit) } };
}
export function getPlayerDeploymentCount(state: GameState): number {
  return state.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board').length;
}
export function getDefinition(unit: Unit) { return UNIT_DEFINITIONS[unit.definitionId]; }

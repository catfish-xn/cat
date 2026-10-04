import { contains, DEFAULT_BOARD, sameCell, type Board } from './board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from './units';
export interface GameState { readonly board: Board; readonly benchSize: number; readonly units: readonly Unit[] }
export type MoveResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly reason: 'unknown-unit' | 'invalid-location' | 'occupied'; readonly state: GameState };
export function createGame(): GameState {
  return { board: DEFAULT_BOARD, benchSize: 7, units: ['sentinel', 'ranger', 'mystic', 'sentinel', 'ranger'].map((definitionId, slot) => ({ id: `unit-${slot + 1}`, definitionId, location: { kind: 'bench', slot } })) };
}
export function moveUnit(state: GameState, unitId: string, target: UnitLocation): MoveResult {
  if (!state.units.some(unit => unit.id === unitId)) return { ok: false, reason: 'unknown-unit', state };
  const valid = target.kind === 'board' ? contains(state.board, target.cell) : Number.isInteger(target.slot) && target.slot >= 0 && target.slot < state.benchSize;
  if (!valid) return { ok: false, reason: 'invalid-location', state };
  const occupied = state.units.some(unit => unit.id !== unitId && unit.location.kind === target.kind && (unit.location.kind === 'board' && target.kind === 'board' ? sameCell(unit.location.cell, target.cell) : unit.location.kind === 'bench' && target.kind === 'bench' && unit.location.slot === target.slot));
  if (occupied) return { ok: false, reason: 'occupied', state };
  const location: UnitLocation = target.kind === 'board' ? { kind: 'board', cell: { ...target.cell } } : { ...target };
  return { ok: true, state: { ...state, units: state.units.map(unit => unit.id === unitId ? { ...unit, location } : unit) } };
}
export function getDefinition(unit: Unit) { return UNIT_DEFINITIONS[unit.definitionId]; }

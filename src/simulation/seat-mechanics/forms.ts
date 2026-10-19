import { DEFAULT_BOARD, type Board, type Team } from '../board';
import type { Unit, UnitDefinition, UnitLocation } from '../unit-types';
import { UNIT_DEFINITIONS } from '../units';
import type { UnitForm } from './types';

/**
 * User decision 2026-10-16: a form swapper's form is set by its row when combat starts and never changes in that combat.
 * The two deployment rows nearest the enemy are melee, the two farthest are ranged. Bench units and units without
 * `formSwap` have no form (null). Pure: the authority, the private view and the client selectors all call this.
 */
export function resolveUnitForm(definition: Pick<UnitDefinition, 'formSwap'> | undefined, team: Team, location: UnitLocation, board: Board = DEFAULT_BOARD): UnitForm | null {
  if (!definition?.formSwap || location.kind !== 'board') return null;
  const zone = board.deploymentZones[team], row = location.cell.row;
  if (row < zone.firstRow || row > zone.lastRow) return null;
  // Player rows grow away from the enemy; enemy rows grow toward it.
  const depth = team === 'player' ? row - zone.firstRow : zone.lastRow - row;
  return depth < 2 ? 'melee' : 'ranged';
}

/** Current form of a preparation unit, from its content definition. */
export function getUnitForm(unit: Pick<Unit, 'definitionId' | 'team' | 'location'>, board: Board = DEFAULT_BOARD): UnitForm | null {
  return resolveUnitForm(UNIT_DEFINITIONS[unit.definitionId], unit.team, unit.location, board);
}

/** Summon flags (UnitDefinition.summon). Ordinary heroes are sellable and count toward population. */
export function isSellableUnit(definitionId: string): boolean {
  return UNIT_DEFINITIONS[definitionId]?.summon?.sellable ?? true;
}
export function countsTowardPopulation(definitionId: string): boolean {
  return UNIT_DEFINITIONS[definitionId]?.summon?.countsTowardPopulation ?? true;
}

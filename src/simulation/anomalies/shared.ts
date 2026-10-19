import type { Board, HexCell } from '../board';
import { hexDistance, sameCell } from '../board';
import type { CombatUnit } from '../combat-types';
import type { AbilityContext } from '../combat-s13-abilities';
import type { S13Unit } from '../combat-s13-state';
import { occupiesCell } from './availability';
import { effectiveStatuses } from '../m8/status';

export { definition } from './definitions';
export const cells = (board: Board): HexCell[] => Array.from({ length: board.rows }, (_, row) =>
  Array.from({ length: board.columns }, (_, col) => ({ col, row }))).flat();
export const cellOrder = (a: HexCell, b: HexCell): number => a.row - b.row || a.col - b.col;
export function freeCells(ctx: AbilityContext, movingId?: string): HexCell[] {
  return cells(ctx.board).filter(c => !ctx.units.some(u => u.id !== movingId && occupiesCell(u, ctx.tick) && sameCell(u.cell, c)));
}
export function nearestLanding(ctx: AbilityContext, desired: HexCell, movingId: string): HexCell | undefined {
  return freeCells(ctx, movingId).sort((a, b) => hexDistance(desired, a) - hexDistance(desired, b) || cellOrder(a, b))[0];
}
export function relocate(ctx: AbilityContext, unit: S13Unit, to: HexCell | undefined): void {
  if (!to || sameCell(unit.cell, to)) return;
  ctx.events.push({ type: 'movement', tick: ctx.tick, unitId: unit.id, from: { ...unit.cell }, to: { ...to } });
  unit.cell = { ...to }; unit.moveCooldownTicks = 5;
}
export function canDisplace(unit: CombatUnit, tick: number): boolean {
  return !unit.mechanics?.some(m => m.mechanic === 'g23Anomaly' && m.source.definitionId === 'deep-roots')
    && !effectiveStatuses(unit.mechanismState?.statuses ?? [], tick).some(g => g.kind === 'control-immunity');
}

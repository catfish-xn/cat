import { occupiesCell } from './anomalies/availability';
import { getNeighbors, hexDistance, sameCell, type HexCell } from './board';
import { canMove } from './combat-movement';
import type { AbilityContext } from './combat-s13-abilities';
import type { S13Unit } from './combat-s13-state';

const key = (cell: HexCell): string => `${cell.col}:${cell.row}`;
function blockedCells(ctx: AbilityContext, unit: S13Unit): Set<string> {
  return new Set([...ctx.movementReservations ?? [], ...ctx.units
    .filter(other => other.id !== unit.id && occupiesCell(other, ctx.tick)).map(other => key(other.cell))]);
}
function dash(ctx: AbilityContext, unit: S13Unit, to: HexCell, reason: 'ambessa-chain' | 'ambessa-fist-retreat'): void {
  if (sameCell(unit.cell, to)) return;
  ctx.events.push({ type: 'movement', tick: ctx.tick, unitId: unit.id, from: { ...unit.cell }, to, reason });
  unit.cell = to;
  (ctx.movementReservations ??= new Set()).add(key(to));
}

/** P: nearest reachable adjacent cell by hex distance; ties keep ordinary BFS neighbor order. */
export function dashAmbessaChain(ctx: AbilityContext, unit: S13Unit, target: S13Unit): void {
  if (!canMove(unit, ctx.tick)) return;
  const blocked = blockedCells(ctx, unit), seen = new Set([key(unit.cell)]), queue = [unit.cell];
  let destination: HexCell | undefined;
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (i > 0 && hexDistance(cell, target.cell) === 1 && (!destination || hexDistance(unit.cell, cell) < hexDistance(unit.cell, destination))) destination = cell;
    for (const next of getNeighbors(ctx.board, cell)) {
      if (seen.has(key(next)) || blocked.has(key(next))) continue;
      seen.add(key(next)); queue.push(next);
    }
  }
  if (destination) dash(ctx, unit, destination, 'ambessa-chain');
}

/** Tick-local continuation, after HP/survival commit; never serialized between ticks. */
export function settleAmbessaRetreats(ctx: AbilityContext): void {
  for (const retreat of ctx.ambessaRetreats ?? []) {
    const unit = ctx.units.find(other => other.id === retreat.unitId)!;
    if (!canMove(unit, ctx.tick)) continue;
    const home = ctx.board.deploymentZones[unit.team], away = ctx.board.deploymentZones[unit.team === 'player' ? 'enemy' : 'player'];
    const direction = Math.sign(home.firstRow + home.lastRow - away.firstRow - away.lastRow);
    // Select the geometric retreat first. A blocked destination does not cause a sideways fallback.
    const to = getNeighbors(ctx.board, unit.cell).find(cell => (cell.row - unit.cell.row) * direction > 0
      && hexDistance(cell, retreat.targetCell) > hexDistance(unit.cell, retreat.targetCell));
    if (to && !blockedCells(ctx, unit).has(key(to))) dash(ctx, unit, to, 'ambessa-fist-retreat');
  }
}

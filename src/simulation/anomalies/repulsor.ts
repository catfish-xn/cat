import type { AnomalyModule } from './contracts';
import { definition, cells, freeCells, cellOrder, relocate, canDisplace } from './shared';
import { getNeighbors, hexDistance, sameCell } from '../board';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.Repulsor.values;
export const repulsor: AnomalyModule = {
  definition: definition('Repulsor'),
  cast(ctx, unit, target) {
    const distance = hexDistance(unit.cell, target.cell);
    if (distance > v.KnockbackRange || !canDisplace(target, ctx.tick)) return;
    // Keep the distance/row/column tie-break, then walk the chosen ray without jumping blockers.
    const destination = cells(ctx.board).filter(c => hexDistance(target.cell, c) <= v.KnockbackRange
      && hexDistance(unit.cell, c) === distance + hexDistance(target.cell, c))
      .sort((a, b) => hexDistance(unit.cell, b) - hexDistance(unit.cell, a) || cellOrder(a, b))[0];
    if (!destination) return;
    const free = freeCells(ctx, target.id);
    let landing = target.cell;
    for (let step = 1; step <= v.KnockbackRange && !sameCell(landing, destination); step++) {
      const next = getNeighbors(ctx.board, landing).filter(c => hexDistance(unit.cell, c) === distance + step
        && hexDistance(c, destination) === hexDistance(landing, destination) - 1).sort(cellOrder)[0];
      if (!next || !free.some(c => sameCell(c, next))) break;
      landing = next;
    }
    relocate(ctx, target, landing);
  },
};

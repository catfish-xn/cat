import type { AnomalyModule } from './contracts';
import { definition, freeCells, cellOrder, relocate, canDisplace } from './shared';
import { hexDistance } from '../board';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.Repulsor.values;
export const repulsor: AnomalyModule = {
  definition: definition('Repulsor', [{ kind: 'attackSpeedBps', bps: Math.round(v.BonusAS * 10000) }]),
  cast(ctx, unit, target) {
    const distance = hexDistance(unit.cell, target.cell);
    if (distance > v.KnockbackRange || !canDisplace(target, ctx.tick)) return;
    // Project convention: move up to two free hexes along an outward hex ray.
    relocate(ctx, target, freeCells(ctx, target.id).filter(c => hexDistance(target.cell, c) <= v.KnockbackRange
      && hexDistance(unit.cell, c) === distance + hexDistance(target.cell, c))
      .sort((a, b) => hexDistance(unit.cell, b) - hexDistance(unit.cell, a) || cellOrder(a, b))[0]);
  },
};

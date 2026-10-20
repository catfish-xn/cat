import type { AnomalyModule } from './contracts';
import { definition, freeCells, cellOrder, relocate } from './shared';
import { enemies, applyStatus } from '../combat-s13-state';
import { hexDistance } from '../board';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.CertainDeath.values;
export const certainDeath: AnomalyModule = {
  definition: definition('CertainDeath'),
  cast(ctx, unit, _target, source) {
    const state = unit.anomalyState ??= {};
    if (state.firstCastTick !== undefined) return;
    state.firstCastTick = ctx.tick;
    const foes = enemies(unit, ctx.units), count = (c: typeof unit.cell) => foes.filter(e => hexDistance(c, e.cell) <= v.HexRadius).length;
    relocate(ctx, unit, freeCells(ctx, unit.id).sort((a, b) => count(b) - count(a)
      || hexDistance(unit.cell, a) - hexDistance(unit.cell, b) || cellOrder(a, b))[0]);
    for (const foe of foes.filter(e => hexDistance(unit.cell, e.cell) <= v.HexRadius))
      applyStatus(foe, source, 'stun', 0, Math.round(v.StunDuration * 20), ctx.tick, ctx.events);
  },
};

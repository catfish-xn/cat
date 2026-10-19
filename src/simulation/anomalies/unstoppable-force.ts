import type { AnomalyModule } from './contracts';
import { definition, freeCells, cellOrder, relocate } from './shared';
import { byDistance, enemies, applyStatus } from '../combat-s13-state';
import { hexDistance } from '../board';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.UnstoppableForce.values;
export const unstoppableForce: AnomalyModule = {
  definition: definition('UnstoppableForce'),
  takedown(ctx, unit, victimId, source) {
    const state = unit.anomalyState ??= {}, receipts = state.takedowns ??= [];
    if (receipts.includes(victimId)) return;
    receipts.push(victimId);
    const target = byDistance(unit, enemies(unit, ctx.units).filter(u => u.hp > 0 && u.id !== victimId))[0];
    if (target) {
      relocate(ctx, unit, freeCells(ctx, unit.id).filter(c => hexDistance(c, target.cell) === 1)
        .sort((a, b) => hexDistance(unit.cell, a) - hexDistance(unit.cell, b) || cellOrder(a, b))[0]);
      applyStatus(target, source, 'stun', 0, Math.round(v.StunDuration * 20), ctx.tick, ctx.events);
    }
    ctx.heals.push({ source, targetId: unit.id, amount: Math.floor(unit.maxHp * v.PctHealthHeal / 100) });
  },
};

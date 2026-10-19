import type { AnomalyModule } from './contracts';
import { definition, nearestLanding, relocate } from './shared';
import { applyStatus } from '../combat-s13-state';
import { isPresent } from './availability';
import { asSource } from '../m8/s13-definitions';
import { P4_SOURCE } from './source';
const v = P4_SOURCE.DramaticEntrance.values;
export const dramaticEntrance: AnomalyModule = {
  definition: definition('DramaticEntrance'),
  start(_ctx, unit) { (unit.anomalyState ??= {}).absentUntilTick = Math.round(v.Delay * 20); },
  tick(ctx, unit, source) {
    const state = unit.anomalyState!;
    if (ctx.tick < state.absentUntilTick! || state.enteredAtTick !== undefined) return;
    const to = nearestLanding(ctx, unit.startingCell ?? unit.cell, unit.id);
    if (!to) { state.absentUntilTick = ctx.tick + 1; return; } // Reserve no occupied cell; retry next tick.
    state.enteredAtTick = ctx.tick;
    if(unit.mechanismState)unit.mechanismState={...unit.mechanismState,periodicTasks:unit.mechanismState.periodicTasks.map(t=>{
      const skipped=Math.max(0,Math.ceil((ctx.tick-t.nextPulseAtTick)/t.periodTicks));
      return {...t,nextPulseAtTick:t.nextPulseAtTick+skipped*t.periodTicks,pulseOrdinal:t.pulseOrdinal+skipped};
    })};
    relocate(ctx, unit, to);
    const beforeMax = unit.maxHp, beforeHp = unit.hp;
    unit.maxHpBasis = { ...unit.maxHpBasis!, bonusBps: unit.maxHpBasis!.bonusBps + Math.round(v.IncreasedMaxHealthPercent * 10000) };
    const b = unit.maxHpBasis;
    unit.maxHp = Math.floor((b.base + b.flat) * (10000 + b.bps + b.bonusBps) / 10000);
    unit.hp += unit.maxHp - beforeMax;
    ctx.events.push({ type: 'maxHpChanged', tick: ctx.tick, unitId: unit.id, source: asSource(source),
      beforeMax, afterMax: unit.maxHp, beforeHp, afterHp: unit.hp, countsAsHeal: false });
    for (const foe of ctx.units.filter(e => e.team !== unit.team && isPresent(e, ctx.tick)))
      applyStatus(foe, source, 'stun', 0, Math.round(v.StunDuration * 20), ctx.tick, ctx.events);
  },
};

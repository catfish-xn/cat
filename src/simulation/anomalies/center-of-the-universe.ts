import type { AnomalyModule } from './contracts';
import { definition } from './shared';
import { areaEnemies, byDistance, enemies } from '../combat-s13-state';
import { hexDistance, type HexCell } from '../board';
import { P4_SOURCE } from './source';
import { ORBIT_PARAMETERS as p } from './orbit-parameters';
const v = P4_SOURCE.CenteroftheUniverse.values;
const directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
const modulo = (n: number, d: number): number => (n % d + d) % d;
function axial(cell: HexCell): { q: number; r: number } {
  return { q: (cell.col - Math.floor(cell.row / 2)) * 1000, r: cell.row * 1000 };
}
/** Fixed-point samples on six equal hex-ring arcs; no rendering or floating trig. */
export function orbitPoint(center: HexCell, radius: number, phase: number): { q: number; r: number } {
  const steps = p.phaseSteps / 6, index = modulo(phase, p.phaseSteps), side = Math.floor(index / steps), part = index % steps;
  const a = directions[side], b = directions[(side + 1) % 6], c = axial(center);
  return { q: c.q + Math.floor(radius * (a[0] * (steps - part) + b[0] * part) / steps),
    r: c.r + Math.floor(radius * (a[1] * (steps - part) + b[1] * part) / steps) };
}
function sweptHit(from: ReturnType<typeof orbitPoint>, to: ReturnType<typeof orbitPoint>, cell: HexCell): boolean {
  const target = axial(cell), dq = to.q - from.q, dr = to.r - from.r;
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) / p.sweepStepMilliHexes));
  for (let i = 0; i <= count; i++) {
    const q = from.q + Math.floor(dq * i / count) - target.q, r = from.r + Math.floor(dr * i / count) - target.r;
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= p.hitRadiusMilliHexes) return true;
  }
  return false;
}
export const centerOfTheUniverse: AnomalyModule = {
  definition: definition('CenteroftheUniverse'),
  tick(ctx, unit, source, nextSeq) {
    const state = unit.anomalyState ??= {}, orbit = state.orbit ??= { radiusMilli: p.initialRadiusMilliHexes, hits: {}, center: { ...unit.cell }, tick: ctx.tick - 1 };
    const eligible = enemies(unit, ctx.units);
    const target = eligible.find(u => u.id === unit.targetId) ?? byDistance(unit, eligible)[0];
    const desired = target ? Math.max(p.initialRadiusMilliHexes, Math.min(p.maxRadiusMilliHexes, hexDistance(unit.cell, target.cell) * 1000)) : p.initialRadiusMilliHexes;
    const radius = orbit.radiusMilli + Math.max(-p.radiusChangeMilliHexesPerTick, Math.min(p.radiusChangeMilliHexesPerTick, desired - orbit.radiusMilli));
    const foes = areaEnemies(unit, ctx.units).filter(u => !['wolf', 'mini'].includes(u.anomalySummon?.kind ?? '')).sort((a, b) => a.id < b.id ? -1 : 1);
    for (let star = 0; star < v.NumStars; star++) {
      const phase = ctx.tick * p.phaseStepsPerTick + star * p.phaseSteps / v.NumStars;
      const from = orbitPoint(orbit.tick === ctx.tick - 1 ? orbit.center : unit.cell, orbit.radiusMilli, phase - p.phaseStepsPerTick);
      const to = orbitPoint(unit.cell, radius, phase);
      for (const foe of foes) {
        const key = JSON.stringify([star, foe.id]), last = orbit.hits[key];
        if (last !== undefined && ctx.tick - last < p.sameStarTargetHitIntervalTicks || !sweptHit(from, to, foe.cell)) continue;
        orbit.hits[key] = ctx.tick;
        ctx.packets.push({ source, targetId: foe.id, raw: v.MissileDamage, damageType: 'magic', actionSeq: nextSeq(), ordinal: star,
          delivery: 'ability-periodic', critEligibility: 'never', critical: false, area: true, triggeringCastActionSeq: null });
      }
    }
    orbit.radiusMilli = radius; orbit.center = { ...unit.cell }; orbit.tick = ctx.tick;
  },
};

import { S13_ANOMALIES } from './registry';
import { ad, type S13Unit } from '../combat-s13-state';
import { seedAnomalyStream } from './summons';
import { isPresent } from './availability';
import { P4_SOURCE } from './source';
import type { AnomalyModule } from './contracts';
import type { AbilityContext } from '../combat-s13-abilities';
import type { CombatOrigin, CombatUnit } from '../combat-types';
export function anomalySource(unit: Pick<CombatUnit, 'mechanics'>, id: string): CombatOrigin | undefined {
  return unit.mechanics?.find(m => m.mechanic === 's13Anomaly' && m.source.definitionId === id)?.source;
}
function each(unit: S13Unit, apply: (module: AnomalyModule, source: CombatOrigin) => void): void {
  if (!unit.mechanics?.some(m => m.mechanic === 's13Anomaly')) return;
  for (const module of S13_ANOMALIES) {
    const source = anomalySource(unit, module.definition.id);
    if (source) apply(module, source);
  }
}
export function startAnomalies(ctx: AbilityContext): void {
  ctx.anomalyOpening = ctx.units.map(u => ({ id: u.id, health: u.maxHp, attackDamage: ad(u) }));
  for (const unit of [...ctx.units]) each(unit, (m, source) => m.start?.(ctx, unit, source));
  for (const unit of ctx.units) if (unit.anomalySummon && unit.anomalySummon.kind !== 'crab')
    (unit.anomalyState ??= {}).attackStream = seedAnomalyStream(ctx.anomalySeed ?? 0, unit.id);
}
export function tickAnomalies(ctx: AbilityContext, nextSeq: () => number, returning = false): void {
  for (const unit of ctx.units.filter(u => u.alive && u.hp > 0 && (returning || isPresent(u, ctx.tick))))
    each(unit, (m, source) => {
      if ((m.definition.id === P4_SOURCE.DramaticEntrance.id) === returning) m.tick?.(ctx, unit, source, nextSeq);
    });
}
export function castAnomaly(ctx: AbilityContext, unit: S13Unit, target: S13Unit): void {
  each(unit, (m, source) => m.cast?.(ctx, unit, target, source));
}
export function takedownAnomalies(ctx: AbilityContext, killed: ReadonlyMap<string, CombatOrigin>, contributors: Readonly<Record<string, readonly string[]>>): void {
  for (const [victim, killer] of [...killed].sort(([a],[b])=>a<b?-1:a>b?1:0)) for (const unit of ctx.units.filter(u => u.alive && u.hp > 0
    && (u.id === killer.ownerId || contributors[victim]?.includes(u.id))))
    each(unit, (m, source) => m.takedown?.(ctx, unit, victim, source));
}
/** Death replacement runs once at the common pre-cleanup barrier. */
export function deathAnomalies(ctx: AbilityContext): void {
  for (const unit of [...ctx.units].filter(u => u.alive && u.hp === 0)) each(unit, (m, source) => m.death?.(ctx, unit, source));
}
export function attackAnomaly(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number): void {
  each(unit, (m, source) => m.attack?.(ctx, unit, target, seq, source));
}

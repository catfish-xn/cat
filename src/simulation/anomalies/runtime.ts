import { S13_ANOMALIES } from './registry';
import type { S13Unit } from '../combat-s13-state';
import type { AnomalyModule } from './contracts';
import type { AbilityContext } from '../combat-s13-abilities';
import type { CombatOrigin, CombatUnit } from '../combat-types';
export function anomalySource(unit: Pick<CombatUnit, 'mechanics'>, id: string): CombatOrigin | undefined {
  return unit.mechanics?.find(m => m.mechanic === 's13Anomaly' && m.source.definitionId === id)?.source;
}
function each(unit: S13Unit, apply: (module: AnomalyModule, source: CombatOrigin) => void): void {
  for (const module of S13_ANOMALIES) {
    const source = anomalySource(unit, module.definition.id);
    if (source) apply(module, source);
  }
}
export function startAnomalies(ctx: AbilityContext): void {
  for (const unit of ctx.units) each(unit, (m, source) => m.start?.(ctx, unit, source));
}
export function tickAnomalies(ctx: AbilityContext, nextSeq: () => number): void {
  for (const unit of ctx.units.filter(u => u.alive && u.hp > 0)) each(unit, (m, source) => m.tick?.(ctx, unit, source, nextSeq));
}
export function castAnomaly(ctx: AbilityContext, unit: S13Unit, target: S13Unit): void {
  each(unit, (m, source) => m.cast?.(ctx, unit, target, source));
}
export function takedownAnomalies(ctx: AbilityContext, killed: ReadonlyMap<string, CombatOrigin>, contributors: Readonly<Record<string, readonly string[]>>): void {
  for (const [victim, killer] of killed) for (const unit of ctx.units.filter(u => u.alive && u.hp > 0
    && (u.id === killer.ownerId || contributors[victim]?.includes(u.id))))
    each(unit, (m, source) => m.takedown?.(ctx, unit, victim, source));
}

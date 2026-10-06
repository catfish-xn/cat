import { S13_COMBAT_RULES } from './s13-rules';
import { getNeighbors, hexDistance, type Board, type HexCell } from './board';
import type { CombatUnit, CombatOrigin, CombatRuntime, CombatStatus, ShieldLayer, CombatTask, CombatEvent } from './combat-types';
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type S13Unit = Omit<Mutable<CombatUnit>, 'runtime' | 'statuses' | 'shieldLayers' | 'tasks'> & {
  runtime: Mutable<CombatRuntime>; statuses: CombatStatus[]; shieldLayers: ShieldLayer[]; tasks: CombatTask[];
};
export const EMPTY_RUNTIME: CombatRuntime = { attackCount: 0, castCount: 0, attackSpeedBps: 0, abilityPowerFlat: 0,
  rangeBonus: 0, nextAttackMagic: 0, nextAttackPhysical: 0, permanentAdBps: 0, buddyTriggered: false };
export const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const sourceKey = (s: CombatOrigin): string => JSON.stringify([s.ownerId, s.sourceKind, s.definitionId, s.instanceId, s.effectIndex]);
export function compareOrigins(a: CombatOrigin, b: CombatOrigin): number {
  const kinds: CombatOrigin['sourceKind'][] = ['attack', 'ability', 'trait', 'item', 'augment', 'anomaly', 'enemyGrowth'];
  return compareText(a.ownerId, b.ownerId) || kinds.indexOf(a.sourceKind) - kinds.indexOf(b.sourceKind)
    || compareText(a.definitionId, b.definitionId) || compareText(a.instanceId, b.instanceId) || a.effectIndex - b.effectIndex;
}
export function origin(unit: CombatUnit, effectIndex = 0): CombatOrigin {
  return { ownerId: unit.id, sourceKind: 'ability', definitionId: unit.ability.id, instanceId: unit.id, effectIndex };
}
export function variable(unit: CombatUnit, name: string, fallback = 0): number {
  return unit.ability.kind === 's13' && Object.hasOwn(unit.ability.variables, name) ? unit.ability.variables[name] / 10000 : fallback;
}
export function champion(unit: CombatUnit): string { return unit.ability.kind === 's13' ? unit.ability.championId : ''; }
export function mechanic(unit: CombatUnit, name: string, key: string, fallback = 0): number {
  return (unit.mechanics ?? []).filter(m => m.mechanic === name).reduce((sum, m) => sum + (m.values[key] ?? fallback), 0);
}
export function hasMechanic(unit: CombatUnit, name: string): boolean { return (unit.mechanics ?? []).some(m => m.mechanic === name); }
export function active(unit: CombatUnit, tick: number, kind: CombatStatus['kind']): CombatStatus[] {
  return (unit.statuses ?? []).filter(s => s.kind === kind && s.startsAtTick <= tick && s.expiresAtTick > tick);
}
export function ap(unit: S13Unit, tick: number): number {
  return (unit.abilityPower ?? 100) + unit.runtime.abilityPowerFlat + active(unit, tick, 'abilityPower').reduce((n, s) => n + s.amount, 0);
}
export function ad(unit: S13Unit): number {
  return Math.floor((unit.attackDamageBase ?? unit.attackDamage) * (10000 + (unit.attackDamagePercentBps ?? 0) + unit.runtime.permanentAdBps) / 10000);
}
/** Historical floats are normalized to integer coefficient basis points before arithmetic. */
export function amount(unit: S13Unit, tick: number, coefficients: { flat?: number; ad?: number; ap?: number; hp?: number }): number {
  const numerator = Math.round((coefficients.flat ?? 0) * 10000) + ad(unit) * Math.round((coefficients.ad ?? 0) * 10000)
    + ap(unit, tick) * Math.round((coefficients.ap ?? 0) * 100) + unit.maxHp * Math.round((coefficients.hp ?? 0) * 10000);
  if (!Number.isSafeInteger(numerator) || numerator < 0) throw new RangeError('Invalid S13 amount');
  return Math.floor(numerator / 10000);
}
export function interval(unit: S13Unit, tick: number): number {
  // R7 neutral definitions author exact integer periods; they have no speed
  // modifiers in this slice. Inverting a rounded speed adds a spurious tick.
  if (champion(unit) === 'neutral') return unit.attackIntervalTicks;
  const speedBps = (unit.attackSpeedBonusBps ?? 0) + unit.runtime.attackSpeedBps + active(unit, tick, 'attackSpeed').reduce((n, s) => n + s.amount, 0);
  const base = unit.baseAttackSpeedBps ?? Math.round(200000 / unit.attackIntervalTicks);
  return Math.max(1, Math.ceil(S13_COMBAT_RULES.attackSpeedIntervalNumerator / (base * (10000 + speedBps))));
}
export function byDistance(from: CombatUnit, list: readonly S13Unit[], farthest = false): S13Unit[] {
  return [...list].sort((a, b) => (farthest ? -1 : 1) * (hexDistance(from.cell, a.cell) - hexDistance(from.cell, b.cell)) || compareText(a.id, b.id));
}
export function enemies(unit: CombatUnit, units: readonly S13Unit[]): S13Unit[] { return units.filter(u => u.alive && u.team !== unit.team); }
export function neighborsOf(unit: CombatUnit, units: readonly S13Unit[], radius = 1): S13Unit[] {
  return enemies(unit, units).filter(u => hexDistance(unit.cell, u.cell) <= radius).sort((a, b) => compareText(a.id, b.id));
}
export function lowestAlly(unit: CombatUnit, units: readonly S13Unit[], current = false): S13Unit | undefined {
  return units.filter(u => u.alive && u.team === unit.team).sort((a, b) =>
    (current ? a.hp - b.hp : a.hp * b.maxHp - b.hp * a.maxHp) || hexDistance(unit.cell, a.cell) - hexDistance(unit.cell, b.cell) || compareText(a.id, b.id))[0];
}
export function path(board: Board, from: HexCell, to: HexCell): HexCell[] {
  const result: HexCell[] = []; let cursor = from;
  while (hexDistance(cursor, to) > 0) {
    const next = getNeighbors(board, cursor).find(c => hexDistance(c, to) < hexDistance(cursor, to));
    if (!next) break;
    result.push(next); cursor = next;
  }
  return result;
}
export function syncShield(unit: S13Unit): void {
  unit.shield = unit.shieldLayers.reduce((n, s) => n + s.remaining, 0);
  unit.shieldExpiresAtTick = unit.shield > 0 ? Math.max(...unit.shieldLayers.filter(s => s.remaining > 0).map(s => s.expiresAtTick)) : null;
}
export function grantShield(unit: S13Unit, source: CombatOrigin, value: number, expiresAtTick: number, tick: number,
  events: CombatEvent[], decay = false): void {
  const key = sourceKey(source), old = unit.shieldLayers.find(s => s.key === key);
  const layer: ShieldLayer = { key, source, granted: Math.max(value, old?.remaining ?? 0), remaining: Math.max(value, old?.remaining ?? 0),
    absorbed: 0, expiresAtTick: Math.max(expiresAtTick, old?.expiresAtTick ?? 0), ...(decay ? {
      grantedAtTick: tick, decayDurationTicks: Math.max(expiresAtTick, old?.expiresAtTick ?? 0) - tick,
    } : {}) };
  unit.shieldLayers = [...unit.shieldLayers.filter(s => s.key !== key), layer].sort((a, b) => a.expiresAtTick - b.expiresAtTick || compareText(a.key, b.key));
  syncShield(unit); events.push({ type: 'shieldLayerChanged', tick, unitId: unit.id, layer, reason: 'granted' });
}
export function applyStatus(unit: S13Unit, source: CombatOrigin, kind: CombatStatus['kind'], value: number, duration: number,
  tick: number, events: CombatEvent[], immediate = false, suffix = ''): void {
  const key = `${sourceKey(source)}:${kind}:${unit.id}:${suffix}`;
  const old = unit.statuses.find(s => s.key === key);
  const requestedStart = immediate ? tick : tick + 1;
  const startsAtTick = old && old.startsAtTick <= tick && old.expiresAtTick > tick ? old.startsAtTick : requestedStart;
  const status: CombatStatus = { key, kind, source, amount: value, startsAtTick,
    expiresAtTick: Math.max(requestedStart + duration, old?.expiresAtTick ?? 0) };
  unit.statuses = [...unit.statuses.filter(s => s.key !== key), status].sort((a, b) => compareText(a.key, b.key));
  events.push({ type: 'statusChanged', tick, unitId: unit.id, status, reason: 'applied' });
}

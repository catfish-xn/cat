import { shortestPath, startingRows } from './m8/targeting';
import { S13_COMBAT_RULES } from './s13-rules';
import { hexDistance, type Board, type HexCell } from './board';
import type { CombatUnit, CombatOrigin, CombatRuntime, CombatStatus, ShieldLayer, CombatTask, CombatEvent } from './combat-types';
import { attackInterval, evaluateAmount, resolveStat, type HpSample } from './m8/stats';
import { authorizeSpellCrit, validateSpellCrit } from './m8/crit';
import type { SpellCritAuthorization, StatModifier, StatusApplication, StatusContribution, StatusGroup, Effect, CombatActivity } from './m8/contracts';
import { effectIdentity } from './m8/identity';
import { applyStatusContribution, isEffective, effectiveStatuses } from './m8/status';
import { grantShieldState } from './m8/shield';
import { EMPTY_MECHANISMS } from './m8/runtime-types';
import { asSource, flatAmount } from './m8/s13-definitions';
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type S13Unit = Omit<Mutable<CombatUnit>, 'runtime' | 'statuses' | 'shieldLayers' | 'tasks'> & {
  runtime: Mutable<CombatRuntime>; statuses: CombatStatus[]; shieldLayers: ShieldLayer[]; tasks: CombatTask[];
};
export function ensureMechanisms(unit: S13Unit, tick = 0, combatId = 'standalone'): void {
  if (!unit.mechanismState) unit.mechanismState = { ...EMPTY_MECHANISMS, combatId, sampledAtTick: tick };
}
// Index immutable contributions, never their HP-dependent evaluated values.
// An array replacement or tick change invalidates the read cache automatically.
const modifierIndex = new WeakMap<readonly StatusGroup[], { tick: number; values: Map<StatModifier['stat'], StatModifier[]> }>();
export function statusModifiers(unit: S13Unit, stat: StatModifier['stat'], tick = unit.mechanismState?.sampledAtTick ?? 0): StatModifier[] {
  const groups = unit.mechanismState?.statuses; if (!groups?.length) return [];
  let index = modifierIndex.get(groups);
  if (!index || index.tick !== tick) {
    const values = new Map<StatModifier['stat'], StatModifier[]>();
    for (const group of groups) for (const c of group.contributions) if (c.application.modifier && isEffective(c, tick)) {
      const modifier = c.application.modifier, list = values.get(modifier.stat) ?? []; list.push(modifier); values.set(modifier.stat, list);
    }
    index = { tick, values }; modifierIndex.set(groups, index);
  }
  return index.values.get(stat) ?? [];
}
export function shieldProjection(state: import('./m8/contracts').ShieldState, legacyKey: string, definition?: Extract<Effect, { kind: 'grant-shield' }>, endedReason?: import('./m8/contracts').ShieldEndReason): ShieldLayer {
  return { key: legacyKey, source: { ownerId: state.source.ownerId, sourceKind: state.source.sourceKind, definitionId: state.source.definitionId, instanceId: state.source.instanceId, effectIndex: state.source.effectIndex }, granted: state.granted, remaining: state.remaining, absorbed: state.absorbed, expiresAtTick: state.expiresAtTick,
    m8State: state, ...(definition ? { m8Grant: definition } : {}), ...(endedReason ? { endedReason } : {}),
    ...(state.decay.kind === 'linear-initial-grant' ? { grantedAtTick: state.decay.grantedAtTick, decayDurationTicks: state.decay.durationTicks } : {}) };
}
export function frozenShield(layer: ShieldLayer, unit: S13Unit): import('./m8/contracts').ShieldState {
  if (layer.m8State) return layer.m8State;
  const startsAtTick = layer.grantedAtTick ?? 0;
  const decayed = Math.max(0, layer.granted - layer.remaining - layer.absorbed);
  return { ...effectIdentity(unit.mechanismState?.combatId ?? 'standalone', asSource(layer.source), unit.id), granted: layer.granted, remaining: layer.remaining,
    absorbed: layer.absorbed, decayed, expiredDiscarded: 0, startsAtTick, expiresAtTick: layer.expiresAtTick, endRewardConsumed: false,
    decay: layer.decayDurationTicks ? { kind: 'linear-initial-grant', basisGranted: layer.granted, grantedAtTick: startsAtTick,
      durationTicks: layer.decayDurationTicks, lastDecayAtTick: Math.max(startsAtTick, unit.mechanismState?.sampledAtTick ?? startsAtTick) } : { kind: 'none' } };
}
export const EMPTY_RUNTIME: CombatRuntime = { attackCount: 0, castCount: 0, attackSpeedBps: 0, abilityPowerFlat: 0,
  rangeBonus: 0, nextAttackMagic: 0, nextAttackPhysical: 0, permanentAdBps: 0, buddyTriggered: false };
export const hpSample = (unit: CombatUnit): HpSample => ({ id: unit.id, hp: unit.hp, maxHp: unit.maxHp });
export const constantModifier = (stat: StatModifier['stat'], amount: number, unit: StatModifier['unit'] = 'flat'): StatModifier =>
  ({ stat, unit, value: { kind: 'constant', amount }, condition: { kind: 'always' }, damageFilter: null });
export function spellCrit(unit: CombatUnit): SpellCritAuthorization {
  if (unit.spellCrit) {
    const auth = validateSpellCrit(unit.spellCrit);
    if ([...auth.itemSources, ...auth.nonItemSources].some(s => s.ownerId !== unit.id)) throw new RangeError('Wrong authorization holder');
    return auth;
  }
  return authorizeSpellCrit([], [], unit.baseCritChanceBps ?? (champion(unit) === 'neutral' ? 0 : S13_COMBAT_RULES.attackCritBps), unit.baseCritMultiplierBps ?? S13_COMBAT_RULES.critMultiplierBps);
}
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
  return resolveStat('abilityPower', unit.abilityPower ?? 100, [constantModifier('abilityPower', unit.runtime.abilityPowerFlat),
    ...active(unit, tick, 'abilityPower').filter(s => !s.contributionKeys).map(s => constantModifier('abilityPower', s.amount)), ...statusModifiers(unit, 'abilityPower', tick)], { holder: hpSample(unit), startingRows: startingRows(unit.team, unit.startingCell?.row ?? unit.cell.row) ?? undefined });
}
export function ad(unit: S13Unit): number {
  return resolveStat('attackDamage', unit.attackDamageBase ?? unit.attackDamage,
    [constantModifier('attackDamage', unit.attackDamagePercentBps ?? 0, 'bps'), constantModifier('attackDamage', unit.runtime.permanentAdBps, 'bps'), ...statusModifiers(unit, 'attackDamage')], { holder: hpSample(unit), startingRows: startingRows(unit.team, unit.startingCell?.row ?? unit.cell.row) ?? undefined });
}
export function range(unit: S13Unit): number {
  return resolveStat('range', unit.attackRange, [constantModifier('range', unit.runtime.rangeBonus, 'hexes'), ...statusModifiers(unit, 'range')], { holder: hpSample(unit), startingRows: startingRows(unit.team, unit.startingCell?.row ?? unit.cell.row) ?? undefined });
}
/** Historical floats are normalized to integer coefficient basis points before arithmetic. */
export function amount(unit: S13Unit, tick: number, coefficients: { flat?: number; ad?: number; ap?: number; hp?: number }): number {
  const flat = coefficients.flat ?? 0;
  if (!Number.isSafeInteger(flat)) throw new RangeError('Invalid S13 flat amount');
  return evaluateAmount({ flat, attackDamageBps: Math.round((coefficients.ad ?? 0) * 10000),
    abilityPowerBps: Math.round((coefficients.ap ?? 0) * 100), maxHpBps: Math.round((coefficients.hp ?? 0) * 10000),
    missingHpBps: 0, actualManaSpentBps: 0, actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'holder', sample: 'application', cap: null },
    { holder: hpSample(unit), attackDamage: ad(unit), abilityPower: ap(unit, tick) });
}
export function interval(unit: S13Unit, tick: number): number {
  // R7 neutral definitions author exact integer periods; they have no speed
  // modifiers in this slice. Inverting a rounded speed adds a spurious tick.
  if (champion(unit) === 'neutral' && unit.unitKind !== 'neutral') return unit.attackIntervalTicks;
  const speedBps = (unit.attackSpeedBonusBps ?? 0) + unit.runtime.attackSpeedBps + active(unit, tick, 'attackSpeed').filter(s => !s.contributionKeys).reduce((n, s) => n + s.amount, 0) + resolveStat('attackSpeed', 0, statusModifiers(unit, 'attackSpeed', tick), { holder: hpSample(unit), startingRows: startingRows(unit.team, unit.startingCell?.row ?? unit.cell.row) ?? undefined });
  const base = unit.baseAttackSpeedBps ?? Math.round(200000 / unit.attackIntervalTicks);
  return attackInterval(base, speedBps);
}
export function byDistance(from: CombatUnit, list: readonly S13Unit[], farthest = false): S13Unit[] {
  return [...list].sort((a, b) => (farthest ? -1 : 1) * (hexDistance(from.cell, a.cell) - hexDistance(from.cell, b.cell)) || compareText(a.id, b.id));
}
export function areaEnemies(unit: CombatUnit, units: readonly S13Unit[]): S13Unit[] { return units.filter(u => u.alive && u.team !== unit.team); }
export function enemies(unit: CombatUnit, units: readonly S13Unit[]): S13Unit[] { return units.filter(u => u.alive && u.team !== unit.team && !effectiveStatuses(u.mechanismState?.statuses ?? [], unit.mechanismState?.sampledAtTick ?? 0).some(g => g.kind === 'untargetable')); }
export function neighborsOf(unit: CombatUnit, units: readonly S13Unit[], radius = 1): S13Unit[] {
  return areaEnemies(unit, units).filter(u => hexDistance(unit.cell, u.cell) <= radius).sort((a, b) => compareText(a.id, b.id));
}
export function lowestAlly(unit: CombatUnit, units: readonly S13Unit[], current = false): S13Unit | undefined {
  return units.filter(u => u.alive && u.team === unit.team).sort((a, b) =>
    (current ? a.hp - b.hp : a.hp * b.maxHp - b.hp * a.maxHp) || hexDistance(unit.cell, a.cell) - hexDistance(unit.cell, b.cell) || compareText(a.id, b.id))[0];
}
export function path(board: Board, from: HexCell, to: HexCell): HexCell[] { return shortestPath(board, from, to); }
export function syncShield(unit: S13Unit): void {
  unit.shield = unit.shieldLayers.reduce((n, s) => n + s.remaining, 0);
  unit.shieldExpiresAtTick = unit.shield > 0 ? Math.max(...unit.shieldLayers.filter(s => s.remaining > 0).map(s => s.expiresAtTick)) : null;
}
export function grantShield(unit: S13Unit, source: CombatOrigin, value: number, expiresAtTick: number, tick: number,
  events: CombatEvent[], decay = false): void {
  ensureMechanisms(unit, tick);
  const key = sourceKey(source), old = unit.shieldLayers.find(s => s.key === key);
  const definition: Extract<Effect, { kind: 'grant-shield' }> = { kind: 'grant-shield', amount: flatAmount(value), durationTicks: expiresAtTick - tick,
    decay: decay ? { kind: 'linear-initial-grant' } : { kind: 'none' }, onEnd: [], endTiming: decay ? 'next-action-planning' : 'post-damage', endTargeting: { kind: 'fixed', targetIds: [unit.id], ifMissing: 'skip' }, endEffects: [] };
  const state = grantShieldState(effectIdentity(unit.mechanismState!.combatId, asSource(source), unit.id), value, definition, tick, old ? frozenShield(old, unit) : undefined);
  const layer = shieldProjection(state, key, definition);
  unit.shieldLayers = [...unit.shieldLayers.filter(s => s.key !== key), layer].sort((a, b) => a.expiresAtTick - b.expiresAtTick || compareText(a.m8State!.key, b.m8State!.key));
  syncShield(unit); events.push({ type: 'shieldLayerChanged', tick, unitId: unit.id, layer, reason: 'granted' });
}

export function applyStatus(unit: S13Unit, source: CombatOrigin, kind: CombatStatus['kind'], value: number, duration: number,
  tick: number, events: CombatEvent[], immediate = false, suffix = '', actionSeq?: number): void {
  ensureMechanisms(unit, tick);
  const key = `${sourceKey(source)}:${kind}:${unit.id}:${suffix}`;
  const old = unit.statuses.find(s => s.key === key);
  if (kind === 'channel' || kind === 'redirect') {
    const identity = effectIdentity(unit.mechanismState!.combatId, asSource(source), unit.id, String(actionSeq ?? unit.runtime.castCount));
    const activity: CombatActivity = { ...identity, actionSeq: actionSeq ?? unit.runtime.castCount, startsAtTick: tick, expiresAtTick: tick + duration,
      ...(kind === 'channel' ? { kind: 'channel', blocks: ['move', 'attack', 'cast'], cancelOnControl: true } as const : { kind: 'redirect', allyRadius: 1, shareBps: value, choose: 'lowest-id', repeatMitigation: false, recursive: false } as const),
      lifecycle: 'active', endedAtTick: null, endReason: null };
    for (const previous of unit.statuses.filter(s => s.activity?.kind === kind && s.activity.lifecycle === 'active')) events.push({ type: 'statusChanged', tick, unitId: unit.id, status: previous, reason: 'replaced', activity: { ...previous.activity!, lifecycle: 'ended', endedAtTick: tick, endReason: 'replaced' } });
    const activities = unit.mechanismState!.activities.map(a => a.kind === kind && a.lifecycle === 'active' ? { ...a, lifecycle: 'ended' as const, endedAtTick: tick, endReason: 'replaced' as const } : a);
    unit.mechanismState = { ...unit.mechanismState!, activities: [...activities, activity] };
    const status: CombatStatus = { key, source, kind, amount: value, startsAtTick: tick, expiresAtTick: tick + duration, activity };
    unit.statuses = [...unit.statuses.filter(s => s.key !== key), status].sort((a, b) => compareText(a.key, b.key));
    events.push({ type: 'statusChanged', tick, unitId: unit.id, status, reason: 'applied', activity }); return;
  }
  const kinds = { stun: 'stun', damageReduction: 'damage-reduction', armorReduction: 'sunder', resistanceFlat: value < 0 ? 'stat-debuff' : 'stat-buff', attackSpeed: 'stat-buff', abilityPower: 'stat-buff' } as const;
  const frozenKind = kinds[kind];
  const policy: StatusApplication['stackPolicy'] = ['damageReduction', 'armorReduction'].includes(kind) ? { kind: 'strongest-category', category: frozenKind, retainSuppressed: true }
    : suffix ? { kind: 'independent-instances' } : { kind: 'refresh-same-instance', magnitude: 'replace', phase: 'preserve' };
  const modifiers = kind === 'resistanceFlat' ? [constantModifier('armor', value), ...(!suffix.startsWith('armor:') ? [constantModifier('magicResist', value)] : [])]
    : kind === 'attackSpeed' ? [constantModifier('attackSpeed', value, 'bps')] : kind === 'abilityPower' ? [constantModifier('abilityPower', value)] : [undefined];
  const legacyApplication = suffix.startsWith('armor:') ? suffix.slice(6) : suffix;
  // Legacy display keys remain compatible; frozen independent applications use
  // canonical tuples instead of their historical colon-separated labels.
  const applicationId = !legacyApplication ? 'source' : legacyApplication.startsWith('[') ? legacyApplication
    : JSON.stringify([...legacyApplication.split(':').map(Number), unit.id]);
  const contributionKeys: string[] = [];
  let groups = unit.mechanismState!.statuses;
  for (const [index, modifier] of modifiers.entries()) {
    const frozenSource = { ...asSource(source), effectIndex: source.effectIndex * 16 + index };
    const identity = effectIdentity(unit.mechanismState!.combatId, frozenSource, unit.id, applicationId);
    const application: StatusApplication = { activation: immediate ? 'immediate' : 'next-tick', kind: frozenKind, magnitudeBps: modifier ? 0 : value, duration: { kind: 'ticks', ticks: duration }, stackPolicy: policy,
      polarity: kind === 'stun' || kind === 'armorReduction' || value < 0 ? 'harmful' : 'beneficial', removable: kind !== 'damageReduction',
      ...(modifier ? { modifier } : {}), damageFilter: kind === 'damageReduction' ? { deliveries: 'all', damageTypes: ['physical', 'magic'], redirected: 'exclude' } : null, onEnd: null };
    const result = applyStatusContribution(groups, identity, application, tick); if (!result.accepted) return;
    groups = result.groups; contributionKeys.push(identity.key);
  }
  unit.mechanismState = { ...unit.mechanismState!, statuses: groups };
  const contribution: StatusContribution = groups.flatMap(g => g.contributions).find(c => c.key === contributionKeys[0])!;
  const status: CombatStatus = { key, kind, source, amount: value, startsAtTick: contribution.appliedAtTick, expiresAtTick: contribution.expiresAtTick!, contributionKeys };
  unit.statuses = [...unit.statuses.filter(s => s.key !== key), status].sort((a, b) => compareText(a.key, b.key));
  events.push({ type: 'statusChanged', tick, unitId: unit.id, status, reason: 'applied' });
  void old;
}

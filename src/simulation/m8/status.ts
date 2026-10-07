import type { Effect, EffectIdentity, StatusApplication, StatusContribution, StatusEndReason, StatusGroup, StatusKind } from './contracts';
import { compareCodePoints, validateIdentity } from './identity';
import { integer, safeNumber } from './stats';
export interface EndedStatus { readonly contribution: StatusContribution; readonly reason: StatusEndReason; readonly effects: readonly Effect[] }
export function isEffective(c: StatusContribution, tick: number, includeFinalPulse = false): boolean {
  return c.appliedAtTick <= tick && (c.expiresAtTick === null || (includeFinalPulse ? c.expiresAtTick >= tick : c.expiresAtTick > tick));
}
export function summarizeGroup(group: StatusGroup, tick: number, includeFinalPulse = false): StatusGroup {
  let best: StatusContribution | undefined;
  for (const contribution of group.contributions) if (isEffective(contribution, tick, includeFinalPulse) && (!best
    || contribution.application.magnitudeBps > best.application.magnitudeBps
    || contribution.application.magnitudeBps === best.application.magnitudeBps && compareCodePoints(contribution.key, best.key) < 0)) best = contribution;
  return { ...group, effectiveSourceKey: best?.key ?? null, effectiveMagnitudeBps: best?.application.magnitudeBps ?? 0 };
}
export function effectiveStatuses(groups: readonly StatusGroup[], tick: number, includeFinalPulse = false): StatusGroup[] {
  return groups.map(g => summarizeGroup(g, tick, includeFinalPulse)).filter(g => g.effectiveSourceKey !== null);
}
export function statusMagnitude(groups: readonly StatusGroup[], kind: StatusKind, tick: number): number {
  return Math.max(0, ...effectiveStatuses(groups, tick).filter(g => g.kind === kind).map(g => g.effectiveMagnitudeBps));
}
export function validateStatusApplication(app: StatusApplication): void {
  if (!['stun','burn','wound','sunder','shred','damage-reduction','control-immunity','untargetable','damage-prevention','stat-buff','stat-debuff'].includes(app.kind)
    || !['immediate','next-tick'].includes(app.activation) || !['beneficial','harmful'].includes(app.polarity) || typeof app.removable !== 'boolean'
    || !['ticks','combat'].includes(app.duration.kind) || !['refresh-same-instance','independent-instances','strongest-category','add-stacks'].includes(app.stackPolicy.kind)) throw new RangeError('Invalid status declaration');
  if (app.stackPolicy.kind === 'add-stacks' && app.stackPolicy.cap !== null) integer(app.stackPolicy.cap, 1);
  if (app.stackPolicy.kind === 'refresh-same-instance' && (!['replace','max'].includes(app.stackPolicy.magnitude) || app.stackPolicy.phase !== 'preserve')) throw new RangeError('Invalid status refresh policy');
  if (app.stackPolicy.kind === 'strongest-category' && app.stackPolicy.retainSuppressed !== true) throw new RangeError('Suppressed contributions must be retained');
  integer(app.magnitudeBps); if (app.magnitudeBps > 10000) throw new RangeError('Invalid status magnitude');
  if (app.duration.kind === 'ticks') integer(app.duration.ticks, 1);
  const stat = app.kind === 'stat-buff' || app.kind === 'stat-debuff';
  if (stat !== (app.modifier !== undefined) || (app.kind === 'damage-reduction') !== (app.damageFilter !== null)) throw new RangeError('Status modifier/filter mismatch');
  if (app.stackPolicy.kind === 'strongest-category' && app.stackPolicy.category !== app.kind) throw new RangeError('Wrong strongest status category');
}
export function applyStatusContribution(groups: readonly StatusGroup[], identity: EffectIdentity, app: StatusApplication, tick: number): { groups: StatusGroup[]; accepted: boolean; refreshed: boolean } {
  validateIdentity(identity); validateStatusApplication(app); integer(tick);
  if (app.kind === 'stun' && effectiveStatuses(groups, tick).some(g => g.targetId === identity.targetId && g.kind === 'control-immunity')) return { groups: [...groups], accepted: false, refreshed: false };
  const group = groups.find(g => g.targetId === identity.targetId && g.kind === app.kind);
  const old = group?.contributions.find(c => c.key === identity.key);
  const requestedStart = tick + (app.activation === 'next-tick' ? 1 : 0);
  const requestedEnd = app.duration.kind === 'combat' ? null : requestedStart + app.duration.ticks;
  let application = app;
  const policy = app.stackPolicy;
  if (old && policy.kind === 'independent-instances') throw new RangeError('Duplicate independent status identity');
  if (old && policy.kind === 'refresh-same-instance' && policy.magnitude === 'max' && old.application.magnitudeBps > app.magnitudeBps) application = { ...app, magnitudeBps: old.application.magnitudeBps, ...(old.application.modifier ? { modifier: old.application.modifier } : {}) };
  if (old && policy.kind === 'refresh-same-instance' && policy.magnitude === 'max' && app.modifier?.value.kind === 'constant' && old.application.modifier?.value.kind === 'constant'
    && Math.abs(old.application.modifier.value.amount) > Math.abs(app.modifier.value.amount)) application = { ...application, modifier: old.application.modifier };
  if (old && policy.kind === 'add-stacks') {
    // Magnitude is a status rate; stat growth accumulates its signed constant.
    const previous = old.application.modifier, next = app.modifier;
    if (previous && next) {
      if (previous.stat !== next.stat || previous.unit !== next.unit || previous.value.kind !== 'constant' || next.value.kind !== 'constant') throw new RangeError('Incompatible status stack modifier');
      const perStack = next.value.amount;
      if (perStack === 0 || previous.value.amount % perStack !== 0) throw new RangeError('Invalid saved status stack amount');
      const stacks = Math.min(policy.cap ?? Number.MAX_SAFE_INTEGER, previous.value.amount / perStack + 1);
      application = { ...app, modifier: { ...next, value: { kind: 'constant', amount: safeNumber(integer(stacks) * integer(perStack, Number.MIN_SAFE_INTEGER)) } } };
    } else {
      if (app.magnitudeBps === 0 || old.application.magnitudeBps % app.magnitudeBps !== 0) throw new RangeError('Invalid saved status stack magnitude');
      application = { ...app, magnitudeBps: Math.min(10000, Math.min(policy.cap ?? Number.MAX_SAFE_INTEGER, old.application.magnitudeBps / app.magnitudeBps + 1) * app.magnitudeBps) };
    }
  }
  const start = old && isEffective(old, tick) ? old.appliedAtTick : requestedStart;
  const expiresAtTick = old?.expiresAtTick === null || requestedEnd === null ? null : Math.max(old?.expiresAtTick ?? 0, requestedEnd);
  const contribution: StatusContribution = { ...identity, application, appliedAtTick: start, expiresAtTick, endRewardConsumed: false };
  const next: StatusGroup = summarizeGroup({ targetId: identity.targetId, kind: app.kind,
    contributions: [...(group?.contributions.filter(c => c.key !== identity.key) ?? []), contribution].sort((a, b) => compareCodePoints(a.key, b.key)),
    effectiveSourceKey: null, effectiveMagnitudeBps: 0,
    nextPulseAtTick: app.kind === 'burn' ? group?.nextPulseAtTick ?? requestedStart + 20 : null }, tick);
  return { groups: [...groups.filter(g => g !== group), next].sort((a, b) => compareCodePoints(JSON.stringify([a.targetId, a.kind]), JSON.stringify([b.targetId, b.kind]))), accepted: true, refreshed: old !== undefined };
}
export function removeStatusContributions(groups: readonly StatusGroup[], remove: (c: StatusContribution) => boolean, reason: StatusEndReason, tick: number): { groups: StatusGroup[]; ended: EndedStatus[] } {
  const ended: EndedStatus[] = [], remaining: StatusGroup[] = [];
  for (const group of groups) {
    const contributions = group.contributions.filter(c => {
      if (!remove(c)) return true;
      const effects = !c.endRewardConsumed && c.application.onEnd?.reasons.includes(reason) ? c.application.onEnd.effects : [];
      ended.push({ contribution: { ...c, endRewardConsumed: true }, reason, effects }); return false;
    });
    if (contributions.length) remaining.push(summarizeGroup({ ...group, contributions }, tick));
  }
  return { groups: remaining, ended };
}
export function endStatuses(groups: readonly StatusGroup[], tick: number): ReturnType<typeof removeStatusContributions> {
  return removeStatusContributions(groups, c => c.expiresAtTick !== null && c.expiresAtTick <= tick, 'expired', tick);
}
export function cleanseStatuses(groups: readonly StatusGroup[], targetId: string, hostileOwners: ReadonlySet<string>, tick: number): ReturnType<typeof removeStatusContributions> {
  return removeStatusContributions(groups, c => c.targetId === targetId && hostileOwners.has(c.source.ownerId) && c.application.removable && c.application.polarity === 'harmful'
    && ['stun', 'burn', 'wound', 'sunder', 'shred', 'stat-debuff'].includes(c.application.kind), 'cleansed', tick);
}
export function advanceBurnClock(groups: readonly StatusGroup[], targetId: string, tick: number): StatusGroup[] {
  return groups.map(g => g.targetId === targetId && g.kind === 'burn' && g.nextPulseAtTick !== null && g.nextPulseAtTick <= tick ? { ...g, nextPulseAtTick: g.nextPulseAtTick + 20 } : g);
}
export function validateStatusGroups(groups: readonly StatusGroup[], tick: number, combatId?: string): void {
  const keys = new Set<string>(), categories = new Set<string>();
  for (const group of groups) {
    const category = JSON.stringify([group.targetId, group.kind]);
    if (categories.has(category) || !group.contributions.length) throw new RangeError('Duplicate/empty status group'); categories.add(category);
    for (const c of group.contributions) {
      validateIdentity(c, combatId); validateStatusApplication(c.application); integer(c.appliedAtTick);
      if (c.expiresAtTick !== null) { integer(c.expiresAtTick, 1); if (c.expiresAtTick <= tick || c.expiresAtTick <= c.appliedAtTick) throw new RangeError('Expired status contribution'); }
      if (keys.has(c.key) || c.targetId !== group.targetId || c.application.kind !== group.kind || c.appliedAtTick > tick + 1 || c.endRewardConsumed) throw new RangeError('Invalid status contribution'); keys.add(c.key);
    }
    const expected = summarizeGroup(group, tick);
    if (group.effectiveSourceKey !== expected.effectiveSourceKey || group.effectiveMagnitudeBps !== expected.effectiveMagnitudeBps) throw new RangeError('Invalid effective status');
    if (group.kind === 'burn') { integer(group.nextPulseAtTick!, 1); if (group.nextPulseAtTick! <= tick) throw new RangeError('Invalid burn clock'); }
    else if (group.nextPulseAtTick !== null) throw new RangeError('Non-burn clock');
  }
}

/** Development saves may only contain programs produced by the enabled content compiler. */
import type { CombatUnit } from '../combat-types';
import { canonicalContent } from '../content';
import { getUnitStats } from '../unit-stats';
import { sourceKey } from '../combat-s13-state';
import { asSource, compileMechanismDefinitions } from './s13-definitions';
import { validateIdentity } from './identity';
import { validateStatusGroups } from './status';
import { validatePeriodicTask } from './periodic';
import { validateShield } from './shield';
import { integer } from './stats';
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`Invalid Match save: ${message}`); }
export function validateMechanisms(unit: CombatUnit, units: readonly CombatUnit[], tick: number, combatId: string, finished: boolean, nextActionSeq: number): void {
  const state = unit.mechanismState, definitions = unit.mechanismDefinitions;
  check(state && definitions && state.initialized === true && state.combatId === combatId && state.sampledAtTick === tick, 'mechanism initialization/namespace');
  const compiled = compileMechanismDefinitions(unit, combatId);
  check(same(definitions, compiled), 'uncompiled mechanism definitions');
  check(Array.isArray(state.statuses) && Array.isArray(state.periodicTasks) && Array.isArray(state.runtimes) && Array.isArray(state.activities), 'mechanism arrays');
  check(state.runtimes.length === 0, 'uncompiled survival trigger runtimes');
  const basis = unit.maxHpBasis;
  const expectedBasis = { base: getUnitStats(unit.definitionId, unit.starLevel).health,
    flat: (unit.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statFlat' && e.effect.stat === 'maxHp' ? e.effect.amount : 0), 0),
    bps: (unit.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statPercentBps' && e.effect.stat === 'maxHp' ? e.effect.bps : 0), 0), bonusBps: 0 };
  check(same(basis, expectedBasis), 'resolved maximum health basis');
  validateStatusGroups(state.statuses, tick, combatId);
  const contributions = state.statuses.flatMap(g => g.contributions), covered = new Set<string>();
  for (const legacy of unit.statuses ?? []) {
    if (legacy.kind === 'channel' || legacy.kind === 'redirect') { check(legacy.activity !== undefined, 'missing activity projection'); continue; }
    check(Array.isArray(legacy.contributionKeys) && legacy.contributionKeys.length > 0, 'missing status contribution projection');
    for (const key of legacy.contributionKeys) {
      const c = contributions.find(c => c.key === key);
      check(c && !covered.has(key) && c.targetId === unit.id && c.source.ownerId === legacy.source.ownerId
        && c.source.sourceKind === legacy.source.sourceKind && c.source.definitionId === legacy.source.definitionId
        && c.source.instanceId === legacy.source.instanceId && c.source.parentItemInstanceId === null
        && (c.source.effectIndex === legacy.source.effectIndex * 16 || c.source.effectIndex === legacy.source.effectIndex * 16 + 1)
        && c.appliedAtTick === legacy.startsAtTick && c.expiresAtTick === legacy.expiresAtTick, 'status source/timing projection');
      const prefix = `${sourceKey(legacy.source)}:${legacy.kind}:${unit.id}:`;
      check(legacy.key.startsWith(prefix), 'status display identity');
      const suffix = legacy.key.slice(prefix.length), legacyApplication = suffix.startsWith('armor:') ? suffix.slice(6) : suffix;
      const applicationId = !legacyApplication ? 'source' : legacyApplication.startsWith('[') ? legacyApplication : JSON.stringify([...legacyApplication.split(':').map(Number), unit.id]);
      check(JSON.parse(c.key)[8] === applicationId, 'status application identity');
      const app = c.application;
      const kind = legacy.kind === 'stun' ? 'stun' : legacy.kind === 'armorReduction' ? 'sunder' : legacy.kind === 'damageReduction' ? 'damage-reduction' : legacy.amount < 0 ? 'stat-debuff' : 'stat-buff';
      check(app.kind === kind && app.onEnd === null, 'uncompiled status kind/end rewards');
      if (app.modifier) check(app.modifier.value.kind === 'constant' && app.modifier.value.amount === legacy.amount
        && app.modifier.unit === 'flat' && ['armor', 'magicResist'].includes(app.modifier.stat) && app.modifier.condition.kind === 'always' && app.modifier.damageFilter === null, 'status modifier projection');
      else check(app.magnitudeBps === legacy.amount, 'status magnitude projection');
      covered.add(key);
    }
  }
  check(covered.size === contributions.length, 'uncompiled status contribution');
  const ids = new Set(units.map(u => u.id)), dead = new Set(units.filter(u => !u.alive).map(u => u.id)), taskKeys = new Set<string>();
  for (const task of state.periodicTasks) {
    validatePeriodicTask(task, ids, dead, tick, combatId);
    const definition = compiled.periodicTasks.find(t => t.key === task.key);
    check(definition && !taskKeys.has(task.key) && same({ ...task, nextPulseAtTick: definition.nextPulseAtTick, pulseOrdinal: 0, remainders: [] }, definition), 'periodic program/source binding');
    check(task.pulseOrdinal === Math.floor(tick / task.periodTicks) && task.nextPulseAtTick === (task.pulseOrdinal + 1) * task.periodTicks, 'periodic phase');
    for (const r of task.remainders) check(r.targetId === unit.id && r.denominator === 10000 && r.numerator > 0, 'compiled periodic account');
    taskKeys.add(task.key);
  }
  check(state.periodicTasks.length === (!unit.alive || finished ? 0 : compiled.periodicTasks.length), 'lost periodic tasks');
  for (const layer of unit.shieldLayers ?? []) {
    check(layer.m8State && layer.m8Grant, 'missing frozen shield record/declaration');
    const shield = layer.m8State, grant = layer.m8Grant;
    validateShield(shield, tick, combatId);
    check(shield.targetId === unit.id && same(shield.source, asSource(layer.source)) && layer.key === sourceKey(layer.source)
      && shield.granted === layer.granted && shield.remaining === layer.remaining && shield.absorbed === layer.absorbed
      && shield.expiresAtTick === layer.expiresAtTick && typeof shield.endRewardConsumed === 'boolean', 'shield projection');
    check(grant.kind === 'grant-shield' && grant.durationTicks > 0 && grant.amount.sample === 'application'
      && grant.amount.flat >= 0 && grant.amount.attackDamageBps === 0 && grant.amount.abilityPowerBps === 0 && grant.amount.maxHpBps === 0
      && grant.amount.missingHpBps === 0 && grant.amount.actualManaSpentBps === 0 && grant.amount.actualDamageBps === 0
      && grant.amount.shieldAbsorbedBps === 0 && grant.amount.cap === null && grant.amount.hpBasis === 'holder'
      , 'uncompiled shield grant');
    integer(grant.durationTicks, 1); integer(grant.amount.flat);
    const owner = units.find(u => u.id === shield.source.ownerId)!;
    if (shield.decay.kind === 'linear-initial-grant') {
      check(owner.ability.kind === 's13' && Object.hasOwn(owner.ability.variables, 'PercentShieldDamage') && grant.endTiming === 'next-action-planning' && grant.decay.kind === 'linear-initial-grant'
        && same(grant.onEnd, ['depleted', 'expired']) && grant.endEffects.length === 1, 'decaying shield end binding');
      const end = grant.endEffects[0];
      check(end.kind === 'damage' && end.damageType === 'magic' && end.delivery === 'ability-direct' && end.critEligibility === 'requires-spell-authorization'
        && end.amount.shieldAbsorbedBps === owner.ability.variables.PercentShieldDamage && end.amount.sample === 'packet'
        && end.amount.attackDamageBps === 0 && end.amount.abilityPowerBps === 0 && end.amount.maxHpBps === 0 && end.amount.missingHpBps === 0
        && end.amount.actualManaSpentBps === 0 && end.amount.actualDamageBps === 0 && end.amount.cap === null && end.amount.hpBasis === 'holder', 'shield end amount binding');
      const apAtGrant = (owner.abilityPower ?? 100) + (owner.mechanics ?? []).filter(m => m.mechanic === 'archangel').reduce((n, m) => n + Math.floor(shield.startsAtTick / m.values.periodTicks) * m.values.abilityPower, 0);
      check(end.amount.flat === Math.floor(apAtGrant * owner.ability.variables.StrikeBaseDamage / 1000000), 'shield end sampled damage');
      check(grant.endTargeting.kind === 'select' && same(grant.endTargeting.selector, { primary: 'normal', candidates: 'board', relation: 'enemy', anchor: 'holder', radius: 1, maxTargets: 100, excludeSelf: true, excludePrimary: false, distinct: true, order: 'id', sample: 'action-completion' }), 'shield end targeting binding');
    } else check(grant.endTiming === 'post-damage' && grant.decay.kind === 'none' && grant.onEnd.length === 0 && grant.endEffects.length === 0
      && same(grant.endTargeting, { kind: 'fixed', targetIds: [unit.id], ifMissing: 'skip' }), 'ordinary shield end binding');
    const pendingEnds = units.flatMap(u => u.tasks ?? []).filter(t => t.shieldEndKey === layer.key && t.source.ownerId === shield.source.ownerId);
    check(shield.remaining === 0 || layer.endedReason === undefined && !shield.endRewardConsumed, 'active shield consumption/reason');
    if (shield.remaining === 0) check(layer.endedReason !== undefined || shield.granted === 0 && !shield.endRewardConsumed, 'missing shield end reason');
    if (shield.endRewardConsumed) check(pendingEnds.length === 0, 'consumed shield has pending end task');
    else if (grant.endTiming === 'next-action-planning') check(pendingEnds.length === 1
      && pendingEnds[0].executeAtTick > tick && same(asSource(pendingEnds[0].source), shield.source), 'missing/foreign shield end task');
    else check(pendingEnds.length === 0, 'unexpected shield end task');
    if (layer.endedReason !== undefined) check(['depleted','expired','replaced','death-cleanup','combat-end'].includes(layer.endedReason) && shield.remaining === 0, 'shield end reason');
  }
  const activityKeys = new Set<string>();
  for (const a of state.activities) {
    validateIdentity(a, combatId); integer(a.actionSeq); integer(a.startsAtTick); integer(a.expiresAtTick, 1);
    check(!activityKeys.has(a.key) && a.targetId === unit.id && a.source.ownerId === unit.id && a.source.sourceKind === 'ability'
      && a.source.definitionId === unit.ability.id && a.source.instanceId === unit.id && a.source.effectIndex === 0 && a.source.parentItemInstanceId === null
      && a.actionSeq < nextActionSeq && a.startsAtTick <= tick && a.expiresAtTick > a.startsAtTick, 'activity identity/time');
    activityKeys.add(a.key);
    check(a.kind === 'channel' || a.kind === 'redirect', 'activity kind');
    if (a.kind === 'channel') check(same(a.blocks, ['move','attack','cast']) && a.cancelOnControl === true, 'channel declaration');
    else check(a.allyRadius === 1 && a.shareBps >= 0 && a.shareBps <= 10000 && a.choose === 'lowest-id' && a.repeatMitigation === false && a.recursive === false, 'redirect declaration');
    if (a.lifecycle === 'active') check(unit.alive && !finished && a.expiresAtTick > tick && a.endedAtTick === null && a.endReason === null
      && (unit.statuses ?? []).some(s => s.activity?.key === a.key && same(s.activity, a) && s.startsAtTick === a.startsAtTick && s.expiresAtTick === a.expiresAtTick && s.kind === a.kind && (a.kind !== 'redirect' || s.amount === a.shareBps)), 'active activity projection');
    else { check(a.lifecycle === 'ended', 'activity lifecycle'); integer(a.endedAtTick); check(a.endedAtTick <= tick && a.endedAtTick >= a.startsAtTick
      && ['expired','control-cancelled','replaced','death-cleanup','combat-end'].includes(a.endReason)
      && (a.endReason !== 'expired' || a.endedAtTick === a.expiresAtTick) && (a.kind !== 'redirect' || a.endReason !== 'control-cancelled'), 'ended activity receipt'); }
  }
  for (const legacy of unit.statuses ?? []) if (legacy.activity) check(state.activities.some(a => a.key === legacy.activity!.key && a.lifecycle === 'active'), 'foreign activity projection');
  if (!unit.alive || finished) check(state.statuses.length === 0 && (unit.statuses ?? []).length === 0 && (unit.shieldLayers ?? []).length === 0, 'mechanism cleanup');
}

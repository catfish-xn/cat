import { isDeclaredStatus, declaredEffects, validateItemRuntime, abilityPowerCandidates, maxHpCandidates } from './item-restore';
import { canonicalSource } from './identity';
/** Development saves may only contain programs produced by the enabled content compiler. */
import type { CombatUnit } from '../combat-types';
import { canonicalContent } from '../content';
import { getUnitStats } from '../unit-stats';
import { sourceKey } from '../combat-s13-state';
import { asSource, compileMechanismDefinitions, flatAmount, selfSelector } from './s13-definitions';
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
  validateItemRuntime(unit,combatId,tick,compiled);
  const basis = unit.maxHpBasis;
  const expectedBasis = { base: getUnitStats(unit.definitionId, unit.starLevel).health,
    flat: (unit.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statFlat' && e.effect.stat === 'maxHp' ? e.effect.amount : 0), 0),
    bps: (unit.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statPercentBps' && e.effect.stat === 'maxHp' ? e.effect.bps : 0), 0), bonusBps: 0 };
  check(same({...basis,bonusBps:0}, expectedBasis), 'resolved maximum health basis');
  validateStatusGroups(state.statuses, tick, combatId);
  const contributions = state.statuses.flatMap(g => g.contributions), covered = new Set<string>();
  for (const legacy of unit.statuses ?? []) {
    if (legacy.kind === 'channel' || legacy.kind === 'redirect') { check(legacy.activity !== undefined, 'missing activity projection'); continue; }
    check(Array.isArray(legacy.contributionKeys) && legacy.contributionKeys.length > 0, 'missing status contribution projection');
    for (const key of legacy.contributionKeys) {
      const c = contributions.find(c => c.key === key);
      if(c && c.source.sourceKind==='item' && isDeclaredStatus(c.source,c.application,units,combatId)) {
        check(!covered.has(key) && c.targetId===unit.id && same(c.source,asSource(legacy.source)) && legacy.key===c.key && c.appliedAtTick===legacy.startsAtTick && (c.expiresAtTick ?? 1201)===legacy.expiresAtTick, 'item status source/timing projection');
        covered.add(key);continue;
      }
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
    const burn=contributions.find(c=>c.key===task.key&&c.application.kind==='burn');
    if(burn) {
      const program={definitionId:JSON.stringify([burn.source.definitionId,burn.source.effectIndex,'burn']),selector:selfSelector({candidates:'bound-target',relation:'enemy',maxTargets:1}),targetSnapshot:'once-per-pulse',effects:[{kind:'damage',damageType:'true',delivery:'item-burn',critEligibility:'never',amount:flatAmount(0,{maxHpBps:burn.application.magnitudeBps,hpBasis:'target',sample:'each-pulse'})}]};
      check(!taskKeys.has(task.key)&&task.targetId===unit.id&&same(task.source,burn.source)&&task.periodTicks===20&&task.endsAtTick===burn.expiresAtTick&&task.finalPulse==='before-expiry'&&task.onSourceDeath==='persist-attached'&&task.onTargetDeath==='cancel'&&task.pulseLimit===null&&same(task.program,program)&&task.nextPulseAtTick===state.statuses.find(g=>g.contributions.some((c: import('./contracts').StatusContribution)=>c.key===burn.key))!.nextPulseAtTick,'item burn program');
      taskKeys.add(task.key);continue;
    }
    const definition = compiled.periodicTasks.find(t => t.key === task.key);
    check(definition && !taskKeys.has(task.key) && same({ ...task, nextPulseAtTick: definition.nextPulseAtTick, pulseOrdinal: 0, remainders: [] }, definition), 'periodic program/source binding');
    check(task.pulseOrdinal === Math.max(0,Math.floor((tick-definition!.nextPulseAtTick)/task.periodTicks)+1) && task.nextPulseAtTick === definition!.nextPulseAtTick+task.pulseOrdinal*task.periodTicks, 'periodic phase');
    for (const r of task.remainders) check(ids.has(r.targetId) && r.denominator > 0 && r.numerator > 0, 'compiled periodic account');
    taskKeys.add(task.key);
  }
  check(state.periodicTasks.filter(t=>t.onSourceDeath==='cancel').length === (!unit.alive || finished ? 0 : compiled.periodicTasks.filter(t=>t.endsAtTick===null||t.endsAtTick>tick).length), 'lost periodic tasks');
  check(contributions.filter(c=>c.application.kind==='burn').every(c=>taskKeys.has(c.key)), 'lost attached burn task');
  for (const layer of unit.shieldLayers ?? []) {
    check(layer.m8State && layer.m8Grant, 'missing frozen shield record/declaration');
    const shield = layer.m8State, grant = layer.m8Grant;
    validateShield(shield, tick, combatId);
    check(shield.targetId === unit.id && same(shield.source, asSource(layer.source)) && layer.key === sourceKey(layer.source)
      && shield.granted === layer.granted && shield.remaining === layer.remaining && shield.absorbed === layer.absorbed
      && shield.expiresAtTick === layer.expiresAtTick && typeof shield.endRewardConsumed === 'boolean', 'shield projection');
    const declared=shield.source.sourceKind==='item'?units.filter(u=>u.id===shield.source.ownerId).flatMap(u=>declaredEffects(u,combatId)).find(d=>canonicalSource(d.source)===canonicalSource(shield.source)&&d.effect.kind==='grant-shield'&&same(d.effect,grant)):undefined;
    if(declared) {
      check(shield.decay.kind===grant.decay.kind && [...maxHpCandidates(unit,shield.startsAtTick,combatId)].some(hp=>shield.granted===Math.floor(hp*grant.amount.maxHpBps/10000)), 'item shield sampled amount');
      check(shield.remaining>0&&layer.endedReason===undefined&&!shield.endRewardConsumed&&!units.some(u=>u.tasks?.some(t=>t.shieldEndKey===layer.key)), 'item shield active lifecycle');
      continue;
    }
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
      check(end.amount.flat === Math.floor(apAtGrant * owner.ability.variables.StrikeBaseDamage / 1000000) || [...abilityPowerCandidates(owner,shield.startsAtTick,combatId)].some(ap=>end.amount.flat===Math.floor(ap*(owner.ability.kind==='s13'?owner.ability.variables.StrikeBaseDamage:0)/1000000)), 'shield end sampled damage');
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

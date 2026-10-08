/** G04–G07 adapter: compiles legacy tags once and executes only finite frozen declarations. */
import { emitMechanismSignal } from './s13-triggers';
import { hexDistance, DEFAULT_BOARD } from '../board';
import { selectTargets, startingRows, type TargetEnvironment } from './targeting';
import { targetingEnvironment } from './s13-targeting';
import type { CombatStatus } from '../combat-types';
import type { AbilityContext, PeriodicReference } from '../combat-s13-abilities';
import { ad, ap, compareText, constantModifier, ensureMechanisms, frozenShield, hpSample, shieldProjection, sourceKey, spellCrit, syncShield, type S13Unit } from '../combat-s13-state';
import type { AmountSample } from './stats';
import { changeMaxHp, conditionHolds, evaluateAmount, integer, resolveStat, safeNumber } from './stats';
import type { AbilityTargeting, Effect, PeriodicTask, Source, StatusApplication, StatusContribution, SurvivalSample, TargetSelector } from './contracts';
import { asSource, compileMechanismDefinitions, flatAmount, selfSelector } from './s13-definitions';
import { canonicalSource, compareCodePoints, effectIdentity } from './identity';
import { applyStatusContribution, advanceBurnClock, cleanseStatuses, endStatuses, removeStatusContributions, statusMagnitude, summarizeGroup } from './status';
import { advancePeriodicTask, cleanPeriodicTasks, periodicAmount, clearRemainder } from './periodic';
import { consumeSurvivalTriggers, endShield, grantShieldState, maintainShield, survivalSamples } from './shield';
import { makeHealRequest, resolveHeal, type VampRate } from './heal';
import { rollCrit } from './crit';
export function selectMechanismTargets(holder: S13Unit, units: readonly S13Unit[], selector: TargetSelector, boundTargetId?: string, source?: Source, environment: Partial<TargetEnvironment> = {}): S13Unit[] {
  const tick = environment.tick ?? holder.mechanismState?.sampledAtTick ?? 0;
  const ids = selectTargets(selector, targetingEnvironment(environment.board ?? DEFAULT_BOARD, units, holder, tick,
    { source, boundTargetIds: boundTargetId ? [boundTargetId] : [], eligibility: selector.candidates === 'bound-target' ? 'bound-packet' : 'new-selection', ...environment }));
  return ids.map(id => units.find(u => u.id === id)!);
}

function endTargets(holder: S13Unit, ctx: AbilityContext, targeting: AbilityTargeting, area = false): S13Unit[] {
  if (targeting.kind === 'fixed') return targeting.targetIds.flatMap(id => ctx.units.filter(u => u.id === id && u.alive && u.hp > 0));
  if (targeting.kind === 'select') return selectMechanismTargets(holder, ctx.units, targeting.selector, undefined, undefined, { board: ctx.board, tick: ctx.tick, eligibility: area ? 'area-hit' : 'new-selection' });
  if (targeting.kind === 'area-around-selected') {
    const center = selectMechanismTargets(holder, ctx.units, targeting.center, undefined, undefined, { board: ctx.board, tick: ctx.tick })[0]; if (!center) return [];
    return ctx.units.filter(u => u.alive && u.hp > 0 && (targeting.relation === 'ally' ? u.team === holder.team : u.team !== holder.team) && hexDistance(center.cell, u.cell) <= targeting.radius).sort((a, b) => compareText(a.id, b.id));
  }
  throw new RangeError('Unsupported G07 end targeting for this batch');
}
function effectSample(holder: S13Unit, target: S13Unit, tick: number, frozen?: SurvivalSample, absorbed?: number): AmountSample & Pick<import('./stats').StatSample, 'startingRows'> {
  const before = frozen ? { id: frozen.unitId, hp: frozen.hpAfterDamage, maxHp: frozen.maxHpBeforeThresholdEffects } : undefined;
  return { startingRows: startingRows(holder.team, holder.startingCell?.row ?? holder.cell.row) ?? undefined, holder: before?.id === holder.id ? before : hpSample(holder), target: before?.id === target.id ? before : hpSample(target), attackDamage: ad(holder), abilityPower: ap(holder, tick), ...(absorbed !== undefined ? { shieldAbsorbed: absorbed } : {}) };
}
function clearMechanismTarget(ctx: AbilityContext, unit: S13Unit, actionSeq: number): void {
  const before = unit.targetId; if (before === null) return;
  unit.targetId = null;
  ctx.events.push({ type: 'targetChanged', tick: ctx.tick, unitId: unit.id, before, after: null });
  emitMechanismSignal(ctx, { event: 'target-changed', tick: ctx.tick, actionSeq, actorId: unit.id, targetId: null, cast: null });
}
function applyFrozenStatus(ctx: AbilityContext, target: S13Unit, source: Source, application: StatusApplication, applicationId = 'source', actionSeq = 0): void {
  ensureMechanisms(target, ctx.tick, ctx.combatId);
  const identity = effectIdentity(target.mechanismState!.combatId, source, target.id, applicationId);
  const result = applyStatusContribution(target.mechanismState!.statuses, identity, application, ctx.tick);
  if (!result.accepted) return;
  target.mechanismState = { ...target.mechanismState!, statuses: result.groups };
  const group = result.groups.find(g => g.contributions.some(c => c.key === identity.key))!;
  // New kinds retain their frozen group fact; a legacy status event only supplies its removal/display anchor.
  const status: CombatStatus = { key: identity.key, source, kind: application.kind === 'stun' ? 'stun' : application.kind === 'sunder' ? 'armorReduction' : 'resistanceFlat',
    amount: application.modifier?.value.kind === 'constant' ? application.modifier.value.amount : application.magnitudeBps,
    startsAtTick: group.contributions.find(c => c.key === identity.key)!.appliedAtTick, expiresAtTick: group.contributions.find(c => c.key === identity.key)!.expiresAtTick ?? 1201, contributionKeys: [identity.key] };
  ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: target.id, status, group, reason: 'applied' });
  if (application.kind === 'untargetable' && application.activation === 'immediate') {
    for (const enemy of ctx.units) if (enemy.team !== target.team && enemy.targetId === target.id) {
      clearMechanismTarget(ctx, enemy, actionSeq);
    }
  }
  if (application.kind === 'burn') synchronizeBurnTask(target, identity.key);
}
function synchronizeBurnTask(target: S13Unit, key: string): void {
  const group = target.mechanismState!.statuses.find(g => g.kind === 'burn' && g.contributions.some(c => c.key === key))!;
  const c = group.contributions.find(c => c.key === key)!;
  const program = { definitionId: JSON.stringify([c.source.definitionId, c.source.effectIndex, 'burn']), selector: selfSelector({ candidates: 'bound-target', relation: 'enemy', maxTargets: 1 }), targetSnapshot: 'once-per-pulse' as const,
    effects: [{ kind: 'damage', damageType: 'true', delivery: 'item-burn', critEligibility: 'never', amount: flatAmount(0, { maxHpBps: c.application.magnitudeBps, hpBasis: 'target', sample: 'each-pulse' }) } as const] };
  const old = target.mechanismState!.periodicTasks.find(t => t.key === key);
  const same = old && JSON.stringify(old.program) === JSON.stringify(program);
  const task: PeriodicTask = { key, source: c.source, targetId: target.id, nextPulseAtTick: group.nextPulseAtTick!, periodTicks: 20, endsAtTick: c.expiresAtTick,
    pulseOrdinal: old?.pulseOrdinal ?? 0, pulseLimit: null, remainders: same ? old.remainders : [], finalPulse: 'before-expiry', onSourceDeath: 'persist-attached', onTargetDeath: 'cancel', program };
  target.mechanismState = { ...target.mechanismState!, periodicTasks: [...target.mechanismState!.periodicTasks.filter(t => t.key !== key), task] };
}
/** Burn clocks are attached to their contribution; independent program timers are not. */
function cancelAttachedBurns(tasks: readonly PeriodicTask[], ended: readonly StatusContribution[]): PeriodicTask[] {
  return tasks.filter(task => !ended.some(c => c.application.kind === 'burn' && task.key === c.key && task.targetId === c.targetId
    && canonicalSource(task.source) === canonicalSource(c.source)
    && task.program.definitionId === JSON.stringify([c.source.definitionId, c.source.effectIndex, 'burn'])));
}
interface DamageExecutionContext { readonly applicationId?: string; readonly facts?: import('./triggers').ResolutionFacts; readonly cast?: import('./contracts').CastReceipt; readonly counters?: Readonly<Record<string, number>>; readonly area: boolean; readonly triggeringCastActionSeq: number | null }
export function executeMechanismEffect(ctx: AbilityContext, holder: S13Unit, source: Source, target: S13Unit, effect: Effect, seq: number, ordinal = 0,
  frozen?: SurvivalSample, periodic?: PeriodicReference, amountOverride?: number, absorbed?: number, damageContext?: DamageExecutionContext): void {
  const sample = { ...effectSample(holder, target, ctx.tick, frozen, absorbed), ...(damageContext?.cast ? { cast: damageContext.cast } : {}), ...(damageContext?.facts?.damage.length ? { damageOutcomes: damageContext.facts.damage } : {}) };
  const value = 'amount' in effect && typeof effect.amount !== 'number' ? amountOverride ?? evaluateAmount(effect.amount, sample) : 0;
  switch (effect.kind) {
    case 'grant-mana':
      (ctx.manaRequests ??= []).push({ source, targetId: target.id, amount: effect.amount, reason: effect.reason, bypassLock: effect.bypassLock, castActionSeq: effect.reason === 'cast-refund' ? seq : null }); break;
    case 'damage': ctx.packets.push({ source, targetId: target.id, raw: value, damageType: effect.damageType, actionSeq: seq, ordinal,
      delivery: effect.delivery, critEligibility: effect.critEligibility, area: damageContext?.area ?? false, triggeringCastActionSeq: damageContext?.triggeringCastActionSeq ?? null, ...(damageContext?.facts?.damage[0] ? { parentPacketId: damageContext.facts.damage[0].context.packetId, rootActionSeq: damageContext.facts.damage[0].context.rootActionSeq } : {}), ...(periodic ? { periodic } : {}) }); break;
    case 'heal': {
      const request = makeHealRequest(JSON.stringify([ctx.combatId ?? 'standalone', ctx.tick, canonicalSource(asSource(source)), target.id, seq, ordinal, 'direct']), target.id, 'direct', null, [{ source, numerator: value, denominator: 1 }]);
      ctx.heals.push({ source, targetId: target.id, amount: value, request, ...(periodic ? { periodic } : {}) }); break;
    }
    case 'apply-status': applyFrozenStatus(ctx, target, source, effect.status, effect.status.stackPolicy.kind === 'independent-instances' ? JSON.stringify([seq, ordinal]) : 'source', seq); break;
    case 'modify-stat': {
      const rawModifier = effect.modifier;
      const modifier = rawModifier.value.kind === 'counter' ? { ...rawModifier, value: { kind: 'constant' as const, amount: safeNumber(integer(damageContext?.counters?.[rawModifier.value.counterId] ?? 0) * integer(rawModifier.value.perCount, Number.MIN_SAFE_INTEGER)) } } : rawModifier;
      if (modifier.stat === 'attackSpeed' && modifier.unit === 'bps' && modifier.value.kind === 'constant' && effect.duration.kind === 'combat' && effect.activation === 'immediate' && !damageContext?.applicationId && effect.stackPolicy.kind === 'add-stacks' && effect.stackPolicy.cap === null && conditionHolds(modifier.condition, sample)) {
        const before = target.runtime.attackSpeedBps; target.runtime.attackSpeedBps = safeNumber(integer(before) + integer(modifier.value.amount));
        ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: target.id, source, stat: 'attackSpeedBps', before, after: target.runtime.attackSpeedBps }); break;
      }
      // Legacy unbounded combat growth is a projection of this one program/runtime.
      if (modifier.stat === 'abilityPower' && modifier.unit === 'flat' && modifier.value.kind === 'constant' && effect.duration.kind === 'combat'
        && effect.activation === 'immediate' && !damageContext?.applicationId && effect.stackPolicy.kind === 'add-stacks' && effect.stackPolicy.cap === null && conditionHolds(modifier.condition, sample)) {
        const before = (target.abilityPower ?? 100) + target.runtime.abilityPowerFlat;
        target.runtime.abilityPowerFlat = safeNumber(integer(target.runtime.abilityPowerFlat) + integer(modifier.value.amount));
        ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: target.id, source, stat: 'abilityPower', before, after: (target.abilityPower ?? 100) + target.runtime.abilityPowerFlat }); break;
      }
      applyFrozenStatus(ctx, target, source, { kind: modifier.value.kind === 'constant' && modifier.value.amount < 0 ? 'stat-debuff' : 'stat-buff', magnitudeBps: 0,
        duration: effect.duration, stackPolicy: effect.stackPolicy, activation: effect.activation, polarity: modifier.value.kind === 'constant' && modifier.value.amount < 0 ? 'harmful' : 'beneficial', removable: modifier.value.kind === 'constant' && modifier.value.amount < 0,
        modifier, damageFilter: null, onEnd: null }, damageContext?.applicationId ?? (effect.stackPolicy.kind === 'independent-instances' ? JSON.stringify([seq, ordinal]) : 'source'), seq); break;
    }
    case 'grant-shield': {
      const identity = effectIdentity(target.mechanismState!.combatId, source, target.id), legacyKey = source.parentItemInstanceId === null ? sourceKey(source) : identity.key, old = target.shieldLayers.find(l => l.key === legacyKey);
      const state = grantShieldState(identity, value, effect, ctx.tick, old ? frozenShield(old, target) : undefined);
      const layer = shieldProjection(state, legacyKey, effect);
      target.shieldLayers = [...target.shieldLayers.filter(l => l.key !== legacyKey), layer]; syncShield(target);
      ctx.events.push({ type: 'shieldLayerChanged', tick: ctx.tick, unitId: target.id, layer, reason: 'granted' }); break;
    }
    case 'change-max-hp': {
      const basis = target.maxHpBasis ?? { base: target.maxHp, flat: 0, bps: 0, bonusBps: 0 };
      const updated = { ...basis, bonusBps: basis.bonusBps + effect.bonusBps };
      const max = resolveStat('maxHp', updated.base, [constantModifier('maxHp', updated.flat), constantModifier('maxHp', updated.bps + updated.bonusBps, 'bps')], { holder: hpSample(target) });
      const result = changeMaxHp(target.maxHp, target.hp, max); target.maxHp = max; target.hp = result.afterHp; target.maxHpBasis = updated;
      ctx.events.push({ type: 'maxHpChanged', tick: ctx.tick, unitId: target.id, source, ...result }); break;
    }
    case 'cleanse': {
      const hostile = new Set(ctx.units.filter(u => u.team !== target.team).map(u => u.id));
      const result = cleanseStatuses(target.mechanismState!.statuses, target.id, hostile, ctx.tick); target.mechanismState = { ...target.mechanismState!, statuses: result.groups };
      const keys = new Set(result.ended.map(e => e.contribution.key));
      target.statuses = target.statuses.filter(s => !(s.contributionKeys?.some(k => keys.has(k)) || !s.contributionKeys && hostile.has(s.source.ownerId) && (s.kind === 'stun' || s.kind === 'armorReduction' || s.kind === 'resistanceFlat' && s.amount < 0)));
      for (const unit of ctx.units) {
        unit.tasks = unit.tasks.filter(t => !(t.attachedDot && t.targetId === target.id && hostile.has(t.source.ownerId)));
      }
      target.mechanismState = { ...target.mechanismState!, periodicTasks: cancelAttachedBurns(target.mechanismState!.periodicTasks, result.ended.map(e => e.contribution)) };
      for (const ended of result.ended) ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: target.id, reason: 'cleansed', group: { targetId: target.id, kind: ended.contribution.application.kind, contributions: [ended.contribution], effectiveSourceKey: null, effectiveMagnitudeBps: 0, nextPulseAtTick: null },
        status: { key: ended.contribution.key, source: ended.contribution.source, kind: 'stun', amount: 0, startsAtTick: ended.contribution.appliedAtTick, expiresAtTick: ctx.tick } });
      clearMechanismTarget(ctx, target, seq); break;
    }
    default: throw new RangeError(`Effect ${effect.kind} belongs to a later B3 batch`);
  }
}
export function initializeMechanisms(ctx: AbilityContext): void {
  const initial: { holder: S13Unit; definition: ReturnType<typeof consumeSurvivalTriggers>['fired'][number] }[] = [];
  for (const unit of ctx.units) {
    ensureMechanisms(unit, ctx.tick - 1, ctx.combatId);
    const state = unit.mechanismState!;
    if (!state.initialized) {
      const definitions = unit.mechanismDefinitions ?? compileMechanismDefinitions(unit, state.combatId);
      unit.mechanismDefinitions = definitions;
      unit.mechanismState = { ...state, initialized: true, periodicTasks: [...state.periodicTasks, ...definitions.periodicTasks.map(t => { const skipped = Math.max(0, Math.ceil((ctx.tick - t.nextPulseAtTick) / t.periodTicks)); return { ...t, nextPulseAtTick: t.nextPulseAtTick + skipped * t.periodTicks, pulseOrdinal: t.pulseOrdinal + skipped }; })] };
      for (const group of state.statuses) if (group.kind === 'burn') for (const c of group.contributions) synchronizeBurnTask(unit, c.key);
      const sample: SurvivalSample = { unitId: unit.id, tick: ctx.tick - 1, hpBeforeDamage: unit.hp, hpAfterDamage: unit.hp, maxHpBeforeThresholdEffects: unit.maxHp, survivedDamageBatch: unit.hp > 0, receivedPositiveDamage: false };
      const eligible = consumeSurvivalTriggers(definitions.survivalTriggers, state.runtimes, sample, state.combatId, true);
      unit.mechanismState = { ...unit.mechanismState!, runtimes: eligible.runtimes };
      for (const definition of eligible.fired) initial.push({ holder: unit, definition });
    }
    unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: ctx.tick };
  }
  for (const { holder, definition: { definition, sample } } of initial) for (const [index, effect] of definition.effects.entries())
    executeMechanismEffect({ ...ctx, tick: sample.tick }, holder, { ...definition.source, effectIndex: definition.source.effectIndex + index }, holder, effect, 0, index, sample);
}
export function maintainMechanisms(ctx: AbilityContext, nextSeq: () => number): void {
  const dead = new Set(ctx.units.filter(u => !u.alive || u.hp <= 0).map(u => u.id));
  // Select one winner per burn group before expiring anything. A final strong
  // pulse and the newly exposed weak source must never both pay on this tick.
  const burnWinners = new Map<string, string | null>();
  for (const unit of ctx.units) for (const group of unit.mechanismState!.statuses) if (group.kind === 'burn' && group.nextPulseAtTick === ctx.tick)
    burnWinners.set(unit.id, summarizeGroup(group, ctx.tick, true).effectiveSourceKey);
  const executePulse = (unit: S13Unit, task: PeriodicTask) => {
    const advanced = advancePeriodicTask(task, ctx.tick); if (!advanced.due) { if (!advanced.task) unit.mechanismState = { ...unit.mechanismState!, periodicTasks: unit.mechanismState!.periodicTasks.filter(t => t.key !== task.key) }; return; }
    const burn = task.program.effects.some(e => e.kind === 'damage' && e.delivery === 'item-burn');
    const holder = ctx.units.find(u => u.id === task.source.ownerId)!;
    const payable = !burn || burnWinners.get(unit.id) === task.key;
    let current = task;
    const seq = nextSeq(), firstPacket = ctx.packets.length;
    if (payable) {
      emitMechanismSignal(ctx, { event: 'periodic', tick: ctx.tick, actionSeq: seq, actorId: holder.id, targetId: task.targetId, cast: null });
      const targets = selectMechanismTargets(holder, ctx.units, task.program.selector, task.targetId, task.source, { board: ctx.board, tick: ctx.tick });
      const samples = new Map(targets.map(t => [t.id, effectSample(holder, t, ctx.tick)]));
      for (const target of targets) for (const [effectIndex, effect] of task.program.effects.entries()) {
        let value: number | undefined;
        if (effect.kind === 'damage' || effect.kind === 'heal' || effect.kind === 'grant-shield') { const computed = periodicAmount(current, effectIndex, target.id, samples.get(target.id)!); current = computed.task; value = computed.requested; }
        const source = { ...task.source, effectIndex: task.source.effectIndex + effectIndex };
        executeMechanismEffect(ctx, holder, source, target, effect, seq, effectIndex, undefined, { holderId: unit.id, taskKey: task.key, effectIndex }, value);
      }
    }
    const updated = advanced.task ? { ...advanced.task, remainders: current.remainders } : null;
    unit.mechanismState = { ...unit.mechanismState!, periodicTasks: [...unit.mechanismState!.periodicTasks.filter(t => t.key !== task.key), ...(updated ? [updated] : [])] };
    for (const packet of ctx.packets.slice(firstPacket).sort((a, b) => compareText(a.targetId, b.targetId) || a.ordinal - b.ordinal)) packet.critical = rollCrit(packet.critEligibility, spellCrit(holder), ctx.draw);
  };
  for (const unit of ctx.units) unit.mechanismState = { ...unit.mechanismState!, periodicTasks: cleanPeriodicTasks(unit.mechanismState!.periodicTasks, dead, dead) };
  // All declared final pulses see the old contributions before any expiration.
  for (const unit of ctx.units) for (const task of [...unit.mechanismState!.periodicTasks].sort((a, b) => compareCodePoints(a.key, b.key)))
    if (task.finalPulse === 'before-expiry' && task.endsAtTick === ctx.tick) executePulse(unit, task);
  for (const unit of ctx.units) {
    const expired = endStatuses(unit.mechanismState!.statuses, ctx.tick);
    for (const status of unit.statuses) if (status.contributionKeys?.some(k => expired.ended.some(e => e.contribution.key === k)))
      ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: unit.id, status, reason: 'expired' });
    for (const ended of expired.ended) if (!unit.statuses.some(s => s.contributionKeys?.includes(ended.contribution.key)))
      ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: unit.id, reason: 'expired', status: { key: ended.contribution.key, source: ended.contribution.source, kind: 'resistanceFlat', amount: 0, startsAtTick: ended.contribution.appliedAtTick, expiresAtTick: ctx.tick }, group: { targetId: unit.id, kind: ended.contribution.application.kind, contributions: [ended.contribution], effectiveSourceKey: null, effectiveMagnitudeBps: 0, nextPulseAtTick: null } });
    unit.mechanismState = { ...unit.mechanismState!, periodicTasks: cancelAttachedBurns(unit.mechanismState!.periodicTasks, expired.ended.map(e => e.contribution)), statuses: expired.groups.map(g => summarizeGroup(g, ctx.tick)) };
    for (const ended of expired.ended) for (const [index, effect] of ended.effects.entries()) executeMechanismEffect(ctx, ctx.units.find(u => u.id === ended.contribution.source.ownerId)!,
      { ...ended.contribution.source, effectIndex: ended.contribution.source.effectIndex + index + 1 }, unit, effect, nextSeq(), index);
    unit.statuses = unit.statuses.filter(s => !s.contributionKeys || s.contributionKeys.some(k => unit.mechanismState!.statuses.some(g => g.contributions.some(c => c.key === k))));
    unit.shieldLayers = unit.shieldLayers.map(layer => {
      const maintained = maintainShield(frozenShield(layer, unit), ctx.tick);
      const next = shieldProjection(maintained.layer, layer.key, layer.m8Grant, maintained.reason ?? layer.endedReason);
      if (maintained.decayed > 0 && ctx.resolutionFacts) ctx.resolutionFacts = { ...ctx.resolutionFacts, shieldDecay: [...ctx.resolutionFacts.shieldDecay, { key: next.key, amount: maintained.decayed }] };
      if (maintained.decayed > 0) ctx.events.push({ type: 'shieldLayerChanged', tick: ctx.tick, unitId: unit.id, layer: next, reason: 'decayed' });
      if (maintained.reason) ctx.events.push({ type: 'shieldLayerChanged', tick: ctx.tick, unitId: unit.id, layer: next, reason: maintained.reason === 'expired' ? 'expired' : 'decayed', endReason: maintained.reason });
      return next;
    }); syncShield(unit);
  }
  for (const unit of ctx.units) for (const task of [...unit.mechanismState!.periodicTasks].sort((a, b) => compareCodePoints(a.key, b.key))) executePulse(unit, task);
  for (const unit of ctx.units) unit.mechanismState = { ...unit.mechanismState!, statuses: advanceBurnClock(unit.mechanismState!.statuses, unit.id, ctx.tick) };
}
export function clearPeriodicAccount(ctx: AbilityContext, reference: PeriodicReference, targetId: string): void {
  const owner = ctx.units.find(u => u.id === reference.holderId)!;
  owner.mechanismState = { ...owner.mechanismState!, periodicTasks: owner.mechanismState!.periodicTasks.map(t => t.key === reference.taskKey ? clearRemainder(t, reference.effectIndex, targetId) : t) };
}
export function executeShieldEnd(ctx: AbilityContext, holder: S13Unit, legacyKey: string, seq: number, damageContext?: DamageExecutionContext): void {
  const layer = holder.shieldLayers.find(l => l.key === legacyKey); if (!layer?.m8Grant) return;
  const state = frozenShield(layer, holder), reason = layer.endedReason ?? (state.expiresAtTick <= ctx.tick ? 'expired' : 'depleted');
  const ended = endShield(state, reason, layer.m8Grant, holder.alive && holder.hp > 0);
  const next = shieldProjection(ended.layer, layer.key, layer.m8Grant, reason); holder.shieldLayers = holder.shieldLayers.map(l => l === layer ? next : l);
  if (!ended.emitEnd) return;
  emitMechanismSignal(ctx, { event: 'shield-ended', tick: ctx.tick, actionSeq: seq, actorId: holder.id, targetId: holder.id, cast: null }, ctx.resolutionFacts);
  for (const target of endTargets(holder, ctx, layer.m8Grant.endTargeting, damageContext?.area)) for (const [index, effect] of ended.effects.entries()) executeMechanismEffect(ctx, holder,
    { ...state.source, effectIndex: state.source.effectIndex + index + 1 }, target, effect, seq, index, undefined, undefined, undefined, state.absorbed, damageContext);
}
export function settleShieldEnds(ctx: AbilityContext, nextSeq: () => number): void {
  for (const unit of ctx.units) for (const layer of [...unit.shieldLayers]) if (layer.m8Grant?.endTiming === 'post-damage' && (layer.remaining === 0 || layer.expiresAtTick <= ctx.tick)) executeShieldEnd(ctx, unit, layer.key, nextSeq());
}
export function settleSurvival(ctx: AbilityContext, before: readonly { id: string; hp: number; maxHp: number }[], positive: ReadonlySet<string>): void {
  const frozen = survivalSamples(before, ctx.units, positive, ctx.tick), fired: { holder: S13Unit; entry: ReturnType<typeof consumeSurvivalTriggers>['fired'][number] }[] = [];
  for (const sample of frozen) {
    const unit = ctx.units.find(u => u.id === sample.unitId)!;
    const result = consumeSurvivalTriggers(unit.mechanismDefinitions!.survivalTriggers, unit.mechanismState!.runtimes, sample, unit.mechanismState!.combatId);
    unit.mechanismState = { ...unit.mechanismState!, runtimes: result.runtimes };
    for (const entry of result.fired) fired.push({ holder: unit, entry });
  }
  fired.sort((a, b) => compareText(canonicalSource(a.entry.definition.source), canonicalSource(b.entry.definition.source)));
  for (const { holder, entry: { definition, sample } } of fired) for (const [index, effect] of definition.effects.entries())
    executeMechanismEffect(ctx, holder, { ...definition.source, effectIndex: definition.source.effectIndex + index }, holder, effect, 0, index, sample);
}
export function vampRates(unit: S13Unit, hp: number): VampRate[] {
  return unit.mechanismDefinitions!.vamp.map(def => {
    const sample = { holder: { id: unit.id, hp, maxHp: unit.maxHp } };
    return { source: def.source, bps: resolveStat('omnivamp', 0, [def.modifier], sample), allyBps: conditionHolds(def.allyCondition, sample) ? def.allyBps : 0 };
  });
}
export function commitMechanismHeal(ctx: AbilityContext, entry: AbilityContext['heals'][number]): void {
  const target = ctx.units.find(u => u.id === entry.targetId); if (!target || target.hp <= 0 || !target.alive) return;
  const late = entry.lateAmount ? evaluateAmount(entry.lateAmount, { holder: hpSample(target), target: hpSample(target), attackDamage: ad(target), abilityPower: ap(target, ctx.tick) }) : entry.amount;
  const request = entry.request ?? makeHealRequest(JSON.stringify([ctx.combatId ?? 'standalone', ctx.tick, canonicalSource(asSource(entry.source)), entry.targetId, 'direct', ctx.heals.indexOf(entry)]), entry.targetId, 'direct', null,
    [{ source: asSource(entry.source), numerator: late, denominator: 1 }]);
  const outcome = resolveHeal(request, target, statusMagnitude(target.mechanismState!.statuses, 'wound', ctx.tick)); target.hp += outcome.actual;
  if (ctx.resolutionFacts) ctx.resolutionFacts = { ...ctx.resolutionFacts, healing: [...ctx.resolutionFacts.healing, outcome] };
  if (entry.periodic && (outcome.actual < outcome.afterWound || target.hp === target.maxHp)) clearPeriodicAccount(ctx, entry.periodic, target.id);
  ctx.events.push({ type: 'heal', tick: ctx.tick, unitId: target.id, source: outcome.shares[0]?.source ?? entry.source, requested: outcome.requested, actual: outcome.actual, overheal: outcome.overheal, hp: target.hp, outcome });
}
export function cleanupMechanisms(ctx: AbilityContext, combatEnd = false): void {
  const dead = new Set(ctx.units.filter(u => u.hp <= 0 || !u.alive).map(u => u.id));
  for (const unit of ctx.units) {
    const reason = combatEnd ? 'combat-end' as const : 'death-cleanup' as const;
    if (combatEnd || dead.has(unit.id)) {
      for (const activity of unit.mechanismState!.activities.filter(a => a.lifecycle === 'active')) {
        const status = unit.statuses.find(s => s.activity?.key === activity.key)!;
        ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: unit.id, status, reason, activity: { ...activity, lifecycle: 'ended', endedAtTick: ctx.tick, endReason: reason } });
      }
      const removed = removeStatusContributions(unit.mechanismState!.statuses, () => true, reason, ctx.tick);
      for (const e of removed.ended) ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: unit.id, reason,
        status: { key: e.contribution.key, source: e.contribution.source, kind: 'stun', amount: 0, startsAtTick: e.contribution.appliedAtTick, expiresAtTick: ctx.tick } });
      for (const layer of unit.shieldLayers) {
        const state = frozenShield(layer, unit), next = endShield(state, reason, layer.m8Grant ?? { kind: 'grant-shield', amount: flatAmount(layer.granted), durationTicks: 1, decay: { kind: 'none' }, onEnd: [], endTiming: 'post-damage', endTargeting: { kind: 'fixed', targetIds: [], ifMissing: 'skip' }, endEffects: [] }, false);
        if (next.emitEnd) ctx.events.push({ type: 'shieldLayerChanged', tick: ctx.tick, unitId: unit.id, layer: shieldProjection(next.layer, layer.key, layer.m8Grant, reason), reason: 'expired', endReason: reason });
      }
      unit.mechanismState = { ...unit.mechanismState!, statuses: [], activities: unit.mechanismState!.activities.map(a => a.lifecycle === 'active' ? { ...a, lifecycle: 'ended', endedAtTick: ctx.tick, endReason: reason } : a) };
    }
    unit.tasks = unit.tasks.filter(task => !task.attachedDot || task.targetId === null || !dead.has(task.targetId));
    unit.mechanismState = { ...unit.mechanismState!, periodicTasks: combatEnd ? [] : cleanPeriodicTasks(unit.mechanismState!.periodicTasks, dead, dead) };
  }
}
export function maintainActivities(ctx: AbilityContext, unit: S13Unit, controlled: boolean): void {
  unit.mechanismState = { ...unit.mechanismState!, activities: unit.mechanismState!.activities.map(activity => {
    if (activity.lifecycle === 'ended') return activity;
    const reason = activity.expiresAtTick <= ctx.tick ? 'expired' as const : activity.kind === 'channel' && controlled ? 'control-cancelled' as const : null;
    if (!reason) return activity;
    const ended = { ...activity, lifecycle: 'ended' as const, endedAtTick: reason === 'expired' ? activity.expiresAtTick : ctx.tick, endReason: reason };
    const status = unit.statuses.find(s => s.activity?.key === activity.key);
    if (status) ctx.events.push({ type: 'statusChanged', tick: ctx.tick, unitId: unit.id, status: { ...status, activity: ended }, reason, activity: ended });
    return ended;
  }) };
  unit.statuses = unit.statuses.filter(s => !s.activity || unit.mechanismState!.activities.some(a => a.key === s.activity!.key && a.lifecycle === 'active'));
}

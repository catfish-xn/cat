import { startingRows } from './m8/targeting';
import { planOpening, commitOpening, advanceOpeningTasks } from './m8/opening';
import { targetUnit } from './m8/s13-targeting';
import { damageTypeForTarget } from './m8/planning';
import { EMPTY_FACTS } from './m8/triggers';
import { emitMechanismSignal, hasMechanismSubscriber } from './m8/s13-triggers';
import { freezeCompanions, registerDeaths, advanceReactions } from './m8/companions';
import { executeDamageControlSequence, executeMechanismEffect } from './m8/s13-mechanisms';
import { completeCast, damageMana, planManaCost, refundCast, resolveMana } from './m8/mana';
import { S13_COMBAT_RULES } from './s13-rules';
import { getNeighbors, hexDistance, type HexCell } from './board';
import { compareIds, eliminationResult, MOVE_INTERVAL_TICKS, type CombatState, type CombatStep, type CombatEvent, type CombatOrigin } from './combat-types';
import { invocationEvent, stampCombatStep } from './combat-effects';
import { collectTriggers } from './effects';
import type { Hook } from './strategy-types';
import { nextRandom } from './rng';
import { copyPlainRecord } from './plain-clone';
import { executeTask, planS13Attack, planS13Cast, type AbilityContext, type S13Packet } from './combat-s13-abilities';
import { active, ad, ap, byDistance, champion, compareText, EMPTY_RUNTIME, enemies, grantShield, hasMechanic, interval,
  mechanic, range, syncShield, variable, origin, hpSample, statusModifiers, frozenShield, shieldProjection, constantModifier, spellCrit, type S13Unit } from './combat-s13-state';
import { allocateDamage, permissionsFor, prepareDamage, resolveDamage, type DamageSample } from './m8/damage';
import { rollCrit } from './m8/crit';
import { resolveStat, safeNumber } from './m8/stats';
import type { Amount, DamageContext, DamageRequest, DamageOutcome, StatModifier } from './m8/contracts';

import { initializeMechanisms, maintainMechanisms, maintainActivities, settleSurvival, settleShieldEnds, vampRates, commitMechanismHeal, cleanupMechanisms, clearPeriodicAccount, refreshMechanismAuras } from './m8/s13-mechanisms';
import { effectiveStatuses, isEffective, statusMagnitude } from './m8/status';
import { recordShieldAbsorption } from './m8/shield';
import { vampRequests } from './m8/heal';
import { evaluateAmount } from './m8/stats';
import { canonicalSource } from './m8/identity';
import { asSource } from './m8/s13-definitions';

const SHARED_UNIT_FIELDS: ReadonlySet<string> = new Set(['mechanismDefinitions', 'mechanismState', 'triggerLedger']);
function key(cell: HexCell): string { return `${cell.col}:${cell.row}`; }
function move(state: CombatState, unit: S13Unit, target: S13Unit, occupied: ReadonlySet<string>): HexCell | undefined {
  const seen = new Set([key(unit.cell)]), queue: { cell: HexCell; first?: HexCell }[] = [{ cell: unit.cell }];
  for (let i = 0; i < queue.length; i++) for (const cell of getNeighbors(state.board, queue[i].cell)) {
    if (seen.has(key(cell)) || occupied.has(key(cell))) continue;
    seen.add(key(cell)); const first = queue[i].first ?? cell;
    if (hexDistance(cell, target.cell) <= range(unit)) return first;
    queue.push({ cell, first });
  }
  return undefined;
}
function defenses(unit: S13Unit, physical: boolean, tick: number, units: readonly S13Unit[]): number {
  const stat = physical ? 'armor' : 'magicResist';
  const modifiers: StatModifier[] = [...statusModifiers(unit, stat, tick), ...active(unit, tick, 'resistanceFlat').filter(s => !s.contributionKeys && (physical || !s.key.includes(':armor:'))).map(s => constantModifier(stat, s.amount))];
  for (const m of unit.mechanics ?? []) if (m.mechanic === 'gargoyle') modifiers.push({ ...constantModifier(stat, 0),
    value: { kind: 'unit-count', perUnit: m.values.resistPerEnemy, population: 'alive-enemies-targeting-holder', sample: 'current', distinctBy: 'unitId' } });
  const shred = Math.max(statusMagnitude(unit.mechanismState?.statuses ?? [], physical ? 'sunder' : 'shred', tick), ...(physical ? active(unit, tick, 'armorReduction').filter(s => !s.contributionKeys).map(s => s.amount) : [0]));
  modifiers.push(constantModifier(stat, -shred, 'bps'));
  return resolveStat(stat, physical ? unit.armor : unit.magicResist, modifiers, { holder: hpSample(unit), startingRows: startingRows(unit.team,unit.startingCell?.row ?? unit.cell.row) ?? undefined,
    enemiesTargetingHolder: units.filter(u => u.alive && u.team !== unit.team && u.targetId === unit.id).map(u => u.id) });
}
/** Authoritative read projection for renderers; it neither consumes RNG nor advances any counter. */
export function readCombatStats(unit: CombatState['units'][number], state: CombatState): {
  attackDamage: number; abilityPower: number; attackIntervalTicks: number; attackRange: number; armor: number; magicResist: number;
} {
  const working = (u: CombatState['units'][number]): S13Unit => ({ ...u, runtime: { ...EMPTY_RUNTIME, ...u.runtime },
    statuses: [...u.statuses ?? []], tasks: [...u.tasks ?? []], shieldLayers: [...u.shieldLayers ?? []] });
  const current = working(unit), units = state.units.map(working);
  return { attackDamage: ad(current), abilityPower: ap(current, state.tick), attackIntervalTicks: interval(current, state.tick),
    attackRange: range(current), armor: defenses(current, true, state.tick, units), magicResist: defenses(current, false, state.tick, units) };
}
function damageRequest(packet: S13Packet, combatId: string, tick: number): DamageRequest {
  const partial: DamageContext = { source: asSource(packet.source), targetId: packet.targetId,
    damageType: packet.damageType, delivery: packet.delivery, actionSeq: packet.actionSeq, rootActionSeq: packet.rootActionSeq ?? packet.actionSeq,
    parentPacketId: packet.inherited?.parentPacketId ?? packet.parentPacketId ?? null, triggeringCastActionSeq: packet.triggeringCastActionSeq,
    packetId: JSON.stringify([combatId, tick, packet.source.ownerId, packet.actionSeq, packet.targetId, packet.ordinal]),
    packetOrdinal: packet.ordinal, equipmentDepth: packet.delivery === 'equipment-proc' || packet.delivery === 'item-burn' ? 1 : 0,
    redirected: false, area: packet.area, critEligibility: packet.critEligibility, permissions: [] };
  const context = { ...partial, permissions: permissionsFor(partial) };
  return { context, input: packet.inherited ? { stage: 'after-mitigation', amount: packet.raw, inherited: packet.inherited } :
    { stage: 'raw', amount: { flat: packet.raw, attackDamageBps: 0, abilityPowerBps: 0, maxHpBps: 0, missingHpBps: 0,
      actualManaSpentBps: 0, actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'holder', sample: 'packet', cap: null } } };
}
function damageSample(packet: S13Packet, target: S13Unit, owner: S13Unit | undefined, tick: number, units: readonly S13Unit[], hp: number): DamageSample {
  const amplifiers: StatModifier[] = owner ? [...statusModifiers(owner, 'damageAmp', tick)] : [];
  if (owner) for (const m of owner.mechanics ?? []) {
    if (m.mechanic === 'damageAmp') amplifiers.push(constantModifier('damageAmp', m.values.bps, 'bps'));
    if (m.mechanic === 'sniper') amplifiers.push(constantModifier('damageAmp', m.values.damageBpsPerHex * hexDistance(owner.cell, target.cell), 'bps'));
    if (m.mechanic === 'glassCannon') amplifiers.push(constantModifier('damageAmp', m.values.damageAmpBps, 'bps'));
  }
  const reduction = (bps: number): StatModifier => ({ ...constantModifier('damageReduction', bps, 'bps'),
    damageFilter: { deliveries: 'all', damageTypes: ['physical', 'magic'], redirected: 'exclude' } });
  const reductions = [...statusModifiers(target, 'damageReduction', tick), ...active(target, tick, 'damageReduction').filter(s => !s.contributionKeys).map(s => reduction(s.amount)), ...(target.mechanismState?.statuses ?? []).filter(g => g.kind === 'damage-reduction').flatMap(g => g.contributions.filter(c => isEffective(c, tick)).map(c => ({ ...constantModifier('damageReduction', c.application.magnitudeBps, 'bps'), damageFilter: c.application.damageFilter! })))];
  for (const m of target.mechanics ?? []) if (m.mechanic === 'watcher') reductions.push(reduction(
    BigInt(target.hp) * 10000n > BigInt(target.maxHp) * BigInt(m.values.thresholdBps) ? m.values.healthyReductionBps : m.values.reductionBps));
  return { holder: hpSample(owner ?? target), target: { ...hpSample(target), hp }, attackDamage: owner ? ad(owner) : 0,
    abilityPower: owner ? ap(owner, tick) : 0, armor: defenses(target, true, tick, units), magicResist: defenses(target, false, tick, units),
    amplifiers, reductions, prevention: effectiveStatuses(target.mechanismState?.statuses ?? [], tick).some(g => g.kind === 'damage-prevention'), ...(packet.delivery === 'item-burn' && champion(target) === 'neutral' ? { burnCap: 100 } : {}), critical: packet.critical ?? false,
    critMultiplierBps: owner ? spellCrit(owner).multiplierBps : S13_COMBAT_RULES.critMultiplierBps,
    shields: [...target.shieldLayers].sort((a, b) => a.expiresAtTick - b.expiresAtTick || compareText(frozenShield(a, target).key, frozenShield(b, target).key)) };
}
/** S13 development resolver; standalone M3/M4 battles keep their original rules. */
export function advanceS13Tick(state: CombatState): CombatStep {
  const tick = state.tick + 1, events: CombatEvent[] = [];
  const units: S13Unit[] = state.units.map(unit => {
    // Legacy mutable fields are detached once. Frozen mechanism declarations and
    // ledgers use copy-on-write updates; sharing them preserves historical inputs.
    // The single plain-data pass is equivalent to the structuredClone path below,
    // which still handles any value that is not plain data.
    const copy = (copyPlainRecord(unit, SHARED_UNIT_FIELDS) ?? { ...structuredClone({ ...unit,
      ...(unit.mechanismDefinitions ? { mechanismDefinitions: undefined } : {}),
      ...(unit.mechanismState ? { mechanismState: undefined } : {}),
      ...(unit.triggerLedger ? { triggerLedger: undefined } : {}) }),
      ...(unit.mechanismDefinitions ? { mechanismDefinitions: unit.mechanismDefinitions } : {}),
      ...(unit.mechanismState ? { mechanismState: unit.mechanismState } : {}),
      ...(unit.triggerLedger ? { triggerLedger: unit.triggerLedger } : {}) }) as unknown as S13Unit;
    return Object.assign(copy, {
      startingCell: unit.startingCell ?? { ...unit.cell },
      runtime: { ...EMPTY_RUNTIME, ...copy.runtime }, statuses: (copy.statuses ?? []) as S13Unit['statuses'],
      shieldLayers: (copy.shieldLayers ?? []) as S13Unit['shieldLayers'], tasks: (copy.tasks ?? []) as S13Unit['tasks'],
      cooldownTicks: unit.alive ? Math.max(0, unit.cooldownTicks - 1) : 0,
      moveCooldownTicks: unit.alive ? Math.max(0, unit.moveCooldownTicks - 1) : 0 });
  }).sort(compareIds);
  let rngState = state.rngState ?? 0, rngDraws = state.rngDraws ?? 0, actionSeq = state.nextActionSeq ?? 0;
  const ctx: AbilityContext = { manaRequests: [], castReceipts: [], resolutionFacts: EMPTY_FACTS, nextTriggerEventSeq: state.nextTriggerEventSeq ?? 0, tick, combatId: state.combatId ?? 'standalone', board: state.board, units, events, packets: [], heals: [], draw: () => {
    const next = nextRandom(rngState); rngState = next.state; rngDraws++; return next.word;
  } };
  initializeMechanisms(ctx);
  if (state.tick === 0) {
    // Initial programs finish at tick 0 before opening occupancy/eligibility freezes.
    ctx.tick = 0;
    for (const unit of units) unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: 0 };
    for (const unit of units) emitMechanismSignal(ctx, { event: 'combat-start', tick: 0, actionSeq: 0, actorId: unit.id, targetId: unit.id, cast: null });
    ctx.tick = tick;
    for (const unit of units) unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: tick };
  }
  let openingState = state.openingState;
  const openingUnits = (atTick = tick) => units.map(u => ({ ...targetUnit(u, atTick), controlled: active(u, atTick, 'stun').length > 0 || effectiveStatuses(u.mechanismState!.statuses, atTick).some(g => g.kind === 'stun') }));
  if (state.openingDefinitions?.length && !openingState) {
    if (state.tick !== 0) throw new RangeError('Missing consumed opening state');
    openingState = planOpening(ctx.combatId!, ctx.board, openingUnits(state.tick), state.openingDefinitions);
  }
  if (openingState && !openingState.committed) {
    const committed = commitOpening(openingState, units); openingState = committed.state;
    for (const u of units) u.cell = committed.units.find(next => next.id === u.id)!.cell;
    events.push(...committed.movements);
  }
  const companionDefinitions = units.flatMap(u => u.companionDefinitions ?? []);
  let companionState = state.companionState ?? (companionDefinitions.length ? freezeCompanions(ctx.combatId!, units.filter(u => u.alive), companionDefinitions) : undefined);
  if (companionState) {
    const reactions = advanceReactions(companionState, tick, units.filter(u => u.alive && u.hp > 0).map(u => u.id), false); companionState = reactions.state;
    for (const reaction of reactions.ready) {
      const holder = units.find(u => u.id === reaction.targetId)!;
      for (const [index, effect] of reaction.effects.entries()) {
        const source = { ...reaction.source, effectIndex: reaction.source.effectIndex + index };
        if (effect.kind === 'heal') ctx.heals.push({ source, targetId: holder.id, amount: 0, lateAmount: effect.amount, reactionKey: reaction.key });
        else executeMechanismEffect(ctx, holder, source, holder, { ...effect, activation: 'immediate', stackPolicy: { kind: 'independent-instances' } }, actionSeq++, index, undefined, undefined, undefined, undefined, { area: false, triggeringCastActionSeq: null, applicationId: reaction.deadUnitId });
      }
    }
  }
  const startHp = new Map(units.map(u => [u.id, u.hp])), manaBefore = new Map(units.map(u => [u.id, u.mana]));
  const spent = new Map<string, number>(), attackMana = new Map<string, number>(), killMana = new Map<string, number>();
  const hookMana = new Map<string, number>();
  const hooks = (unit: S13Unit, hook: Hook, seq: number) => {
    const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], hook, unit.id, unit.targetId);
    unit.effectRuntime = batch.runtime;
    batch.invocations.forEach((invocation, index) => {
      events.push(invocationEvent(invocation, tick));
      const original = invocation.trigger.source;
      const source: CombatOrigin = { ownerId: original.ownerId, sourceKind: original.sourceKind, definitionId: original.sourceDefinitionId,
        instanceId: original.sourceInstanceId, effectIndex: original.effectIndex, ...(original.parentItemInstanceId ? { parentItemInstanceId: original.parentItemInstanceId } : {}) };
      const target = units.find(u => u.id === invocation.targetId);
      if (invocation.action.kind === 'gainMana') hookMana.set(unit.id, (hookMana.get(unit.id) ?? 0) + invocation.action.amount);
      else if (target && invocation.action.kind === 'grantShield') grantShield(target, source, invocation.action.amount, tick + invocation.action.durationTicks, tick, events);
      else if (target && invocation.action.kind === 'dealDamage') ctx.packets.push({ source, targetId: target.id, raw: invocation.action.amount,
        damageType: invocation.action.damageType, actionSeq: seq, ordinal: 100000 + index,
        delivery: source.sourceKind === 'item' ? 'equipment-proc' : 'attack-extra', critEligibility: 'never', area: false,
        triggeringCastActionSeq: invocation.trigger.hook === 'onCast' ? seq : null });
    });
  };
  maintainMechanisms(ctx, () => actionSeq++);
  const blocked = new Set<string>();
  for (const unit of units) {
    for (const status of unit.statuses.filter(s => !s.contributionKeys && !s.activity && s.expiresAtTick <= tick)) events.push({ type: 'statusChanged', tick, unitId: unit.id, status, reason: 'expired' });
    unit.statuses = unit.statuses.filter(s => s.activity || s.expiresAtTick > tick);
    const controlled = active(unit, tick, 'stun').length > 0 || effectiveStatuses(unit.mechanismState!.statuses, tick).some(g => g.kind === 'stun');
    maintainActivities(ctx, unit, controlled);
    if (controlled) { blocked.add(unit.id); unit.tasks = unit.tasks.filter(t => !t.cancellable); }
  }
  const occupied = new Set(units.filter(u => u.alive).map(u => key(u.cell))), reserved = new Set<string>();
  const intents = units.map(unit => {
    if (!unit.alive || blocked.has(unit.id) || active(unit, tick, 'channel').length > 0) return undefined;
    const target = byDistance(unit, enemies(unit, units))[0];
    if (!target || unit.moveCooldownTicks > 0 || hexDistance(unit.cell, target.cell) <= range(unit)) return undefined;
    return move(state, unit, target, occupied);
  });
  units.forEach((unit, n) => {
    const destination = intents[n]; if (!destination || reserved.has(key(destination))) return;
    reserved.add(key(destination)); events.push({ type: 'movement', tick, unitId: unit.id, from: unit.cell, to: destination });
    unit.cell = destination; unit.moveCooldownTicks = MOVE_INTERVAL_TICKS;
  });
  refreshMechanismAuras(ctx);
  if (openingState) {
    const advanced = advanceOpeningTasks(openingState, tick, openingUnits()); openingState = advanced.state;
    for (const task of advanced.ready) {
      const holder = units.find(u => u.id === task.source.ownerId)!, seq = actionSeq++;
      for (const id of task.targetIds) {
        const target = units.find(u => u.id === id && u.alive && u.hp > 0); if (!target) continue;
        executeDamageControlSequence(ctx, holder, task.source, target, task.effects, seq);
      }
    }
  }
  // Every action reads pre-damage HP/life. New control has startsAtTick=tick+1.
  for (const unit of units) {
    const firstPacket = ctx.packets.length;
    const target = byDistance(unit, enemies(unit, units))[0];
    if (unit.alive && unit.targetId !== (target?.id ?? null)) events.push({ type: 'targetChanged', tick, unitId: unit.id, before: unit.targetId, after: target?.id ?? null });
    const previousTarget = unit.targetId;
    unit.targetId = unit.alive ? target?.id ?? null : null;
    if (unit.alive && previousTarget !== unit.targetId) emitMechanismSignal(ctx, { event: 'target-changed', tick, actionSeq, actorId: unit.id, targetId: unit.targetId, cast: null });
    const due = unit.tasks.filter(t => t.executeAtTick <= tick || (t.shieldEndKey !== undefined && unit.shieldLayers.find(s => s.key === t.shieldEndKey)?.remaining === 0));
    unit.tasks = unit.tasks.filter(t => !due.includes(t));
    for (const task of due) if ((!task.cancellable || (unit.alive && !blocked.has(unit.id))) && (unit.alive || task.attachedDot || task.kind === 'tristanaBounce')) executeTask(ctx, unit, task);
    const rollPlannedPackets = () => {
      const authorization = spellCrit(unit);
      const planned = ctx.packets.slice(firstPacket).sort((a, b) => a.actionSeq - b.actionSeq || compareText(a.targetId, b.targetId) || a.ordinal - b.ordinal);
      for (const packet of planned) packet.critical = packet.inherited ? packet.inherited.critical : rollCrit(packet.critEligibility, packet.source.ownerId === unit.id ? authorization : spellCrit(units.find(u => u.id === packet.source.ownerId)!), ctx.draw);
    };
    if (!unit.alive || !target || blocked.has(unit.id) || active(unit, tick, 'channel').length > 0) { rollPlannedPackets(); continue; }
    const inRange = hexDistance(unit.cell, target.cell) <= range(unit);
    const selfCast = ['irelia', 'leona', 'vander', 'kogmaw', 'lux', 'loris', 'scar', 'caitlyn', 'maddie'].includes(champion(unit));
    const pendingVanderStrike = champion(unit) === 'vander' && unit.runtime.nextAttackPhysical > 0;
    if (champion(unit) !== 'neutral' && unit.maxMana > 0 && !pendingVanderStrike && unit.mana >= unit.maxMana && (inRange || selfCast)) {
      const seq = actionSeq++, beforeCount = events.length;
      const cost = planManaCost({ unitId: unit.id, current: unit.mana, maximum: unit.maxMana, lockedUntilTick: unit.manaLockedUntilTick ?? 0 }, unit.mana)!;
      spent.set(unit.id, cost.actualManaSpent); unit.mana = cost.after.current; unit.runtime.castCount++;
      const oldInterval = interval(unit, tick);
      const targets = planS13Cast(ctx, unit, target, seq);
      const receipt = completeCast({ source: asSource(origin(unit)), actionSeq: seq, completed: true, targetIds: targets, targetsSampledAtTick: tick, actualManaSpent: 0, refundedMana: 0, completionCell: unit.cell }, cost.actualManaSpent);
      (ctx.castReceipts ??= []).push(receipt);
      events.splice(beforeCount, 0, { type: 'cast', tick, sourceId: unit.id, abilityId: unit.ability.id, targetIds: targets, manaSpent: spent.get(unit.id)! });
      unit.cooldownTicks = oldInterval;
      const immediate = unit.tasks.filter(t => t.executeAtTick <= tick);
      unit.tasks = unit.tasks.filter(t => t.executeAtTick > tick);
      for (const task of immediate) executeTask(ctx, unit, task);
      hooks(unit, 'onCast', seq);
      emitMechanismSignal(ctx, { event: 'cast-completed', tick, actionSeq: seq, actorId: unit.id, targetId: target.id, cast: receipt });
    } else if (inRange && unit.cooldownTicks === 0) {
      const seq = actionSeq++, neutral = champion(unit) === 'neutral';
      unit.runtime.attackCount++; events.push({ type: 'attack', tick, attackerId: unit.id, targetId: target.id });
      const oldInterval = interval(unit, tick); planS13Attack(ctx, unit, target, seq); unit.cooldownTicks = oldInterval;
      hooks(unit, 'onAttack', seq);
      emitMechanismSignal(ctx, { event: 'attack-completed', tick, actionSeq: seq, actorId: unit.id, targetId: target.id, cast: null });
      if (!neutral) attackMana.set(unit.id, S13_COMBAT_RULES.attackMana + mechanic(unit, 'extraAttackMana', 'amount'));
    }
    rollPlannedPackets();
  }
  const beforeDamage = units.map(u => ({ id: u.id, hp: u.hp, maxHp: u.maxHp }));
  const positiveDamage = new Set<string>();
  // Virtual health and layered shields give each packet a deterministic actual contribution and killer.
  const virtualHp = new Map(units.map(u => [u.id, u.hp])), hpLost = new Map<string, number>(), totals = new Map<string, { physical: number; magic: number; true: number; absorbed: number; incoming: number }>();
  const damageByAction = new Map<string, { owner: S13Unit; source: CombatOrigin; seq: number; outcomes: DamageOutcome[]; hpAmount: number; heal?: Amount }>();
  const allOutcomes: DamageOutcome[] = [];
  const trackAssists = hasMechanismSubscriber(units, 'kill-or-assist');
  const damageContributors = { ...state.damageContributors };

  ctx.virtualHp = virtualHp;
  const killed = new Map<string, CombatOrigin>();
  const ricochetActions = new Set<string>(), aggregatedActions = new Set<number>();
  const commitOutcome = (target: S13Unit, result: ReturnType<typeof allocateDamage>, packet: S13Packet, legacyRaw: number) => {
    const outcome = result.outcome, { absorbed, hpDamage: actual, context, critical } = outcome;
    target.shieldLayers = result.shields.map(layer => {
      const old = target.shieldLayers.find(s => s.key === layer.key)!;
      const taken = old.remaining - layer.remaining;
      const next = shieldProjection(recordShieldAbsorption(frozenShield(old, target), layer.remaining), old.key, old.m8Grant, taken > 0 && layer.remaining === 0 ? 'depleted' : old.endedReason);
      if (taken > 0) {
        events.push({ type: 'shieldLayerChanged', tick, unitId: target.id, layer: next, reason: 'absorbed' });
        if (next.remaining === 0) events.push({ type: 'shieldLayerChanged', tick, unitId: target.id, layer: next, reason: 'absorbed', endReason: 'depleted' });
      }
      return next;
    }); syncShield(target);
    virtualHp.set(target.id, result.hpAfter);
    allOutcomes.push(outcome);
    ctx.resolutionFacts = { ...ctx.resolutionFacts!, damage: allOutcomes };
    hpLost.set(target.id, (hpLost.get(target.id) ?? 0) + actual);
    const total = totals.get(target.id) ?? { physical: 0, magic: 0, true: 0, absorbed: 0, incoming: 0 };
    total[packet.damageType] += outcome.mitigated; total.absorbed += absorbed; total.incoming += outcome.mitigated; totals.set(target.id, total);
    if (absorbed + actual > 0) {
      positiveDamage.add(target.id);
      if (trackAssists) damageContributors[target.id] = [...new Set([...(damageContributors[target.id] ?? []), context.source.ownerId])].sort(compareText);
    }
    // Development adapter: replay2 will publish the frozen outcome payload in B9.
    events.push({ type: 'packetDamage', tick, source: packet.source, unitId: target.id, damageType: packet.damageType, raw: legacyRaw,
      mitigated: outcome.mitigated, absorbed, hpDamage: actual, actionSeq: packet.actionSeq, packetOrdinal: packet.ordinal, critical, redirected: context.redirected });
    const owner = units.find(u => u.id === packet.source.ownerId);
    if (owner && absorbed + actual > 0 && context.permissions.includes('omnivamp')) {
      const damageKey = JSON.stringify([owner.id, packet.actionSeq]), old = damageByAction.get(damageKey);
      damageByAction.set(damageKey, { owner, source: packet.source, seq: packet.actionSeq,
        outcomes: [...old?.outcomes ?? [], outcome], hpAmount: (old?.hpAmount ?? 0) + actual, heal: old?.heal ?? packet.onPositiveHpDamageHeal });
    }
    if (outcome.killingPacket) {
      killed.set(target.id, packet.source); events.push({ type: 'kill', tick, unitId: target.id, source: packet.source });
      const ricochetKey = JSON.stringify([packet.source.ownerId, packet.actionSeq]);
      if (owner && !context.redirected && packet.bounce && !ricochetActions.has(ricochetKey) && outcome.overkill > 0) {
        const next = byDistance(target, enemies(owner, units).filter(u => u.id !== target.id && (virtualHp.get(u.id) ?? 0) > 0))[0];
        if (next) {
          ricochetActions.add(ricochetKey);
          owner.tasks.push({ key: `${owner.id}:${packet.actionSeq}:bounce`, kind: 'tristanaBounce', source: packet.source,
            executeAtTick: tick + 1, targetId: next.id, amount: outcome.overkill, ordinal: 0, total: 1, cancellable: false, actionSeq: packet.actionSeq,
            inherited: { parentPacketId: context.packetId, resolvedAtTick: tick, portion: 'overkill', critical } });
          const gain = Math.round(variable(owner, 'ASKillGain', 1.25) * 100); owner.runtime.permanentAdBps += gain;
          events.push({ type: 'growth', tick, unitId: owner.id, amountBps: gain, totalBps: owner.runtime.permanentAdBps });
        }
      }
    }
    const facts = { damage: [outcome], healing: [], shieldDecay: [] };
    const signal = { tick, actionSeq: context.rootActionSeq, actorId: context.source.ownerId, targetId: target.id, cast: null } as const;
    if (context.permissions.includes('incoming-basic-hit') && outcome.hit) emitMechanismSignal(ctx, { ...signal, event: 'incoming-basic-hit' }, facts);
    if (absorbed + actual > 0) {
      emitMechanismSignal(ctx, { ...signal, event: 'damage-dealt' }, facts);
      emitMechanismSignal(ctx, { ...signal, event: 'damage-taken' }, facts);
      if (absorbed > 0 && context.permissions.includes('guardbreaker')) emitMechanismSignal(ctx, { ...signal, event: 'shield-hit' }, facts);
    }
  };
  ctx.packets.sort((a, b) => compareText(a.source.ownerId, b.source.ownerId) || a.actionSeq - b.actionSeq || compareText(a.targetId, b.targetId) || a.ordinal - b.ordinal);
  for (let packetIndex = 0; packetIndex < ctx.packets.length; packetIndex++) {
    let packet = ctx.packets[packetIndex]; const beforeDerived = ctx.packets.length;
    const target = units.find(u => u.id === packet.targetId); if (!target || !target.alive) continue;
    const owner = units.find(u => u.id === packet.source.ownerId);
    if (owner) for (const prefix of packet.beforeDamage ?? []) executeMechanismEffect(ctx, owner, prefix.source, target, prefix.effect, packet.actionSeq, prefix.ordinal);
    const damageType = damageTypeForTarget(packet.damageType, targetUnit(target, tick), ctx.resolutionFacts!);
    if (damageType !== packet.damageType) packet = { ...packet, damageType };
    const request = damageRequest(packet, state.combatId ?? 'standalone', tick);
    const sample = damageSample(packet, target, owner, tick, units, virtualHp.get(target.id)!);
    const prepared = prepareDamage(request, sample);
    if (packet.periodic && (sample.prevention || sample.burnCap !== undefined && prepared.mitigated >= sample.burnCap)) clearPeriodicAccount(ctx, packet.periodic, target.id);
    const protector = units.filter(u => u.alive && u.id !== target.id && u.team === target.team && hexDistance(u.cell, target.cell) <= 1
      && active(u, tick, 'redirect').length > 0).sort(compareIds)[0];
    const transfer = protector ? safeNumber(BigInt(prepared.mitigated) * BigInt(Math.max(...active(protector, tick, 'redirect').map(s => s.amount))) / 10000n) : 0;
    commitOutcome(target, allocateDamage(request.context, { ...prepared, mitigated: prepared.mitigated - transfer }, sample.target!.hp, sample.shields), packet, prepared.rawAfterCritical);
    if (protector && transfer > 0) {
      const partial: DamageContext = { ...request.context, targetId: protector.id, redirected: true, critEligibility: 'never',
        parentPacketId: request.context.packetId, packetId: JSON.stringify([request.context.packetId, 'redirect', protector.id]) };
      const redirected: DamageRequest = { context: { ...partial, permissions: permissionsFor(partial) }, input: { stage: 'after-mitigation', amount: transfer,
        inherited: { parentPacketId: request.context.packetId, resolvedAtTick: tick, portion: 'redirect-share', critical: prepared.critical } } };
      const redirectSample = damageSample(packet, protector, owner, tick, units, virtualHp.get(protector.id)!);
      commitOutcome(protector, resolveDamage(redirected, redirectSample), packet, prepared.rawAfterCritical);
    }
    // The bound target's virtual HP is authoritative here; alive/hp are committed
    // after the batch. Prevention and full shield absorption still allow control.
    // Redirect outcomes do not inherit this continuation or change its target.
    if (owner && target.alive && (virtualHp.get(target.id) ?? 0) > 0) {
      for (const control of packet.afterDamageControl ?? []) executeMechanismEffect(ctx, owner, control.source, target, control.effect, packet.actionSeq, control.ordinal);
    }
    const rootSeq = request.context.rootActionSeq;
    if (!aggregatedActions.has(rootSeq) && !ctx.packets.slice(packetIndex + 1).some(p => (p.rootActionSeq ?? p.actionSeq) === rootSeq)) {
      aggregatedActions.add(rootSeq);
      const owners = [...new Set(allOutcomes.filter(o => o.context.rootActionSeq === rootSeq).map(o => o.context.source.ownerId))].sort(compareText);
      for (const actorId of owners) {
        const damage = allOutcomes.filter(o => o.context.source.ownerId === actorId && o.context.rootActionSeq === rootSeq);
        emitMechanismSignal(ctx, { event: 'damage-dealt', tick, actionSeq: rootSeq, actorId, targetId: damage[0]?.context.targetId ?? null, cast: null }, { ...ctx.resolutionFacts!, damage }, 'action-damage-total');
      }
    }
    if (ctx.packets.length > beforeDerived) {
      const children = ctx.packets.splice(beforeDerived).sort((a,b) => compareText(canonicalSource(asSource(a.source)), canonicalSource(asSource(b.source))) || compareText(a.targetId,b.targetId) || a.ordinal-b.ordinal);
      for (const child of children) child.critical = rollCrit(child.critEligibility, spellCrit(units.find(u => u.id === child.source.ownerId)!), ctx.draw);
      ctx.packets.splice(packetIndex + 1, 0, ...children);
    }
  }
  ctx.virtualHp = undefined;
  for (const unit of units) {
    unit.hp = virtualHp.get(unit.id)!;
    const total = totals.get(unit.id);
    if (total) events.push({ type: 'damage', tick, unitId: unit.id, amount: total.incoming, hp: unit.hp, physicalAmount: total.physical,
      magicAmount: total.magic, absorbed: total.absorbed, hpDamage: hpLost.get(unit.id) ?? 0, shield: unit.shield });
  }
  settleSurvival(ctx, beforeDamage, positiveDamage);
  settleShieldEnds(ctx, () => actionSeq++);
  // Every vamp condition samples the same healing-entry HP, before any queued heal.
  const rates = new Map(units.map(unit => [unit.id, vampRates(unit, unit.hp)]));
  for (const { owner, source, seq, outcomes, hpAmount, heal: positiveHeal } of damageByAction.values()) {
    if (owner.hp <= 0) continue;
    if (hpAmount > 0) for (const definition of positiveHeal ? [{ source, amount: positiveHeal }] : owner.mechanismDefinitions!.positiveDamageHeals ?? []) ctx.heals.push({ source: definition.source, targetId: owner.id,
      amount: evaluateAmount(definition.amount, { holder: hpSample(owner), attackDamage: ad(owner), abilityPower: ap(owner, tick) }) });
    for (const request of vampRequests(JSON.stringify([ctx.combatId, tick, owner.id, seq, 'vamp']), owner, outcomes, rates.get(owner.id)!, units))
      ctx.heals.push({ source: request.contributions[0].source, targetId: request.targetId, amount: request.requested, request });
  }
  ctx.heals.sort((a, b) => compareText(canonicalSource(asSource(a.source)), canonicalSource(asSource(b.source))) || compareText(a.targetId, b.targetId) || compareText(a.request?.healId ?? '', b.request?.healId ?? ''));
  const healIds = new Set<string>();
  for (const entry of ctx.heals) {
    if (entry.request) { if (healIds.has(entry.request.healId)) throw new RangeError('Duplicate planned healing mutation'); healIds.add(entry.request.healId); }
    commitMechanismHeal(ctx, entry);
    if (entry.reactionKey && companionState && units.find(u => u.id === entry.targetId)!.hp <= 0) companionState = { ...companionState, reactions: companionState.reactions.map(r => r.key === entry.reactionKey ? { ...r, status: 'cancelled' as const } : r) };
  }
  if (trackAssists) for (const death of allOutcomes.filter(o => o.killingPacket)) for (const actorId of damageContributors[death.context.targetId] ?? [])
    if (units.some(u => u.id === actorId && u.hp > 0)) emitMechanismSignal(ctx, { event: 'kill-or-assist', tick, actionSeq: death.context.rootActionSeq, actorId, targetId: death.context.targetId, cast: null }, { ...ctx.resolutionFacts!, damage: [death] });
  for (const source of killed.values()) {
    const owner = units.find(u => u.id === source.ownerId);
    if (owner && owner.hp > 0 && hasMechanic(owner, 'killStreak')) killMana.set(owner.id, (killMana.get(owner.id) ?? 0) + mechanic(owner, 'killStreak', 'mana'));
  }
  for (const request of ctx.manaRequests ?? []) {
    const target = units.find(u => u.id === request.targetId); if (!target?.alive || target.hp <= 0) continue;
    const mana = { unitId: target.id, current: target.mana, maximum: target.maxMana, lockedUntilTick: target.manaLockedUntilTick ?? 0 };
    const receipt = ctx.castReceipts?.find(c => c.source.ownerId === target.id && c.actionSeq === request.castActionSeq);
    const result = request.reason === 'cast-refund' ? refundCast(mana, request, receipt!, tick) : { outcome: resolveMana(mana, request, tick) };
    if ('receipt' in result) ctx.castReceipts = ctx.castReceipts!.map(c => c === receipt ? result.receipt : c);
    const outcome = result.outcome; target.mana = outcome.after;
    events.push({ type: 'manaChanged', tick, unitId: target.id, before: outcome.before, spent: 0, attackGain: 0, damageGain: 0, hookGain: outcome.applied, overflow: outcome.overflow, after: outcome.after, outcome });
  }
  for (const unit of units) {
    if (!unit.alive || unit.hp <= 0 || champion(unit) === 'neutral') continue;
    if ((hpLost.get(unit.id) ?? 0) > 0) hooks(unit, 'onHpLoss', actionSeq);
    const attackGain = attackMana.get(unit.id) ?? 0, damageGain = damageMana(hpLost.get(unit.id) ?? 0), hookGain = (killMana.get(unit.id) ?? 0) + (hookMana.get(unit.id) ?? 0);
    let overflow = 0;
    for (const [reason, gain] of [['attack', attackGain], ['damage', damageGain], ['kill', hookGain]] as const) {
      const outcome = resolveMana({ unitId: unit.id, current: unit.mana, maximum: unit.maxMana, lockedUntilTick: unit.manaLockedUntilTick ?? 0 },
        { source: asSource(origin(unit)), targetId: unit.id, amount: gain, reason, bypassLock: 'none', castActionSeq: null }, tick);
      unit.mana = outcome.after; overflow += outcome.overflow;
    }
    if ((spent.get(unit.id) ?? 0) + attackGain + damageGain + hookGain > 0) events.push({ type: 'manaChanged', tick, unitId: unit.id,
      before: manaBefore.get(unit.id)!, spent: spent.get(unit.id) ?? 0, attackGain, damageGain, hookGain, overflow, after: unit.mana });
    for (const effect of unit.mechanics ?? []) if (effect.mechanic === 'bulkyBuddies' && !unit.runtime.buddyTriggered) {
      const buddy = units.find(u => u.id === effect.targetId);
      if (buddy && (startHp.get(buddy.id) ?? 0) > 0 && buddy.hp === 0) {
        unit.runtime.buddyTriggered = true; grantShield(unit, effect.source, Math.floor(unit.maxHp * effect.values.shieldMaxHpBps / 10000), tick + effect.values.durationTicks, tick, events);
      }
    }
  }
  cleanupMechanisms(ctx);
  for (const unit of units) {
    if (unit.alive && unit.hp === 0) {
      unit.alive = false; unit.targetId = null; unit.cooldownTicks = 0; unit.moveCooldownTicks = 0; unit.mana = 0;
      unit.shieldLayers = []; unit.shield = 0; unit.shieldExpiresAtTick = null; unit.statuses = [];
      unit.tasks = unit.tasks.filter(t => !t.cancellable && (t.attachedDot || t.kind === 'tristanaBounce'));
      events.push({ type: 'death', tick, unitId: unit.id });
    }
    // Keep depleted protective layers only until their independent end task has consumed absorption.
    unit.shieldLayers = unit.shieldLayers.filter(layer => layer.remaining > 0 || unit.tasks.some(t => t.shieldEndKey === layer.key));
  }
  if (companionState) {
    const deaths = units.filter(u => (startHp.get(u.id) ?? 0) > 0 && !u.alive && u.unitKind === 'neutral' && u.encounterId && u.monsterFamily).map(u => ({ combatId: ctx.combatId!, tick, deadUnitId: u.id, team: u.team, encounterId: u.encounterId!, monsterFamily: u.monsterFamily!, eventId: JSON.stringify([ctx.combatId, tick, (state.nextEventSeq ?? 0) + events.findIndex(e => e.type === 'death' && e.unitId === u.id)]) }));
    companionState = registerDeaths(companionState, deaths, units.filter(u => u.alive).map(u => u.id));
  }
  const eliminated = eliminationResult(units), result = eliminated ?? (tick >= state.maxTicks ? 'draw' : null);
  if (result) { cleanupMechanisms(ctx, true); for (const unit of units) { unit.statuses = []; unit.shieldLayers = []; syncShield(unit); unit.tasks = []; } }
  if (result && companionState) companionState = advanceReactions(companionState, tick, [], true).state;
  if (result) events.push({ type: 'combatFinished', tick, result, reason: eliminated ? 'elimination' : 'timeout' });
  return stampCombatStep({ ...state, ...(openingState ? { openingState } : {}), ...(trackAssists ? { damageContributors } : {}), nextTriggerEventSeq: ctx.nextTriggerEventSeq, ...(companionState ? { companionState } : {}), units, tick, rngState, rngDraws, nextActionSeq: actionSeq, status: result ? 'finished' : 'running', result }, events);
}

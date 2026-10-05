import { S13_COMBAT_RULES } from './s13-rules';
import { getNeighbors, hexDistance, type HexCell } from './board';
import { compareIds, eliminationResult, MOVE_INTERVAL_TICKS, type CombatState, type CombatStep, type CombatEvent, type CombatOrigin } from './combat-types';
import { invocationEvent, stampCombatStep } from './combat-effects';
import { collectTriggers } from './effects';
import type { Hook } from './strategy-types';
import { nextRandom } from './rng';
import { executeTask, planS13Attack, planS13Cast, type AbilityContext, type S13Heal, type S13Packet } from './combat-s13-abilities';
import { active, ad, amount, ap, byDistance, champion, compareOrigins, compareText, EMPTY_RUNTIME, enemies, grantShield, hasMechanic, interval,
  lowestAlly, mechanic, origin, sourceKey, syncShield, variable, type S13Unit } from './combat-s13-state';

function key(cell: HexCell): string { return `${cell.col}:${cell.row}`; }
function move(state: CombatState, unit: S13Unit, target: S13Unit, occupied: ReadonlySet<string>): HexCell | undefined {
  const seen = new Set([key(unit.cell)]), queue: { cell: HexCell; first?: HexCell }[] = [{ cell: unit.cell }];
  for (let i = 0; i < queue.length; i++) for (const cell of getNeighbors(state.board, queue[i].cell)) {
    if (seen.has(key(cell)) || occupied.has(key(cell))) continue;
    seen.add(key(cell)); const first = queue[i].first ?? cell;
    if (hexDistance(cell, target.cell) <= unit.attackRange + unit.runtime.rangeBonus) return first;
    queue.push({ cell, first });
  }
  return undefined;
}
function defenses(unit: S13Unit, physical: boolean, tick: number, units: readonly S13Unit[]): number {
  const flat = active(unit, tick, 'resistanceFlat').filter(s => physical || !s.key.includes(':armor:')).reduce((sum, s) => sum + s.amount, 0);
  const gargoyle = mechanic(unit, 'gargoyle', 'resistPerEnemy') * units.filter(u => u.alive && u.team !== unit.team && u.targetId === unit.id).length;
  const shred = physical ? Math.max(0, ...active(unit, tick, 'armorReduction').map(s => s.amount)) : 0;
  return Math.max(0, Math.floor(((physical ? unit.armor : unit.magicResist) + flat + gargoyle) * (10000 - shred) / 10000));
}
/** Authoritative read projection for renderers; it neither consumes RNG nor advances any counter. */
export function readCombatStats(unit: CombatState['units'][number], state: CombatState): {
  attackDamage: number; abilityPower: number; attackIntervalTicks: number; attackRange: number; armor: number; magicResist: number;
} {
  const working = (u: CombatState['units'][number]): S13Unit => ({ ...u, runtime: { ...EMPTY_RUNTIME, ...u.runtime },
    statuses: [...u.statuses ?? []], tasks: [...u.tasks ?? []], shieldLayers: [...u.shieldLayers ?? []] });
  const current = working(unit), units = state.units.map(working);
  return { attackDamage: ad(current), abilityPower: ap(current, state.tick), attackIntervalTicks: interval(current, state.tick),
    attackRange: unit.attackRange + current.runtime.rangeBonus, armor: defenses(current, true, state.tick, units), magicResist: defenses(current, false, state.tick, units) };
}
function mitigated(packet: S13Packet, target: S13Unit, owner: S13Unit | undefined, tick: number, units: readonly S13Unit[]): number {
  if (packet.raw === 0) return 0;
  if (packet.direct) return packet.raw;
  const resistance = defenses(target, packet.damageType === 'physical', tick, units);
  const first = Math.floor(packet.raw * 100 / (100 + resistance));
  let amp = owner ? mechanic(owner, 'damageAmp', 'bps') : 0;
  if (owner) amp += mechanic(owner, 'sniper', 'damageBpsPerHex') * hexDistance(owner.cell, target.cell) + mechanic(owner, 'glassCannon', 'damageAmpBps');
  const watcher = mechanic(target, 'watcher', target.hp * 10000 > target.maxHp * mechanic(target, 'watcher', 'thresholdBps') ? 'healthyReductionBps' : 'reductionBps');
  const reduction = Math.max(watcher, 0, ...active(target, tick, 'damageReduction').map(s => s.amount));
  return Math.max(1, Math.floor(first * (10000 + amp) * Math.max(0, 10000 - reduction) / 100000000));
}
function heal(ctx: AbilityContext, entry: S13Heal): void {
  const unit = ctx.units.find(u => u.id === entry.targetId);
  if (!unit || unit.hp <= 0) return;
  const requested = Math.max(0, Math.floor(entry.amount)), actual = Math.min(requested, unit.maxHp - unit.hp);
  unit.hp += actual;
  ctx.events.push({ type: 'heal', tick: ctx.tick, unitId: unit.id, source: entry.source, requested, actual, overheal: requested - actual, hp: unit.hp });
}
/** M5 is a separate versioned resolver; unchanged standalone M3/M4 battles keep their original rules. */
export function advanceS13Tick(state: CombatState): CombatStep {
  const tick = state.tick + 1, events: CombatEvent[] = [];
  const units: S13Unit[] = state.units.map(unit => ({ ...structuredClone(unit), runtime: { ...EMPTY_RUNTIME, ...unit.runtime },
    statuses: structuredClone(unit.statuses ?? []) as S13Unit['statuses'], shieldLayers: structuredClone(unit.shieldLayers ?? []) as S13Unit['shieldLayers'],
    tasks: structuredClone(unit.tasks ?? []) as S13Unit['tasks'], cooldownTicks: unit.alive ? Math.max(0, unit.cooldownTicks - 1) : 0,
    moveCooldownTicks: unit.alive ? Math.max(0, unit.moveCooldownTicks - 1) : 0 })).sort(compareIds);
  let rngState = state.rngState ?? 0, rngDraws = state.rngDraws ?? 0, actionSeq = state.nextActionSeq ?? 0;
  const ctx: AbilityContext = { tick, board: state.board, units, events, packets: [], heals: [], draw: () => {
    const next = nextRandom(rngState); rngState = next.state; rngDraws++; return next.word;
  } };
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
        instanceId: original.sourceInstanceId, effectIndex: original.effectIndex };
      const target = units.find(u => u.id === invocation.targetId);
      if (invocation.action.kind === 'gainMana') hookMana.set(unit.id, (hookMana.get(unit.id) ?? 0) + invocation.action.amount);
      else if (target && invocation.action.kind === 'grantShield') grantShield(target, source, invocation.action.amount, tick + invocation.action.durationTicks, tick, events);
      else if (target && invocation.action.kind === 'dealDamage') ctx.packets.push({ source, targetId: target.id, raw: invocation.action.amount,
        damageType: invocation.action.damageType, actionSeq: seq, ordinal: 100000 + index });
    });
  };
  const blocked = new Set<string>();
  for (const unit of units) {
    for (const status of unit.statuses.filter(s => s.expiresAtTick <= tick)) events.push({ type: 'statusChanged', tick, unitId: unit.id, status, reason: 'expired' });
    unit.statuses = unit.statuses.filter(s => s.expiresAtTick > tick);
    if (active(unit, tick, 'stun').length > 0) {
      blocked.add(unit.id); unit.tasks = unit.tasks.filter(t => !t.cancellable);
      unit.statuses = unit.statuses.filter(s => s.kind !== 'channel');
    }
    unit.shieldLayers = unit.shieldLayers.map(layer => {
      let remaining = layer.remaining;
      if (layer.expiresAtTick <= tick) remaining = 0;
      else if (layer.decayDurationTicks && layer.grantedAtTick !== undefined) {
        const elapsed = tick - layer.grantedAtTick;
        const loss = Math.floor(layer.granted * elapsed / layer.decayDurationTicks) - Math.floor(layer.granted * (elapsed - 1) / layer.decayDurationTicks);
        remaining = Math.max(0, remaining - loss);
      }
      else if (layer.decayPerTick) remaining = Math.max(0, remaining - layer.decayPerTick);
      if (remaining !== layer.remaining) events.push({ type: 'shieldLayerChanged', tick, unitId: unit.id,
        layer: { ...layer, remaining }, reason: layer.expiresAtTick <= tick ? 'expired' : 'decayed' });
      return { ...layer, remaining };
    });
    syncShield(unit);
    if (!unit.alive) continue;
    for (const m of [...unit.mechanics ?? []].sort((a, b) => compareOrigins(a.source, b.source))) {
      if (m.mechanic === 'archangel' && tick % m.values.periodTicks === 0) {
        const before = (unit.abilityPower ?? 100) + unit.runtime.abilityPowerFlat; unit.runtime.abilityPowerFlat += m.values.abilityPower;
        events.push({ type: 'statChanged', tick, unitId: unit.id, source: m.source, stat: 'abilityPower', before,
          after: (unit.abilityPower ?? 100) + unit.runtime.abilityPowerFlat });
      }
      if (m.mechanic === 'dragonClaw' && tick % m.values.periodTicks === 0) ctx.heals.push({ source: m.source, targetId: unit.id,
        amount: Math.floor(unit.maxHp * m.values.healMaxHpBps / 10000) });
    }
  }
  const occupied = new Set(units.filter(u => u.alive).map(u => key(u.cell))), reserved = new Set<string>();
  const intents = units.map(unit => {
    if (!unit.alive || blocked.has(unit.id) || active(unit, tick, 'channel').length > 0) return undefined;
    const target = byDistance(unit, enemies(unit, units))[0];
    if (!target || unit.moveCooldownTicks > 0 || hexDistance(unit.cell, target.cell) <= unit.attackRange + unit.runtime.rangeBonus) return undefined;
    return move(state, unit, target, occupied);
  });
  units.forEach((unit, n) => {
    const destination = intents[n]; if (!destination || reserved.has(key(destination))) return;
    reserved.add(key(destination)); events.push({ type: 'movement', tick, unitId: unit.id, from: unit.cell, to: destination });
    unit.cell = destination; unit.moveCooldownTicks = MOVE_INTERVAL_TICKS;
  });
  // Every action reads pre-damage HP/life. New control has startsAtTick=tick+1.
  for (const unit of units) {
    const target = byDistance(unit, enemies(unit, units))[0];
    if (unit.alive && unit.targetId !== (target?.id ?? null)) events.push({ type: 'targetChanged', tick, unitId: unit.id, before: unit.targetId, after: target?.id ?? null });
    unit.targetId = unit.alive ? target?.id ?? null : null;
    const due = unit.tasks.filter(t => t.executeAtTick <= tick || (t.kind === 'ireliaEnd' && unit.shieldLayers.find(s => s.key === sourceKey(t.source))?.remaining === 0));
    unit.tasks = unit.tasks.filter(t => !due.includes(t));
    for (const task of due) if ((!task.cancellable || (unit.alive && !blocked.has(unit.id))) && (unit.alive || task.kind === 'bleed' || task.kind === 'tristanaBounce')) executeTask(ctx, unit, task);
    if (!unit.alive || !target || blocked.has(unit.id) || active(unit, tick, 'channel').length > 0) continue;
    const inRange = hexDistance(unit.cell, target.cell) <= unit.attackRange + unit.runtime.rangeBonus;
    const selfCast = ['irelia', 'leona', 'vander', 'kogmaw', 'lux', 'loris', 'scar', 'caitlyn', 'maddie'].includes(champion(unit));
    const pendingVanderStrike = champion(unit) === 'vander' && unit.runtime.nextAttackPhysical > 0;
    if (champion(unit) !== 'neutral' && !pendingVanderStrike && unit.mana >= unit.maxMana && (inRange || selfCast)) {
      const seq = actionSeq++, beforeCount = events.length;
      spent.set(unit.id, unit.mana); unit.mana = 0; unit.runtime.castCount++;
      const oldInterval = interval(unit, tick);
      const targets = planS13Cast(ctx, unit, target, seq);
      events.splice(beforeCount, 0, { type: 'cast', tick, sourceId: unit.id, abilityId: unit.ability.id, targetIds: targets, manaSpent: spent.get(unit.id)! });
      unit.cooldownTicks = oldInterval;
      const immediate = unit.tasks.filter(t => t.executeAtTick <= tick);
      unit.tasks = unit.tasks.filter(t => t.executeAtTick > tick);
      for (const task of immediate) executeTask(ctx, unit, task);
      hooks(unit, 'onCast', seq);
    } else if (inRange && unit.cooldownTicks === 0) {
      const seq = actionSeq++, neutral = champion(unit) === 'neutral', word = ctx.draw(), critical = !neutral && word < 0x100000000 * S13_COMBAT_RULES.attackCritBps / 10000;
      unit.runtime.attackCount++; events.push({ type: 'attack', tick, attackerId: unit.id, targetId: target.id });
      const oldInterval = interval(unit, tick); planS13Attack(ctx, unit, target, seq, critical); unit.cooldownTicks = oldInterval;
      hooks(unit, 'onAttack', seq);
      if (!neutral) attackMana.set(unit.id, S13_COMBAT_RULES.attackMana + mechanic(unit, 'extraAttackMana', 'amount'));
    }
  }
  // Virtual health and layered shields give each packet a deterministic actual contribution and killer.
  const virtualHp = new Map(units.map(u => [u.id, u.hp])), hpLost = new Map<string, number>(), totals = new Map<string, { physical: number; magic: number; absorbed: number; incoming: number }>();
  const damageByAction = new Map<string, { owner: S13Unit; source: CombatOrigin; seq: number; amount: number }>();
  const killed = new Map<string, CombatOrigin>();
  const ricochetActions = new Set<string>();
  const absorb = (target: S13Unit, value: number, packet: S13Packet, redirected: boolean) => {
    let remaining = value, absorbed = 0;
    target.shieldLayers = [...target.shieldLayers].sort((a, b) => a.expiresAtTick - b.expiresAtTick || compareText(a.key, b.key)).map(layer => {
      const taken = Math.min(layer.remaining, remaining); remaining -= taken; absorbed += taken;
      const next = { ...layer, remaining: layer.remaining - taken, absorbed: layer.absorbed + taken };
      if (taken > 0) events.push({ type: 'shieldLayerChanged', tick, unitId: target.id, layer: next, reason: 'absorbed' });
      return next;
    }); syncShield(target);
    const before = virtualHp.get(target.id)!, actual = Math.min(before, remaining); virtualHp.set(target.id, before - actual);
    hpLost.set(target.id, (hpLost.get(target.id) ?? 0) + actual);
    const total = totals.get(target.id) ?? { physical: 0, magic: 0, absorbed: 0, incoming: 0 };
    total[packet.damageType] += value; total.absorbed += absorbed; total.incoming += value; totals.set(target.id, total);
    events.push({ type: 'packetDamage', tick, source: packet.source, unitId: target.id, damageType: packet.damageType, raw: packet.raw, mitigated: value, absorbed,
      hpDamage: actual, actionSeq: packet.actionSeq, packetOrdinal: packet.ordinal, critical: packet.critical ?? false, redirected });
    const owner = units.find(u => u.id === packet.source.ownerId);
    if (owner && actual > 0) {
      const damageKey = `${owner.id}:${packet.actionSeq}`, old = damageByAction.get(damageKey);
      damageByAction.set(damageKey, { owner, source: packet.source, seq: packet.actionSeq, amount: (old?.amount ?? 0) + actual });
    }
    if (before > 0 && before - actual === 0) {
      killed.set(target.id, packet.source); events.push({ type: 'kill', tick, unitId: target.id, source: packet.source });
      const ricochetKey = `${packet.source.ownerId}:${packet.actionSeq}`;
      // Shared damage preserves damage/kill attribution but is not a second primary spell hit.
      if (owner && !redirected && packet.bounce && !ricochetActions.has(ricochetKey) && remaining > actual) {
        const next = byDistance(target, enemies(owner, units).filter(u => u.id !== target.id && (virtualHp.get(u.id) ?? 0) > 0))[0];
        if (next) {
          ricochetActions.add(ricochetKey);
          owner.tasks.push({ key: `${owner.id}:${packet.actionSeq}:bounce`, kind: 'tristanaBounce', source: packet.source,
            executeAtTick: tick + 1, targetId: next.id, amount: remaining - actual, ordinal: 0, total: 1, cancellable: false, actionSeq: packet.actionSeq });
          const gain = Math.round(variable(owner, 'ASKillGain', 1.25) * 100); owner.runtime.permanentAdBps += gain;
          events.push({ type: 'growth', tick, unitId: owner.id, amountBps: gain, totalBps: owner.runtime.permanentAdBps });
        }
      }
    }
  };
  ctx.packets.sort((a, b) => compareText(a.source.ownerId, b.source.ownerId) || a.actionSeq - b.actionSeq || compareText(a.targetId, b.targetId) || a.ordinal - b.ordinal);
  for (const packet of ctx.packets) {
    const target = units.find(u => u.id === packet.targetId); if (!target || !target.alive) continue;
    const owner = units.find(u => u.id === packet.source.ownerId), value = mitigated(packet, target, owner, tick, units);
    const protector = units.filter(u => u.alive && u.id !== target.id && u.team === target.team && hexDistance(u.cell, target.cell) <= 1
      && active(u, tick, 'redirect').length > 0).sort(compareIds)[0];
    const transfer = protector && !packet.direct ? Math.floor(value * Math.max(...active(protector, tick, 'redirect').map(s => s.amount)) / 10000) : 0;
    absorb(target, value - transfer, packet, false); if (protector && transfer > 0) absorb(protector, transfer, packet, true);
  }
  for (const unit of units) {
    unit.hp = virtualHp.get(unit.id)!;
    const total = totals.get(unit.id);
    if (total) events.push({ type: 'damage', tick, unitId: unit.id, amount: total.incoming, hp: unit.hp, physicalAmount: total.physical,
      magicAmount: total.magic, absorbed: total.absorbed, hpDamage: hpLost.get(unit.id) ?? 0, shield: unit.shield });
  }
  for (const { owner, source, amount: actual } of damageByAction.values()) {
    if (owner.hp <= 0) continue;
    if (champion(owner) === 'garen') ctx.heals.push({ source: origin(owner), targetId: owner.id,
      amount: amount(owner, tick, { hp: variable(owner, 'HealPercentHealth') }) });
    for (const effect of [...owner.mechanics ?? []].sort((a, b) => compareOrigins(a.source, b.source))) if (effect.mechanic === 'gunblade') {
      ctx.heals.push({ source: effect.source, targetId: owner.id, amount: Math.floor(actual * (effect.values.selfHealBps ?? 1500) / 10000) });
      const ally = lowestAlly(owner, units.filter(u => u.hp > 0));
      if (ally) ctx.heals.push({ source: effect.source, targetId: ally.id, amount: Math.floor(actual * (effect.values.allyHealBps ?? 2500) / 10000) });
    }
    void source;
  }
  ctx.heals.sort((a, b) => compareOrigins(a.source, b.source) || compareText(a.targetId, b.targetId));
  for (const entry of ctx.heals) heal(ctx, entry);
  for (const source of killed.values()) {
    const owner = units.find(u => u.id === source.ownerId);
    if (owner && owner.hp > 0 && hasMechanic(owner, 'killStreak')) killMana.set(owner.id, (killMana.get(owner.id) ?? 0) + mechanic(owner, 'killStreak', 'mana'));
  }
  for (const unit of units) {
    if (!unit.alive || unit.hp <= 0 || champion(unit) === 'neutral') continue;
    if ((hpLost.get(unit.id) ?? 0) > 0) hooks(unit, 'onHpLoss', actionSeq);
    const attackGain = attackMana.get(unit.id) ?? 0, damageGain = Math.min(S13_COMBAT_RULES.damageManaCap, Math.floor((hpLost.get(unit.id) ?? 0) * S13_COMBAT_RULES.damageManaBps / 10000)), hookGain = (killMana.get(unit.id) ?? 0) + (hookMana.get(unit.id) ?? 0);
    const total = unit.mana + attackGain + damageGain + hookGain, overflow = Math.max(0, total - unit.maxMana);
    unit.mana = Math.min(unit.maxMana, total);
    if ((spent.get(unit.id) ?? 0) + attackGain + damageGain + hookGain > 0) events.push({ type: 'manaChanged', tick, unitId: unit.id,
      before: manaBefore.get(unit.id)!, spent: spent.get(unit.id) ?? 0, attackGain, damageGain, hookGain, overflow, after: unit.mana });
    for (const effect of unit.mechanics ?? []) if (effect.mechanic === 'bulkyBuddies' && !unit.runtime.buddyTriggered) {
      const buddy = units.find(u => u.id === effect.targetId);
      if (buddy && (startHp.get(buddy.id) ?? 0) > 0 && buddy.hp === 0) {
        unit.runtime.buddyTriggered = true; grantShield(unit, effect.source, Math.floor(unit.maxHp * effect.values.shieldMaxHpBps / 10000), tick + effect.values.durationTicks, tick, events);
      }
    }
  }
  for (const unit of units) {
    if (unit.alive && unit.hp === 0) {
      unit.alive = false; unit.targetId = null; unit.cooldownTicks = 0; unit.moveCooldownTicks = 0; unit.mana = 0;
      unit.shieldLayers = []; unit.shield = 0; unit.shieldExpiresAtTick = null; unit.statuses = [];
      unit.tasks = unit.tasks.filter(t => !t.cancellable && (t.kind === 'bleed' || t.kind === 'tristanaBounce'));
      events.push({ type: 'death', tick, unitId: unit.id });
    }
    // Keep depleted protective layers only until their independent end task has consumed absorption.
    unit.shieldLayers = unit.shieldLayers.filter(layer => layer.remaining > 0 || unit.tasks.some(t => t.kind === 'ireliaEnd' && sourceKey(t.source) === layer.key));
  }
  const eliminated = eliminationResult(units), result = eliminated ?? (tick >= state.maxTicks ? 'draw' : null);
  if (result) events.push({ type: 'combatFinished', tick, result, reason: eliminated ? 'elimination' : 'timeout' });
  return stampCombatStep({ ...state, units, tick, rngState, rngDraws, nextActionSeq: actionSeq, status: result ? 'finished' : 'running', result }, events);
}

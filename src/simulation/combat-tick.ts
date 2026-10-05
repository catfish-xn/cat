import { collectTriggers } from './effects';
import { invocationEvent, stampCombatStep } from './combat-effects';
import type { EffectInvocation } from './strategy-types';
import { getNeighbors, hexDistance, type Board, type HexCell } from './board';
import { compareIds, eliminationResult, MOVE_INTERVAL_TICKS, type CombatEvent, type CombatState, type CombatStep, type CombatUnit } from './combat-types';
import { planAbility, type AbilityIntent } from './combat-abilities';
import { aggregateDamagePackets } from './combat-damage';
import type { DamagePacket } from './ability-types';

type WorkingUnit = { -readonly [Key in keyof CombatUnit]: CombatUnit[Key] };
const cellKey = (cell: HexCell): string => `${cell.col},${cell.row}`;

function nearestEnemy(unit: CombatUnit, units: readonly CombatUnit[]): CombatUnit | undefined {
  return units.filter(other => other.alive && other.team !== unit.team).sort((a, b) =>
    hexDistance(unit.cell, a.cell) - hexDistance(unit.cell, b.cell) || compareIds(a, b))[0];
}

/** BFS visits neighbors in board order, retaining the first step of each path. */
function nextStep(board: Board, unit: CombatUnit, target: CombatUnit, occupied: ReadonlySet<string>): HexCell | undefined {
  const visited = new Set([cellKey(unit.cell)]);
  const queue: { cell: HexCell; first: HexCell | undefined }[] = [{ cell: unit.cell, first: undefined }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const cell of getNeighbors(board, current.cell)) {
      const key = cellKey(cell);
      if (visited.has(key) || occupied.has(key)) continue;
      visited.add(key);
      const first = current.first ?? cell;
      if (hexDistance(cell, target.cell) <= unit.attackRange) return first;
      queue.push({ cell, first });
    }
  }
  return undefined;
}

export function advanceCombatTick(state: CombatState): CombatStep {
  const tick = state.tick + 1;
  const events: CombatEvent[] = [];
  const units: WorkingUnit[] = state.units.map(unit => ({ ...structuredClone(unit), cell: { ...unit.cell }, ability: { ...unit.ability },
    cooldownTicks: unit.alive ? Math.max(0, unit.cooldownTicks - 1) : 0,
    moveCooldownTicks: unit.alive ? Math.max(0, unit.moveCooldownTicks - 1) : 0,
  })).sort(compareIds);
  for (const unit of units) {
    if (unit.shieldExpiresAtTick === null || tick < unit.shieldExpiresAtTick) continue;
    if (unit.shield > 0) events.push({ type: 'shieldChanged', tick, unitId: unit.id, reason: 'expired', before: unit.shield, after: 0, expiresAtTick: null });
    unit.shield = 0;
    unit.shieldExpiresAtTick = null;
  }
  const occupied = new Set(units.filter(unit => unit.alive).map(unit => cellKey(unit.cell)));
  // Every intent reads the same position snapshot. Reservations resolve only after planning.
  const intents = units.map(unit => {
    if (!unit.alive) return undefined;
    const target = nearestEnemy(unit, units);
    unit.targetId = target?.id ?? null;
    if (!target || unit.moveCooldownTicks > 0 || hexDistance(unit.cell, target.cell) <= unit.attackRange) return undefined;
    return nextStep(state.board, unit, target, occupied);
  });
  const reserved = new Set<string>();
  units.forEach((unit, index) => {
    const destination = intents[index];
    if (!destination || reserved.has(cellKey(destination))) return;
    reserved.add(cellKey(destination));
    events.push({ type: 'movement', tick, unitId: unit.id, from: { ...unit.cell }, to: { ...destination } });
    unit.cell = destination;
    unit.moveCooldownTicks = MOVE_INTERVAL_TICKS;
  });

  const actions: ({ kind: 'cast'; unit: WorkingUnit; intent: AbilityIntent }
    | { kind: 'attack'; unit: WorkingUnit; target: CombatUnit })[] = [];
  for (const unit of units) {
    if (!unit.alive) continue;
    const target = nearestEnemy(unit, units);
    unit.targetId = target?.id ?? null;
    const ability = planAbility(unit, target, units);
    if (ability) actions.push({ kind: 'cast', unit, intent: ability });
    else if (target && unit.cooldownTicks === 0 && hexDistance(unit.cell, target.cell) <= unit.attackRange) {
      actions.push({ kind: 'attack', unit, target });
    }
  }

  const packets: DamagePacket[] = [];
  const attacks = new Set<string>();
  const spentMana = new Map<string, number>();
  const shields: NonNullable<AbilityIntent['shield']>[] = [];
  const hookMana = new Map<string, number>();
  const invocations: EffectInvocation[] = [];
  for (const action of actions) {
    const unit = action.unit;
    if (action.kind === 'cast') {
      events.push({ type: 'cast', tick, sourceId: unit.id, abilityId: unit.ability.id,
        targetIds: [...action.intent.targetIds], manaSpent: unit.mana });
      spentMana.set(unit.id, unit.mana);
      unit.mana = 0;
      packets.push(...action.intent.packets);
      if (action.intent.shield) shields.push(action.intent.shield);
    } else {
      events.push({ type: 'attack', tick, attackerId: unit.id, targetId: action.target.id });
      attacks.add(unit.id);
      packets.push({ sourceId: unit.id, targetId: action.target.id, damageType: 'physical',
        rawAmount: unit.attackDamage, sourceKind: 'attack', effectIndex: 0 });
    }
    unit.cooldownTicks = unit.attackIntervalTicks;
    if (state.strategy) {
      const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], action.kind === 'cast' ? 'onCast' : 'onAttack', unit.id, unit.targetId);
      unit.effectRuntime = batch.runtime;
      invocations.push(...batch.invocations);
    }
  }

  for (const invocation of invocations) {
    events.push(invocationEvent(invocation, tick));
    const { action, trigger, targetId } = invocation;
    if (action.kind === 'gainMana') hookMana.set(targetId, (hookMana.get(targetId) ?? 0) + action.amount);
    else if (action.kind === 'grantShield') shields.push({ unitId: targetId, amount: action.amount, durationTicks: action.durationTicks });
    else packets.push({ sourceId: trigger.source.ownerId, targetId, rawAmount: action.amount, damageType: action.damageType,
      sourceKind: trigger.source.sourceKind, source: { ...trigger.source }, sourceInstanceId: trigger.source.sourceInstanceId,
      effectIndex: trigger.source.effectIndex, packetOrdinal: packets.length, triggerEligible: false });
  }
  // Every cast and attack is committed before any HP/life changes. Same-tick shields protect both teams.
  for (const unit of units) {
    const grants = shields.filter(grant => grant.unitId === unit.id);
    if (grants.length === 0) continue;
    const before = unit.shield, previousExpiry = unit.shieldExpiresAtTick;
    unit.shield = Math.max(unit.shield, ...grants.map(grant => grant.amount));
    unit.shieldExpiresAtTick = unit.shield > 0
      ? (state.strategy ? Math.max(previousExpiry ?? 0, ...grants.map(grant => tick + grant.durationTicks))
        : tick + grants.at(-1)!.durationTicks) : null;
    if (before !== unit.shield || previousExpiry !== unit.shieldExpiresAtTick) events.push({ type: 'shieldChanged', tick,
      unitId: unit.id, reason: 'granted', before, after: unit.shield, expiresAtTick: unit.shieldExpiresAtTick });
  }
  const incoming = aggregateDamagePackets(packets, units, Boolean(state.strategy));
  const hpLost = new Map<string, number>();
  for (const unit of units) {
    const damage = incoming.get(unit.id);
    if (!damage) continue;
    const absorbed = Math.min(unit.shield, damage.amount);
    const hpDamage = Math.min(unit.hp, damage.amount - absorbed);
    unit.shield -= absorbed;
    if (unit.shield === 0) unit.shieldExpiresAtTick = null;
    unit.hp -= hpDamage;
    hpLost.set(unit.id, hpDamage);
    events.push({ type: 'damage', tick, unitId: unit.id, ...damage, absorbed, hpDamage, hp: unit.hp, shield: unit.shield });
  }
  // HP-loss hooks have only Mana actions; they cannot recurse into damage or alter settled HP.
  if (state.strategy) for (const unit of units) {
    if (!unit.alive || unit.hp === 0 || (hpLost.get(unit.id) ?? 0) === 0) continue;
    const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], 'onHpLoss', unit.id, unit.targetId);
    unit.effectRuntime = batch.runtime;
    for (const invocation of batch.invocations) {
      events.push(invocationEvent(invocation, tick));
      hookMana.set(unit.id, (hookMana.get(unit.id) ?? 0) + invocation.action.amount);
    }
  }
  for (const unit of units) {
    if (!unit.alive || unit.hp === 0) continue;
    const spent = spentMana.get(unit.id) ?? 0;
    const attackGain = attacks.has(unit.id) ? 10 : 0;
    const damageGain = Math.min(20, Math.floor((hpLost.get(unit.id) ?? 0) / 10));
    const hookGain = hookMana.get(unit.id) ?? 0;
    if (spent === 0 && attackGain === 0 && damageGain === 0 && hookGain === 0) continue;
    const before = unit.mana + spent;
    const overflow = Math.max(0, unit.mana + attackGain + damageGain + hookGain - unit.maxMana);
    unit.mana = Math.min(unit.maxMana, unit.mana + attackGain + damageGain + hookGain);
    events.push({ type: 'manaChanged', tick, unitId: unit.id, before, spent, attackGain, damageGain, ...(state.strategy ? { hookGain } : {}), overflow, after: unit.mana });
  }
  for (const unit of units) {
    if (!unit.alive || unit.hp > 0) continue;
    unit.alive = false;
    unit.targetId = null;
    unit.cooldownTicks = 0;
    unit.moveCooldownTicks = 0;
    unit.mana = 0;
    unit.shield = 0;
    unit.shieldExpiresAtTick = null;
    events.push({ type: 'death', tick, unitId: unit.id });
  }
  const eliminated = eliminationResult(units);
  const result = eliminated ?? (tick >= state.maxTicks ? 'draw' : null);
  if (result !== null) events.push({ type: 'combatFinished', tick, result, reason: eliminated === null ? 'timeout' : 'elimination' });
  return stampCombatStep({ ...state, units, tick, status: result === null ? 'running' : 'finished', result }, events);
}

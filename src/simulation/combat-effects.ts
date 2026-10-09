import type { CombatEvent, CombatState, CombatStep, CombatUnit } from './combat-types';
import { compileMechanismDefinitions } from './m8/s13-definitions';
import { EMPTY_MECHANISMS } from './m8/runtime-types';
import { initializeMechanisms, refreshMechanismAuras } from './m8/s13-mechanisms';
import type { EffectInvocation } from './strategy-types';
import { collectTriggers } from './effects';
import { EMPTY_RUNTIME, grantShield, ensureMechanisms, type S13Unit } from './combat-s13-state';
export function stampCombatStep(state: CombatState, events: readonly CombatEvent[]): CombatStep {
  if (!state.strategy) return { state, events };
  const first = state.nextEventSeq ?? 0;
  return { state: { ...state, nextEventSeq: first + events.length },
    events: events.map((event, i) => ({ ...event, domain: 'combat', combatId: state.combatId!, eventSeq: first + i })) };
}
export function invocationEvent(invocation: EffectInvocation, tick: number): CombatEvent {
  return { type: 'effectTriggered', tick, source: { ...invocation.trigger.source }, effectKey: invocation.trigger.key,
    action: { ...invocation.action }, targetId: invocation.targetId };
}
/** Tick-zero actions cannot cause damage; all start hooks share the same pre-combat boundary. */
export function applyCombatStart(state: CombatState): CombatStep {
  if (!state.strategy || state.startEffectsApplied) return { state, events: [] };
  if (state.status === 'finished') return stampCombatStep({ ...state, units: state.units.map(unit => unit.ability.kind !== 's13' ? unit : { ...unit, mechanismDefinitions: compileMechanismDefinitions(unit, state.combatId!), mechanismState: { ...EMPTY_MECHANISMS, initialized: true, combatId: state.combatId!, sampledAtTick: 0 } }), startEffectsApplied: true },
    [{ type: 'combatFinished', tick: 0, result: state.result!, reason: 'elimination' }]);
  const effects: CombatEvent[] = [], shields: CombatEvent[] = [], mana: CombatEvent[] = [];
  const units: CombatUnit[] = state.units.map(unit => {
    const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], 'combatStart', unit.id, null);
    if (unit.ability.kind === 's13') {
      const current: S13Unit = { ...unit, runtime: { ...EMPTY_RUNTIME, ...unit.runtime }, statuses: [...unit.statuses ?? []],
        shieldLayers: [...unit.shieldLayers ?? []], tasks: [...unit.tasks ?? []], effectRuntime: batch.runtime };
      ensureMechanisms(current, 0, state.combatId);
      let gain = 0;
      for (const invocation of batch.invocations) {
        effects.push(invocationEvent(invocation, 0)); const source = invocation.trigger.source;
        if (invocation.action.kind === 'grantShield') grantShield(current, { ownerId: source.ownerId, sourceKind: source.sourceKind,
          definitionId: source.sourceDefinitionId, instanceId: source.sourceInstanceId, effectIndex: source.effectIndex, ...(source.parentItemInstanceId ? { parentItemInstanceId: source.parentItemInstanceId } : {}) },
        invocation.action.amount, invocation.action.durationTicks, 0, shields);
        else if (invocation.action.kind === 'gainMana') gain += invocation.action.amount;
      }
      current.mana = Math.min(current.maxMana, current.mana + gain);
      if (gain > 0) mana.push({ type: 'manaChanged', tick: 0, unitId: current.id, before: unit.mana, spent: 0, attackGain: 0,
        damageGain: 0, hookGain: gain, overflow: Math.max(0, unit.mana + gain - unit.maxMana), after: current.mana });
      return current;
    }
    let shield = unit.shield, expiry = unit.shieldExpiresAtTick, gain = 0;
    for (const invocation of batch.invocations) {
      effects.push(invocationEvent(invocation, 0));
      if (invocation.action.kind === 'grantShield') {
        shield = Math.max(shield, invocation.action.amount);
        expiry = Math.max(expiry ?? 0, invocation.action.durationTicks);
      } else if (invocation.action.kind === 'gainMana') gain += invocation.action.amount;
    }
    if (shield === 0) expiry = null;
    if (shield !== unit.shield || expiry !== unit.shieldExpiresAtTick) shields.push({ type: 'shieldChanged', tick: 0, unitId: unit.id,
      reason: 'granted', before: unit.shield, after: shield, expiresAtTick: expiry });
    const after = Math.min(unit.maxMana, unit.mana + gain);
    if (gain > 0) mana.push({ type: 'manaChanged', tick: 0, unitId: unit.id, before: unit.mana, spent: 0,
      attackGain: 0, damageGain: 0, hookGain: gain, overflow: Math.max(0, unit.mana + gain - unit.maxMana), after });
    return { ...unit, shield, shieldExpiresAtTick: expiry, mana: after, effectRuntime: batch.runtime };
  });
  const mechanismUnits = units.filter(u => u.ability.kind === 's13') as S13Unit[];
  if (mechanismUnits.length) {
    initializeMechanisms({ tick: 1, combatId: state.combatId, board: state.board, units: mechanismUnits, events: shields, packets: [], heals: [], draw: () => { throw new Error('Combat start mechanisms cannot draw RNG'); } });
    for (const unit of mechanismUnits) unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: 0 };
    refreshMechanismAuras({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('Auras cannot draw RNG');}});
  }
  return stampCombatStep({ ...state, units, startEffectsApplied: true }, [...effects, ...shields, ...mana]);
}

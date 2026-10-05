import type { CombatEvent, CombatState, CombatStep, CombatUnit } from './combat-types';
import type { EffectInvocation } from './strategy-types';
import { collectTriggers } from './effects';
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
  if (state.status === 'finished') return stampCombatStep({ ...state, startEffectsApplied: true },
    [{ type: 'combatFinished', tick: 0, result: state.result!, reason: 'elimination' }]);
  const effects: CombatEvent[] = [], shields: CombatEvent[] = [], mana: CombatEvent[] = [];
  const units: CombatUnit[] = state.units.map(unit => {
    const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], 'combatStart', unit.id, null);
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
  return stampCombatStep({ ...state, units, startEffectsApplied: true }, [...effects, ...shields, ...mana]);
}

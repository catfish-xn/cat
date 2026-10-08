import type { Effect, EffectIdentity, EffectRuntime, ShieldEndReason, ShieldState, SurvivalSample, TriggerDefinition } from './contracts';
import { canonicalSource, compareCodePoints, effectIdentity, validateIdentity } from './identity';
import { conditionHolds, integer, safeNumber } from './stats';
export type ShieldGrant = Extract<Effect, { kind: 'grant-shield' }>;
export function grantShieldState(identity: EffectIdentity, value: number, definition: ShieldGrant, tick: number, old?: ShieldState): ShieldState {
  validateIdentity(identity); integer(value); integer(tick); integer(definition.durationTicks, 1);
  if (old && old.key !== identity.key) throw new RangeError('Shield refresh source mismatch');
  const granted = Math.max(value, old?.remaining ?? 0), expiresAtTick = Math.max(tick + definition.durationTicks, old?.expiresAtTick ?? 0);
  return { ...identity, granted, remaining: granted, absorbed: 0, decayed: 0, expiredDiscarded: 0, startsAtTick: tick, expiresAtTick, endRewardConsumed: false,
    decay: definition.decay.kind === 'none' ? { kind: 'none' } : { kind: 'linear-initial-grant', basisGranted: granted, grantedAtTick: tick, durationTicks: expiresAtTick - tick, lastDecayAtTick: tick } };
}
export function maintainShield(layer: ShieldState, tick: number): { layer: ShieldState; decayed: number; reason: 'expired' | 'depleted' | null } {
  integer(tick);
  if (tick < layer.startsAtTick) throw new RangeError('Shield time moved backwards');
  if (layer.endRewardConsumed || layer.remaining === 0) return { layer, decayed: 0, reason: null };
  let next = layer, decayed = 0;
  const d = layer.decay;
  if (d.kind === 'linear-initial-grant') {
    if (tick < d.lastDecayAtTick) throw new RangeError('Shield decay time moved backwards');
    const elapsed = Math.min(d.durationTicks, tick - d.grantedAtTick), previous = Math.min(d.durationTicks, d.lastDecayAtTick - d.grantedAtTick);
    const loss = integer(d.basisGranted) * integer(elapsed) / integer(d.durationTicks, 1) - integer(d.basisGranted) * integer(previous) / integer(d.durationTicks, 1);
    decayed = Math.min(layer.remaining, safeNumber(loss));
    next = { ...layer, remaining: layer.remaining - decayed, decayed: layer.decayed + decayed, decay: { ...d, lastDecayAtTick: Math.min(tick, layer.expiresAtTick) } };
  }
  if (tick >= layer.expiresAtTick) return { layer: { ...next, remaining: 0, expiredDiscarded: next.expiredDiscarded + next.remaining }, decayed, reason: 'expired' };
  return { layer: next, decayed, reason: next.remaining === 0 ? 'depleted' : null };
}
export function absorbShields(layers: readonly ShieldState[], damage: number): { layers: ShieldState[]; remainingDamage: number; absorbed: number; depletedKeys: string[] } {
  integer(damage); let remainingDamage = damage; const depletedKeys: string[] = [];
  const next = [...layers].sort((a, b) => a.expiresAtTick - b.expiresAtTick || compareCodePoints(a.key, b.key)).map(layer => {
    const taken = Math.min(layer.remaining, remainingDamage); remainingDamage -= taken;
    if (taken > 0 && taken === layer.remaining) depletedKeys.push(layer.key);
    return { ...layer, remaining: layer.remaining - taken, absorbed: layer.absorbed + taken };
  });
  return { layers: next, remainingDamage, absorbed: damage - remainingDamage, depletedKeys };
}
/** G02 chooses allocation once; G07 records that allocation in its conservation ledger. */
export function recordShieldAbsorption(layer: ShieldState, remaining: number): ShieldState {
  integer(remaining);
  if (remaining > layer.remaining || layer.endRewardConsumed && remaining !== layer.remaining) throw new RangeError('Invalid shield allocation');
  return { ...layer, remaining, absorbed: layer.absorbed + layer.remaining - remaining };
}
export function endShield(layer: ShieldState, reason: ShieldEndReason, definition: ShieldGrant, survived: boolean): { layer: ShieldState; emitEnd: boolean; effects: readonly Effect[] } {
  if (layer.endRewardConsumed) return { layer, emitEnd: false, effects: [] };
  const remaining = reason === 'replaced' ? layer.remaining : 0;
  return { layer: { ...layer, remaining, expiredDiscarded: layer.expiredDiscarded + layer.remaining - remaining, endRewardConsumed: true }, emitEnd: true,
    effects: survived && definition.onEnd.includes(reason) ? definition.endEffects : [] };
}
export function validateShield(layer: ShieldState, tick: number, combatId?: string): void {
  validateIdentity(layer, combatId);
  for (const n of [layer.granted, layer.remaining, layer.absorbed, layer.decayed, layer.expiredDiscarded, layer.startsAtTick, layer.expiresAtTick]) integer(n);
  if (typeof layer.endRewardConsumed !== 'boolean' || layer.endRewardConsumed && layer.remaining > 0) throw new RangeError('Invalid shield consumption');
  if (integer(layer.remaining) + integer(layer.absorbed) + integer(layer.decayed) + integer(layer.expiredDiscarded) !== integer(layer.granted)
    || layer.startsAtTick > tick || layer.expiresAtTick <= layer.startsAtTick || layer.remaining > 0 && layer.expiresAtTick <= tick) throw new RangeError('Invalid shield conservation/lifetime');
  if (layer.decay.kind !== 'none') {
    const d = layer.decay; integer(d.basisGranted); integer(d.grantedAtTick); integer(d.durationTicks, 1); integer(d.lastDecayAtTick);
    if (d.basisGranted !== layer.granted || d.grantedAtTick !== layer.startsAtTick || d.grantedAtTick + d.durationTicks !== layer.expiresAtTick
      || d.lastDecayAtTick < d.grantedAtTick || d.lastDecayAtTick > tick || d.lastDecayAtTick > layer.expiresAtTick) throw new RangeError('Invalid shield decay phase');
  }
}
export function survivalSamples(before: readonly { id: string; hp: number; maxHp: number }[], after: readonly { id: string; hp: number; maxHp: number }[], positive: ReadonlySet<string>, tick: number): SurvivalSample[] {
  return before.map(u => {
    const next = after.find(a => a.id === u.id); if (!next || u.maxHp !== next.maxHp) throw new RangeError('Threshold sample requires unchanged maxHP');
    return { unitId: u.id, tick, hpBeforeDamage: u.hp, hpAfterDamage: next.hp, maxHpBeforeThresholdEffects: u.maxHp, survivedDamageBatch: next.hp > 0, receivedPositiveDamage: positive.has(u.id) };
  });
}
/** Start/post-damage listeners of the same source share one permanent consumption identity. */
export function survivalConsumptionKeys(definitions: readonly TriggerDefinition[], combatId: string, holderId: string): string[] {
  return [...new Set(definitions.filter(d => d.maxPerCombat === 1).map(d => effectIdentity(combatId, d.source, holderId).key))].sort(compareCodePoints);
}
export function remainingSurvivalKeys(keys: readonly string[], runtimes: readonly EffectRuntime[]): string[] {
  const consumed = new Set(runtimes.filter(r => r.consumed).map(r => r.key));
  return keys.filter(key => !consumed.has(key));
}
export function consumeSurvivalTriggers(definitions: readonly TriggerDefinition[], runtimes: readonly EffectRuntime[], sample: SurvivalSample, combatId: string, initial = false): { runtimes: EffectRuntime[]; fired: { definition: TriggerDefinition; sample: SurvivalSample }[] } {
  const next = [...runtimes], fired: { definition: TriggerDefinition; sample: SurvivalSample }[] = [];
  if (!sample.survivedDamageBatch || !sample.receivedPositiveDamage && !initial) return { runtimes: next, fired };
  for (const definition of [...definitions].sort((a, b) => compareCodePoints(canonicalSource(a.source), canonicalSource(b.source)) || compareCodePoints(a.id, b.id))) {
    if (definition.event !== (initial ? 'combat-start' : 'post-damage-survival') || definition.source.ownerId !== sample.unitId
      || definition.listener.subject !== (initial ? 'actor' : 'target') || definition.listener.relationToHolder !== 'self') continue;
    if (!conditionHolds(definition.condition, { holder: { id: sample.unitId, hp: sample.hpAfterDamage, maxHp: sample.maxHpBeforeThresholdEffects } })) continue;
    if (definition.gate.kind !== 'always') throw new RangeError('Survival gates must be expressed by finite runtime limits');
    const identity = effectIdentity(combatId, definition.source, sample.unitId), index = next.findIndex(r => r.key === identity.key), old = next[index];
    if (old?.consumed || old && sample.tick < old.nextEligibleTick || definition.maxPerCombat !== null && (old?.triggerCount ?? 0) >= definition.maxPerCombat) continue;
    const count = (old?.triggerCount ?? 0) + 1;
    const runtime: EffectRuntime = { ...identity, startsAtTick: old?.startsAtTick ?? sample.tick, expiresAtTick: null,
      stacks: old?.stacks ?? 0, counters: old?.counters ?? {}, consumedRewards: old?.consumedRewards ?? [], stackPolicy: definition.stackPolicy,
      triggerCount: count, nextEligibleTick: sample.tick + definition.internalCooldownTicks, consumed: definition.maxPerCombat !== null && count >= definition.maxPerCombat };
    if (index >= 0) next[index] = runtime; else next.push(runtime);
    fired.push({ definition, sample: { ...sample } });
  }
  return { runtimes: next.sort((a, b) => compareCodePoints(a.key, b.key)), fired };
}

import { validateH11Grant } from '../augment-pool-batch5-h11-validation';
import { angerCombatItem } from '../augment-pool-batch5-r2-combat';
/** G2-4b Unstable Treasure Chest executor and its restore receipt. A grant appends one record to the receiver; the item's
 * program comes from the frozen pool (combat-item-programs.ts) and joins the receiver's compiled mechanisms, so every later
 * tick, save and restore treats it exactly like an item compiled at combat start. Conventions G24-CHEST-01…04. */
import type { AbilityContext } from '../combat-s13-abilities';
import type { CombatItemGrant, CombatUnit } from '../combat-types';
import { constantModifier, hpSample, type S13Unit } from '../combat-s13-state';
import { G24_CHEST_PAYLOADS, G24_CHEST_POOL } from '../content/g2-4-chest-pool';
import { shareGeneratedDeclaration } from '../immutable-json';
import type { Source, SurvivalSample } from './contracts';
import { canonicalSource } from './identity';
import { isG23NonCombatant, isG23Summon } from '../g2-3-summons';
import { compileItemCrit } from './item-program';
import { grantedItemInstanceId, grantedItemSource } from './combat-item-programs';
import { resolveMana } from './mana';
import { compileMechanismDefinitions } from './s13-definitions';
import { commitMechanismHeal, executeMechanismEffect } from './s13-mechanisms';
import { consumeSurvivalTriggers, remainingSurvivalKeys, survivalConsumptionKeys } from './shield';
import { changeMaxHp, integer, resolveStat } from './stats';
import { scaleItemSummonHp } from '../g2-4b-summons';

const maxHpOf = (basis: NonNullable<CombatUnit['maxHpBasis']>, unit: CombatUnit) => scaleItemSummonHp(unit, resolveStat('maxHp', basis.base,
  [constantModifier('maxHp', basis.flat), constantModifier('maxHp', basis.bps + basis.bonusBps, 'bps')], { holder: hpSample(unit) }));

/** One combat random word picks the item (word modulo pool size, repeats allowed); it then works at once (G24-CHEST-03). */
export function grantCombatItem(ctx: AbilityContext, chest: Source, target: S13Unit, seq: number): void {
  const word = ctx.draw(); integer(word);
  if (word > 0xffffffff) throw new RangeError('Invalid combat random word');
  grantCombatItemDefinition(ctx, chest, target, seq, angerCombatItem(target, G24_CHEST_POOL[word % G24_CHEST_POOL.length].definitionId));
}

/** Internal rule transaction; the caller owns item selection and eligibility. */
export function grantCombatItemDefinition(ctx: AbilityContext, chest: Source, target: S13Unit, seq: number, definitionId: string): void {
  const payload = G24_CHEST_PAYLOADS[definitionId], key = canonicalSource(chest);
  if (!payload) throw new RangeError('Invalid combat item payload');
  const ordinal = ctx.units.reduce((n, u) => n + (u.combatItemGrants ?? []).filter(g => canonicalSource(g.chest) === key).length, 0);
  const grant: CombatItemGrant = { chest: { ...chest }, ordinal, definitionId: payload.definitionId, grantedAtTick: ctx.tick };
  target.combatItemGrants = [...target.combatItemGrants ?? [], grant];
  const source = grantedItemSource(target.id, grant), instanceId = grantedItemInstanceId(grant);
  ctx.events.push({ type: 'combatItemGranted', tick: ctx.tick, unitId: target.id, definitionId: payload.definitionId, source: chest });
  if (payload.maxHpFlat || payload.maxHpBps) {
    const basis = target.maxHpBasis ?? { base: target.maxHp, flat: 0, bps: 0, bonusBps: 0 };
    const updated = { ...basis, flat: basis.flat + payload.maxHpFlat, bps: basis.bps + payload.maxHpBps }, max = maxHpOf(updated, target);
    const result = changeMaxHp(target.maxHp, target.hp, max); target.maxHp = max; target.hp = result.afterHp; target.maxHpBasis = updated;
    ctx.events.push({ type: 'maxHpChanged', tick: ctx.tick, unitId: target.id, source, ...result });
  }
  target.spellCrit = compileItemCrit(target);
  const combatId = target.mechanismState!.combatId, definitions = shareGeneratedDeclaration(compileMechanismDefinitions(target, combatId));
  target.mechanismDefinitions = definitions;
  const own = (s: Source) => s.ownerId === target.id && s.instanceId === instanceId;
  const survival = definitions.survivalTriggers.filter(d => own(d.source));
  target.mechanismState = { ...target.mechanismState!, periodicTasks: [...target.mechanismState!.periodicTasks, ...definitions.periodicTasks.filter(t => own(t.source))] };
  if (payload.initialMana > 0) {
    const outcome = resolveMana({ unitId: target.id, current: target.mana, maximum: target.maxMana, lockedUntilTick: target.manaLockedUntilTick ?? 0 },
      { source, targetId: target.id, amount: payload.initialMana, reason: 'item-granted', bypassLock: 'none', castActionSeq: null }, ctx.tick);
    target.mana = outcome.after; ctx.events.push({ type: 'manaChanged', tick: ctx.tick, outcome });
  }
  // Start-of-combat declarations of the new item fire now, against the receiver's post-grant health.
  const sample: SurvivalSample = { unitId: target.id, tick: ctx.tick, hpBeforeDamage: target.hp, hpAfterDamage: target.hp, maxHpBeforeThresholdEffects: target.maxHp, survivedDamageBatch: target.hp > 0, receivedPositiveDamage: false };
  const fired = consumeSurvivalTriggers(survival, target.mechanismState.runtimes, sample, combatId, true);
  const keys = [...new Set([...target.mechanismState.unconsumedSurvivalKeys, ...survivalConsumptionKeys(survival, combatId, target.id)])];
  target.mechanismState = { ...target.mechanismState, runtimes: fired.runtimes, unconsumedSurvivalKeys: remainingSurvivalKeys(keys, fired.runtimes) };
  // The grant runs after this tick's heal and mana passes: settle what its start effects queue here, in order.
  const heals = ctx.heals.length, mana = ctx.manaRequests?.length ?? 0, packets = ctx.packets.length;
  for (const { definition } of fired.fired) for (const [index, effect] of definition.effects.entries())
    executeMechanismEffect(ctx, target, { ...definition.source, effectIndex: definition.source.effectIndex + index }, target, effect, seq, index, sample);
  if (ctx.packets.length !== packets) throw new RangeError('Granted start effects cannot queue damage');
  for (const entry of ctx.heals.splice(heals)) commitMechanismHeal(ctx, entry);
  for (const request of ctx.manaRequests?.splice(mana) ?? []) {
    const outcome = resolveMana({ unitId: target.id, current: target.mana, maximum: target.maxMana, lockedUntilTick: target.manaLockedUntilTick ?? 0 }, request, ctx.tick);
    target.mana = outcome.after; ctx.events.push({ type: 'manaChanged', tick: ctx.tick, outcome });
  }
}

/** Restore: every grant names a fired chest trigger of a dead ally, a pool item and a tick; a chest's grants share one
 * tick, number 0…n−1, go to distinct receivers and never exceed its target count. Runs before any unit is compiled, so a
 * malformed record (or a malformed holder declaration it points at) is always reported as an invalid save. */
export function validateCombatItemGrants(units: readonly CombatUnit[], tick: number, compiledEventTriggers: (unit: CombatUnit) => readonly import('./contracts').TriggerDefinition[]): void {
  try { checkCombatItemGrants(units, tick, compiledEventTriggers); } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid Match save')) throw error;
    throw new Error('Invalid Match save: combat item grants');
  }
}
function checkCombatItemGrants(units: readonly CombatUnit[], tick: number, compiledEventTriggers: (unit: CombatUnit) => readonly import('./contracts').TriggerDefinition[]): void {
  const fail = (message: string): never => { throw new Error(`Invalid Match save: ${message}`); };
  const isInt = (value: unknown, minimum = 0) => Number.isSafeInteger(value) && (value as number) >= minimum;
  const isRecord = (value: unknown, keys: string): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === keys;
  const byChest = new Map<string, { receiver: CombatUnit; grant: CombatItemGrant }[]>();
  for (const receiver of units) {
    const grants: unknown = receiver.combatItemGrants;
    if (grants === undefined) continue;
    if (!Array.isArray(grants)) fail('combat item grants');
    for (const grant of grants as unknown[]) {
      if (!isRecord(grant, 'chest,definitionId,grantedAtTick,ordinal')) return fail('combat item grant shape');
      const chest = grant.chest;
      if (!isRecord(chest, 'definitionId,effectIndex,instanceId,ownerId,parentItemInstanceId,sourceKind') || !['item', 'augment'].includes(chest.sourceKind as string) || chest.parentItemInstanceId !== null
        || typeof chest.ownerId !== 'string' || typeof chest.definitionId !== 'string' || typeof chest.instanceId !== 'string' || !isInt(chest.effectIndex)) return fail('combat item chest source');
      if (!isInt(grant.ordinal) || !isInt(grant.grantedAtTick, chest.sourceKind === 'augment' && chest.definitionId === 'sponging' ? 0 : 1) || (grant.grantedAtTick as number) > tick
        || typeof grant.definitionId !== 'string' || !Object.hasOwn(G24_CHEST_PAYLOADS, grant.definitionId)) fail('combat item grant item/tick');
      const valid = grant as unknown as CombatItemGrant;
      if (valid.chest.sourceKind === 'augment') { validateH11Grant(units, receiver, valid); continue; }
      const holder = units.find(u => u.id === valid.chest.ownerId);
      if (!holder || holder.alive || holder.team !== receiver.team || holder.id === receiver.id) return fail('combat item chest holder');
      const triggers: unknown = compiledEventTriggers(holder), runtimes: unknown = holder.triggerLedger?.runtimes;
      if (!Array.isArray(triggers) || !Array.isArray(runtimes)) return fail('combat item chest declaration');
      const trigger = (triggers as import('./contracts').TriggerDefinition[]).find(d => canonicalSource(d.source) === canonicalSource({ ...valid.chest, effectIndex: d.source.effectIndex })
        && d.effects[valid.chest.effectIndex - d.source.effectIndex]?.kind === 'grant-combat-item');
      if (!trigger || trigger.event !== 'holder-death') return fail('combat item chest declaration');
      if (trigger.selector.excludeSummons && (isG23Summon(receiver) || isG23NonCombatant(receiver))) fail('combat item summon receiver');
      if (!(runtimes as { source: Source; triggerCount: number; startsAtTick: number }[]).some(r => canonicalSource(r.source) === canonicalSource(trigger.source) && r.triggerCount === 1 && r.startsAtTick === valid.grantedAtTick)) fail('combat item chest receipt');
      const list = byChest.get(canonicalSource(valid.chest)) ?? [];
      list.push({ receiver, grant: valid }); byChest.set(canonicalSource(valid.chest), list);
      if (list.length > trigger.selector.maxTargets) fail('combat item grant count');
    }
  }
  for (const list of byChest.values()) {
    const ordinals = list.map(e => e.grant.ordinal).sort((a, b) => a - b);
    if (ordinals.some((n, i) => n !== i) || new Set(list.map(e => e.receiver.id)).size !== list.length || new Set(list.map(e => e.grant.grantedAtTick)).size !== 1) fail('combat item grant set');
  }
}

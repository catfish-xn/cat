
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



import type { CombatState } from './combat';
import { createRestoreCombatReplay } from './restore-combat-replay';
import type { CombatInputBasis } from './combat-input';
import type { StrategySnapshot } from './strategy-types';
import { EMPTY_TRIGGER_LEDGER } from './m8/triggers';

/** Tasks and one-time flags are historical facts, including after source death,
 * cleanse or Forge revival. Reconstruct from the authenticated opening; no
 * candidate kind/amount/flag decides which facts must exist. Never commit the
 * reconstruction's events, RNG draws or effects to the restored match. */
export function validateTaskAndSummonFacts(combat: CombatState, basis: CombatInputBasis, strategy: StrategySnapshot,
  same: (a: unknown, b: unknown) => boolean, replay = createRestoreCombatReplay(basis, strategy, combat.tick)): void {
  // Compare the complete ordinary queue, so adding another kind beside genuine
  // curse pulses (or inventing delayed Maddie damage on another hero) cannot
  // escape a kind-filtered comparison. Reuse sampled-stat evidence when present.
  const expected = replay.atSaveTick();
  if(!same(combat.openingDeaths,expected.openingDeaths))throw new Error('Invalid Match save: opening deaths');
  if (expected.tick !== combat.tick) throw new Error('Invalid Match save: curse task fact tick');
  if (!same(combat.damageContributors ?? {}, expected.damageContributors ?? {}))
    throw new Error('Invalid Match save: damage contributors binding facts');
  if (combat.nextTriggerEventSeq !== expected.nextTriggerEventSeq)
    throw new Error('Invalid Match save: trigger event sequence binding facts');
  // Continuing from a different RNG word or action/event cursor changes every
  // later roll and identity, so the cursor is a replay fact like the ledgers.
  if (combat.rngState !== expected.rngState || combat.rngDraws !== expected.rngDraws
    || combat.nextActionSeq !== expected.nextActionSeq || combat.nextEventSeq !== expected.nextEventSeq)
    throw new Error('Invalid Match save: combat cursor binding facts');
  for (const unit of combat.units) {
    const settledUnit = expected.units.find(u => u.id === unit.id)!;
    if (unit.mana !== settledUnit.mana || unit.manaLockedUntilTick !== settledUnit.manaLockedUntilTick
      || unit.damageManaRemainderCenti !== settledUnit.damageManaRemainderCenti)
      throw new Error('Invalid Match save: mana binding facts');
    // Sion reuses buddyTriggered for its Black Rose release. Current HP/cast
    // totals cannot establish when the threshold was crossed (or later healed).
    if (unit.definitionId === 'g23-sion' && unit.runtime!.buddyTriggered !== settledUnit.buddyTriggered)
      throw new Error('Invalid Match save: Sion binding facts');
    if (unit.definitionId !== 'g23-sion' && unit.runtime?.buddyTriggered !== settledUnit.buddyTriggered)
      throw new Error('Invalid Match save: buddy trigger binding facts');
    // Reave lives on the target, independently of the caster's remaining queue.
    // Compare zero/absent values too, including targets never hit by a curse.
    if ((unit.g22?.reaveBps ?? 0) !== settledUnit.reaveBps
      || (unit.g22?.reaveUntilTick ?? 0) !== settledUnit.reaveUntilTick)
      throw new Error('Invalid Match save: curse reave binding facts');
    // Every Black Rose member contributes its own historical cast count to Sion.
    // Identity comes from the authenticated roster, never a candidate team total.
    if (strategy.traits.some(t=>t.team===unit.team&&t.traitId==='black-rose'&&(t.memberUnitIds?t.memberUnitIds.includes(unit.id):t.memberDefinitionIds.includes(settledUnit.definitionId)))
      && unit.runtime?.castCount !== settledUnit.castCount)
      throw new Error('Invalid Match save: Black Rose cast binding facts');
    // These are history, not merely bounded counters or internally consistent
    // projections. Compare every holder (including those with no triggers) and
    // the complete records so invented keys/receipts cannot hide in a subset.
    if (!same(unit.triggerLedger ?? EMPTY_TRIGGER_LEDGER, settledUnit.triggerLedger ?? EMPTY_TRIGGER_LEDGER))
      throw new Error('Invalid Match save: trigger ledger binding facts');
    if (!same(unit.runtime ?? null, settledUnit.runtime ?? null))
      throw new Error('Invalid Match save: combat runtime binding facts');
    if (!same(unit.shieldLayers ?? [], settledUnit.shieldLayers ?? []) || unit.shield !== settledUnit.shield
      || unit.shieldExpiresAtTick !== settledUnit.shieldExpiresAtTick)
      throw new Error('Invalid Match save: shield binding facts');
    if (!same(unit.g23?.absorbed ?? [], settledUnit.g23?.absorbed ?? []))
      throw new Error('Invalid Match save: G23 absorption binding facts');
    if (!same(unit.g23 ?? null, settledUnit.g23 ?? null) || unit.maxHp !== settledUnit.maxHp || !same(unit.maxHpBasis ?? null, settledUnit.maxHpBasis ?? null))
      throw new Error('Invalid Match save: G23 state/maximum health binding facts');
    if (!same(unit.mechanismState?.periodicTasks ?? [], settledUnit.periodicTasks)
      || !same(unit.mechanismState?.statuses.filter(s => s.kind === 'burn') ?? [], settledUnit.burnStatuses))
      throw new Error('Invalid Match save: periodic/burn binding facts');
    if (!same(unit.mechanismState?.activities ?? [], settledUnit.activities))
      throw new Error('Invalid Match save: activity binding facts');
    if ((unit.g22?.exposureBps ?? 0) !== settledUnit.exposureBps
      || (unit.g22?.exposureFromTick ?? 0) !== settledUnit.exposureFromTick
      || (unit.g22?.exposureUntilTick ?? 0) !== settledUnit.exposureUntilTick)
      throw new Error('Invalid Match save: exposure binding facts');
    const expansionDamage = unit.expansion && { damageDealt: unit.expansion.damageDealt,
      damageTaken: unit.expansion.damageTaken, crystalDamage: unit.expansion.crystalDamage };
    if (!same(expansionDamage ?? null, settledUnit.expansionDamage ?? null))
      throw new Error('Invalid Match save: expansion damage binding facts');
    const tasks = unit.tasks ?? [];
    const settled = settledUnit.tasks ?? [];
    // Full task records bind the queue holder, source, target, action identity,
    // sampled damage, pulse ordinal/count, timing and death-persistence policy.
    if (!same(tasks, settled)) throw new Error(`Invalid Match save: ${settledUnit.curseCaster ? 'curse ' : ''}task binding facts`);
  }
}

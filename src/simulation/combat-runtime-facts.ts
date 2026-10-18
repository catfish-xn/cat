import type { CombatState } from './combat';
import { createRestoreCombatReplay } from './restore-combat-replay';
import type { CombatInputBasis } from './combat-input';
import type { StrategySnapshot } from './strategy-types';
import { UNIT_DEFINITIONS } from './units';

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
  if (expected.tick !== combat.tick) throw new Error('Invalid Match save: curse task fact tick');
  for (const unit of combat.units) {
    const settledUnit = expected.units.find(u => u.id === unit.id)!;
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
    if (UNIT_DEFINITIONS[settledUnit.definitionId]?.traits.includes('black-rose')
      && unit.runtime?.castCount !== settledUnit.castCount)
      throw new Error('Invalid Match save: Black Rose cast binding facts');
    const tasks = unit.tasks ?? [];
    const settled = settledUnit.tasks ?? [];
    // Full task records bind the queue holder, source, target, action identity,
    // sampled damage, pulse ordinal/count, timing and death-persistence policy.
    if (!same(tasks, settled)) throw new Error(`Invalid Match save: ${settledUnit.curseCaster ? 'curse ' : ''}task binding facts`);
  }
}

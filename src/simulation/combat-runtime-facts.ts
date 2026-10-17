import { createCombatWithEvents, stepCombat, type CombatState } from './combat';
import type { CombatInputBasis } from './combat-input';
import type { StrategySnapshot } from './strategy-types';

/** Tasks and one-time flags are historical facts, including after source death,
 * cleanse or Forge revival. Reconstruct from the authenticated opening; no
 * candidate kind/amount/flag decides which facts must exist. Never commit the
 * reconstruction's events, RNG draws or effects to the restored match. */
export function validateTaskAndSummonFacts(combat: CombatState, basis: CombatInputBasis, strategy: StrategySnapshot,
  same: (a: unknown, b: unknown) => boolean, proven?: CombatState): void {
  // Compare the complete ordinary queue, so adding another kind beside genuine
  // curse pulses (or inventing delayed Maddie damage on another hero) cannot
  // escape a kind-filtered comparison. Reuse sampled-stat evidence when present.
  let expected = proven ?? createCombatWithEvents(basis.inputs.preparation, strategy, basis.combatId, basis.battleSeed).state;
  while (expected.tick < combat.tick && expected.status === 'running') expected = stepCombat(expected).state;
  if (expected.tick !== combat.tick) throw new Error('Invalid Match save: curse task fact tick');
  for (const unit of combat.units) {
    const settledUnit = expected.units.find(u => u.id === unit.id)!;
    // Sion reuses buddyTriggered for its Black Rose release. Current HP/cast
    // totals cannot establish when the threshold was crossed (or later healed).
    if (unit.definitionId === 'g23-sion' && unit.runtime!.buddyTriggered !== settledUnit.runtime!.buddyTriggered)
      throw new Error('Invalid Match save: Sion binding facts');
    if (unit.definitionId !== 'g23-sion' && unit.runtime?.buddyTriggered !== settledUnit.runtime?.buddyTriggered)
      throw new Error('Invalid Match save: buddy trigger binding facts');
    const tasks = unit.tasks ?? [];
    const settled = settledUnit.tasks ?? [];
    // Full task records bind the queue holder, source, target, action identity,
    // sampled damage, pulse ordinal/count, timing and death-persistence policy.
    if (!same(tasks, settled)) throw new Error(`Invalid Match save: ${settledUnit.ability.kind === 's13' && settledUnit.ability.championId === 'morgana' ? 'curse ' : ''}task binding facts`);
  }
}

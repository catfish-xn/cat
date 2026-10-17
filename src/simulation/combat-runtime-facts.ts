import { createCombatWithEvents, stepCombat, type CombatState } from './combat';
import type { CombatInputBasis } from './combat-input';
import type { StrategySnapshot } from './strategy-types';

/** Curse pulses persist after source death and may be replaced on recast or
 * removed by target death/cleanse. Candidate clocks and counters cannot prove
 * those facts. Reconstruct from the authenticated opening, without committing
 * any events, RNG draws or effects to the restored match. */
export function validateTaskAndSummonFacts(combat: CombatState, basis: CombatInputBasis, strategy: StrategySnapshot,
  same: (a: unknown, b: unknown) => boolean, proven?: CombatState): void {
  // Use trusted declarations, so deleting every pending pulse cannot bypass
  // verification. Reuse the isolated sampled-stat reconstruction when present.
  if (!strategy.units.some(u => u.ability.kind === 's13' && ['morgana', 'g23-sion'].includes(u.ability.championId))) return;
  let expected = proven ?? createCombatWithEvents(basis.inputs.preparation, strategy, basis.combatId, basis.battleSeed).state;
  while (expected.tick < combat.tick && expected.status === 'running') expected = stepCombat(expected).state;
  if (expected.tick !== combat.tick) throw new Error('Invalid Match save: curse task fact tick');
  for (const unit of combat.units) {
    const settledUnit = expected.units.find(u => u.id === unit.id)!;
    // Sion reuses buddyTriggered for its Black Rose release. Current HP/cast
    // totals cannot establish when the threshold was crossed (or later healed).
    if (unit.definitionId === 'g23-sion' && unit.runtime!.buddyTriggered !== settledUnit.runtime!.buddyTriggered)
      throw new Error('Invalid Match save: Sion binding facts');
    const tasks = unit.tasks?.filter(t => t.kind === 'g22Curse') ?? [];
    const settled = settledUnit.tasks?.filter(t => t.kind === 'g22Curse') ?? [];
    // Full task records bind the queue holder, source, target, action identity,
    // sampled damage, pulse ordinal/count, timing and death-persistence policy.
    if (!same(tasks, settled)) throw new Error('Invalid Match save: curse task binding facts');
  }
}

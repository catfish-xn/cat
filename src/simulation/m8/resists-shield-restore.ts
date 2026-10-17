import { createCombatWithEvents, stepCombat, type CombatState } from '../combat';
import type { CombatInputBasis } from '../combat-input';
import type { StrategySnapshot } from '../strategy-types';
import { canonicalContent } from '../content';

/** Read only compiler output, never a candidate's declarations, to select the replay path. */
function hasResistsShield(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  if (object.kind === 'grant-shield' && (object.amount as { resistsBps?: number } | undefined)?.resistsBps) return true;
  return Object.values(object).some(hasResistsShield);
}
function projection(combat: CombatState) {
  return combat.units.flatMap(unit => (unit.shieldLayers ?? []).filter(layer => layer.m8Grant?.amount.resistsBps)
    .map(layer => ({ targetId: unit.id, layer }))).sort((a, b) => {
      const x = a.targetId + '\0' + a.layer.key, y = b.targetId + '\0' + b.layer.key;
      return x < y ? -1 : x > y ? 1 : 0;
    });
}
/**
 * Live defenses include targeting, expired statuses and death-time effects. Neither
 * the opening stats nor the candidate's current stats authenticate a past sample.
 * Re-execute only battles whose independently compiled strategy declares this
 * amount type, from the validated resource prefix and independently checked seed.
 * No replay state/events are returned or installed into the restored match.
 */
export function validateResistsShields(combat: CombatState, basis: CombatInputBasis, strategy: StrategySnapshot): void {
  if (!hasResistsShield(strategy)) return;
  if (!Number.isSafeInteger(combat.tick) || combat.tick < 0 || combat.tick > 1200)
    throw new Error('Invalid Match save: resists shield replay tick');
  let expected = createCombatWithEvents(basis.inputs.preparation, strategy, basis.combatId, basis.battleSeed).state;
  while (expected.tick < combat.tick && expected.status === 'running') expected = stepCombat(expected).state;
  if (expected.tick !== combat.tick || canonicalContent(projection(expected)) !== canonicalContent(projection(combat)))
    throw new Error('Invalid Match save: resists shield replay');
}

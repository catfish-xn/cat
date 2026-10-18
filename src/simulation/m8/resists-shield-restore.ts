import type { CombatState } from '../combat';
import { createRestoreCombatReplay, type RestoreCombatReplay, type CombatReplayFacts } from '../restore-combat-replay';
import type { CombatInputBasis } from '../combat-input';
import type { StrategySnapshot } from '../strategy-types';
import { canonicalContent } from '../content';
import { declaredEffects } from './item-restore';
import { canonicalSource } from './identity';
import { asSource } from './s13-definitions';

/** Read only compiler output, never a candidate's declarations, to select the replay path. */
function hasResistsShield(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  if (object.kind === 'grant-shield' && (object.amount as { resistsBps?: number } | undefined)?.resistsBps) return true;
  return Object.values(object).some(hasResistsShield);
}
function projection(combat: Pick<CombatState, 'units'> | CombatReplayFacts, sources: ReadonlySet<string>) {
  return combat.units.flatMap(unit => (unit.shieldLayers ?? []).filter(layer => sources.has(canonicalSource(asSource(layer.source))))
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
export function validateResistsShields(combat: CombatState, basis: CombatInputBasis, strategy: StrategySnapshot, replay: RestoreCombatReplay = createRestoreCombatReplay(basis, strategy, combat.tick)): void {
  if (!hasResistsShield(strategy)) return;
  if (!Number.isSafeInteger(combat.tick) || combat.tick < 0 || combat.tick > 1200)
    throw new Error('Invalid Match save: resists shield replay tick');
  const opening = replay.opening();
  const sources = new Set(opening.units.flatMap(unit => declaredEffects(unit, basis.combatId))
    .filter(d => d.effect.kind === 'grant-shield' && d.effect.amount.resistsBps)
    .map(d => canonicalSource(d.source)));
  const expected = replay.atSaveTick();
  if (expected.tick !== combat.tick || canonicalContent(projection(expected, sources)) !== canonicalContent(projection(combat, sources)))
    throw new Error('Invalid Match save: resists shield replay');
}

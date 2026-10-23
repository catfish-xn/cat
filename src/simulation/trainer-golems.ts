import { EMBLEM_ITEMS } from './content/emblems';
import { freezeContent } from './content/freeze';
import { TRAINER_GOLEMS_POLICY } from './content/trainer-golems';
import { OpeningEncounterError, validateOpeningEncounterState, type OpeningEncounterContext } from './opening-encounter';
import type { MatchCommandResult, MatchState } from './match-types';

export { TRAINER_GOLEMS_POLICY } from './content/trainer-golems';
export type TrainerGolemEmblems = readonly [string, string, string];

/** Shape/executable-membership check only. Not a verified pool, draw or reward
 * authentication: even a valid triple cannot be granted while evidence is missing.
 */
export function validateTrainerGolemEmblems(input: unknown): TrainerGolemEmblems {
  if (!Array.isArray(input) || input.length !== TRAINER_GOLEMS_POLICY.emblemsPerGolem)
    throw new OpeningEncounterError('invalid-opening-effect');
  const ids: string[] = [], traits = new Set<string>();
  // Array iteration deliberately checks holes, unlike Array.every.
  for (const id of input) {
    if (typeof id !== 'string' || !Object.hasOwn(EMBLEM_ITEMS, id))
      throw new OpeningEncounterError('invalid-opening-effect');
    const trait = EMBLEM_ITEMS[id].emblemTrait;
    if (!trait || ids.includes(id) || traits.has(trait))
      throw new OpeningEncounterError('invalid-opening-effect');
    ids.push(id); traits.add(trait);
  }
  return freezeContent([ids[0], ids[1], ids[2]] as const);
}

/** Explicit effect admission, intentionally closed. Generic lifecycle calls still
 * use applyOpeningEffects(state, []), which succeeds without granting anything.
 * No caller-supplied definitions, pool or enabled flag can bypass missing evidence.
 */
export function applyTrainerGolemsOpening(state: MatchState, shared?: OpeningEncounterContext): MatchCommandResult {
  try {
    validateOpeningEncounterState(state, shared);
    const opening = state.openingEncounter;
    const selection = opening.mode === 'solo' ? opening.context.selection
      : opening.mode === 'shared' ? opening.selection : null;
    if (selection?.encounterId !== TRAINER_GOLEMS_POLICY.encounterId)
      throw new OpeningEncounterError('invalid-opening-effect');
    // Enabling requires a real executor, permanent item authority and restore
    // recompilation as well as evidence. Flipping metadata alone is insufficient.
    throw new OpeningEncounterError('opening-config-incomplete');
  } catch (error) {
    return { ok: false, state, reason: error instanceof OpeningEncounterError ? error.reason : 'opening-context-mismatch' };
  }
}

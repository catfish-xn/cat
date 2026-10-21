import type { Team } from './board';
import type { GameState } from './game';
import type { ItemInstance, TraitDefinition, TraitSnapshot } from './strategy-types';
import { TRAIT_DEFINITIONS } from './content/traits';
import { deriveEffectiveTraits, projectEffectiveMembership, type TraitProjectionContext } from './traits/effective-membership';

/** Compatibility entry: native and dynamic consumers share one pure projection. */
export function deriveTraits(preparation: GameState, team: Team,
  definitions: Readonly<Record<string,TraitDefinition>> = TRAIT_DEFINITIONS, context?: TraitProjectionContext, items: readonly ItemInstance[] = []): TraitSnapshot[] {
  return deriveEffectiveTraits(projectEffectiveMembership(preparation,context,definitions,items),team,definitions);
}

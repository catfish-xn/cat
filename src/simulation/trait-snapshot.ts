import type { Team } from './board';
import type { GameState } from './game';
import { UNIT_DEFINITIONS } from './units';
import type { TraitDefinition, TraitSnapshot } from './strategy-types';
import { TRAIT_DEFINITIONS } from './content/traits';

const ascii = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Count distinct on-board definitions, then freeze the highest tier's concrete targets.
 * Inactive rows stay in the preview so the UI can show the next threshold.
 */
export function deriveTraits(preparation: GameState, team: Team,
  definitions: Readonly<Record<string, TraitDefinition>> = TRAIT_DEFINITIONS): TraitSnapshot[] {
  const boardUnits = preparation.units.filter(unit => unit.team === team && unit.location.kind === 'board')
    .sort((a, b) => ascii(a.id, b.id));
  for (const unit of boardUnits) {
    if (!Object.hasOwn(UNIT_DEFINITIONS, unit.definitionId)) throw new RangeError(`Unknown unit definition: ${unit.definitionId}`);
    for (const traitId of UNIT_DEFINITIONS[unit.definitionId].traits) {
      if (!Object.hasOwn(definitions, traitId)) throw new RangeError(`Unknown trait: ${traitId}`);
    }
  }
  return Object.keys(definitions).sort(ascii).map(traitId => {
    const definition = definitions[traitId];
    const members = boardUnits.filter(unit => UNIT_DEFINITIONS[unit.definitionId].traits.includes(traitId));
    const memberDefinitionIds = [...new Set(members.map(unit => unit.definitionId))].sort(ascii);
    const count = memberDefinitionIds.length;
    const tier = definition.tiers.reduce((highest, candidate) =>
      candidate.threshold <= count ? Math.max(highest, candidate.threshold) : highest, 0);
    const targets = definition.target === 'team' ? boardUnits : members;
    return { team, traitId, count, tier, memberDefinitionIds, targetUnitIds: tier === 0 ? [] : targets.map(unit => unit.id) };
  });
}

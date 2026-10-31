import type { CombatStrategyInputs } from './combat-input';
import type { TraitDefinition } from './strategy-types';
import { TRAIT_DEFINITIONS } from './content/traits';
import { projectR3Roster, r3Traits } from './augment-pool-batch5-r3';
import { projectHallOfMirrors } from './augment-pool-batch5-r3-mirrors';
import { bindV20Teamups, v20MembershipSources } from './v20-teamups';
import { projectEffectiveMembership, type TraitProjectionContext } from './traits/effective-membership';
import { readRoundEnemyProjection } from './round-enemies';

/** Shared opening roster/membership for combat and preparation summon visibility/occupancy.
 * Projects combat bodies only; never grants assets or consumes resources/RNG. */
export function projectStrategyMembership(state: CombatStrategyInputs,
  definitions: Readonly<Record<string, TraitDefinition>> = TRAIT_DEFINITIONS, context?: TraitProjectionContext) {
  const hall = projectHallOfMirrors(state);
  const r3 = projectR3Roster(hall.state);
  state = r3.state;
  if (context && context.round !== state.round) throw new RangeError('Trait projection round mismatch');
  const sisterAugment = state.augments.find(a => a.definitionId === 'sisters');
  const sisterUnits = state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && ['jinx', 'vi'].includes(u.definitionId));
  const sisterSources = sisterAugment && new Set(sisterUnits.map(u => u.definitionId)).size === 2 ? sisterUnits.map(u => ({
    kind: 'add-trait' as const, sourceId: sisterAugment.choiceId + ':sisters:' + u.id, unitId: u.id, traitId: 'sisters',
    activeFromRound: state.round, expiresBeforeRound: state.round + 1,
  })) : [];
  const teamups = bindV20Teamups(state), teamupSources = v20MembershipSources(state, teamups);
  const traitContext = sisterSources.length || teamupSources.length ? {
    round: state.round, sources: [...(context?.sources ?? []), ...sisterSources, ...teamupSources],
  } : context;
  const projection = projectEffectiveMembership(state.preparation, traitContext, definitions, [...state.items,
    ...(state.preparation.units.some(u => u.team === 'enemy') ? readRoundEnemyProjection(state.round).items : []).map(i => ({
      id: 'enemy:' + i.unitId + ':' + i.slot, definitionId: i.definitionId,
      location: { kind: 'unit' as const, unitId: i.unitId, slot: i.slot },
    })),
  ]);
  return { state: { ...state, preparation: projection.preparation }, hall, r3, teamups, projection,
    traits: [...r3Traits(projection, 'player', definitions, r3.copies, hall.mirrors),
      ...r3Traits(projection, 'enemy', definitions, r3.copies, hall.mirrors)] };
}

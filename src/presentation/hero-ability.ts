import { strongestHeroCopy } from '../simulation/hero-carry';
import { GLOVES_OFF } from '../simulation/content/gloves-off';
import type { MatchState } from '../simulation/match-types';

/** 卯足全力: the id of my strongest board Vander that the rules give the hero spell, or undefined (same pick as heroCarry). */
export function glovesOffUnitId(state: Pick<MatchState, 'augments' | 'items' | 'preparation'> | null | undefined): string | undefined {
  if (!state?.augments.some(augment => augment.definitionId === 'all-out')) return undefined;
  return strongestHeroCopy(state.preparation.units.filter(unit => unit.team === 'player'), state.items, 'vander')?.id;
}
/** Extra max mana of the hero spell, for a panel that only knows base stats. */
export const HERO_ABILITY_MANA_INCREASE = GLOVES_OFF.manaIncrease;

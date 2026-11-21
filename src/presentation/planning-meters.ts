import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import { getUnitStats } from '../simulation/unit-stats';
import { isAnvilUnit } from './anvil-display';
import { fourStarBaseStats } from './d14-display';
import { HERO_ABILITY_MANA_INCREASE } from './hero-ability';

/** A unit's stats outside combat: the inspect panel's numbers and the 3D bar's full HP and starting mana. */
export function planningBase(definitionId: string, starLevel: number) {
  return (starLevel === 4 ? fourStarBaseStats(definitionId) : null) ?? getUnitStats(definitionId, UNIT_DEFINITIONS[definitionId].unitKind === 'neutral' ? 1 : Math.min(3, starLevel) as StarLevel);
}
export function planningMeters(definitionId: string, starLevel: number, heroAbility = false) {
  const base = planningBase(definitionId, starLevel);
  return { hp: base.health, maxHp: base.health, mana: base.initialMana, maxMana: base.maxMana + (heroAbility && starLevel !== 4 ? HERO_ABILITY_MANA_INCREASE : 0), shield: 0 };
}
/** The 3D bar's values outside combat; none for enemies, monsters, Jayce's forge or anvils (they have no star-level bar). */
export function planningMetersFor(unit: { readonly definitionId: string; readonly team: string }, starLevel: number, heroAbility = false) {
  const def = UNIT_DEFINITIONS[unit.definitionId];
  if (!def || unit.team !== 'player' || def.unitKind === 'neutral' || unit.definitionId === 'g23-forge' || isAnvilUnit(unit.definitionId)) return undefined;
  return planningMeters(unit.definitionId, starLevel, heroAbility);
}

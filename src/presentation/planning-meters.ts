import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import { getUnitStats } from '../simulation/unit-stats';
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

import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import { getUnitStats, resolveUnitStats } from '../simulation/unit-stats';
import type { UnitForm } from '../simulation/seat-mechanics/types';
import { abilityUnitDefinition, formDefinitionId } from './ability-text';
import { isAnvilUnit } from './anvil-display';
import { fourStarBaseStats } from './d14-display';
import { HERO_ABILITY_MANA_INCREASE } from './hero-ability';

/**
 * A unit's stats outside combat: the inspect panel's numbers and the 3D bar's full HP and starting mana. A form swapper in
 * its back-row `form` reads that form's content definition, as the rules do for its board row (g2-3-forms.ts g23FormStats).
 */
export function planningBase(definitionId: string, starLevel: number, form: UnitForm | null = null) {
  const star = (UNIT_DEFINITIONS[definitionId].unitKind === 'neutral' ? 1 : Math.min(3, starLevel)) as StarLevel, formId = formDefinitionId(definitionId, form);
  return (starLevel === 4 ? fourStarBaseStats(definitionId) : null)
    ?? (formId === definitionId ? getUnitStats(definitionId, star) : resolveUnitStats(abilityUnitDefinition(formId)!, star));
}
export function planningMeters(definitionId: string, starLevel: number, heroAbility = false, form: UnitForm | null = null) {
  const base = planningBase(definitionId, starLevel, form);
  return { hp: base.health, maxHp: base.health, mana: base.initialMana, maxMana: base.maxMana + (heroAbility && starLevel !== 4 ? HERO_ABILITY_MANA_INCREASE : 0), shield: 0 };
}
/** The 3D bar's values outside combat; none for enemies, monsters, Jayce's forge or anvils (they have no star-level bar). */
export function planningMetersFor(unit: { readonly definitionId: string; readonly team: string }, starLevel: number, heroAbility = false, form: UnitForm | null = null) {
  const def = UNIT_DEFINITIONS[unit.definitionId];
  if (!def || unit.team !== 'player' || def.unitKind === 'neutral' || unit.definitionId === 'g23-forge' || isAnvilUnit(unit.definitionId)) return undefined;
  return planningMeters(unit.definitionId, starLevel, heroAbility, form);
}

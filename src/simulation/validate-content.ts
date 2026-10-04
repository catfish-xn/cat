import { ABILITY_DEFINITIONS, validateAbilityDefinitions } from './combat-abilities';
import { UNIT_DEFINITIONS, validateUnitDefinitions } from './units';
import { SHOP_ODDS, XP_TO_NEXT_LEVEL } from './match-rules';
/** Cross-module data checks are startup validation, never a combat-tick side effect. */
export function validateContent(): void {
  validateUnitDefinitions();
  validateAbilityDefinitions();
  for (const unit of Object.values(UNIT_DEFINITIONS)) {
    if (!Object.hasOwn(ABILITY_DEFINITIONS, unit.abilityId)) throw new Error(`Missing ability: ${unit.abilityId}`);
  }
  for (let level = 1; level <= 9; level++) {
    const odds = SHOP_ODDS[level];
    if (!odds || odds.length !== 5 || odds.some(value => !Number.isInteger(value) || value < 0)
      || odds.reduce((sum, value) => sum + value, 0) !== 100) throw new Error(`Invalid odds: ${level}`);
    if (level < 9 && (!Number.isSafeInteger(XP_TO_NEXT_LEVEL[level]) || XP_TO_NEXT_LEVEL[level] <= 0)) throw new Error(`Invalid XP threshold: ${level}`);
  }
}

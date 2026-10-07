import { validateNeutralInputs } from './m8/unit-inputs';
import { UNIT_DEFINITIONS, type UnitDefinition, type ResolvedUnitStats, type StarLevel, type Unit } from './units';

const STAR_PERCENT = Object.freeze({ 1: 100, 2: 180, 3: 324 });

export function getUnitStats(definitionId: string, starLevel: StarLevel): ResolvedUnitStats {
  const definition = UNIT_DEFINITIONS[definitionId];
  if (!Object.hasOwn(UNIT_DEFINITIONS, definitionId)) throw new RangeError(`Unknown unit definition: ${definitionId}`);
  return resolveUnitStats(definition, starLevel);
}
/** Content input seam for future catalogs; never installs a definition globally. */
export function resolveUnitStats(definition: UnitDefinition, starLevel: StarLevel): ResolvedUnitStats {
  validateNeutralInputs(definition);
  if (!Object.hasOwn(STAR_PERCENT, starLevel)) throw new RangeError(`Invalid star level: ${starLevel}`);
  return {
    ...(definition.unitKind ? { unitKind: definition.unitKind, ...(definition.monsterFamily ? { monsterFamily: definition.monsterFamily } : {}) } : {}),
    ...(definition.baseCritChanceBps === undefined ? {} : { baseCritChanceBps: definition.baseCritChanceBps, baseCritMultiplierBps: definition.baseCritMultiplierBps }),
    health: Math.floor(definition.baseStats.health * STAR_PERCENT[starLevel] / 100),
    attack: Math.floor(definition.baseStats.attack * STAR_PERCENT[starLevel] / 100),
    armor: definition.baseStats.armor, magicResist: definition.baseStats.magicResist,
    attackRange: definition.attackRange, attackIntervalTicks: definition.attackIntervalTicks,
    ...(definition.baseAttackSpeedBps === undefined ? {} : { baseAttackSpeedBps: definition.baseAttackSpeedBps }),
    initialMana: definition.initialMana, maxMana: definition.maxMana, abilityId: definition.abilityId,
  };
}

export function getUnitSellPrice(unit: Unit): number {
  if (!Object.hasOwn(UNIT_DEFINITIONS, unit.definitionId)) throw new RangeError(`Unknown unit definition: ${unit.definitionId}`);
  if (!Object.hasOwn(STAR_PERCENT, unit.starLevel)) throw new RangeError(`Invalid star level: ${unit.starLevel}`);
  const cost = UNIT_DEFINITIONS[unit.definitionId].cost;
  return unit.starLevel === 1 ? cost : cost * 3 ** (unit.starLevel - 1) - (cost > 1 ? 1 : 0);
}

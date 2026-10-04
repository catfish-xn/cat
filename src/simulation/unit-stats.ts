import { UNIT_DEFINITIONS, type ResolvedUnitStats, type StarLevel, type Unit } from './units';

const STAR_PERCENT = Object.freeze({ 1: 100, 2: 180, 3: 324 });

export function getUnitStats(definitionId: string, starLevel: StarLevel): ResolvedUnitStats {
  const definition = UNIT_DEFINITIONS[definitionId];
  if (!Object.hasOwn(UNIT_DEFINITIONS, definitionId)) throw new RangeError(`Unknown unit definition: ${definitionId}`);
  if (!Object.hasOwn(STAR_PERCENT, starLevel)) throw new RangeError(`Invalid star level: ${starLevel}`);
  return {
    health: Math.floor(definition.baseStats.health * STAR_PERCENT[starLevel] / 100),
    attack: Math.floor(definition.baseStats.attack * STAR_PERCENT[starLevel] / 100),
    armor: definition.baseStats.armor, magicResist: definition.baseStats.magicResist,
    attackRange: definition.attackRange, attackIntervalTicks: definition.attackIntervalTicks,
    initialMana: definition.initialMana, maxMana: definition.maxMana, abilityId: definition.abilityId,
  };
}

export function getUnitSellPrice(unit: Unit): number {
  if (!Object.hasOwn(UNIT_DEFINITIONS, unit.definitionId)) throw new RangeError(`Unknown unit definition: ${unit.definitionId}`);
  if (!Object.hasOwn(STAR_PERCENT, unit.starLevel)) throw new RangeError(`Invalid star level: ${unit.starLevel}`);
  return UNIT_DEFINITIONS[unit.definitionId].cost * 3 ** (unit.starLevel - 1);
}

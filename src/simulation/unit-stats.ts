import { TRAINER_ID, TRAINER_HEALTH, TRAINER_ATTACK_CENTI } from './content/opening-batch-b';
import { STAR_HEALTH_PERCENT, STAR_ATTACK_PERCENT, SIX_COST_STAR_PERCENT } from './content/unit-star-scaling';
import { validateNeutralInputs } from './m8/unit-inputs';
import { UNIT_DEFINITIONS, type UnitDefinition, type ResolvedUnitStats, type StarLevel, type Unit } from './units';

export function getUnitStats(definitionId: string, starLevel: StarLevel): ResolvedUnitStats {
  const definition = UNIT_DEFINITIONS[definitionId];
  if (!Object.hasOwn(UNIT_DEFINITIONS, definitionId)) throw new RangeError(`Unknown unit definition: ${definitionId}`);
  if (definition.unitKind === 'neutral' && starLevel !== 1) throw new RangeError('Neutral units have fixed one star');
  return resolveUnitStats(definition, starLevel);
}
/** Content input seam for future catalogs; never installs a definition globally. */
export function resolveUnitStats(definition: UnitDefinition, starLevel: StarLevel): ResolvedUnitStats {
  validateNeutralInputs(definition);
  if (!Object.hasOwn(STAR_HEALTH_PERCENT, starLevel)) throw new RangeError(`Invalid star level: ${starLevel}`);
  const fixed = definition.summon?.fixedStarStats;
  const healthPercent = fixed ? 100 : (definition.cost === 6 ? SIX_COST_STAR_PERCENT : STAR_HEALTH_PERCENT)[starLevel];
  const attackPercent = fixed ? 100 : (definition.cost === 6 ? SIX_COST_STAR_PERCENT : STAR_ATTACK_PERCENT)[starLevel];
  return {
    ...(definition.id===TRAINER_ID?{attackRemainderCenti:TRAINER_ATTACK_CENTI[starLevel-1]%100}:{}),
    ...(definition.unitKind ? { unitKind: definition.unitKind, ...(definition.monsterFamily ? { monsterFamily: definition.monsterFamily } : {}) } : {}),
    ...(definition.baseCritChanceBps === undefined ? {} : { baseCritChanceBps: definition.baseCritChanceBps, baseCritMultiplierBps: definition.baseCritMultiplierBps }),
    health: definition.id===TRAINER_ID ? TRAINER_HEALTH[starLevel-1] : Math.floor(definition.baseStats.health * healthPercent / 100),
    attack: definition.id===TRAINER_ID ? Math.floor(TRAINER_ATTACK_CENTI[starLevel-1]/100) : Math.floor(definition.baseStats.attack * attackPercent / 100),
    armor: definition.baseStats.armor, magicResist: definition.baseStats.magicResist,
    attackRange: definition.attackRange, attackIntervalTicks: definition.attackIntervalTicks,
    ...(definition.baseAttackSpeedBps === undefined ? {} : { baseAttackSpeedBps: definition.baseAttackSpeedBps }),
    initialMana: definition.initialMana, maxMana: definition.maxMana, abilityId: definition.abilityId,
  };
}

export function getUnitSellPrice<T extends Pick<Unit,'definitionId'|'starLevel'>>(unit: T): number {
  if (!Object.hasOwn(UNIT_DEFINITIONS, unit.definitionId)) throw new RangeError(`Unknown unit definition: ${unit.definitionId}`);
  if (!Object.hasOwn(STAR_HEALTH_PERCENT, unit.starLevel)) throw new RangeError(`Invalid star level: ${unit.starLevel}`);
  if (UNIT_DEFINITIONS[unit.definitionId].unitKind === 'neutral') return 0; // Display-only: sell command rejects enemy identity.
  const cost = UNIT_DEFINITIONS[unit.definitionId].cost;
  return unit.starLevel === 1 ? cost : cost * 3 ** (unit.starLevel - 1) - (cost > 1 ? 1 : 0);
}

import { SHOP_CATALOG_BY_COST } from './match-rules';
import type { UnitDefinition } from './unit-types';
export * from './unit-types';

function define(definition: UnitDefinition): UnitDefinition {
  return Object.freeze({ ...definition, baseStats: Object.freeze({ ...definition.baseStats }), traits: Object.freeze([...definition.traits]) });
}

/** Small authored M4 roster; this is not a complete season data set. */
export const UNIT_DEFINITIONS: Readonly<Record<string, UnitDefinition>> = Object.freeze({
  sentinel: define({ id: 'sentinel', name: '守卫', symbol: '盾', color: 0x68ddd0, cost: 1,
    baseStats: { health: 800, attack: 45, armor: 40, magicResist: 30 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'sentinel-guard', traits: ['bulwark', 'conduit'] }),
  ranger: define({ id: 'ranger', name: '游侠', symbol: '弓', color: 0xe6bc76, cost: 1,
    baseStats: { health: 500, attack: 70, armor: 15, magicResist: 15 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'ranger-shot', traits: ['marksman', 'forge'] }),
  mystic: define({ id: 'mystic', name: '秘术师', symbol: '星', color: 0xb4a1f5, cost: 1,
    baseStats: { health: 450, attack: 80, armor: 10, magicResist: 20 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'mystic-bolt', traits: ['scholar', 'conduit'] }),
  bulwark: define({ id: 'bulwark', name: '壁垒', symbol: '壁', color: 0x70c99a, cost: 2,
    baseStats: { health: 1000, attack: 55, armor: 45, magicResist: 35 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'bulwark-guard', traits: ['bulwark', 'forge'] }),
  archer: define({ id: 'archer', name: '神射手', symbol: '箭', color: 0x9ec970, cost: 2,
    baseStats: { health: 650, attack: 85, armor: 20, magicResist: 20 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'archer-shot', traits: ['marksman', 'conduit'] }),
  arcanist: define({ id: 'arcanist', name: '奥术师', symbol: '术', color: 0x719ee2, cost: 3,
    baseStats: { health: 750, attack: 85, armor: 25, magicResist: 30 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'arcanist-burst', traits: ['scholar', 'forge'] }),
  duelist: define({ id: 'duelist', name: '决斗者', symbol: '刃', color: 0x759dd0, cost: 3,
    baseStats: { health: 1100, attack: 100, armor: 35, magicResist: 30 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'duelist-strike', traits: ['duelist', 'forge'] }),
  warden: define({ id: 'warden', name: '守望者', symbol: '卫', color: 0xbc82d8, cost: 4,
    baseStats: { health: 1500, attack: 90, armor: 55, magicResist: 50 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'warden-guard', traits: ['bulwark', 'scholar'] }),
  tempest: define({ id: 'tempest', name: '风暴使', symbol: '岚', color: 0xa68de5, cost: 4,
    baseStats: { health: 950, attack: 110, armor: 30, magicResist: 35 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'tempest-burst', traits: ['scholar', 'marksman'] }),
  colossus: define({ id: 'colossus', name: '巨像', symbol: '巨', color: 0xe1bc61, cost: 5,
    baseStats: { health: 1800, attack: 125, armor: 65, magicResist: 60 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 90, abilityId: 'colossus-guard', traits: ['bulwark', 'forge'] }),
  oracle: define({ id: 'oracle', name: '先知', symbol: '谕', color: 0xf0cc83, cost: 5,
    baseStats: { health: 1150, attack: 125, armor: 35, magicResist: 45 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'oracle-burst', traits: ['scholar', 'conduit'] }),
  squire: define({ id: 'squire', name: '侍卫', symbol: '侍', color: 0x89d7bd, cost: 1,
    baseStats: { health: 800, attack: 45, armor: 40, magicResist: 30 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'sentinel-guard', traits: ['bulwark', 'duelist'] }),
  spark: define({ id: 'spark', name: '火花', symbol: '火', color: 0xefaa78, cost: 1,
    baseStats: { health: 450, attack: 80, armor: 10, magicResist: 20 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'mystic-bolt', traits: ['scholar', 'forge'] }),
  scout: define({ id: 'scout', name: '斥候', symbol: '斥', color: 0x7fb58d, cost: 2,
    baseStats: { health: 650, attack: 85, armor: 20, magicResist: 20 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'archer-shot', traits: ['marksman', 'duelist'] }),
  binder: define({ id: 'binder', name: '织流者', symbol: '织', color: 0x83c4d2, cost: 2,
    baseStats: { health: 1000, attack: 55, armor: 45, magicResist: 35 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'bulwark-guard', traits: ['conduit', 'duelist'] }),
  striker: define({ id: 'striker', name: '突击手', symbol: '突', color: 0xb98c87, cost: 3,
    baseStats: { health: 1100, attack: 100, armor: 35, magicResist: 30 }, attackRange: 1,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 60, abilityId: 'duelist-strike', traits: ['marksman', 'duelist'] }),
  beacon: define({ id: 'beacon', name: '灯塔', symbol: '灯', color: 0xeee0a2, cost: 3,
    baseStats: { health: 750, attack: 85, armor: 25, magicResist: 30 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'arcanist-burst', traits: ['bulwark', 'conduit'] }),
  prism: define({ id: 'prism', name: '棱镜', symbol: '棱', color: 0xd8a0d9, cost: 4,
    baseStats: { health: 950, attack: 110, armor: 30, magicResist: 35 }, attackRange: 3,
    attackIntervalTicks: 20, initialMana: 0, maxMana: 80, abilityId: 'tempest-burst', traits: ['marksman', 'forge'] }),
});

/** Configuration mistakes fail at startup instead of altering shop sampling. */
export function validateUnitDefinitions(definitions: Readonly<Record<string, UnitDefinition>> = UNIT_DEFINITIONS, catalogByCost = SHOP_CATALOG_BY_COST): void {
  const integerAtLeast = (value: number, minimum: number) => Number.isSafeInteger(value) && value >= minimum;
  for (const [id, definition] of Object.entries(definitions)) {
    const stats = definition.baseStats;
    if (definition.id !== id || !definition.name || !definition.symbol || !definition.abilityId
      || !integerAtLeast(definition.color, 0) || definition.color > 0xffffff
      || !integerAtLeast(definition.cost, 1) || definition.cost > 5
      || !integerAtLeast(stats.health, 1) || !integerAtLeast(stats.attack, 0)
      || !integerAtLeast(stats.armor, 0) || !integerAtLeast(stats.magicResist, 0)
      || !integerAtLeast(definition.attackRange, 1) || !integerAtLeast(definition.attackIntervalTicks, 1)
      || !integerAtLeast(definition.maxMana, 1) || !integerAtLeast(definition.initialMana, 0)
      || definition.initialMana > definition.maxMana || !Array.isArray(definition.traits)
      || definition.traits.length === 0 || new Set(definition.traits).size !== definition.traits.length
      || definition.traits.some(trait => typeof trait !== 'string' || !trait)) throw new RangeError(`Invalid unit definition: ${id}`);
  }
  const catalogIds = new Set<string>();
  for (const cost of [1, 2, 3, 4, 5] as const) {
    const catalog = catalogByCost[cost];
    if (catalog.length === 0) throw new RangeError(`Empty shop tier: ${cost}`);
    for (const id of catalog) {
      if (catalogIds.has(id) || definitions[id]?.cost !== cost) throw new RangeError(`Invalid shop definition: ${id}`);
      catalogIds.add(id);
    }
  }
  if (catalogIds.size !== Object.keys(definitions).length) throw new RangeError('Unit definitions and shop catalog differ');
}

validateUnitDefinitions();

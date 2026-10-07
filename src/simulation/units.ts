import { validateManaDefinition } from './m8/mana';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import type { UnitDefinition } from './unit-types';
import { freezeContent } from './content/freeze';
export * from './unit-types';
function define(definition: UnitDefinition): UnitDefinition { return freezeContent(definition); }
// Legacy-only standalone scenarios; these definitions never enter M5 acquisition pools.
export const LEGACY_UNIT_DEFINITIONS: Readonly<Record<string, UnitDefinition>> = Object.freeze({
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

export const M5_UNIT_DEFINITIONS: Readonly<Record<string,UnitDefinition>> = freezeContent({
  "irelia": {
    "id": "irelia",
    "name": "Irelia",
    "symbol": "I",
    "color": 10466749,
    "cost": 1,
    "baseStats": {
      "health": 700,
      "attack": 45,
      "armor": 40,
      "magicResist": 40
    },
    "attackRange": 1,
    "attackIntervalTicks": 34,
    "baseAttackSpeedBps": 6000,
    "initialMana": 30,
    "maxMana": 70,
    "abilityId": "irelia-ability",
    "traits": [
      "sentinel"
    ]
  },
  "maddie": {
    "id": "maddie",
    "name": "Maddie",
    "symbol": "M",
    "color": 10466749,
    "cost": 1,
    "baseStats": {
      "health": 500,
      "attack": 50,
      "armor": 15,
      "magicResist": 15
    },
    "attackRange": 6,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 20,
    "maxMana": 120,
    "abilityId": "maddie-ability",
    "traits": [
      "sniper"
    ]
  },
  "darius": {
    "id": "darius",
    "name": "Darius",
    "symbol": "D",
    "color": 10466749,
    "cost": 1,
    "baseStats": {
      "health": 600,
      "attack": 55,
      "armor": 40,
      "magicResist": 40
    },
    "attackRange": 1,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 30,
    "maxMana": 70,
    "abilityId": "darius-ability",
    "traits": [
      "watcher"
    ]
  },
  "lux": {
    "id": "lux",
    "name": "Lux",
    "symbol": "L",
    "color": 10466749,
    "cost": 1,
    "baseStats": {
      "health": 500,
      "attack": 30,
      "armor": 20,
      "magicResist": 20
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 0,
    "maxMana": 50,
    "abilityId": "lux-ability",
    "traits": [
      "sorcerer"
    ]
  },
  "zyra": {
    "id": "zyra",
    "name": "Zyra",
    "symbol": "Z",
    "color": 10466749,
    "cost": 1,
    "baseStats": {
      "health": 500,
      "attack": 30,
      "armor": 20,
      "magicResist": 20
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 10,
    "maxMana": 60,
    "abilityId": "zyra-ability",
    "traits": [
      "sorcerer"
    ]
  },
  "tristana": {
    "id": "tristana",
    "name": "Tristana",
    "symbol": "T",
    "color": 7523468,
    "cost": 2,
    "baseStats": {
      "health": 550,
      "attack": 42,
      "armor": 20,
      "magicResist": 20
    },
    "attackRange": 4,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 20,
    "maxMana": 60,
    "abilityId": "tristana-ability",
    "traits": [
      "artillerist"
    ]
  },
  "urgot": {
    "id": "urgot",
    "name": "Urgot",
    "symbol": "U",
    "color": 7523468,
    "cost": 2,
    "baseStats": {
      "health": 700,
      "attack": 50,
      "armor": 45,
      "magicResist": 45
    },
    "attackRange": 2,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 20,
    "maxMana": 70,
    "abilityId": "urgot-ability",
    "traits": [
      "artillerist"
    ]
  },
  "rell": {
    "id": "rell",
    "name": "Rell",
    "symbol": "R",
    "color": 7523468,
    "cost": 2,
    "baseStats": {
      "health": 800,
      "attack": 60,
      "armor": 45,
      "magicResist": 45
    },
    "attackRange": 1,
    "attackIntervalTicks": 34,
    "baseAttackSpeedBps": 6000,
    "initialMana": 40,
    "maxMana": 90,
    "abilityId": "rell-ability",
    "traits": [
      "sentinel"
    ]
  },
  "leona": {
    "id": "leona",
    "name": "Leona",
    "symbol": "L",
    "color": 7523468,
    "cost": 2,
    "baseStats": {
      "health": 800,
      "attack": 55,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 34,
    "baseAttackSpeedBps": 6000,
    "initialMana": 50,
    "maxMana": 90,
    "abilityId": "leona-ability",
    "traits": [
      "sentinel"
    ]
  },
  "vander": {
    "id": "vander",
    "name": "Vander",
    "symbol": "V",
    "color": 7523468,
    "cost": 2,
    "baseStats": {
      "health": 800,
      "attack": 50,
      "armor": 45,
      "magicResist": 45
    },
    "attackRange": 1,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 0,
    "maxMana": 50,
    "abilityId": "vander-ability",
    "traits": [
      "watcher"
    ]
  },
  "kogmaw": {
    "id": "kogmaw",
    "name": "Kog'Maw",
    "symbol": "K",
    "color": 7839464,
    "cost": 3,
    "baseStats": {
      "health": 650,
      "attack": 15,
      "armor": 25,
      "magicResist": 25
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 0,
    "maxMana": 40,
    "abilityId": "kogmaw-ability",
    "traits": [
      "sniper"
    ]
  },
  "scar": {
    "id": "scar",
    "name": "Scar",
    "symbol": "S",
    "color": 7839464,
    "cost": 3,
    "baseStats": {
      "health": 800,
      "attack": 50,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 31,
    "baseAttackSpeedBps": 6500,
    "initialMana": 80,
    "maxMana": 170,
    "abilityId": "scar-ability",
    "traits": [
      "watcher"
    ]
  },
  "ezreal": {
    "id": "ezreal",
    "name": "Ezreal",
    "symbol": "E",
    "color": 7839464,
    "cost": 3,
    "baseStats": {
      "health": 700,
      "attack": 60,
      "armor": 25,
      "magicResist": 25
    },
    "attackRange": 4,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 0,
    "maxMana": 60,
    "abilityId": "ezreal-ability",
    "traits": [
      "artillerist"
    ]
  },
  "loris": {
    "id": "loris",
    "name": "Loris",
    "symbol": "L",
    "color": 7839464,
    "cost": 3,
    "baseStats": {
      "health": 850,
      "attack": 50,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 31,
    "baseAttackSpeedBps": 6500,
    "initialMana": 40,
    "maxMana": 80,
    "abilityId": "loris-ability",
    "traits": [
      "sentinel"
    ]
  },
  "nami": {
    "id": "nami",
    "name": "Nami",
    "symbol": "N",
    "color": 7839464,
    "cost": 3,
    "baseStats": {
      "health": 700,
      "attack": 40,
      "armor": 25,
      "magicResist": 25
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 0,
    "maxMana": 60,
    "abilityId": "nami-ability",
    "traits": [
      "sorcerer"
    ]
  },
  "corki": {
    "id": "corki",
    "name": "Corki",
    "symbol": "C",
    "color": 12025069,
    "cost": 4,
    "baseStats": {
      "health": 850,
      "attack": 65,
      "armor": 30,
      "magicResist": 30
    },
    "attackRange": 4,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 0,
    "maxMana": 60,
    "abilityId": "corki-ability",
    "traits": [
      "artillerist"
    ]
  },
  "garen": {
    "id": "garen",
    "name": "Garen",
    "symbol": "G",
    "color": 12025069,
    "cost": 4,
    "baseStats": {
      "health": 1000,
      "attack": 65,
      "armor": 60,
      "magicResist": 60
    },
    "attackRange": 1,
    "attackIntervalTicks": 34,
    "baseAttackSpeedBps": 6000,
    "initialMana": 60,
    "maxMana": 125,
    "abilityId": "garen-ability",
    "traits": [
      "watcher"
    ]
  },
  "zoe": {
    "id": "zoe",
    "name": "Zoe",
    "symbol": "Z",
    "color": 12025069,
    "cost": 4,
    "baseStats": {
      "health": 800,
      "attack": 40,
      "armor": 30,
      "magicResist": 30
    },
    "attackRange": 4,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 20,
    "maxMana": 80,
    "abilityId": "zoe-ability",
    "traits": [
      "sorcerer"
    ]
  },
  "caitlyn": {
    "id": "caitlyn",
    "name": "Caitlyn",
    "symbol": "C",
    "color": 14859608,
    "cost": 5,
    "baseStats": {
      "health": 900,
      "attack": 82,
      "armor": 40,
      "magicResist": 40
    },
    "attackRange": 13,
    "attackIntervalTicks": 37,
    "baseAttackSpeedBps": 5500,
    "initialMana": 0,
    "maxMana": 50,
    "abilityId": "caitlyn-ability",
    "traits": [
      "sniper"
    ]
  }
});
export const NEUTRAL_UNIT_DEFINITIONS: Readonly<Record<string,UnitDefinition>> = freezeContent({
  "neutral-stage-2": {
    "id": "neutral-stage-2",
    "name": "中立守卫 2",
    "symbol": "兽",
    "color": 9993582,
    "cost": 1,
    "baseStats": {
      "health": 500,
      "attack": 35,
      "armor": 20,
      "magicResist": 20
    },
    "attackRange": 1,
    "attackIntervalTicks": 25,
    "initialMana": 0,
    "maxMana": 1,
    "abilityId": "neutral-attack",
    "traits": []
  },
  "neutral-stage-3": {
    "id": "neutral-stage-3",
    "name": "中立守卫 3",
    "symbol": "兽",
    "color": 9993582,
    "cost": 1,
    "baseStats": {
      "health": 900,
      "attack": 50,
      "armor": 30,
      "magicResist": 30
    },
    "attackRange": 1,
    "attackIntervalTicks": 23,
    "initialMana": 0,
    "maxMana": 1,
    "abilityId": "neutral-attack",
    "traits": []
  },
  "neutral-stage-4": {
    "id": "neutral-stage-4",
    "name": "中立守卫 4",
    "symbol": "兽",
    "color": 9993582,
    "cost": 1,
    "baseStats": {
      "health": 1200,
      "attack": 65,
      "armor": 40,
      "magicResist": 40
    },
    "attackRange": 1,
    "attackIntervalTicks": 22,
    "initialMana": 0,
    "maxMana": 1,
    "abilityId": "neutral-attack",
    "traits": []
  },
  "neutral-stage-5": {
    "id": "neutral-stage-5",
    "name": "中立守卫 5",
    "symbol": "兽",
    "color": 9993582,
    "cost": 1,
    "baseStats": {
      "health": 6000,
      "attack": 100,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 2,
    "attackIntervalTicks": 20,
    "initialMana": 0,
    "maxMana": 1,
    "abilityId": "neutral-attack",
    "traits": []
  },
  "neutral-stage-6": {
    "id": "neutral-stage-6",
    "name": "中立守卫 6",
    "symbol": "兽",
    "color": 9993582,
    "cost": 1,
    "baseStats": {
      "health": 9000,
      "attack": 130,
      "armor": 60,
      "magicResist": 60
    },
    "attackRange": 2,
    "attackIntervalTicks": 18,
    "initialMana": 0,
    "maxMana": 1,
    "abilityId": "neutral-attack",
    "traits": []
  }
});
export const M5_UNIT_IDS: readonly string[] = Object.freeze(Object.keys(M5_UNIT_DEFINITIONS).sort());
export const UNIT_DEFINITIONS: Readonly<Record<string,UnitDefinition>> = Object.freeze({...LEGACY_UNIT_DEFINITIONS,...M5_UNIT_DEFINITIONS,...NEUTRAL_UNIT_DEFINITIONS});
/** Reject malformed IDs and fields without silently changing shop sampling. */
export function validateUnitDefinitions(definitions: Readonly<Record<string,UnitDefinition>> = UNIT_DEFINITIONS, catalogByCost = SHOP_CATALOG_BY_COST): void {
  const integerAtLeast = (value:number,minimum:number) => Number.isSafeInteger(value) && value >= minimum;
  for (const [id, definition] of Object.entries(definitions)) {
    validateManaDefinition(definition);
    const s=definition.baseStats;
    if (definition.id !== id || !/^[a-z][a-z0-9-]*$/.test(id) || !definition.name || !definition.symbol || !definition.abilityId
      || !integerAtLeast(definition.color,0) || definition.color>0xffffff || !integerAtLeast(definition.cost,1) || definition.cost>5
      || !integerAtLeast(s.health,1) || !integerAtLeast(s.attack,0) || !integerAtLeast(s.armor,0) || !integerAtLeast(s.magicResist,0)
      || !integerAtLeast(definition.attackRange,1) || !integerAtLeast(definition.attackIntervalTicks,1)
      || !integerAtLeast(definition.maxMana,0) || !integerAtLeast(definition.initialMana,0) || definition.initialMana>definition.maxMana
      || !Array.isArray(definition.traits) || new Set(definition.traits).size!==definition.traits.length
      || definition.traits.some(trait=>typeof trait!=='string'||!trait)) throw new RangeError(`Invalid unit definition: ${id}`);
  }
  const seen=new Set<string>();
  for (const cost of [1,2,3,4,5] as const) {
    const catalog=catalogByCost[cost];
    if (!catalog.length) throw new RangeError(`Empty shop tier: ${cost}`);
    for (const id of catalog) {
      if (seen.has(id)||definitions[id]?.cost!==cost) throw new RangeError(`Invalid shop definition: ${id}`);
      seen.add(id);
    }
  }
  if (definitions===UNIT_DEFINITIONS && [...seen].some(id=>!Object.hasOwn(M5_UNIT_DEFINITIONS,id))) throw new RangeError('Legacy or neutral unit in M5 shop');
}
validateUnitDefinitions();

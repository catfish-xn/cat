import type { ItemDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
export const ITEM_DEFINITIONS: Readonly<Record<string,ItemDefinition>> = freezeContent({
  "sword": {
    "id": "sword",
    "name": "暴风大剑",
    "kind": "component",
    "effects": [
      {
        "kind": "statPercentBps",
        "stat": "attackDamage",
        "bps": 1000
      }
    ]
  },
  "bow": {
    "id": "bow",
    "name": "反曲之弓",
    "kind": "component",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 1000
      }
    ]
  },
  "rod": {
    "id": "rod",
    "name": "无用大棒",
    "kind": "component",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "abilityPower",
        "amount": 10
      }
    ]
  },
  "tear": {
    "id": "tear",
    "name": "女神之泪",
    "kind": "component",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "initialMana",
        "amount": 15
      }
    ]
  },
  "vest": {
    "id": "vest",
    "name": "锁子甲",
    "kind": "component",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "armor",
        "amount": 20
      }
    ]
  },
  "cloak": {
    "id": "cloak",
    "name": "负极斗篷",
    "kind": "component",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "magicResist",
        "amount": 20
      }
    ]
  },
  "belt": {
    "id": "belt",
    "name": "巨人腰带",
    "kind": "component",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "maxHp",
        "amount": 150
      }
    ]
  },
  "rageblade": {
    "id": "rageblade",
    "name": "鬼索的狂暴之刃",
    "kind": "completed",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "abilityPower",
        "amount": 10
      },
      {
        "kind": "attackSpeedBps",
        "bps": 1000
      },
      {
        "kind": "mechanic",
        "mechanic": "rageblade",
        "values": {
          "attackSpeedBps": 500
        }
      }
    ],
    "recipe": [
      "bow",
      "rod"
    ]
  },
  "deathblade": {
    "id": "deathblade",
    "name": "死亡之刃",
    "kind": "completed",
    "effects": [
      {
        "kind": "statPercentBps",
        "stat": "attackDamage",
        "bps": 5500
      },
      {
        "kind": "mechanic",
        "mechanic": "damageAmp",
        "values": {
          "bps": 800
        }
      }
    ],
    "recipe": [
      "sword",
      "sword"
    ]
  },
  "shojin": {
    "id": "shojin",
    "name": "朔极之矛",
    "kind": "completed",
    "effects": [
      {
        "kind": "statPercentBps",
        "stat": "attackDamage",
        "bps": 1500
      },
      {
        "kind": "statFlat",
        "stat": "abilityPower",
        "amount": 15
      },
      {
        "kind": "statFlat",
        "stat": "initialMana",
        "amount": 15
      },
      {
        "kind": "mechanic",
        "mechanic": "extraAttackMana",
        "values": {
          "amount": 5
        }
      }
    ],
    "recipe": [
      "sword",
      "tear"
    ]
  },
  "archangel": {
    "id": "archangel",
    "name": "大天使之杖",
    "kind": "completed",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "abilityPower",
        "amount": 20
      },
      {
        "kind": "statFlat",
        "stat": "initialMana",
        "amount": 15
      },
      {
        "kind": "mechanic",
        "mechanic": "archangel",
        "values": {
          "periodTicks": 100,
          "abilityPower": 30
        }
      }
    ],
    "recipe": [
      "rod",
      "tear"
    ]
  },
  "deathcap": {
    "id": "deathcap",
    "name": "灭世者的死亡之帽",
    "kind": "completed",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "abilityPower",
        "amount": 50
      },
      {
        "kind": "mechanic",
        "mechanic": "damageAmp",
        "values": {
          "bps": 1500
        }
      }
    ],
    "recipe": [
      "rod",
      "rod"
    ]
  },
  "warmog": {
    "id": "warmog",
    "name": "狂徒铠甲",
    "kind": "completed",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "maxHp",
        "amount": 600
      },
      {
        "kind": "statPercentBps",
        "stat": "maxHp",
        "bps": 1200
      }
    ],
    "recipe": [
      "belt",
      "belt"
    ]
  },
  "dragons-claw": {
    "id": "dragons-claw",
    "name": "巨龙之爪",
    "kind": "completed",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "magicResist",
        "amount": 75
      },
      {
        "kind": "statPercentBps",
        "stat": "maxHp",
        "bps": 900
      },
      {
        "kind": "mechanic",
        "mechanic": "dragonClaw",
        "values": {
          "periodTicks": 40,
          "healMaxHpBps": 250
        }
      }
    ],
    "recipe": [
      "cloak",
      "cloak"
    ]
  },
  "gargoyle": {
    "id": "gargoyle",
    "name": "石像鬼石板甲",
    "kind": "completed",
    "effects": [
      {
        "kind": "statFlat",
        "stat": "maxHp",
        "amount": 100
      },
      {
        "kind": "statFlat",
        "stat": "armor",
        "amount": 25
      },
      {
        "kind": "statFlat",
        "stat": "magicResist",
        "amount": 25
      },
      {
        "kind": "mechanic",
        "mechanic": "gargoyle",
        "values": {
          "resistPerEnemy": 10
        }
      }
    ],
    "recipe": [
      "vest",
      "cloak"
    ]
  },
  "gunblade": {
    "id": "gunblade",
    "name": "海克斯科技枪刃",
    "kind": "completed",
    "effects": [
      {
        "kind": "statPercentBps",
        "stat": "attackDamage",
        "bps": 2000
      },
      {
        "kind": "statFlat",
        "stat": "abilityPower",
        "amount": 20
      },
      {
        "kind": "mechanic",
        "mechanic": "gunblade",
        "values": {
          "selfHealBps": 1500,
          "allyHealBps": 2500
        }
      }
    ],
    "recipe": [
      "sword",
      "rod"
    ]
  }
});
export const COMPONENT_IDS: readonly string[] = Object.freeze(Object.keys(ITEM_DEFINITIONS).filter(id=>ITEM_DEFINITIONS[id].kind==='component').sort());

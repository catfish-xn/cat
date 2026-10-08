import type { ItemDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
import { COMPONENTS_ITEMS } from './items-components';
import { SWORD_ITEMS } from './items-sword';
import { BOW_ITEMS } from './items-bow';
export const ITEM_DEFINITIONS: Readonly<Record<string,ItemDefinition>> = freezeContent({
  ...Object.fromEntries([COMPONENTS_ITEMS,SWORD_ITEMS,BOW_ITEMS].flat().map(item=>[item.id,item])),
  ...{
  "rageblade": {
    "id": "rageblade",
    "effectDescriptions": ["每次完成普攻叠加5%攻速，持续本场，无上限。"],
    "name": "鬼索的狂暴之刃",
    "kind": "completed",
    "apiName": "TFT_Item_GuinsoosRageblade",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "A-15",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "bow",
      "rod"
    ],
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
    ]
  },
  "deathblade": {
    "id": "deathblade",
    "effectDescriptions": ["常驻增伤8%，与攻击力属性分别计算。"],
    "name": "死亡之刃",
    "kind": "completed",
    "apiName": "TFT_Item_Deathblade",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "A-09",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "sword",
      "sword"
    ],
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
    ]
  },
  "shojin": {
    "id": "shojin",
    "effectDescriptions": ["每次完成普攻额外回5法力，仍受锁蓝与上限限制。"],
    "name": "朔极之矛",
    "kind": "completed",
    "apiName": "TFT_Item_SpearOfShojin",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "sword",
      "tear"
    ],
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
    ]
  },
  "archangel": {
    "id": "archangel",
    "effectDescriptions": ["每5秒增加30法强，持续本场，首次不是开战。"],
    "name": "大天使之杖",
    "kind": "completed",
    "apiName": "TFT_Item_ArchangelsStaff",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "A-02",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "rod",
      "tear"
    ],
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
    ]
  },
  "deathcap": {
    "id": "deathcap",
    "effectDescriptions": ["常驻增伤15%。"],
    "name": "灭世者的死亡之帽",
    "kind": "completed",
    "apiName": "TFT_Item_RabadonsDeathcap",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "B-06",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "rod",
      "rod"
    ],
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
    ]
  },
  "warmog": {
    "id": "warmog",
    "effectDescriptions": ["生命按（基础与固定生命之和）×（1+合计生命百分比）计算。"],
    "name": "狂徒铠甲",
    "kind": "completed",
    "apiName": "TFT_Item_WarmogsArmor",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "belt",
      "belt"
    ],
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
    ]
  },
  "dragons-claw": {
    "id": "dragons-claw",
    "effectDescriptions": ["每2秒治疗当时最大生命的2.5%，不复活、不转盾。"],
    "name": "巨龙之爪",
    "kind": "completed",
    "apiName": "TFT_Item_DragonsClaw",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "A-10",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "cloak",
      "cloak"
    ],
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
    ]
  },
  "gargoyle": {
    "id": "gargoyle",
    "effectDescriptions": ["每个当前主目标为持有者的存活敌人增加10双抗，目标改变或死亡即时重算。"],
    "name": "石像鬼石板甲",
    "kind": "completed",
    "apiName": "TFT_Item_GargoyleStoneplate",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "A-12",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "vest",
      "cloak"
    ],
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
    ]
  },
  "gunblade": {
    "id": "gunblade",
    "effectDescriptions": ["15%全能吸血；合资格实际盾伤+生命伤害的25%治疗另一名生命比例最低存活友军，同值按稳定ID，不治疗自身。"],
    "name": "海克斯科技枪刃",
    "kind": "completed",
    "apiName": "TFT_Item_HextechGunblade",
    "unique": false,
    "slotCost": 1,
    "conventionIds": [
      "A-16",
      "GLOBAL-STAT-01"
    ],
    "recipe": [
      "sword",
      "rod"
    ],
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
    ]
  }
}
});
export const COMPONENT_IDS: readonly string[] = Object.freeze(Object.values(ITEM_DEFINITIONS).filter(item=>item.kind==='component').sort((a,b)=>a.apiName!<b.apiName!?-1:1).map(item=>item.id));

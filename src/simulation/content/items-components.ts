import type { ItemDefinition } from '../strategy-types';
import { modifier } from './item-programs';
export const COMPONENTS_ITEMS: readonly ItemDefinition[] = [
{
  "id": "sword",
  "name": "暴风大剑",
  "kind": "component",
  "apiName": "TFT_Item_BFSword",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "AD: 1000 Bps"
  ],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 1000
    }
  ]
},
{
  "id": "vest",
  "name": "锁子甲",
  "kind": "component",
  "apiName": "TFT_Item_ChainVest",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "Armor: 20 resistance-points"
  ],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    }
  ]
},
{
  "id": "belt",
  "name": "巨人腰带",
  "kind": "component",
  "apiName": "TFT_Item_GiantsBelt",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "Health: 150 health-points"
  ],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ]
},
{
  "id": "rod",
  "name": "无用大棒",
  "kind": "component",
  "apiName": "TFT_Item_NeedlesslyLargeRod",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "AP: 10 ability-power-points"
  ],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 10
    }
  ]
},
{
  "id": "cloak",
  "name": "负极斗篷",
  "kind": "component",
  "apiName": "TFT_Item_NegatronCloak",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "MagicResist: 20 magic-resist-points"
  ],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "magicResist",
      "amount": 20
    }
  ]
},
{
  "id": "bow",
  "name": "反曲之弓",
  "kind": "component",
  "apiName": "TFT_Item_RecurveBow",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "AS: 1000 Bps"
  ],
  "effects": [
    {
      "kind": "attackSpeedBps",
      "bps": 1000
    }
  ]
},
{
  "id": "gloves",
  "name": "拳套",
  "kind": "component",
  "apiName": "TFT_Item_SparringGloves",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": ["暴击率 +20%。"],
  "effects": [],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps')]}
},
{
  "id": "tear",
  "name": "女神之泪",
  "kind": "component",
  "apiName": "TFT_Item_TearOfTheGoddess",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "effectDescriptions": [
    "Mana: 15 mana-points"
  ],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 15
    }
  ]
}
];

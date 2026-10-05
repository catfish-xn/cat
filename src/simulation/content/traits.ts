import type { TraitDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
export const TRAIT_DEFINITIONS: Readonly<Record<string,TraitDefinition>> = freezeContent({
  "sentinel": {
    "id": "sentinel",
    "name": "哨兵",
    "target": "team",
    "tiers": [
      {
        "threshold": 2,
        "effects": [
          {
            "kind": "statFlat",
            "stat": "armor",
            "amount": 12
          },
          {
            "kind": "statFlat",
            "stat": "magicResist",
            "amount": 12
          }
        ],
        "memberEffects": [
          {
            "kind": "statFlat",
            "stat": "armor",
            "amount": 24
          },
          {
            "kind": "statFlat",
            "stat": "magicResist",
            "amount": 24
          }
        ]
      },
      {
        "threshold": 4,
        "effects": [
          {
            "kind": "statFlat",
            "stat": "armor",
            "amount": 25
          },
          {
            "kind": "statFlat",
            "stat": "magicResist",
            "amount": 25
          }
        ],
        "memberEffects": [
          {
            "kind": "statFlat",
            "stat": "armor",
            "amount": 50
          },
          {
            "kind": "statFlat",
            "stat": "magicResist",
            "amount": 50
          }
        ]
      }
    ]
  },
  "artillerist": {
    "id": "artillerist",
    "name": "炮手",
    "target": "members",
    "tiers": [
      {
        "threshold": 2,
        "effects": [
          {
            "kind": "statPercentBps",
            "stat": "attackDamage",
            "bps": 1000
          },
          {
            "kind": "mechanic",
            "mechanic": "artillery",
            "values": {
              "everyN": 5,
              "adBps": 12500,
              "radius": 1
            }
          }
        ]
      },
      {
        "threshold": 4,
        "effects": [
          {
            "kind": "statPercentBps",
            "stat": "attackDamage",
            "bps": 4500
          },
          {
            "kind": "mechanic",
            "mechanic": "artillery",
            "values": {
              "everyN": 5,
              "adBps": 12500,
              "radius": 1
            }
          }
        ]
      }
    ]
  },
  "sniper": {
    "id": "sniper",
    "name": "狙神",
    "target": "members",
    "tiers": [
      {
        "threshold": 2,
        "effects": [
          {
            "kind": "mechanic",
            "mechanic": "sniper",
            "values": {
              "damageBpsPerHex": 700
            }
          }
        ]
      }
    ]
  },
  "watcher": {
    "id": "watcher",
    "name": "监察",
    "target": "members",
    "tiers": [
      {
        "threshold": 2,
        "effects": [
          {
            "kind": "mechanic",
            "mechanic": "watcher",
            "values": {
              "reductionBps": 1500,
              "healthyReductionBps": 3000,
              "thresholdBps": 5000
            }
          }
        ]
      },
      {
        "threshold": 4,
        "effects": [
          {
            "kind": "mechanic",
            "mechanic": "watcher",
            "values": {
              "reductionBps": 2500,
              "healthyReductionBps": 4500,
              "thresholdBps": 5000
            }
          }
        ]
      }
    ]
  },
  "sorcerer": {
    "id": "sorcerer",
    "name": "法师",
    "target": "team",
    "tiers": [
      {
        "threshold": 2,
        "effects": [
          {
            "kind": "statFlat",
            "stat": "abilityPower",
            "amount": 10
          }
        ],
        "memberEffects": [
          {
            "kind": "statFlat",
            "stat": "abilityPower",
            "amount": 10
          }
        ]
      },
      {
        "threshold": 4,
        "effects": [
          {
            "kind": "statFlat",
            "stat": "abilityPower",
            "amount": 10
          }
        ],
        "memberEffects": [
          {
            "kind": "statFlat",
            "stat": "abilityPower",
            "amount": 40
          }
        ]
      }
    ]
  }
});

import { P3_ANOMALIES } from './s13-p3';
import { G23_ANOMALIES } from './g2-3-anomalies';
import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
import { S13_ANOMALY_DEFINITIONS } from '../anomalies/definitions';
export const ANOMALY_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent({
  ...P3_ANOMALIES,
  "titanic-strikes": {
    "id": "titanic-strikes",
    "name": "泰坦打击",
    "description": "普攻对目标及其一格邻域附加40%攻击力物理伤害。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "titanic",
        "values": {
          "adBps": 4000,
          "radius": 1
        }
      }
    ]
  },
  "mage-armor": {
    "id": "mage-armor",
    "name": "法师护甲",
    "description": "获得相当于转换前最终法强50%的护甲和魔抗。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "mageArmor",
        "values": {
          "apBps": 5000
        }
      }
    ]
  },
  "kill-streak": {
    "id": "kill-streak",
    "name": "连杀",
    "description": "每次击杀后，若本tick仍存活，获得20法力。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "killStreak",
        "values": {
          "mana": 20
        }
      }
    ]
  },
  ...G23_ANOMALIES,
  ...S13_ANOMALY_DEFINITIONS,
});

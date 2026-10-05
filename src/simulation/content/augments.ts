import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
export const AUGMENT_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent({
  "placebo": {
    "id": "placebo",
    "name": "安慰剂",
    "description": "立即获得8金币，全队获得1%攻速。",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 100
      },
      {
        "kind": "mechanic",
        "mechanic": "acquisitionGold",
        "values": {
          "amount": 8
        }
      }
    ]
  },
  "manaflow-i": {
    "id": "manaflow-i",
    "name": "法力流 I",
    "description": "开战时最后一排单位每次普攻额外获得2法力。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "extraAttackMana",
        "values": {
          "amount": 2,
          "backRowOnly": 1
        }
      }
    ]
  },
  "glass-cannon-i": {
    "id": "glass-cannon-i",
    "name": "玻璃大炮 I",
    "description": "开战时最后一排单位以80%最大生命开始，获得12%伤害增幅。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "glassCannon",
        "values": {
          "startingHealthBps": 8000,
          "damageAmpBps": 1200,
          "backRowOnly": 1
        }
      }
    ]
  },
  "pumping-up-i": {
    "id": "pumping-up-i",
    "name": "加快节奏 I",
    "description": "全队获得6%攻速，此后每完成一轮增加0.5个百分点。",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 600
      },
      {
        "kind": "mechanic",
        "mechanic": "pumpingUp",
        "values": {
          "attackSpeedBpsPerRound": 50
        }
      }
    ]
  },
  "investment-strategy-i": {
    "id": "investment-strategy-i",
    "name": "投资策略 I",
    "description": "获得后，每赚取1利息，全队永久增加8最大生命。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "investment",
        "values": {
          "healthPerInterest": 8
        }
      }
    ]
  },
  "bulky-buddies-i": {
    "id": "bulky-buddies-i",
    "name": "大块头伙伴 I",
    "description": "开战时恰与一个友军相邻的单位获得100生命；该邻居死亡时，获得10%最大生命的10秒盾。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "bulkyBuddies",
        "values": {
          "health": 100,
          "shieldMaxHpBps": 1000,
          "durationTicks": 200
        }
      }
    ]
  }
});

import { AUGMENT_BATCH5_H7_DEFINITIONS } from './augment-pool-batch5-h7';
import { AUGMENT_SHOP_DEFINITIONS } from './augment-pool-shop';
import { AUGMENT_BATCH5_DEFINITIONS } from './augment-pool-batch5';
import { AUGMENT_BATCH4_DEFINITIONS } from './augment-pool-batch4';
import { AUGMENT_BATCH4_B4XP_DEFINITIONS } from './augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4REROLL_DEFINITIONS } from './augment-pool-batch4-b4reroll';
import { AUGMENT_BATCH4_B4COMBAT_DEFINITIONS } from './augment-pool-batch4-b4combat';
import { AUGMENT_BATCH2_DEFINITIONS } from './augment-pool-batch2';
import { AUGMENT_BATCH1_DEFINITIONS } from './augment-pool-batch1';
import { AUGMENT_BATCH3_DEFINITIONS } from './augment-pool-batch3';
import { AUGMENT_BATCH3_XP_DEFINITIONS } from './augment-pool-batch3-xp';
import { V20_TEAMUP_AUGMENTS } from './v20-traits';
import { S13_P1_AUGMENTS } from './s13-p1-augments';
import { D11_AUGMENTS } from './d11-fill';
import { P3_AUGMENTS } from './s13-p3';
import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
import { S13_P2_AUGMENTS } from './s13-augments-p2';
export const AUGMENT_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent({
  ...AUGMENT_BATCH1_DEFINITIONS,
  ...AUGMENT_BATCH2_DEFINITIONS,
  ...AUGMENT_BATCH3_DEFINITIONS,
  ...AUGMENT_SHOP_DEFINITIONS,
  ...AUGMENT_BATCH4_B4COMBAT_DEFINITIONS,
  ...AUGMENT_BATCH3_XP_DEFINITIONS,
  ...AUGMENT_BATCH4_DEFINITIONS,
  ...AUGMENT_BATCH5_DEFINITIONS,
  ...AUGMENT_BATCH5_H7_DEFINITIONS,
  ...AUGMENT_BATCH4_B4XP_DEFINITIONS,
  ...AUGMENT_BATCH4_B4REROLL_DEFINITIONS,
  ...V20_TEAMUP_AUGMENTS,
  sisters:{id:'sisters',name:'姐妹',description:'获得蔚和金克丝。两者在场时解锁姐妹：金克丝参与击杀使蔚获得40%攻击力7秒；蔚参与击杀使金克丝获得75%攻速5秒。',effects:[{kind:'mechanic',mechanic:'sistersUnlock',values:{enabled:1}}]},
  ...D11_AUGMENTS,
  ...S13_P1_AUGMENTS,
  ...S13_P2_AUGMENTS,
  ...P3_AUGMENTS,
  "placebo": {
    "id": "placebo",
    "name": "安慰剂",
    "description": "获得时按阶段一次性获得金币：2阶段8、3阶段11、4阶段及以后15；全队获得1%攻速。",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 100
      },
      {
        "kind": "mechanic",
        "mechanic": "acquisitionGold",
        "values": {
          "amount": 8,
          "stage3Amount": 11,
          "stage4Amount": 15
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
  },
  "manaflow-ii": {
    "id": "manaflow-ii",
    "name": "Manaflow II",
    "description": "开战最后一排；每次普攻额外4法力。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "extraAttackMana",
        "values": {
          "amount": 4,
          "backRowOnly": 1
        }
      }
    ]
  },
  "glass-cannon-ii": {
    "id": "glass-cannon-ii",
    "name": "Glass Cannon II",
    "description": "开战最后一排；80%初始生命，20%增伤。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "glassCannon",
        "values": {
          "startingHealthBps": 8000,
          "damageAmpBps": 2000,
          "backRowOnly": 1
        }
      }
    ]
  },
  "pumping-up-ii": {
    "id": "pumping-up-ii",
    "name": "Pumping Up II",
    "description": "基础8%攻速；获得后每轮再加1个百分点。",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 800
      },
      {
        "kind": "mechanic",
        "mechanic": "pumpingUp",
        "values": {
          "attackSpeedBpsPerRound": 100
        }
      }
    ]
  },
  "pumping-up-iii": {
    "id": "pumping-up-iii",
    "name": "Pumping Up III",
    "description": "基础12%攻速；获得后每轮再加2个百分点。",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 1200
      },
      {
        "kind": "mechanic",
        "mechanic": "pumpingUp",
        "values": {
          "attackSpeedBpsPerRound": 200
        }
      }
    ]
  },
  "bulky-buddies-ii": {
    "id": "bulky-buddies-ii",
    "name": "Bulky Buddies II",
    "description": "恰邻接一个友军：175HP；该友军死亡给15%最大HP盾10秒。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "bulkyBuddies",
        "values": {
          "health": 175,
          "shieldMaxHpBps": 1500,
          "durationTicks": 200
        }
      }
    ]
  },
  "bulky-buddies-iii": {
    "id": "bulky-buddies-iii",
    "name": "Bulky Buddies III",
    "description": "恰邻接一个友军：330HP；该友军死亡给18%最大HP盾10秒。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "bulkyBuddies",
        "values": {
          "health": 330,
          "shieldMaxHpBps": 1800,
          "durationTicks": 200
        }
      }
    ]
  },
  "placebo-plus": {
    "id": "placebo-plus",
    "name": "Placebo+",
    "description": "获得时按阶段一次性获得金币：2阶段15、3阶段18、4阶段及以后22；全队获得1%攻速。",
    "effects": [
      {
        "kind": "attackSpeedBps",
        "bps": 100
      },
      {
        "kind": "mechanic",
        "mechanic": "acquisitionGold",
        "values": {
          "amount": 15,
          "stage3Amount": 18,
          "stage4Amount": 22
        }
      }
    ]
  },
  "mentorship-i": {
    "id": "mentorship-i",
    "name": "Mentorship I",
    "description": "邻接至少一个更高费友军：12%AS和150HP；不是按邻居数叠加。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "mentorship",
        "values": {
          "health": 150,
          "attackSpeedBps": 1200
        }
      }
    ]
  },
  "mentorship-ii": {
    "id": "mentorship-ii",
    "name": "Mentorship II",
    "description": "邻接至少一个更高费友军：18%AS和220HP；不是按邻居数叠加。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "mentorship",
        "values": {
          "health": 220,
          "attackSpeedBps": 1800
        }
      }
    ]
  },
  "item-collector-i": {
    "id": "item-collector-i",
    "name": "Item Collector I",
    "description": "全队基础10HP；每种不同穿戴物品全队2HP、1%AD、1AP。原文不限定成装。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "itemCollector",
        "values": {
          "baseHealth": 10,
          "healthPerItem": 2,
          "adBpsPerItem": 100,
          "apCentiPerItem": 100
        }
      }
    ]
  },
  "item-collector-ii": {
    "id": "item-collector-ii",
    "name": "Item Collector II",
    "description": "全队基础20HP；每种不同穿戴物品全队5HP、1.5%AD、1.5AP。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "itemCollector",
        "values": {
          "baseHealth": 20,
          "healthPerItem": 5,
          "adBpsPerItem": 150,
          "apCentiPerItem": 150
        }
      }
    ]
  },
  "bronze-for-life-i": {
    "id": "bronze-for-life-i",
    "name": "Bronze For Life I",
    "description": "每个当前铜级羁绊全队3%增伤；不是所有最低阈值。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "bronzeForLife",
        "values": {
          "damageAmpBps": 300,
          "durabilityBps": 0
        }
      }
    ]
  },
  "bronze-for-life-ii": {
    "id": "bronze-for-life-ii",
    "name": "Bronze For Life II",
    "description": "每个当前铜级羁绊全队3.5%增伤和1.5%坚韧。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "bronzeForLife",
        "values": {
          "damageAmpBps": 350,
          "durabilityBps": 150
        }
      }
    ]
  },
  "little-buddies": {
    "id": "little-buddies",
    "name": "Little Buddies",
    "description": "每个1/2费上场友军，使4/5费友军增加65HP和7%AS；不可误扩到6费。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "littleBuddies",
        "values": {
          "health": 65,
          "attackSpeedBps": 700
        }
      }
    ]
  },
  "backup": {
    "id": "backup",
    "name": "Backup",
    "description": "后两排至少4个友军，全队10%AS。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "backup",
        "values": {
          "minimum": 4,
          "attackSpeedBps": 1000
        }
      }
    ]
  },
  "lineup": {
    "id": "lineup",
    "name": "Lineup",
    "description": "前两排每个友军，全队2.5护甲和魔抗。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "lineup",
        "values": {
          "resistCentiPerUnit": 250
        }
      }
    ]
  },
  "find-your-center": {
    "id": "find-your-center",
    "name": "Find Your Center",
    "description": "中心格开战单位15%增伤和15%最大HP；中心坐标需项目约定。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "findCenter",
        "values": {
          "healthBps": 1500,
          "damageAmpBps": 1500
        }
      }
    ]
  },
  "built-different": {
    "id": "built-different",
    "name": "Built Different",
    "description": "无任何激活羁绊的单位；B补丁stage2/3/4/5+为300/400/500/600HP和45/55/65/75%AS。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "builtDifferent",
        "values": {
          "health2": 300,
          "health3": 400,
          "health4": 500,
          "health5": 600,
          "speed2": 4500,
          "speed3": 5500,
          "speed4": 6500,
          "speed5": 7500
        }
      }
    ]
  },
  "blistering-strikes": {
  "id": "blistering-strikes",
  "name": "Blistering Strikes",
  "description": "普攻施加5秒灼烧与33%重伤，灼烧共造成目标5%最大生命伤害。",
  "effects": [
    {
      "kind": "mechanic",
      "mechanic": "blisteringStrikes",
      "values": {
        "durationTicks": 100,
        "burnBpsPerSecond": 100,
        "woundBps": 3300
      }
    }
  ]
},
  "clockwork-accelerator": {
    "id": "clockwork-accelerator",
    "name": "Clockwork Accelerator",
    "description": "每3秒全队增加10%AS；不是开战即加。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "clockworkAccelerator",
        "values": {
          "attackSpeedBps": 1000,
          "periodTicks": 60
        }
      }
    ]
  },
  "lone-hero": {
    "id": "lone-hero",
    "name": "Lone Hero",
    "description": "最后存活单位140%AS与35%坚韧；持续条件与召唤物计数需约定。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "loneHero",
        "values": {
          "attackSpeedBps": 14000,
          "durabilityBps": 3500
        }
      }
    ]
  },
  "climb-the-ladder-i": {
    "id": "climb-the-ladder-i",
    "name": "Climb The Ladder I",
    "description": "每个友军死亡，和死者共享至少一个羁绊的存活友军+3%AD、3AP、3双抗。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "climbLadder",
        "values": {
          "adBps": 300,
          "abilityPower": 3,
          "armor": 3,
          "magicResist": 3
        }
      }
    ]
  },
  "climb-the-ladder-ii": {
    "id": "climb-the-ladder-ii",
    "name": "Climb The Ladder II",
    "description": "每个友军死亡，和死者共享至少一个羁绊的存活友军+5%AD、5AP、5双抗。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "climbLadder",
        "values": {
          "adBps": 500,
          "abilityPower": 5,
          "armor": 5,
          "magicResist": 5
        }
      }
    ]
  },
  "inspiring-epitaph": {
    "id": "inspiring-epitaph",
    "name": "Inspiring Epitaph",
    "description": "单位死亡，最近友军获得20%最大HP盾及可叠10%AS；raw未给盾持续时间。",
    "effects": [
      {
        "kind": "mechanic",
        "mechanic": "inspiringEpitaph",
        "values": {
          "shieldMaxHpBps": 2000,
          "attackSpeedBps": 1000
        }
      }
    ]
  }
});

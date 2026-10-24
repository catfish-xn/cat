import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** A counter over authoritative battle receipts from the acquisition round onward (inclusive).
 * `every`/`max` name a source value (or `every` is a literal count); `repeat:false` fires once at the first threshold. */
export interface Batch3Schedule {
 readonly counter:'pvp-combat'|'pvp-loss'|'pvp-win'|'allied-deaths'|'round-start'|'stage-start'|'team-healing'|'dummy-deaths'|'dummy-first-death'|'dummy-gold'; readonly every:string|number; readonly repeat:boolean;
 readonly gifts:readonly AugmentGiftSpec[]; readonly gold?:string; readonly max?:string|number;
 /** round-start only: first entry this many rounds after acquisition (default 1). */
 readonly from?:string|number;
 /** Grant one more 1-star copy of the champion drawn by the acquisition gift at this index instead of `gifts`. */
 readonly copyOf?:number;
 /** Support Mining: when this schedule fires, the augment's own training dummy is removed from the roster. */
 readonly retireDummy?:true;
}
interface Batch3Content {
 readonly apiName:string; readonly name:string; readonly tier:'silver'|'gold'|'prismatic'; readonly description:string;
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly gifts:readonly AugmentGiftSpec[]; readonly schedules:readonly Batch3Schedule[];
 /** Free shop rerolls: `now` (a source value) at acquisition, `perRound` per round from the acquisition round. */
 readonly freeRerolls?:{readonly now?:string;readonly perRound?:number};
 /** Superstars: team damage amp of BaseBonusDamage + BonusDamagePer3Star per 3-star ally on the board. */
 readonly superstars?:boolean; readonly gold?:string;
 /** Flexible: every board ally gains HPPerEmblem for each emblem held across the board (P 2026-10-24). */
 readonly flexible?:boolean;
 /** Corrosion: every Time seconds, enemies in their own front two rows lose ResistLoss armor and magic resist. */
 readonly corrosion?:boolean;
 /** Wandering Trainer: this many random emblems (a source value) are permanently attached to the augment's dummy. */
 readonly dummyEmblems?:string;
 /** Replay-authenticated combat mechanics (g2-4b-gold-restore BATCH3_REPLAYED_MECHANICS); values come from the source row. */
 readonly combat?:'blazingSoul'|'nobleSacrifice'|'wealthyRehab'|'badLuck'|'goldForDummies';
}
/** classification.json batch 3, group 3a-1: grants scheduled by player-combat count, player-combat results or allied deaths.
 * Every count and reward is the 14.24 zh_cn/en_us source value. Three readings are project conventions (P 2026-10-24,
 * docs/S13_RULES_GAP.md): Eye for an Eye+'s max 3 caps the death-based components only; Prizefighter counts player-combat
 * wins; Shimmerscale Essence's "in 5 rounds" (CombatNum) counts player combats.
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH3:Readonly<Record<string,Batch3Content>>=freezeContent({
 "support-mining": {
  "apiName": "TFT_Augment_SupportMining",
  "name": "辅助挖矿",
  "tier": "silver",
  "description": "获得1个【训练假人】。当它阵亡7次时，获得1个随机辅助装并移除该训练假人。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "NumDeaths": 7.0
   },
   "description_en_us": "Gain a Training Dummy. When it dies 7 times, gain a random Support Item and remove the Training Dummy."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-deaths",
    "every": "NumDeaths",
    "repeat": false,
    "retireDummy": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "support",
      "count": 1
     }
    ]
   }
  ]
 },
 "support-mining-plus": {
  "apiName": "TFT_Augment_SupportMiningPlus",
  "name": "辅助挖矿+",
  "tier": "silver",
  "description": "获得1个【训练假人】。当它阵亡4次时，获得1个随机辅助装并移除该训练假人。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "NumDeaths": 4.0
   },
   "description_en_us": "Gain a Training Dummy. When it dies 4 times, gain a random Support Item and remove the Training Dummy."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-deaths",
    "every": "NumDeaths",
    "repeat": false,
    "retireDummy": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "support",
      "count": 1
     }
    ]
   }
  ]
 },
 "scapegoat": {
  "apiName": "TFT10_Augment_Scapegoat",
  "name": "替罪羊",
  "tier": "gold",
  "description": "获得1个【训练假人】和4金币。如果这个假人在玩家对战回合中第一个阵亡，就会获得1金币。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0,
    "InitialGold": 4.0
   },
   "description_en_us": "Gain a Training Dummy and 4 gold. If it is the first to die each player combat, gain 1 gold."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-first-death",
    "every": 1,
    "repeat": true,
    "gold": "Gold",
    "gifts": []
   }
  ],
  "gold": "InitialGold"
 },
 "wandering-trainer-i": {
  "apiName": "TFT11_Augment_WanderingTrainerGold",
  "name": "漫游训练师 I",
  "tier": "gold",
  "description": "获得1金币和1个携带着2个永久附着的纹章的【训练假人】。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0,
    "NumOfEmblems": 2.0
   },
   "description_en_us": "Gain 1 gold and a Training Dummy with 2 permanently attached Emblems."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [],
  "gold": "Gold",
  "dummyEmblems": "NumOfEmblems"
 },
 "wandering-trainer-ii": {
  "apiName": "TFT9_Augment_WanderingTrainer",
  "name": "漫游训练师 II",
  "tier": "prismatic",
  "description": "获得6金币和1个携带着3个永久附着的纹章的【训练假人】。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 6.0,
    "NumOfEmblems": 3.0
   },
   "description_en_us": "Gain 6 gold and a Training Dummy with 3 permanently attached Emblems."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [],
  "gold": "Gold",
  "dummyEmblems": "NumOfEmblems"
 },
 "gold-for-dummies": {
  "apiName": "TFT_Augment_GoldForDummies",
  "name": "假人金币",
  "tier": "gold",
  "description": "获得1个【训练假人】。每10秒，所有【训练假人】提供1金币.",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "GoldAmount": 1.0,
    "GoldDuration": 10.0
   },
   "description_en_us": "Gain a Training Dummy. Every 10 seconds, all Training Dummies grant 1 gold."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-gold",
    "every": 1,
    "repeat": true,
    "gold": "GoldAmount",
    "gifts": []
   }
  ],
  "combat": "goldForDummies"
 },
 "bad-luck-protection": {
  "apiName": "TFT_Augment_BadLuckProtection",
  "name": "厄运保护",
  "tier": "gold",
  "description": "己方弈子们无法再造成暴击。将每1%暴击几率转化为1%攻击力。获得1个【拳套】。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ADPerCrit": 0.009999999776482582,
    "CritChancePercent": 1.0,
    "{1a2d5ea3}": null
   },
   "description_en_us": "Your team can no longer critically strike. Convert each 1% Critical Strike Chance into 1% Attack Damage. Gain a Sparring Gloves."
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "gloves"
   }
  ],
  "schedules": [],
  "combat": "badLuck"
 },
 "blazing-soul-i": {
  "apiName": "TFT_Augment_BlazingSoul",
  "name": "炽热灵魂 I",
  "tier": "gold",
  "description": "战斗开始时：你攻击速度最高的那个弈子获得20法术强度和20%攻击速度。每过3秒，在另一名己方弈子身上重复此效果。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AbilityPower": 20.0,
    "AttackSpeed": 0.20000000298023224,
    "TransferDuration": 3.0
   },
   "description_en_us": "Combat start: Your highest Attack Speed champion gains 20 Ability Power and 20% Attack Speed. Repeat on another ally every 3 seconds."
  },
  "gifts": [],
  "schedules": [],
  "combat": "blazingSoul"
 },
 "blazing-soul-ii": {
  "apiName": "TFT_Augment_BlazingSoul2",
  "name": "炽热灵魂 II",
  "tier": "prismatic",
  "description": "战斗开始时：你攻击速度最高的那个弈子获得35法术强度和30%攻击速度。每过3秒，在另一名己方弈子身上重复此效果。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AbilityPower": 35.0,
    "AttackSpeed": 0.30000001192092896,
    "TransferDuration": 3.0
   },
   "description_en_us": "Combat start: Your highest Attack Speed champion gains 35 Ability Power and 30% Attack Speed. Repeat on another ally every 3 seconds."
  },
  "gifts": [],
  "schedules": [],
  "combat": "blazingSoul"
 },
 "noble-sacrifice": {
  "apiName": "TFT_Augment_NobleSacrifice",
  "name": "高贵牺牲",
  "tier": "gold",
  "description": "每当你的第一个友军在对战中阵亡时，给予己方弈子们25 + 该友军10%的护甲和魔抗。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BaseResists": 25.0,
    "SharePerc": 0.10000000149011612
   },
   "description_en_us": "When your first ally dies each combat, grant your team 25 + 10% of that ally's Armor and Magic Resistance."
  },
  "gifts": [],
  "schedules": [],
  "combat": "nobleSacrifice"
 },
 "wealthy-rehab-i": {
  "apiName": "TFT_Augment_WealthyRehab1",
  "name": "健康就是财富 I",
  "tier": "silver",
  "description": "你的弈子们获得10%全能吸血。当己方的弈子总治疗量首次达到10000时，获得额外的8金币。\n\n累积总治疗量：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 8.0,
    "HealingThreshold": 10000.0,
    "Omnivamp": 0.10000000149011612
   },
   "description_en_us": "Your team gains 10% Omnivamp.  Get a bonus of 8 gold when your team first accumulates 10000 total champion healing.\n\nTotal Healing: 〔对局动态值〕"
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "team-healing",
    "every": "HealingThreshold",
    "repeat": false,
    "gold": "Gold",
    "gifts": []
   }
  ],
  "combat": "wealthyRehab"
 },
 "wealthy-rehab-ii": {
  "apiName": "TFT_Augment_WealthyRehab2",
  "name": "健康就是财富 II",
  "tier": "gold",
  "description": "你的弈子们获得15%全能吸血。当己方的弈子总治疗量首次达到10000时，获得额外的15金币。\n\n累积总治疗量：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 15.0,
    "HealingThreshold": 10000.0,
    "Omnivamp": 0.15000000596046448
   },
   "description_en_us": "Your team gains 15% Omnivamp.  Get a bonus of 15 gold when your team first accumulates 10000 total champion healing.\n\nTotal Healing: 〔对局动态值〕"
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "team-healing",
    "every": "HealingThreshold",
    "repeat": false,
    "gold": "Gold",
    "gifts": []
   }
  ],
  "combat": "wealthyRehab"
 },


 "corrosion": {
  "apiName": "TFT_Augment_Corrosion",
  "name": "腐蚀",
  "tier": "silver",
  "description": "前两排的敌方弈子们每2秒损失3护甲和魔抗。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ResistLoss": 3.0,
    "Time": 2.0
   },
   "description_en_us": "Enemy champions in the first two rows lose 3 Armor and Magic Resist every 2 seconds."
  },
  "gifts": [],
  "schedules": [],
  "corrosion": true
 },
 "building-a-collection-iii": {
  "apiName": "TFT9_Augment_BuildingACollectionPlusPlus",
  "name": "珍藏财宝 III",
  "tier": "prismatic",
  "description": "接下来的6个回合(包括这个回合)在开始时都会获得一件随机的基础装备。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": null,
    "roundsofbonusitems": 6.0
   },
   "description_en_us": "Gain a random item component at the start of the next 6 rounds (including this round)."
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "component",
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "round-start",
    "every": 1,
    "repeat": true,
    "max": 5,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "worth-the-wait": {
  "apiName": "TFT_Augment_WorthTheWaitGold",
  "name": "值得等待",
  "tier": "gold",
  "description": "获得1个随机的2星1费弈子。在2个回合后，每回合开始时都会获得该弈子的又一个1星版本，持续至本局游戏结束。\n\n弈子：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AdditionalCopies": 99.0,
    "Delay": 2.0,
    "UnitTier": 1.0,
    "{3a9ff59a}": 3.0
   },
   "description_en_us": "Gain a random two-star 1-cost champion. After 2 rounds, gain another copy of them at the start of each round for the rest of the game.\n\nChampion: 〔对局动态值〕"
  },
  "gifts": [
   {
    "kind": "random-unit",
    "cost": 1,
    "count": 1,
    "starLevel": 2
   }
  ],
  "schedules": [
   {
    "counter": "round-start",
    "every": 1,
    "repeat": true,
    "from": "Delay",
    "max": "AdditionalCopies",
    "copyOf": 0,
    "gifts": []
   }
  ]
 },
 "worth-the-wait-ii": {
  "apiName": "TFT_Augment_WorthTheWaitPrismatic",
  "name": "值得等待 II",
  "tier": "prismatic",
  "description": "获得1个随机的2费弈子。每回合开始时都会获得该弈子的又一个1星版本，持续至本局游戏结束。\n\n弈子：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AdditionalCopies": 99.0,
    "Delay": null,
    "UnitTier": 2.0,
    "{3a9ff59a}": 1.0
   },
   "description_en_us": "Gain a random 2-cost champion. Gain another copy of them at the start of each round for the rest of the game.\n\nChampion: 〔对局动态值〕"
  },
  "gifts": [
   {
    "kind": "random-unit",
    "cost": 2,
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "round-start",
    "every": 1,
    "repeat": true,
    "max": "AdditionalCopies",
    "copyOf": 0,
    "gifts": []
   }
  ]
 },
 "flexible": {
  "apiName": "TFT_Augment_Flexible",
  "name": "灵活摇摆",
  "tier": "prismatic",
  "description": "获得1个随机纹章。在每个阶段开始时，获得一个随机纹章。每携带一个纹章，你的弈子们就会获得40生命值。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BonusStages": 99.0,
    "HPPerEmblem": 40.0,
    "StartingEmblems": 1.0
   },
   "description_en_us": "Gain 1 random emblem. At the start of every Stage, gain a random emblem. Your team gains 40 Health for each emblem they are holding."
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "emblem",
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "stage-start",
    "every": 1,
    "repeat": true,
    "max": "BonusStages",
    "gifts": [
     {
      "kind": "random-item",
      "pool": "emblem",
      "count": 1
     }
    ]
   }
  ],
  "flexible": true
 },
 "rolling-for-days-i": {
  "apiName": "TFT9_Augment_Commander_RollingForDays",
  "name": "D个痛快！ I",
  "tier": "silver",
  "description": "获得11次免费刷新。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numrolls": 11.0
   },
   "description_en_us": "Gain 11 free Shop rerolls."
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "now": "Numrolls"
  }
 },
 "superstars-i": {
  "apiName": "TFT_Augment_SuperstarsSilver",
  "name": "超级巨星 I",
  "tier": "silver",
  "description": "己方弈子造成5%额外伤害，并且队伍中每拥有1个3星英雄，此加成就会提升2%。获得2次刷新。\n\n加成：〔对局动态值〕%",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BaseBonusDamage": 0.05000000074505806,
    "BonusDamagePer3Star": 0.019999999552965164,
    "Rerolls": 2.0
   },
   "description_en_us": "Your team deals 5% more damage, increased by 2% for every 3-star champion on your team. Gain 2 rerolls.\n\nBonus: 〔对局动态值〕%"
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "now": "Rerolls"
  },
  "superstars": true
 },
 "superstars-ii": {
  "apiName": "TFT_Augment_Superstars",
  "name": "超级巨星 II",
  "tier": "gold",
  "description": "己方弈子造成7%额外伤害，并且队伍中每拥有1个3星英雄，此加成就会提升5%。获得4次刷新。\n\n加成：〔对局动态值〕%",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BaseBonusDamage": 0.07000000029802322,
    "BonusDamagePer3Star": 0.05000000074505806,
    "Rerolls": 4.0
   },
   "description_en_us": "Your team deals 7% more damage, increased by 5% for every 3-star champion on your team. Gain 4 rerolls.\n\nBonus: 〔对局动态值〕%"
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "now": "Rerolls"
  },
  "superstars": true
 },
 "trade-sector": {
  "apiName": "TFT6_Augment_TradeSector",
  "name": "DD街区",
  "tier": "gold",
  "description": "每回合获得1次免费的商店刷新。获得1金币。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0
   },
   "description_en_us": "Gain a free Shop reroll every round. Gain 1 gold."
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "perRound": 1
  },
  "gold": "Gold"
 },
 "eye-for-an-eye-plus": {
  "apiName": "TFT_Augment_EyeForAnEyePlus",
  "name": "以眼还眼+",
  "tier": "silver",
  "description": "获得1件随机基础装备。每阵亡13名己方弈子，获得另一件基础装备(最多3件)。\n\n剩余阵亡数：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AllyDeaths": 13.0,
    "NumComponents": 3.0,
    "{a6cb80ca}": 1.0
   },
   "description_en_us": "Gain a random component. For every 13 ally champions that die, gain another component (max 3).\n\nDeaths Remaining: 〔对局动态值〕"
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "component",
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "allied-deaths",
    "every": "AllyDeaths",
    "max": "NumComponents",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "prizefighter": {
  "apiName": "TFT11_Augment_Prizefighter",
  "name": "赏金战士",
  "tier": "gold",
  "description": "获得2件基础装备。每赢得5场胜利，你就会获得1件基础装备。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "WinsNeeded": 5.0,
    "component": 2.0
   },
   "description_en_us": "Gain 2 item components. Every 5 wins gives you an item component."
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "component",
    "count": 2
   }
  ],
  "schedules": [
   {
    "counter": "pvp-win",
    "every": "WinsNeeded",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "shimmerscale-essence": {
  "apiName": "TFT_Augment_ShimmerscaleEssence",
  "name": "金鳞精粹",
  "tier": "prismatic",
  "description": "获得1个【大亨之铠】。在5回合内，获得1个【投机者之刃】。\n\n这些装备会在提供战斗力的同时给予金币。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 5.0
   },
   "description_en_us": "Gain a Mogul's Mail. In 5 rounds, gain a Gamblers Blade.\n\nThese items give gold as well as combat power."
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT7_Item_ShimmerscaleMogulsMail"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT7_Item_ShimmerscaleGamblersBlade"
     }
    ]
   }
  ]
 },
 "eye-for-an-eye": {
  "apiName": "TFT_Augment_EyeForAnEye",
  "name": "以眼还眼",
  "tier": "silver",
  "description": "每阵亡15名己方弈子，获得一件随机基础装备(最多4件)。\n\n剩余阵亡数：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AllyDeaths": 15.0,
    "NumComponents": 4.0,
    "{a6cb80ca}": null
   },
   "description_en_us": "For every 15 ally champions that die, gain a random component (max 4).\n\nDeaths Remaining: 〔对局动态值〕"
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "allied-deaths",
    "every": "AllyDeaths",
    "max": "NumComponents",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "team-building": {
  "apiName": "TFT9_Augment_ArmyBuilding",
  "name": "团队建设",
  "tier": "silver",
  "description": "获得1个【次级英雄复制器】。在7个玩家对战回合后获得另一个。\n\n这个物品允许你能复制一个3费或以下的弈子。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "PlayerCombatNum": 7.0
   },
   "description_en_us": "Gain a Lesser Champion Duplicator. Gain another after 7 player combats.\n\nThis item allows you to copy a 3-cost or less champion."
  },
  "gifts": [
   {
    "kind": "consumable",
    "definitionId": "TFT_Consumable_ChampionDuplicator_III"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "PlayerCombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "consumable",
      "definitionId": "TFT_Consumable_ChampionDuplicator_III"
     }
    ]
   }
  ]
 },
 "latent-forge": {
  "apiName": "TFT9_Augment_LongTimeCrafting",
  "name": "休眠锻炉",
  "tier": "silver",
  "description": "在8个玩家对战后，获得1个【神器锻造器】。\n\n这个锻造器提供4个选项。神器是可以提供独特效果的强力装备。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numberofcombats": 8.0
   },
   "description_en_us": "After 8 player combats, gain an Artifact anvil. \n\nThe anvil offers 4 choices. Artifacts are more powerful items with a unique effect."
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "Numberofcombats",
    "repeat": false,
    "gifts": [
     {
      "kind": "unit",
      "definitionId": "TFT_ArmoryKeyOrnn"
     }
    ]
   }
  ]
 },
 "phreaky-friday": {
  "apiName": "TFT9_Augment_PhreakyFriday",
  "name": "成吨的伤害",
  "tier": "prismatic",
  "description": "获得1个【三相之力】。在5个玩家对战回合后，获得另一个【三相之力】。\n\n【三相之力】：一件神器，可以提供成吨的攻击和防御属性。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 5.0
   },
   "description_en_us": "Gain an Infinity Force. After 5 player combats, gain another.\n\nInfinity Force: Artifact that offers tons of offensive and defensive stats"
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT4_Item_OrnnInfinityForce"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT4_Item_OrnnInfinityForce"
     }
    ]
   }
  ]
 },
 "phreaky-friday-plus": {
  "apiName": "TFT9_Augment_PhreakyFridayPlus",
  "name": "成吨的伤害+",
  "tier": "prismatic",
  "description": "获得1个【三相之力】。在3个玩家对战回合后，获得另一个【三相之力】。\n\n【三相之力】：一件神器，可以提供成吨的攻击和防御属性。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 3.0
   },
   "description_en_us": "Gain an Infinity Force. After 3 player combats, gain another.\n\nInfinity Force: Artifact that offers tons of offensive and defensive stats"
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT4_Item_OrnnInfinityForce"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT4_Item_OrnnInfinityForce"
     }
    ]
   }
  ]
 },
 "dark-alley-dealings": {
  "apiName": "TFT_Augment_DarkAlleyDealings",
  "name": "暗巷交易",
  "tier": "prismatic",
  "description": "获得1个【迷离风衣】。在3个玩家对战回合后，获得一个【诡术师之镜】。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 3.0
   },
   "description_en_us": "Gain a Suspicious Trenchcoat. After 3 player combats, gain a Trickster's Glass."
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT_Item_Artifact_SuspiciousTrenchCoat"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT9_Item_OrnnTrickstersGlass"
     }
    ]
   }
  ]
 },
 "living-forge": {
  "apiName": "TFT7_Augment_LivingForge",
  "name": "活体锻炉",
  "tier": "prismatic",
  "description": "立刻以及之后的每9个玩家对战回合后获得1个【神器锻造器】。\n\n神器是可以提供独特效果的强力装备。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numberofcombats": 9.0
   },
   "description_en_us": "Gain an Artifact anvil now and after every 9 player combats.\n\nArtifacts are more powerful items with a unique effect."
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "TFT_ArmoryKeyOrnn"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "Numberofcombats",
    "repeat": true,
    "gifts": [
     {
      "kind": "unit",
      "definitionId": "TFT_ArmoryKeyOrnn"
     }
    ]
   }
  ]
 },
 "what-doesnt-kill-you": {
  "apiName": "TFT9_Augment_WhatDoesntKillYou",
  "name": "在失败中变强",
  "tier": "gold",
  "description": "在输掉一个玩家对战回合后获得2金币。每4次失败之后，获得1个随机基础装备。\n\n下一件基础装备还需要的失败次数：〔对局动态值〕",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 2.0,
    "RoundsPerComponent": 4.0
   },
   "description_en_us": "Gain 2 gold after losing a player combat. Gain a random component after every 4 losses.\n\nLosses until next component: 〔对局动态值〕"
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "pvp-loss",
    "every": 1,
    "repeat": true,
    "gold": "Gold",
    "gifts": []
   },
   {
    "counter": "pvp-loss",
    "every": "RoundsPerComponent",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 }
});
export function batch3Count(row:Batch3Content,key:string|number):number {
 const n=typeof key==='number'?key:row.source.values[key];
 if(!Number.isSafeInteger(n)||n!<1)throw new RangeError(`Batch3 source value ${String(key)}`);return n!;
}
function batch3CombatValues(row:Batch3Content):Record<string,number> {
 const bps=(key:string)=>Math.round(row.source.values[key]!*10000);
 switch(row.combat){
  case 'blazingSoul':return {abilityPower:batch3Count(row,'AbilityPower'),attackSpeedBps:bps('AttackSpeed'),periodTicks:batch3Count(row,'TransferDuration')*20};
  case 'badLuck':return {ratioBps:Math.round(row.source.values.ADPerCrit!*10000/row.source.values.CritChancePercent!*100)};
  case 'goldForDummies':return {periodTicks:batch3Count(row,'GoldDuration')*20};
  case 'nobleSacrifice':return {baseResists:batch3Count(row,'BaseResists'),shareBps:bps('SharePerc')};
  default:return {omnivampBps:bps('Omnivamp')};
 }
}
export const AUGMENT_BATCH3_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:batch3Count(row,row.gold)}}]:[]),
  ...(row.combat?[{kind:'mechanic' as const,mechanic:row.combat,values:batch3CombatValues(row)}]:[]),
  ...(row.corrosion?[{kind:'mechanic' as const,mechanic:'corrosion',values:{resistLoss:batch3Count(row,'ResistLoss'),periodTicks:batch3Count(row,'Time')*20}}]:[]),
  ...(row.flexible?[{kind:'mechanic' as const,mechanic:'flexible',values:{healthPerEmblem:batch3Count(row,'HPPerEmblem')}}]:[]),
  ...(row.superstars?[{kind:'mechanic' as const,mechanic:'superstars',values:{baseBps:Math.round(row.source.values.BaseBonusDamage!*10000),per3StarBps:Math.round(row.source.values.BonusDamagePer3Star!*10000)}}]:[])],
}])));
export const AUGMENT_BATCH3_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH3_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row])=>[id,row.apiName])));

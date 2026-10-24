import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

interface Batch1Content {
 readonly apiName:string; readonly name:string; readonly tier:'silver'|'gold'|'prismatic'; readonly description:string;
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly gifts:readonly AugmentGiftSpec[]; readonly gold?:number; readonly xp?:number; readonly roundGold?:number;
}
/** 14.24 zh_cn/en_us source values and resolved descriptions, kept alongside each executable gift plan.
 * Counts not present in effectAmounts are stated explicitly in the source description (e.g. Final Polish).
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH1:Readonly<Record<string,Batch1Content>> = freezeContent({
  "coronation": {
  "apiName": "TFT_Augment_Coronation",
  "name": "加冕礼",
  "tier": "prismatic",
  "description": "获得1个【金铲铲冠冕】。【金铲铲冠冕】、【金锅锅冠冕】和【金锅铲冠冕】将为携带者提供额外的30%攻击速度、30%攻击力和40法术强度。",
  "source": {
    "patch": "14.24",
    "archive": "augments-research-2026-10-23/data/augments-14.24.json",
    "values": {
      "BonusAD": 0.30000001192092896,
      "BonusAP": 40.0,
      "BonusAS": 0.30000001192092896
    },
    "description_en_us": "Gain a Tactician's Crown. Tactician's Crown, Shield, and Cape grant the holder an additional 30% Attack Speed, 30% Attack Damage, and 40 Ability Power."
  },
  "gifts": [
    {
      "kind": "item",
      "definitionId": "TFT_Item_ForceOfNature"
    }
  ]
},
  "tacticians-kitchen": {
  "apiName": "TFT_Augment_TacticiansKitchen",
  "name": "锅铲厨房",
  "tier": "prismatic",
  "description": "获得1个【金锅铲冠冕】和1个随机纹章。",
  "source": {
    "patch": "14.24",
    "archive": "augments-research-2026-10-23/data/augments-14.24.json",
    "values": {
      "NumFryingPan": 1.0,
      "NumItemAnvils": 1.0,
      "NumSpatula": 1.0
    },
    "description_en_us": "Gain a Tactician's Cape and a random Emblem."
  },
  "gifts": [
    {
      "kind": "item",
      "definitionId": "TFT_Item_TacticiansRing"
    },
    {
      "kind": "random-item",
      "pool": "emblem",
      "count": 1
    }
  ]
},
  "branching-out": {
  "apiName": "TFT_Augment_BranchingOut",
  "name": "节外生枝",
  "tier": "silver",
  "description": "提供1个随机【纹章】和1个【装备重铸器】。\n\n【装备重铸器】允许你将任一装备随机成另一件装备。",
  "source": {
    "patch": "14.24",
    "archive": "augments-research-2026-10-23/data/augments-14.24.json",
    "values": {
      "Numberofcombats": null
    },
    "description_en_us": "Gain a random Emblem and a Reforger.\n\nReforgers allow you to remake any item."
  },
  "gifts": [
    {
      "kind": "random-item",
      "pool": "emblem",
      "count": 1
    },
    {
      "kind": "consumable",
      "definitionId": "reforger",
      "count": 1
    }
  ]
},
  "item-grab-bag-i": {
    "apiName": "TFT6_Augment_ItemGrabBag1",
    "name": "百宝袋 I",
    "tier": "silver",
    "description": "提供1件随机成装。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumItems": 1.0
      },
      "description_en_us": "Gain 1 random completed item."
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "completed",
        "count": 1
      }
    ]
  },
  "one-two-five": {
    "apiName": "TFT6_Augment_OneTwoFive",
    "name": "一，二，五！",
    "tier": "silver",
    "description": "获得1个随机的基础装备、2金币、和1个随机的5费弈子。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 2.0,
        "NumChamps": 1.0,
        "NumComponents": 1.0
      },
      "description_en_us": "Gain 1 random component, 2 gold, and 1 random 5-cost champion."
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 1
      },
      {
        "kind": "random-unit",
        "cost": 5,
        "count": 1
      }
    ],
    "gold": 2
  },
  "band-of-thieves-i": {
    "apiName": "TFT7_Augment_BandOfThieves1",
    "name": "窃贼帮派 I",
    "tier": "silver",
    "description": "提供1个【窃贼手套】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumGloves": 1.0
      },
      "description_en_us": "Gain 1 Thief's Gloves."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "thiefs-gloves"
      }
    ]
  },
  "teaming-up-i": {
    "apiName": "TFT9_Augment_Commander_TeamingUp1",
    "name": "成群结队 I",
    "tier": "silver",
    "description": "获得1件随机基础装备和2个随机3阶英雄。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumChamps": 2.0,
        "NumComponents": 1.0
      },
      "description_en_us": "Gain 1 random component and 2 random Tier 3 champions."
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 1
      },
      {
        "kind": "random-unit",
        "cost": 3,
        "count": 2
      }
    ]
  },
  "iron-assets": {
    "apiName": "TFT9_Augment_IronAssets",
    "name": "黑铁资产",
    "tier": "silver",
    "description": "获得1个【基础装备锻造器】和4金币。\n\n这个锻造器提供4个选项。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 4.0
      },
      "description_en_us": "Gain a component anvil and 4 gold.\n\nThe anvil offers 4 choices."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyComponent"
      }
    ],
    "gold": 4
  },
  "missed-connections": {
    "apiName": "TFT9_Augment_MissedConnections",
    "name": "别再错过",
    "tier": "silver",
    "description": "获得每个1费弈子各1个。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a copy of each 1-cost champion."
    },
    "gifts": [
      {
        "kind": "all-units",
        "cost": 1
      }
    ]
  },
  "ones-twos-three": {
    "apiName": "TFT9_Augment_OneTwosThree",
    "name": "一二二三",
    "tier": "silver",
    "description": "获得2个1费弈子，2个2费弈子和1个3费弈子。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumChamps": 2.0,
        "tier1champs": 2.0
      },
      "description_en_us": "Gain 2 1-cost champion, 2 2-cost champions, and 1 3-cost champion."
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 2
      },
      {
        "kind": "random-unit",
        "cost": 2,
        "count": 2
      },
      {
        "kind": "random-unit",
        "cost": 3,
        "count": 1
      }
    ]
  },
  "silver-spoon": {
    "apiName": "TFT9_Augment_SilverSpoon",
    "name": "银汤匙",
    "tier": "silver",
    "description": "获得10经验值。\n",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Experience": 10.0
      },
      "description_en_us": "Gain 10 XP.\n"
    },
    "gifts": [],
    "xp": 10
  },
  "heroic-grab-bag": {
    "apiName": "TFT10_Augment_HeroicGrabBag",
    "name": "英勇福袋",
    "tier": "gold",
    "description": "获得2个【次级英雄复制器】和9金币。\n\n这个物品允许你能复制一个3费或以下的弈子。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 9.0,
        "LesserDuplicatorAmount": 2.0
      },
      "description_en_us": "Gain 2 Lesser Champion Duplicators and 9 gold.\n\nThis item allows you to copy a 3-cost or less champion."
    },
    "gifts": [
      {
        "kind": "consumable",
        "definitionId": "TFT_Consumable_ChampionDuplicator_III",
        "count": 2
      }
    ],
    "gold": 9
  },
  "raining-gold": {
    "apiName": "TFT11_Augment_RainingGold",
    "name": "天降金币",
    "tier": "gold",
    "description": "即刻获得8金币，并且每回合获得1金币。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "InstantGold": 8.0,
        "RoundGold": 1.0
      },
      "description_en_us": "Gain 8 gold now and 1 gold every round."
    },
    "gifts": [],
    "gold": 8,
    "roundGold": 1
  },
  "raining-gold-plus": {
    "apiName": "TFT11_Augment_RainingGoldPlus",
    "name": "天降金币+",
    "tier": "gold",
    "description": "即刻获得18金币，并且每回合获得1金币。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "InstantGold": 18.0,
        "RoundGold": 1.0
      },
      "description_en_us": "Gain 18 gold now and 1 gold every round."
    },
    "gifts": [],
    "gold": 18,
    "roundGold": 1
  },
  "academy-crest": {
    "apiName": "TFT13_Augment_AcademyCrest",
    "name": "皮城学院之徽",
    "tier": "gold",
    "description": "获得1个【皮城学院纹章】和1个【蕾欧娜】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Academy Emblem and a Leona."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AcademyEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "leona"
      }
    ]
  },
  "ambusher-crest": {
    "apiName": "TFT13_Augment_AmbusherCrest",
    "name": "伏击专家之徽",
    "tier": "gold",
    "description": "获得1个【伏击专家纹章】和1个【卡蜜尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Ambusher Emblem and a Camille."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AmbusherEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "camille"
      }
    ]
  },
  "artillerist-crest": {
    "apiName": "TFT13_Augment_ArtilleristCrest",
    "name": "炮手之徽",
    "tier": "gold",
    "description": "获得1个【炮手纹章】和1个【崔丝塔娜】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Artillerist Emblem and a Tristana."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_DemolitionistEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "tristana"
      }
    ]
  },
  "automata-crest": {
    "apiName": "TFT13_Augment_AutomataCrest",
    "name": "海克斯机械之徽",
    "tier": "gold",
    "description": "获得1个【海克斯机械纹章】和1个【魔腾】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Automata Emblem and a Nocturne."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AutomataEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ]
  },
  "bruiser-crest": {
    "apiName": "TFT13_Augment_BruiserCrest",
    "name": "格斗家之徽",
    "tier": "gold",
    "description": "获得1个【格斗家纹章】和1个【瑟提】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Bruiser Emblem and a Sett."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_BruiserEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "sett"
      }
    ]
  },
  "black-rose-crest": {
    "apiName": "TFT13_Augment_CabalCrest",
    "name": "黑色玫瑰之徽",
    "tier": "gold",
    "description": "获得1个【黑色玫瑰纹章】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Black Rose Emblem."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CabalEmblemItem"
      }
    ]
  },
  "chem-baron-crest": {
    "apiName": "TFT13_Augment_ChembaronCrest",
    "name": "炼金男爵之徽",
    "tier": "gold",
    "description": "获得1个【炼金男爵纹章】和1个【烈娜塔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Chem-Baron Emblem and a Renata Glasc."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CrimeEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "renata"
      }
    ]
  },
  "conqueror-crest": {
    "apiName": "TFT13_Augment_ConquerorCrest",
    "name": "铁血征服者之徽",
    "tier": "gold",
    "description": "获得1个【铁血征服者纹章】和1个【芮尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Conqueror Emblem and a Rell."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WarbandEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "rell"
      }
    ]
  },
  "dominator-crest": {
    "apiName": "TFT13_Augment_DominatorCrest",
    "name": "统领之徽",
    "tier": "gold",
    "description": "获得1个【统领纹章】和1个【布里茨】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Dominator Emblem and a Blitzcrank."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InfusedEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "blitzcrank"
      }
    ]
  },
  "enforcer-crest": {
    "apiName": "TFT13_Augment_EnforcerCrest",
    "name": "执法官之徽",
    "tier": "gold",
    "description": "获得1个【执法官纹章】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Enforcer Emblem."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SquadEmblemItem"
      }
    ]
  },
  "experiment-crest": {
    "apiName": "TFT13_Augment_ExperimentCrest",
    "name": "试验品之徽",
    "tier": "gold",
    "description": "获得1个【试验品纹章】和1个【厄加特】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Experiment Emblem and an Urgot."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ExperimentEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ]
  },
  "family-crest": {
    "apiName": "TFT13_Augment_FamilyCrest",
    "name": "家人之徽",
    "tier": "gold",
    "description": "获得1个【家人纹章】和1个【蔚奥莱】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Family Emblem and a Violet."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_FamilyEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "violet"
      }
    ]
  },
  "firelight-crest": {
    "apiName": "TFT13_Augment_FirelightCrest",
    "name": "野火帮之徽",
    "tier": "gold",
    "description": "获得1个【野火帮纹章】和1个【泽丽】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Firelight Emblem and a Zeri."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_HoverboardEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "zeri"
      }
    ]
  },
  "pit-fighter-crest": {
    "apiName": "TFT13_Augment_PitFighterCrest",
    "name": "搏击手之徽",
    "tier": "gold",
    "description": "获得1个【搏击手纹章】和1个【厄加特】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Pit Fighter Emblem and an Urgot."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_PitFighterEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ]
  },
  "quickstriker-crest": {
    "apiName": "TFT13_Augment_QuickstrikerCrest",
    "name": "迅击战士之徽",
    "tier": "gold",
    "description": "获得1个【迅击战士纹章】和1个【阿卡丽】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Quickstriker Emblem and an Akali."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ChallengerEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ]
  },
  "rebel-crest": {
    "apiName": "TFT13_Augment_RebelCrest",
    "name": "蓝发小队之徽",
    "tier": "gold",
    "description": "获得1个【蓝发小队纹章】和1个【阿卡丽】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Rebel Emblem and an Akali."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_RebelEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ]
  },
  "scrap-crest": {
    "apiName": "TFT13_Augment_ScrapCrest",
    "name": "极客之徽",
    "tier": "gold",
    "description": "获得1个【极客纹章】和1个【吉格斯】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Scrap Emblem and a Ziggs."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ScrapEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "ziggs"
      }
    ]
  },
  "sentinel-crest": {
    "apiName": "TFT13_Augment_SentinelCrest",
    "name": "哨兵之徽",
    "tier": "gold",
    "description": "获得1个【哨兵纹章】和1个【芮尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Sentinel Emblem and a Rell."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_TitanEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "rell"
      }
    ]
  },
  "sniper-crest": {
    "apiName": "TFT13_Augment_SniperCrest",
    "name": "狙神之徽",
    "tier": "gold",
    "description": "获得1个【狙神纹章】和1个【泽丽】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Sniper Emblem and a Zeri."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SniperEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "zeri"
      }
    ]
  },
  "sorcerer-crest": {
    "apiName": "TFT13_Augment_SorcererCrest",
    "name": "法师之徽",
    "tier": "gold",
    "description": "获得1个【法师纹章】和1个【弗拉基米尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Sorcerer Emblem and a Vladimir."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SorcererEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "vladimir"
      }
    ]
  },
  "visionary-crest": {
    "apiName": "TFT13_Augment_VisionaryCrest",
    "name": "先知之徽",
    "tier": "gold",
    "description": "获得1个【先知纹章】和1个【烈娜塔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Visionary Emblem and a Renata Glasc."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InvokerEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "renata"
      }
    ]
  },
  "watcher-crest": {
    "apiName": "TFT13_Augment_WatcherCrest",
    "name": "监察之徽",
    "tier": "gold",
    "description": "获得1个【监察纹章】和1个【范德尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Watcher Emblem and a Vander."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WatcherEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "vander"
      }
    ]
  },
  "big-grab-bag": {
    "apiName": "TFT9_Augment_BigGrabBag",
    "name": "大百宝袋",
    "tier": "gold",
    "description": "获得3件随机基础装备、2金币和1个【装备重铸器】。\n\n【装备重铸器】允许你将任一装备随机成另一件装备。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 2.0,
        "NumItems": 3.0,
        "NumReforgers": 1.0
      },
      "description_en_us": "Gain 3 random components, 2 gold, and 1 Reforger. \n\nReforgers allow you to remake any item."
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 3
      },
      {
        "kind": "consumable",
        "definitionId": "reforger"
      }
    ],
    "gold": 2
  },
  "teaming-up-ii": {
    "apiName": "TFT9_Augment_Commander_TeamingUp2",
    "name": "成群结队 II",
    "tier": "gold",
    "description": "获得1件随机辅助装和2个随机4阶弈子。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumComponents": null,
        "NumItems": 1.0,
        "NumUnits": 2.0
      },
      "description_en_us": "Gain 1 random Support item and 2 random 4-cost champions."
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "support",
        "count": 1
      },
      {
        "kind": "random-unit",
        "cost": 4,
        "count": 2
      }
    ]
  },
  "support-cache": {
    "apiName": "TFT9_Augment_SupportCache",
    "name": "辅助宝库",
    "tier": "gold",
    "description": "从4件辅助装中选出1件。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "ArmoryChoiceCount": 4.0
      },
      "description_en_us": "Choose 1 of 4 Support items."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeySupport"
      }
    ]
  },
  "duo-queue": {
    "apiName": "TFT_Augment_DuoQueue",
    "name": "双排",
    "tier": "gold",
    "description": "获得2个随机的5费弈子和2件相同的随机基础装备。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumComponents": 2.0,
        "NumUnits": 2.0
      },
      "description_en_us": "Gain 2 random 5-cost champions and 2 copies of a random component."
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 5,
        "count": 2
      },
      {
        "kind": "random-item",
        "pool": "component",
        "count": 2,
        "identical": true
      }
    ]
  },
  "two-trick": {
    "apiName": "TFT_Augment_TwoTrick",
    "name": "两把刷子",
    "tier": "gold",
    "description": "获得1个随机的2星2费英雄和2个随机的2星1费英雄。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a random 2-star two-cost and 2 random 2-star one-cost champions."
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 2,
        "count": 1,
        "starLevel": 2
      },
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 2,
        "starLevel": 2
      }
    ]
  },
  "build-a-bud": {
    "apiName": "TFT11_Augment_Buildabud",
    "name": "来个好伙计！",
    "tier": "prismatic",
    "description": "获得1个随机3星1费弈子和8金币。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 8.0
      },
      "description_en_us": "Gain a random 3-star 1-cost champion and 8 gold."
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 1,
        "starLevel": 3
      }
    ],
    "gold": 8
  },
  "radiant-refactor": {
    "apiName": "TFT11_Augment_RadiantRefactor",
    "name": "光明重构器",
    "tier": "prismatic",
    "description": "获得1个【杰作升级】和1个【基础装备锻造器】。\n\n【杰作升级】可将装备升级为光明版！",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "anvils": 1.0
      },
      "description_en_us": "Gain a Masterwork Upgrade and 1 component anvil.\n\nMasterwork Upgrade upgrades an item to Radiant!"
    },
    "gifts": [
      {
        "kind": "consumable",
        "definitionId": "masterwork-upgrade"
      },
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyComponent"
      }
    ]
  },
  "academy-crown": {
    "apiName": "TFT13_Augment_AcademyCrown",
    "name": "皮城学院之冕",
    "tier": "prismatic",
    "description": "获得1个【皮城学院纹章】和一个随机的赞助版装备。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Academy Emblem and a random sponsored item."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AcademyEmblemItem"
      },
      {
        "kind": "random-item",
        "pool": "sponsored",
        "count": 1
      }
    ]
  },
  "ambusher-crown": {
    "apiName": "TFT13_Augment_AmbusherCrown",
    "name": "伏击专家之冕",
    "tier": "prismatic",
    "description": "获得1个【伏击专家纹章】、1个【正义之手】和1个【卡蜜尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Ambusher Emblem, a Hand of Justice, and a Camille."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AmbusherEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "hand-of-justice"
      },
      {
        "kind": "unit",
        "definitionId": "camille"
      }
    ]
  },
  "artillerist-crown": {
    "apiName": "TFT13_Augment_ArtilleristCrown",
    "name": "炮手之冕",
    "tier": "prismatic",
    "description": "获得1个【炮手纹章】、1个【卢安娜的飓风】和1个【崔丝塔娜】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Artillerist Emblem, a Runaan's Hurricane, and a Tristana."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_DemolitionistEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "runaans-hurricane"
      },
      {
        "kind": "unit",
        "definitionId": "tristana"
      }
    ]
  },
  "automata-crown": {
    "apiName": "TFT13_Augment_AutomataCrown",
    "name": "海克斯机械之冕",
    "tier": "prismatic",
    "description": "获得1个【海克斯机械纹章】、1个【破防者】和1个【魔腾】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Automata Emblem, a Guardbreaker, and a Nocturne."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AutomataEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "guardbreaker"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ]
  },
  "bruiser-crown": {
    "apiName": "TFT13_Augment_BruiserCrown",
    "name": "格斗家之冕",
    "tier": "prismatic",
    "description": "获得1个【格斗家纹章】、1个【救赎】和1个【瑟提】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Bruiser Emblem, a Redemption, and a Sett."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_BruiserEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "redemption"
      },
      {
        "kind": "unit",
        "definitionId": "sett"
      }
    ]
  },
  "black-rose-crown": {
    "apiName": "TFT13_Augment_CabalCrown",
    "name": "黑色玫瑰之冕",
    "tier": "prismatic",
    "description": "获得1个【黑色玫瑰纹章】和1个【朔极之矛】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Black Rose Emblem and a Spear of Shojin."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CabalEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "shojin"
      }
    ]
  },
  "chem-baron-crown": {
    "apiName": "TFT13_Augment_ChembaronCrown",
    "name": "炼金男爵之冕",
    "tier": "prismatic",
    "description": "获得1个【炼金男爵纹章】、1个【纳什之牙】和1个【史密奇】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Chem-Baron Emblem, a Nashor's Tooth, and a Smeech."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CrimeEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "nashors-tooth"
      },
      {
        "kind": "unit",
        "definitionId": "smeech"
      }
    ]
  },
  "conqueror-crown": {
    "apiName": "TFT13_Augment_ConquerorCrown",
    "name": "铁血征服者之冕",
    "tier": "prismatic",
    "description": "获得1个【铁血征服者纹章】、1个【最后的轻语】和1个【芮尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Conqueror Emblem, a Last Whisper, and a Rell."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WarbandEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "last-whisper"
      },
      {
        "kind": "unit",
        "definitionId": "rell"
      }
    ]
  },
  "dominator-crown": {
    "apiName": "TFT13_Augment_DominatorCrown",
    "name": "统领之冕",
    "tier": "prismatic",
    "description": "获得1个【统领纹章】、1个【圣盾使的誓约】和1个【布里茨】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Dominator Emblem, a Protector's Vow, and a Blitzcrank."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InfusedEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "protectors-vow"
      },
      {
        "kind": "unit",
        "definitionId": "blitzcrank"
      }
    ]
  },
  "enforcer-crown": {
    "apiName": "TFT13_Augment_EnforcerCrown",
    "name": "执法官之冕",
    "tier": "prismatic",
    "description": "获得1个【执法官纹章】、1个【无尽之刃】和1个【麦迪】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Enforcer Emblem, an Infinity Edge, and a Maddie."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SquadEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "infinity-edge"
      },
      {
        "kind": "unit",
        "definitionId": "maddie"
      }
    ]
  },
  "experiment-crown": {
    "apiName": "TFT13_Augment_ExperimentCrown",
    "name": "试验品之冕",
    "tier": "prismatic",
    "description": "获得1个【试验品纹章】、1个【饮血剑】和1个【厄加特】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain an Experiment Emblem, a Bloodthirster, and an Urgot."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ExperimentEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "bloodthirster"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ]
  },
  "family-crown": {
    "apiName": "TFT13_Augment_FamilyCrown",
    "name": "家人之冕",
    "tier": "prismatic",
    "description": "获得1个【家人纹章】、1个【救赎】、1个【范德尔】和1个【蔚奥莱】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Family Emblem, a Redemption, a Vander, and a Violet."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_FamilyEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "redemption"
      },
      {
        "kind": "unit",
        "definitionId": "vander"
      },
      {
        "kind": "unit",
        "definitionId": "violet"
      }
    ]
  },
  "firelight-crown": {
    "apiName": "TFT13_Augment_FirelightCrown",
    "name": "野火帮之冕",
    "tier": "prismatic",
    "description": "获得1个【野火帮纹章】、1个【圣盾使的誓约】和1个【刀疤】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Firelight Emblem, a Protector's Vow, and a Scar."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_HoverboardEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "protectors-vow"
      },
      {
        "kind": "unit",
        "definitionId": "scar"
      }
    ]
  },
  "pit-fighter-crown": {
    "apiName": "TFT13_Augment_PitFighterCrown",
    "name": "搏击手之冕",
    "tier": "prismatic",
    "description": "获得1个【搏击手纹章】、1个【斯特拉克的挑战护手】和1个【普朗克】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Pit Fighter Emblem, a Sterak's Gage, and a Gangplank."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_PitFighterEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "steraks-gage"
      },
      {
        "kind": "unit",
        "definitionId": "gangplank"
      }
    ]
  },
  "quickstriker-crown": {
    "apiName": "TFT13_Augment_QuickstrikerCrown",
    "name": "迅击战士之冕",
    "tier": "prismatic",
    "description": "获得1个【迅击战士纹章】、1个【鬼索的狂暴之刃】和1个【魔腾】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Quickstriker Emblem, a Guinsoo's Rageblade, and a Nocturne."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ChallengerEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "rageblade"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ]
  },
  "rebel-crown": {
    "apiName": "TFT13_Augment_RebelCrown",
    "name": "蓝发小队之冕",
    "tier": "prismatic",
    "description": "获得1个【蓝发小队纹章】、1个【珠光护手】和1个【阿卡丽】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Rebel Emblem, a Jeweled Gauntlet, and an Akali."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_RebelEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "jeweled-gauntlet"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ]
  },
  "scrap-crown": {
    "apiName": "TFT13_Augment_ScrapCrown",
    "name": "极客之冕",
    "tier": "prismatic",
    "description": "获得1个【极客纹章】、1个【吉格斯】和2件随机基础装备。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumComponents": 2
      },
      "description_en_us": "Gain a Scrap Emblem, a Ziggs, and 2 random components."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ScrapEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "ziggs"
      },
      {
        "kind": "random-item",
        "pool": "component",
        "count": 2
      }
    ]
  },
  "sentinel-crown": {
    "apiName": "TFT13_Augment_SentinelCrown",
    "name": "哨兵之冕",
    "tier": "prismatic",
    "description": "获得1个【哨兵纹章】、1个【冕卫】和1个【洛里斯】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Sentinel Emblem, a Crownguard, and a Loris."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_TitanEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "crownguard"
      },
      {
        "kind": "unit",
        "definitionId": "loris"
      }
    ]
  },
  "sniper-crown": {
    "apiName": "TFT13_Augment_SniperCrown",
    "name": "狙神之冕",
    "tier": "prismatic",
    "description": "获得1个【狙神纹章】、1个【无尽之刃】和1个【泽丽】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Sniper Emblem, an Infinity Edge, and a Zeri."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SniperEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "infinity-edge"
      },
      {
        "kind": "unit",
        "definitionId": "zeri"
      }
    ]
  },
  "sorcerer-crown": {
    "apiName": "TFT13_Augment_SorcererCrown",
    "name": "法师之冕",
    "tier": "prismatic",
    "description": "获得1个【法师纹章】、1个【适应性头盔】和1个【弗拉基米尔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Sorcerer Emblem, an Adaptive Helm, and a Vladimir."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SorcererEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "adaptive-helm"
      },
      {
        "kind": "unit",
        "definitionId": "vladimir"
      }
    ]
  },
  "visionary-crown": {
    "apiName": "TFT13_Augment_VisionaryCrown",
    "name": "先知之冕",
    "tier": "prismatic",
    "description": "获得1个【先知纹章】、1个【朔极之矛】和1个【烈娜塔】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Visionary Emblem, a Spear of Shojin, and a Renata Glasc."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InvokerEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "shojin"
      },
      {
        "kind": "unit",
        "definitionId": "renata"
      }
    ]
  },
  "watcher-crown": {
    "apiName": "TFT13_Augment_WatcherCrown",
    "name": "监察之冕",
    "tier": "prismatic",
    "description": "获得1个【监察纹章】、1个【坚定之心】和1个【刀疤】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Watcher Emblem, a Steadfast Heart, and a Scar."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WatcherEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "steadfast-heart"
      },
      {
        "kind": "unit",
        "definitionId": "scar"
      }
    ]
  },
  "final-polish": {
    "apiName": "TFT_Augment_FinalPolish",
    "name": "最终润色",
    "tier": "prismatic",
    "description": "获得1个【辅助装锻造器】和1个【成装锻造器】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Support Anvil and a completed item anvil."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeySupport"
      },
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyCompleted"
      }
    ]
  },
  "one-buff-two-buff": {
    "apiName": "TFT_Augment_OneBuffTwoBuff",
    "name": "1个霸符，2个霸符",
    "tier": "prismatic",
    "description": "获得1个【红霸符】、1个【蓝霸符】和1个【英雄复制器】。",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {},
      "description_en_us": "Gain a Red Buff, a Blue Buff, and a Champion Duplicator."
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "red-buff"
      },
      {
        "kind": "item",
        "definitionId": "blue-buff"
      },
      {
        "kind": "consumable",
        "definitionId": "TFT_Consumable_NeekosHelp"
      }
    ]
  }
});
export const AUGMENT_BATCH1_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH1).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:row.name,description:row.description,effects:[
  {kind:'mechanic',mechanic:id==='coronation'?'coronation':'acquisitionBundle',values:{enabled:1}},
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.gold}}]:[]),
  ...(row.xp?[{kind:'mechanic' as const,mechanic:'acquisitionXp',values:{amount:row.xp}}]:[]),
  ...(row.roundGold?[{kind:'mechanic' as const,mechanic:'incomePolicy',values:{interestDisabled:0,interestCap:5,roundXp:0,roundGold:row.roundGold}}]:[]),
 ],
}])));
export const AUGMENT_BATCH1_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH1).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH1_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH1).map(([id,row])=>[id,row.apiName])));
export const AUGMENT_BATCH1_BLOCKED = freezeContent({
  "TFT9_Augment_AllThatShimmers": "尚缺已认证生金神器候选池与InterestCap=5语义；3选1不能套用4选锻造器。",
  "TFT_Augment_AllThatShimmersPlus": "同闪若金鳞：生金池/InterestCap语义未认证、3选管线待接。",
});

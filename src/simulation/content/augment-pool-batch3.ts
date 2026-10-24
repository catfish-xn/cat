import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** A counter over authoritative battle receipts from the acquisition round onward (inclusive).
 * `every`/`max` name a source value (or `every` is a literal count); `repeat:false` fires once at the first threshold. */
export interface Batch3Schedule {
 readonly counter:'pvp-combat'|'pvp-loss'|'pvp-win'|'allied-deaths'; readonly every:string|number; readonly repeat:boolean;
 readonly gifts:readonly AugmentGiftSpec[]; readonly gold?:string; readonly max?:string;
}
interface Batch3Content {
 readonly apiName:string; readonly name:string; readonly tier:'silver'|'gold'|'prismatic'; readonly description:string;
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly gifts:readonly AugmentGiftSpec[]; readonly schedules:readonly Batch3Schedule[];
 /** Free shop rerolls: `now` (a source value) at acquisition, `perRound` per round from the acquisition round. */
 readonly freeRerolls?:{readonly now?:string;readonly perRound?:number};
 /** Superstars: team damage amp of BaseBonusDamage + BonusDamagePer3Star per 3-star ally on the board. */
 readonly superstars?:boolean; readonly gold?:string;
}
/** classification.json batch 3, group 3a-1: grants scheduled by player-combat count, player-combat results or allied deaths.
 * Every count and reward is the 14.24 zh_cn/en_us source value. Three readings are project conventions (P 2026-10-24,
 * docs/S13_RULES_GAP.md): Eye for an Eye+'s max 3 caps the death-based components only; Prizefighter counts player-combat
 * wins; Shimmerscale Essence's "in 5 rounds" (CombatNum) counts player combats.
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH3:Readonly<Record<string,Batch3Content>>=freezeContent({
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
export const AUGMENT_BATCH3_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:batch3Count(row,row.gold)}}]:[]),
  ...(row.superstars?[{kind:'mechanic' as const,mechanic:'superstars',values:{baseBps:Math.round(row.source.values.BaseBonusDamage!*10000),per3StarBps:Math.round(row.source.values.BonusDamagePer3Star!*10000)}}]:[])],
}])));
export const AUGMENT_BATCH3_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH3_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row])=>[id,row.apiName])));

import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface Row {
 readonly apiName:string; readonly name:string; readonly description:string; readonly tier:'silver'|'prismatic';
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly gifts:readonly AugmentGiftSpec[]; readonly gold?:number;
}
/** 14.24 source, P-B5-80/84/86 (2026-10-27). No research archive is needed at runtime. */
export const AUGMENT_BATCH5_H12:Readonly<Record<string,Row>>=freezeContent({
  "subscription-service":{
  "apiName": "TFT_Augment_SubscriptionService",
  "name": "订阅服务",
  "tier": "prismatic",
  "description": "现在，并且在每个阶段开始时，开启一个由4个独特4费弈子组成的商店，并获得6金币。",
  "source": {
    "patch": "14.24",
    "archive": "augments-research-2026-10-23/data/augments-14.24.json",
    "values": {
      "ChampionTier": 4.0,
      "GoldPerStage": 6.0
    },
    "description_en_us": "Now, and at the start of each Stage, open a Shop of 4 unique 4-cost champions and gain 6 gold."
  },
  "gold": 6,
  "gifts": []
},
  "max-cap":{
  "apiName": "TFT_Augment_MaxCap",
  "name": "最大规模",
  "description": "你的最大等级为7级。获得1个【金锅锅冠冕】，该装备可使己方小队规模+1，并获得60金币。",
  "tier": "prismatic",
  "source": {
    "patch": "14.24",
    "archive": "augments-research-2026-10-23/data/augments-14.24.json",
    "values": {
      "AugmentGold": 60.0,
      "NumItems": 1.0
    },
    "description_en_us": "Your max level is 7. Gain 1 Tactician's Shield which increases your team size by +1, and 60 gold."
  },
  "gifts": [
    {
      "kind": "item",
      "definitionId": "TFT_Item_TacticiansScepter",
      "count": 1
    }
  ],
  "gold": 60
},
  "head-start": {
    "apiName": "TFT_Augment_HeadStart",
    "name": "延迟开始",
    "description": "卖掉你场上和备战席上的所有弈子。获得4个随机的2星1费弈子。在接下来的3个回合中禁用你的商店。",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumUnits": 4.0,
        "RoundsToSkip": 3.0,
        "Tier": 1.0
      },
      "description_en_us": "Sell your board and bench. Gain 4 random 2-star 1 cost champions. Disable your Shop for the next 3 rounds."
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 4,
        "starLevel": 2
      }
    ]
  }
});
export const AUGMENT_BATCH5_H12_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H12).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
 ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.gold}}]:[])],
}])));
export const AUGMENT_BATCH5_H12_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H12).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_H12_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H12).map(([id,row])=>[id,row.apiName])));

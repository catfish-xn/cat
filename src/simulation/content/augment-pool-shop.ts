import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** Shop-rule augments (classification.json batch 3, G2): shop generation, purchases, rerolls and round-start economy facts.
 * Every number is the 14.24 zh_cn/en_us source value; the runtime is src/simulation/shop-augments.ts and each project reading
 * is a P entry in docs/S13_RULES_GAP.md. Shop Glitch (real-time refresh timer) and Two Much Value (no fielded-units battle
 * fact) are not in this table. v23 candidate content; no v22 identity, evidence or recording is changed. */
export type ShopAugmentRule='patience'|'firesale'|'rigged'|'reinfourcement'|'dual-purpose'|'invested'|'ticket'|'subscription';
export interface ShopAugmentContent {
 readonly apiName:string; readonly name:string; readonly tier:'silver'|'gold'|'prismatic'; readonly description:string;
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly rule:ShopAugmentRule;
 /** Source value of the gold gained on acquisition. */
 readonly gold?:string;
}
export const AUGMENT_SHOP:Readonly<Record<string,ShopAugmentContent>>=freezeContent({
 "patience-is-a-virtue": {
  "apiName": "TFT_Augment_PatienceIsAVirtue",
  "name": "耐心是一种美德",
  "tier": "silver",
  "description": "每回合，如果你在上一回合未购买任何弈子，则会获得2次免费刷新。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "FreeRerolls": 2.0,
    "{4293de94}": null
   },
   "description_en_us": "Each round, gain 2 free rerolls if you did not buy a champion last round."
  },
  "rule": "patience"
 },
 "firesale": {
  "apiName": "TFT_Augment_FiresalePlus",
  "name": "火爆甩卖",
  "tier": "silver",
  "description": "每回合从商店偷取一个随机弈子。获得1金币。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0
   },
   "description_en_us": "Each round, steal a random champion from the shop. Gain 1 gold."
  },
  "rule": "firesale",
  "gold": "Gold"
 },
 "rigged-shop-plus": {
  "apiName": "TFT_Augment_RiggedShopPlus",
  "name": "操纵商店+",
  "tier": "silver",
  "description": "你的下一次和每4次商店刷新都将是全3费弈子。获得5次刷新。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numrolls": 4.0,
    "Rerolls": 5.0
   },
   "description_en_us": "Your next shop and every 4 shops will contain all 3-cost champions. Gain 5 rerolls."
  },
  "rule": "rigged"
 },
 "reinfourcement": {
  "apiName": "TFT11_Augment_Reinfourcement",
  "name": "四费增援",
  "tier": "gold",
  "description": "你购买的下一个4费弈子将立刻升到2星。获得 12 金币。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 12.0
   },
   "description_en_us": "The next 4-cost champion you buy is instantly upgraded to 2-star. Get 12 gold."
  },
  "rule": "reinfourcement",
  "gold": "Gold"
 },
 "dual-purpose": {
  "apiName": "TFT_Augment_DualPurpose",
  "name": "双重目的",
  "tier": "prismatic",
  "description": "你在每回合首次购买经验值时，获得2金币。每当你购买经验值时，刷新你的商店。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "goldtogive": 2.0
   },
   "description_en_us": "The first time you buy XP each round, gain 2 gold. Whenever you buy XP, reroll your Shop."
  },
  "rule": "dual-purpose"
 },
 "invested-plus": {
  "apiName": "TFT_Augment_InvestedPlus",
  "name": "投资+",
  "tier": "prismatic",
  "description": "获得26金币。在每个回合开始时，在50金币之上，每拥有10金币就会获得1次商店刷新(最多80金币)。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 26.0,
    "GoldPerReroll": 10.0,
    "GoldThreshold": 50.0,
    "MaxGold": 80.0
   },
   "description_en_us": "Gain 26 gold. At the start of each round, gain 1 Shop reroll for every 10 gold above 50 (max 80 gold)."
  },
  "rule": "invested",
  "gold": "Gold"
 },
 "invested-plus-plus": {
  "apiName": "TFT_Augment_InvestedPlusPlus",
  "name": "投资++",
  "tier": "prismatic",
  "description": "获得45金币。在每个回合开始时，在50金币之上，每拥有10金币就会获得1次商店刷新(最多80金币)。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 45.0,
    "GoldPerReroll": 10.0,
    "GoldThreshold": 50.0,
    "MaxGold": 80.0
   },
   "description_en_us": "Gain 45 gold. At the start of each round, gain 1 Shop reroll for every 10 gold above 50 (max 80 gold)."
  },
  "rule": "invested",
  "gold": "Gold"
 },
 "prismatic-ticket": {
  "apiName": "TFT6_Augment_GachaAddict",
  "name": "棱彩门票",
  "tier": "prismatic",
  "description": "每当你的商店刷新时，你都有45%几率获得1次免费刷新。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "RerollPercent": 45.0
   },
   "description_en_us": "Each time your Shop is rerolled, you have a 45% chance to gain a free reroll."
  },
  "rule": "ticket"
 },
 "subscription-service": {
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
  "rule": "subscription",
  "gold": "GoldPerStage"
 }
});
export function shopAugmentValue(id:string,key:string):number {
 const n=AUGMENT_SHOP[id]?.source.values[key];
 if(!Number.isSafeInteger(n)||n!<1)throw new RangeError(`Shop augment source value ${id}.${key}`);return n!;
}
export const AUGMENT_SHOP_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_SHOP).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:shopAugmentValue(id,row.gold)}}]:[])],
}])));
export const AUGMENT_SHOP_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_SHOP).map(([id,row])=>[id,row.tier])));
export const AUGMENT_SHOP_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_SHOP).map(([id,row])=>[id,row.apiName])));

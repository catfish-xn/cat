import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** Shop-rule augments (classification.json batch 3, G2): shop generation, purchases, rerolls and round-start economy facts.
 * Every number is the 14.24 zh_cn/en_us source value; the runtime is src/simulation/shop-augments.ts and each project reading
 * is a P entry in docs/S13_RULES_GAP.md. Shop Glitch (real-time refresh timer) and Two Much Value (no fielded-units battle
 * fact) are not in this table. Starry Night's per-level chances are the 14.24 values stored under hashed field names
 * (decoded in perf-1022/augment-pool/missing-values-triage-2026-10-24.md). v24 candidate content; historical evidence and recordings remain unchanged. */
export type ShopAugmentRule='starry'|'firesale'|'rigged'|'reinfourcement'|'dual-purpose'|'ticket'|'subscription';
export interface ShopAugmentContent {
 readonly apiName:string; readonly name:string; readonly tier:'silver'|'gold'|'prismatic'; readonly description:string;
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly rule:ShopAugmentRule;
 /** Source value of the gold gained on acquisition. */
 readonly gold?:string;
}
export const AUGMENT_SHOP:Readonly<Record<string,ShopAugmentContent>>=freezeContent({
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
 },
 "starry-night": {
  "apiName": "TFT_Augment_StarryNight",
  "name": "星夜",
  "tier": "gold",
  "description": "你商店中的1费和2费弈子有几率成为2星。获得6金币。\n\n当前几率：〔对局动态值〕%\n几率随玩家等级提升。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 6.0,
    "{019b80fe}": 0.800000011920929,
    "{020fb2eb}": 0.25,
    "{0d14760d}": 2.0,
    "{4885b8ce}": 1.0,
    "{49c43705}": 0.20000000298023224,
    "{4abd7204}": 0.18000000715255737,
    "{7083c200}": 0.30000001192092896,
    "{99dcb7a2}": 0.2199999988079071,
    "{ca771d21}": 0.5
   },
   "description_en_us": "1-cost and 2-cost units in your shop have a chance to be 2-star. Gain 6 gold.\n\nCurrent Chances: 〔对局动态值〕%\nChances increase with player level."
  },
  "rule": "starry",
  "gold": "Gold"
 },
 "starry-night-plus": {
  "apiName": "TFT_Augment_StarryNightPlus",
  "name": "星夜+",
  "tier": "gold",
  "description": "你商店中的1费和2费弈子有几率成为2星。获得8金币。\n\n当前几率：〔对局动态值〕%\n几率随玩家等级提升。",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 8.0,
    "{019b80fe}": 0.800000011920929,
    "{020fb2eb}": 0.25,
    "{0d14760d}": 2.0,
    "{4885b8ce}": 1.0,
    "{49c43705}": 0.20000000298023224,
    "{4abd7204}": 0.18000000715255737,
    "{7083c200}": 0.30000001192092896,
    "{99dcb7a2}": 0.2199999988079071,
    "{ca771d21}": 0.5
   },
   "description_en_us": "1-cost and 2-cost units in your shop have a chance to be 2-star. Gain 8 gold.\n\nCurrent Chances: 〔对局动态值〕%\nChances increase with player level."
  },
  "rule": "starry",
  "gold": "Gold"
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

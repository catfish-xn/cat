import { freezeContent } from './freeze';
import type { ShopAugmentContent } from './augment-pool-shop';

/** 14.24 archive rows. Execution conventions: P-B5-08 / P-B5-09, 2026-10-27. */
export const AUGMENT_BATCH5_R5 = freezeContent({
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
} satisfies Readonly<Record<string, ShopAugmentContent>>);

/** Levels 1/2: user convention; levels 3–10: S13 community chart + matching 14.24 fields. */
export const BATCH5_R5_STARRY_POLICY = freezeContent({
  version: 'batch5-r5-starry-v1',
  chanceBpsByLevel: [0, 0, 1800, 2000, 2200, 2500, 3000, 5000, 8000, 10000],
  maxCost: 2, copies: 3,
  shortStock: 'keep-one-star',
  stream: 'augment-pool-shop-seat-choice-generation-slot-lcg32',
  history: 'shop-history-v1',
} as const);

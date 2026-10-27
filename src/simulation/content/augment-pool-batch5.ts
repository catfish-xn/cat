import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface Row { readonly apiName:string; readonly name?:string; readonly description?:string; readonly tier:'silver'|'prismatic'; readonly source:{readonly patch:string;readonly archive:string;readonly description_en_us?:string;readonly values:Readonly<Record<string,number|null>>}; readonly gifts:readonly AugmentGiftSpec[] }
/** 14.24 source; execution conventions P-B5 (2026-10-25). */
export const AUGMENT_BATCH5:Readonly<Record<string,Row>>=freezeContent({
  "called-shot": {
    "apiName": "TFT_Augment_CalledShot",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 4.0,
        "Streak": 4.0
      }
    },
    "gifts": []
  },
  "crafted-crafting": {
    "apiName": "TFT_Augment_CraftedCrafting",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Rerolls": 2.0
      }
    },
    "gifts": []
  },
  "a-change-of-fate": {
    "apiName": "TFT13_Augment_Grant6Cost_MissMage",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "RoundGold": 60
      }
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "blue-buff"
      }
    ]
  },
  "dual-purpose": {
    "apiName": "TFT_Augment_DualPurpose",
    "name": "双重目的",
    "description": "你在每回合首次购买经验值时，获得2金币。每当你购买经验值时，刷新你的商店。",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "description_en_us": "The first time you buy XP each round, gain 2 gold. Whenever you buy XP, reroll your Shop.",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "goldtogive": 2.0
      }
    },
    "gifts": []
  }
});
export const AUGMENT_BATCH5_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5).map(([id,row]):[string,ChoiceDefinition]=>[id,{id,name:row.name??id,description:row.description??id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},...(id==='called-shot'?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.source.values.Gold!}}]:[])]}])));
export const AUGMENT_BATCH5_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5).map(([id,row])=>[id,row.apiName])));

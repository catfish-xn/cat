import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface B4xpContent {
 readonly apiName:string; readonly tier:'gold';
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>};
 readonly gifts:readonly AugmentGiftSpec[];
 readonly condition:'empty-champion-bench'|'full-champion-bench'|'empty-item-inventory';
 readonly acquisitionXp?:number;
}
/** 14.24 source values, including null; P-B4XP (2026-10-25) defines settlement ordering. */
export const AUGMENT_BATCH4_B4XP:Readonly<Record<string,B4xpContent>>=freezeContent({
  "clear-mind": {
    "apiName": "TFT6_Augment_ClearMind",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "XP": 3.0
      }
    },
    "gifts": [],
    "condition": "empty-champion-bench"
  },
  "cluttered-mind": {
    "apiName": "TFT7_Augment_ClutteredMind",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Units": 4.0,
        "XP": 3.0
      }
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 4.0
      }
    ],
    "condition": "full-champion-bench"
  },
  "slammin": {
    "apiName": "TFT11_Augment_Slammin",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "XP": 2.0,
        "XPNow": null,
        "components": 1.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 1.0
      }
    ],
    "condition": "empty-item-inventory"
  },
  "slammin-plus": {
    "apiName": "TFT11_Augment_Slammin_Plus",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "XP": 2.0,
        "XPNow": 10.0,
        "components": 1.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 1.0
      }
    ],
    "condition": "empty-item-inventory",
    "acquisitionXp": 10.0
  }
});
export const AUGMENT_BATCH4_B4XP_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4XP).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
 ...(row.acquisitionXp?[{kind:'mechanic' as const,mechanic:'acquisitionXp',values:{amount:row.acquisitionXp}}]:[])],
}])));
export const AUGMENT_BATCH4_B4XP_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4XP).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH4_B4XP_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4XP).map(([id,row])=>[id,row.apiName])));
/** 14.24 stage-tag bans, same reading as augment-stage-bans.ts. */
export const AUGMENT_BATCH4_B4XP_NODE_BANS=freezeContent({
 TFT6_Augment_ClearMind:['3-2','4-2'],TFT7_Augment_ClutteredMind:['3-2','4-2'],
 TFT11_Augment_Slammin:['3-2','4-2'],TFT11_Augment_Slammin_Plus:['2-1','4-2'],
});

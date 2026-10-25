import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 source rows; entry timing follows P-B4R (2026-10-25). No acquisition-round credit. */
export const AUGMENT_BATCH4_B4REROLL = freezeContent({
  "patience-is-a-virtue": {
    "apiName": "TFT_Augment_PatienceIsAVirtue",
    "tier": "silver",
    "nodes": [
      "2-1"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "FreeRerolls": 2,
        "{4293de94}": null
      }
    }
  },
  "invested-plus": {
    "apiName": "TFT_Augment_InvestedPlus",
    "tier": "prismatic",
    "nodes": [
      "3-2"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 26,
        "GoldPerReroll": 10,
        "GoldThreshold": 50,
        "MaxGold": 80
      }
    }
  },
  "invested-plus-plus": {
    "apiName": "TFT_Augment_InvestedPlusPlus",
    "tier": "prismatic",
    "nodes": [
      "4-2"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 45,
        "GoldPerReroll": 10,
        "GoldThreshold": 50,
        "MaxGold": 80
      }
    }
  }
} as const);
export const AUGMENT_BATCH4_B4REROLL_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4REROLL).map(([id,row]):[string,ChoiceDefinition]=>[id,{id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},...('Gold' in row.source.values?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.source.values.Gold}}]:[])]}])));
export const AUGMENT_BATCH4_B4REROLL_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4REROLL).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH4_B4REROLL_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4REROLL).map(([id,row])=>[id,row.apiName])));
export const AUGMENT_BATCH4_B4REROLL_NODE_BANS=freezeContent(Object.fromEntries(Object.values(AUGMENT_BATCH4_B4REROLL).map(row=>[row.apiName,['2-1','3-2','4-2'].filter(node=>!(row.nodes as readonly string[]).includes(node))])));

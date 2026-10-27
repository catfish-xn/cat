import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface Row { readonly apiName:string; readonly name:string; readonly description:string; readonly tier:'gold'|'prismatic'; readonly source:{readonly patch:string;readonly archive:string;readonly description_en_us:string;readonly values:Readonly<Record<string,number>>}; readonly gifts:readonly AugmentGiftSpec[] }
/** 14.24 source; P-B5-H13, user approved 2026-10-27.
 * B5-20: NumRounds=4, ordinary permanent recipes only.
 * B5-22: Health=50 is retained source metadata, with no described health effect.
 * B5-23: the description grants one radiant directly (not an anvil).
 */
export const AUGMENT_BATCH5_H13:Readonly<Record<string,Row>>=freezeContent({
  "salvage-bin-plus": {
    "apiName": "TFT8_Augment_SalvageBinPlus",
    "name": "打捞桶+",
    "description": "立刻获得1件随机成装，并在4个玩家对战回合之后提供1个基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "description_en_us": "Gain 1 random completed item now, and 1 component after 4 player combats. Selling champions breaks completed items into components (excluding Tactician's items and Emblems).",
      "values": {
        "NumRounds": 4.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "completed",
        "count": 1
      }
    ]
  },
  "artifactory": {
    "apiName": "TFT_Augment_Artifactory",
    "name": "神器工厂",
    "description": "每回合开始时，你备战席上的各个成装都将转变为一件随机的神器装备。获得1个【神器锻造器】和2个【拆卸器】。",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "description_en_us": "At the start of each turn, your benched completed items transform into a random Artifact item. Gain 1 Artifact Anvil and 2 Removers.",
      "values": {
        "Health": 50.0,
        "NumItems": 1.0,
        "NumRemovers": 2
      }
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyOrnn",
        "count": 1
      },
      {
        "kind": "consumable",
        "definitionId": "magnetic-remover",
        "count": 2
      }
    ]
  },
  "pandoras-items-iii": {
    "apiName": "TFT9_Augment_PandorasRadiantBox",
    "name": "潘朵拉的装备 III",
    "description": "回合开始时：你备战席上的装备会随机变化。\n\n获得1件随机光明武器。",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "description_en_us": "Round start: items on your bench are randomized. \n\nGain 1 random Radiant item.",
      "values": {}
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "radiant",
        "count": 1
      }
    ]
  }
});
export const AUGMENT_BATCH5_H13_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H13).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_H13_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H13).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_H13_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H13).map(([id,row])=>[id,row.apiName])));

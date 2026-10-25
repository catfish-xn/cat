import { freezeContent } from './freeze';
import type { AugmentGiftSpec } from '../augment-gift-plan';
import type { ChoiceDefinition } from '../strategy-types';
interface Batch4Content {
 readonly gifts:readonly AugmentGiftSpec[];
 readonly perLevel?:{readonly copyOf:number}|{readonly costOffset:number;readonly minCost:number;readonly starLevel:2};
 readonly thresholds?:readonly {readonly level:string;readonly gifts:readonly AugmentGiftSpec[]}[];
 readonly goldThreshold?:{readonly level:string;readonly amount:string};
 readonly apiName:string; readonly tier:'silver'|'gold'|'prismatic';
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>};
}
/** Level-triggered rewards. Numbers and behaviour: 14.24 archive; sampling/timing: P-B4, 2026-10-25. */
export const AUGMENT_BATCH4:Readonly<Record<string,Batch4Content>>=freezeContent({
  "caretakers-ally": {
    gifts:[{kind:'random-unit',cost:2,count:1}],perLevel:{copyOf:0},
    "apiName": "TFT9_Augment_BardPlaybook1",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "UnitTier": 2.0
      }
    }
  },
  "lategame-specialist": {
    gifts:[],goldThreshold:{level:'LevelReq',amount:'Gold'},
    "apiName": "TFT7_Augment_LategameSpecialist",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 33.0,
        "LevelReq": 9.0
      }
    }
  },
  "caretakers-favor": {
    gifts:[],thresholds:['levelreqa','levelreqb','levelreqc','levelreqd'].map(level=>({level,gifts:[{kind:'unit' as const,definitionId:'TFT_ArmoryKeyComponent'}]})),
    "apiName": "TFT9_Augment_BardPlaybook2",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "levelreqa": 5.0,
        "levelreqb": 6.0,
        "levelreqc": 7.0,
        "levelreqd": 8.0
      }
    }
  },
  "birthday-presents": {
    gifts:[],perLevel:{costOffset:4,minCost:1,starLevel:2},
    "apiName": "TFT7_Augment_BirthdayPresents",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": null
      }
    }
  },
  "caretakers-chosen": {
    gifts:[],thresholds:[
     {level:'levelreqa',gifts:[{kind:'unit',definitionId:'TFT_ArmoryKeyComponent'}]},
     {level:'levelreqb',gifts:[{kind:'unit',definitionId:'TFT_ArmoryKeyCompleted'}]},
     {level:'levelreqc',gifts:[{kind:'unit',definitionId:'TFT_ArmoryKeyRadiant'}]},
    ],
    "apiName": "TFT9_Augment_BardPlaybook3",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "levelreqa": 4.0,
        "levelreqb": 6.0,
        "levelreqc": 7.0
      }
    }
  }
});
export const AUGMENT_BATCH4_BLOCKED=freezeContent({});
export const AUGMENT_BATCH4_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4).map(([id]):[string,ChoiceDefinition]=>[id,{
 id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}],
}])));
export const AUGMENT_BATCH4_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH4_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4).map(([id,row])=>[id,row.apiName])));

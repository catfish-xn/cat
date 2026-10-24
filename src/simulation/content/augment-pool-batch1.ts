import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

interface Batch1Content {
 readonly apiName:string;  readonly tier:'silver'|'gold'|'prismatic';
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>};
 readonly gifts:readonly AugmentGiftSpec[]; readonly gold?:number; readonly xp?:number; readonly roundGold?:number;
}
/** 14.24 executable gift plans and source values. UI text is lazy; archive columns are restored offline.
 * Counts not present in effectAmounts are stated explicitly in the source description (e.g. Final Polish).
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH1:Readonly<Record<string,Batch1Content>> = freezeContent({
  "coronation": {
    "apiName": "TFT_Augment_Coronation",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "BonusAD": 0.30000001192092896,
        "BonusAP": 40.0,
        "BonusAS": 0.30000001192092896
      }
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT_Item_ForceOfNature"
      }
    ]
  },
  "tacticians-kitchen": {
    "apiName": "TFT_Augment_TacticiansKitchen",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumFryingPan": 1.0,
        "NumItemAnvils": 1.0,
        "NumSpatula": 1.0
      }
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT_Item_TacticiansRing"
      },
      {
        "kind": "random-item",
        "pool": "emblem",
        "count": 1
      }
    ]
  },
  "branching-out": {
    "apiName": "TFT_Augment_BranchingOut",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Numberofcombats": null
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "emblem",
        "count": 1
      },
      {
        "kind": "consumable",
        "definitionId": "reforger",
        "count": 1
      }
    ]
  },
  "item-grab-bag-i": {
    "apiName": "TFT6_Augment_ItemGrabBag1",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumItems": 1.0
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
  "one-two-five": {
    "apiName": "TFT6_Augment_OneTwoFive",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 2.0,
        "NumChamps": 1.0,
        "NumComponents": 1.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 1
      },
      {
        "kind": "random-unit",
        "cost": 5,
        "count": 1
      }
    ],
    "gold": 2
  },
  "band-of-thieves-i": {
    "apiName": "TFT7_Augment_BandOfThieves1",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumGloves": 1.0
      }
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "thiefs-gloves"
      }
    ]
  },
  "teaming-up-i": {
    "apiName": "TFT9_Augment_Commander_TeamingUp1",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumChamps": 2.0,
        "NumComponents": 1.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 1
      },
      {
        "kind": "random-unit",
        "cost": 3,
        "count": 2
      }
    ]
  },
  "iron-assets": {
    "apiName": "TFT9_Augment_IronAssets",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 4.0
      }
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyComponent"
      }
    ],
    "gold": 4
  },
  "missed-connections": {
    "apiName": "TFT9_Augment_MissedConnections",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "all-units",
        "cost": 1
      }
    ]
  },
  "ones-twos-three": {
    "apiName": "TFT9_Augment_OneTwosThree",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumChamps": 2.0,
        "tier1champs": 2.0
      }
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 2
      },
      {
        "kind": "random-unit",
        "cost": 2,
        "count": 2
      },
      {
        "kind": "random-unit",
        "cost": 3,
        "count": 1
      }
    ]
  },
  "silver-spoon": {
    "apiName": "TFT9_Augment_SilverSpoon",
    "tier": "silver",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Experience": 10.0
      }
    },
    "gifts": [],
    "xp": 10
  },
  "heroic-grab-bag": {
    "apiName": "TFT10_Augment_HeroicGrabBag",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 9.0,
        "LesserDuplicatorAmount": 2.0
      }
    },
    "gifts": [
      {
        "kind": "consumable",
        "definitionId": "TFT_Consumable_ChampionDuplicator_III",
        "count": 2
      }
    ],
    "gold": 9
  },
  "raining-gold": {
    "apiName": "TFT11_Augment_RainingGold",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "InstantGold": 8.0,
        "RoundGold": 1.0
      }
    },
    "gifts": [],
    "gold": 8,
    "roundGold": 1
  },
  "raining-gold-plus": {
    "apiName": "TFT11_Augment_RainingGoldPlus",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "InstantGold": 18.0,
        "RoundGold": 1.0
      }
    },
    "gifts": [],
    "gold": 18,
    "roundGold": 1
  },
  "academy-crest": {
    "apiName": "TFT13_Augment_AcademyCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AcademyEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "leona"
      }
    ]
  },
  "ambusher-crest": {
    "apiName": "TFT13_Augment_AmbusherCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AmbusherEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "camille"
      }
    ]
  },
  "artillerist-crest": {
    "apiName": "TFT13_Augment_ArtilleristCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_DemolitionistEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "tristana"
      }
    ]
  },
  "automata-crest": {
    "apiName": "TFT13_Augment_AutomataCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AutomataEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ]
  },
  "bruiser-crest": {
    "apiName": "TFT13_Augment_BruiserCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_BruiserEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "sett"
      }
    ]
  },
  "black-rose-crest": {
    "apiName": "TFT13_Augment_CabalCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CabalEmblemItem"
      }
    ]
  },
  "chem-baron-crest": {
    "apiName": "TFT13_Augment_ChembaronCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CrimeEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "renata"
      }
    ]
  },
  "conqueror-crest": {
    "apiName": "TFT13_Augment_ConquerorCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WarbandEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "rell"
      }
    ]
  },
  "dominator-crest": {
    "apiName": "TFT13_Augment_DominatorCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InfusedEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "blitzcrank"
      }
    ]
  },
  "enforcer-crest": {
    "apiName": "TFT13_Augment_EnforcerCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SquadEmblemItem"
      }
    ]
  },
  "experiment-crest": {
    "apiName": "TFT13_Augment_ExperimentCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ExperimentEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ]
  },
  "family-crest": {
    "apiName": "TFT13_Augment_FamilyCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_FamilyEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "violet"
      }
    ]
  },
  "firelight-crest": {
    "apiName": "TFT13_Augment_FirelightCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_HoverboardEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "zeri"
      }
    ]
  },
  "pit-fighter-crest": {
    "apiName": "TFT13_Augment_PitFighterCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_PitFighterEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ]
  },
  "quickstriker-crest": {
    "apiName": "TFT13_Augment_QuickstrikerCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ChallengerEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ]
  },
  "rebel-crest": {
    "apiName": "TFT13_Augment_RebelCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_RebelEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ]
  },
  "scrap-crest": {
    "apiName": "TFT13_Augment_ScrapCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ScrapEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "ziggs"
      }
    ]
  },
  "sentinel-crest": {
    "apiName": "TFT13_Augment_SentinelCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_TitanEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "rell"
      }
    ]
  },
  "sniper-crest": {
    "apiName": "TFT13_Augment_SniperCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SniperEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "zeri"
      }
    ]
  },
  "sorcerer-crest": {
    "apiName": "TFT13_Augment_SorcererCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SorcererEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "vladimir"
      }
    ]
  },
  "visionary-crest": {
    "apiName": "TFT13_Augment_VisionaryCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InvokerEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "renata"
      }
    ]
  },
  "watcher-crest": {
    "apiName": "TFT13_Augment_WatcherCrest",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WatcherEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "vander"
      }
    ]
  },
  "big-grab-bag": {
    "apiName": "TFT9_Augment_BigGrabBag",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 2.0,
        "NumItems": 3.0,
        "NumReforgers": 1.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "component",
        "count": 3
      },
      {
        "kind": "consumable",
        "definitionId": "reforger"
      }
    ],
    "gold": 2
  },
  "teaming-up-ii": {
    "apiName": "TFT9_Augment_Commander_TeamingUp2",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumComponents": null,
        "NumItems": 1.0,
        "NumUnits": 2.0
      }
    },
    "gifts": [
      {
        "kind": "random-item",
        "pool": "support",
        "count": 1
      },
      {
        "kind": "random-unit",
        "cost": 4,
        "count": 2
      }
    ]
  },
  "support-cache": {
    "apiName": "TFT9_Augment_SupportCache",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "ArmoryChoiceCount": 4.0
      }
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeySupport"
      }
    ]
  },
  "duo-queue": {
    "apiName": "TFT_Augment_DuoQueue",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumComponents": 2.0,
        "NumUnits": 2.0
      }
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 5,
        "count": 2
      },
      {
        "kind": "random-item",
        "pool": "component",
        "count": 2,
        "identical": true
      }
    ]
  },
  "two-trick": {
    "apiName": "TFT_Augment_TwoTrick",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 2,
        "count": 1,
        "starLevel": 2
      },
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 2,
        "starLevel": 2
      }
    ]
  },
  "build-a-bud": {
    "apiName": "TFT11_Augment_Buildabud",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 8.0
      }
    },
    "gifts": [
      {
        "kind": "random-unit",
        "cost": 1,
        "count": 1,
        "starLevel": 3
      }
    ],
    "gold": 8
  },
  "radiant-refactor": {
    "apiName": "TFT11_Augment_RadiantRefactor",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "anvils": 1.0
      }
    },
    "gifts": [
      {
        "kind": "consumable",
        "definitionId": "masterwork-upgrade"
      },
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyComponent"
      }
    ]
  },
  "academy-crown": {
    "apiName": "TFT13_Augment_AcademyCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AcademyEmblemItem"
      },
      {
        "kind": "random-item",
        "pool": "sponsored",
        "count": 1
      }
    ]
  },
  "ambusher-crown": {
    "apiName": "TFT13_Augment_AmbusherCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AmbusherEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "hand-of-justice"
      },
      {
        "kind": "unit",
        "definitionId": "camille"
      }
    ]
  },
  "artillerist-crown": {
    "apiName": "TFT13_Augment_ArtilleristCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_DemolitionistEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "runaans-hurricane"
      },
      {
        "kind": "unit",
        "definitionId": "tristana"
      }
    ]
  },
  "automata-crown": {
    "apiName": "TFT13_Augment_AutomataCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_AutomataEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "guardbreaker"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ]
  },
  "bruiser-crown": {
    "apiName": "TFT13_Augment_BruiserCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_BruiserEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "redemption"
      },
      {
        "kind": "unit",
        "definitionId": "sett"
      }
    ]
  },
  "black-rose-crown": {
    "apiName": "TFT13_Augment_CabalCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CabalEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "shojin"
      }
    ]
  },
  "chem-baron-crown": {
    "apiName": "TFT13_Augment_ChembaronCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_CrimeEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "nashors-tooth"
      },
      {
        "kind": "unit",
        "definitionId": "smeech"
      }
    ]
  },
  "conqueror-crown": {
    "apiName": "TFT13_Augment_ConquerorCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WarbandEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "last-whisper"
      },
      {
        "kind": "unit",
        "definitionId": "rell"
      }
    ]
  },
  "dominator-crown": {
    "apiName": "TFT13_Augment_DominatorCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InfusedEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "protectors-vow"
      },
      {
        "kind": "unit",
        "definitionId": "blitzcrank"
      }
    ]
  },
  "enforcer-crown": {
    "apiName": "TFT13_Augment_EnforcerCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SquadEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "infinity-edge"
      },
      {
        "kind": "unit",
        "definitionId": "maddie"
      }
    ]
  },
  "experiment-crown": {
    "apiName": "TFT13_Augment_ExperimentCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ExperimentEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "bloodthirster"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ]
  },
  "family-crown": {
    "apiName": "TFT13_Augment_FamilyCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_FamilyEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "redemption"
      },
      {
        "kind": "unit",
        "definitionId": "vander"
      },
      {
        "kind": "unit",
        "definitionId": "violet"
      }
    ]
  },
  "firelight-crown": {
    "apiName": "TFT13_Augment_FirelightCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_HoverboardEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "protectors-vow"
      },
      {
        "kind": "unit",
        "definitionId": "scar"
      }
    ]
  },
  "pit-fighter-crown": {
    "apiName": "TFT13_Augment_PitFighterCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_PitFighterEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "steraks-gage"
      },
      {
        "kind": "unit",
        "definitionId": "gangplank"
      }
    ]
  },
  "quickstriker-crown": {
    "apiName": "TFT13_Augment_QuickstrikerCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ChallengerEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "rageblade"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ]
  },
  "rebel-crown": {
    "apiName": "TFT13_Augment_RebelCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_RebelEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "jeweled-gauntlet"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ]
  },
  "scrap-crown": {
    "apiName": "TFT13_Augment_ScrapCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumComponents": 2
      }
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_ScrapEmblemItem"
      },
      {
        "kind": "unit",
        "definitionId": "ziggs"
      },
      {
        "kind": "random-item",
        "pool": "component",
        "count": 2
      }
    ]
  },
  "sentinel-crown": {
    "apiName": "TFT13_Augment_SentinelCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_TitanEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "crownguard"
      },
      {
        "kind": "unit",
        "definitionId": "loris"
      }
    ]
  },
  "sniper-crown": {
    "apiName": "TFT13_Augment_SniperCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SniperEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "infinity-edge"
      },
      {
        "kind": "unit",
        "definitionId": "zeri"
      }
    ]
  },
  "sorcerer-crown": {
    "apiName": "TFT13_Augment_SorcererCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_SorcererEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "adaptive-helm"
      },
      {
        "kind": "unit",
        "definitionId": "vladimir"
      }
    ]
  },
  "visionary-crown": {
    "apiName": "TFT13_Augment_VisionaryCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_InvokerEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "shojin"
      },
      {
        "kind": "unit",
        "definitionId": "renata"
      }
    ]
  },
  "watcher-crown": {
    "apiName": "TFT13_Augment_WatcherCrown",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "TFT13_Item_WatcherEmblemItem"
      },
      {
        "kind": "item",
        "definitionId": "steadfast-heart"
      },
      {
        "kind": "unit",
        "definitionId": "scar"
      }
    ]
  },
  "final-polish": {
    "apiName": "TFT_Augment_FinalPolish",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeySupport"
      },
      {
        "kind": "unit",
        "definitionId": "TFT_ArmoryKeyCompleted"
      }
    ]
  },
  "one-buff-two-buff": {
    "apiName": "TFT_Augment_OneBuffTwoBuff",
    "tier": "prismatic",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {}
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "red-buff"
      },
      {
        "kind": "item",
        "definitionId": "blue-buff"
      },
      {
        "kind": "consumable",
        "definitionId": "TFT_Consumable_NeekosHelp"
      }
    ]
  }
});
export const AUGMENT_BATCH1_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH1).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:id,description:id,effects:[
  {kind:'mechanic',mechanic:id==='coronation'?'coronation':'acquisitionBundle',values:{enabled:1}},
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:row.gold}}]:[]),
  ...(row.xp?[{kind:'mechanic' as const,mechanic:'acquisitionXp',values:{amount:row.xp}}]:[]),
  ...(row.roundGold?[{kind:'mechanic' as const,mechanic:'incomePolicy',values:{interestDisabled:0,interestCap:5,roundXp:0,roundGold:row.roundGold}}]:[]),
 ],
}])));
export const AUGMENT_BATCH1_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH1).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH1_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH1).map(([id,row])=>[id,row.apiName])));
export const AUGMENT_BATCH1_BLOCKED = freezeContent({
  "TFT9_Augment_AllThatShimmers": "尚缺已认证生金神器候选池与InterestCap=5语义；3选1不能套用4选锻造器。",
  "TFT_Augment_AllThatShimmersPlus": "同闪若金鳞：生金池/InterestCap语义未认证、3选管线待接。",
});

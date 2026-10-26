import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
import { TOWER_DEFENSE_SPELL } from './batch3-summons';
import { nextRandom } from '../rng';

/** A counter over authoritative battle receipts from the acquisition round onward (inclusive).
 * `every`/`max` name a source value (or `every` is a literal count); `repeat:false` fires once at the first threshold. */
export interface Batch3Schedule {
 readonly counter:'pvp-combat'|'pvp-loss'|'pvp-win'|'allied-deaths'|'round-start'|'stage-start'|'team-healing'|'dummy-deaths'|'dummy-first-death'|'dummy-gold'|'golden-egg'|'adventure-quest'|'enemy-kills'|'damage-dealt'|'outcome'|'magic-egg'; readonly every:string|number; readonly repeat:boolean;
 readonly gifts:readonly AugmentGiftSpec[]; readonly gold?:string|number; readonly max?:string|number;
 /** round-start only: first entry this many rounds after acquisition (default 1). */
 readonly from?:string|number;
 /** Grant one more 1-star copy of the champion drawn by the acquisition gift at this index instead of `gifts`. */
 readonly copyOf?:number;
 /** Support Mining: when this schedule fires, the augment's own training dummy is removed from the roster. */
 readonly retireDummy?:true;
}
interface Batch3Content {
 readonly apiName:string; readonly tier:'silver'|'gold'|'prismatic';
 /** UI name/description live in src/presentation/augment-pool-text.ts (lazy chunk); scripts/augment-content-archive.ts restores the archive columns offline. */
 readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>};
 readonly gifts:readonly AugmentGiftSpec[]; readonly schedules:readonly Batch3Schedule[];
 /** Free shop rerolls: `now` (a source value) at acquisition, `perRound` per round from the acquisition round. */
 readonly freeRerolls?:{readonly now?:string;readonly perRound?:number};
 /** Superstars: team damage amp of BaseBonusDamage + BonusDamagePer3Star per 3-star ally on the board. */
 readonly superstars?:boolean; readonly gold?:string;
 /** Flexible: every board ally gains HPPerEmblem for each emblem held across the board (P 2026-10-24). */
 readonly flexible?:boolean;
 /** Corrosion: every Time seconds, enemies in their own front two rows lose ResistLoss armor and magic resist. */
 readonly corrosion?:boolean;
 /** Wandering Trainer: this many random emblems (a source value) are permanently attached to the augment's dummy. */
 readonly dummyEmblems?:string;
 /** Hero augment: the champion whose strongest copy on the board gets the replacement ability (heroCarryLive). */
 /** Spoils of War tier: which TFT9_Augment_Spoils_Tier{n} tables the enemy-kills schedule reads. */
 readonly spoilsTier?:1|2|3;
 /** Dummify/Golemify: remove every champion on acquisition; the granted forming-dummy/augment-golem takes their totals. */
 readonly forming?:'dummy'|'golem';
 /** Magic Roll / Call to Chaos: one random reward at acquisition (the `outcome` schedule), drawn on its own stream. */
 readonly outcome?:'magic-roll'|'call-to-chaos';
 readonly hero?:'steb'|'irelia'|'trundle'|'renni'|'vander'|'vladimir';
 /** Replay-authenticated combat mechanics (g2-4b-gold-restore BATCH3_REPLAYED_MECHANICS); values come from the source row. */
 readonly combat?:'blazingSoul'|'nobleSacrifice'|'wealthyRehab'|'badLuck'|'goldForDummies'|'towerDefense';
}
/** classification.json batch 3, group 3a-1: grants scheduled by player-combat count, player-combat results or allied deaths.
 * Every count and reward is the 14.24 zh_cn/en_us source value. Three readings are project conventions (P 2026-10-24,
 * docs/S13_RULES_GAP.md): Eye for an Eye+'s max 3 caps the death-based components only; Prizefighter counts player-combat
 * wins; Shimmerscale Essence's "in 5 rounds" (CombatNum) counts player combats.
 * This is v23 candidate content; no v22 identity, evidence or recording is changed. */
export const AUGMENT_BATCH3:Readonly<Record<string,Batch3Content>>=freezeContent({
 "dummify": {
  "apiName": "TFT_Augment_Dummify",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "HPPerStage": 250,
    "HealthPercent": 100.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "forming-dummy"
   }
  ],
  "schedules": [],
  "forming": "dummy"
 },
 "golemify": {
  "apiName": "TFT_Augment_Golemify",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ADPercent": 60.0,
    "HPPerStage": 150,
    "HealthPercent": 90.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "augment-golem"
   }
  ],
  "schedules": [],
  "forming": "golem"
 },
 "spoils-of-war-i": {
  "apiName": "TFT9_Augment_DravenSpoilsOfWar",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "LootDropChance": 0.25,
    "{ac7ef35a}": 0.25
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "enemy-kills",
    "every": 1,
    "repeat": true,
    "gifts": []
   }
  ],
  "spoilsTier": 1
 },
 "spoils-of-war-ii": {
  "apiName": "TFT9_Augment_DravenSpoilsOfWar2",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "LootDropChance": 0.30000001192092896,
    "{ac7ef35a}": 0.30000001192092896
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "enemy-kills",
    "every": 1,
    "repeat": true,
    "gifts": []
   }
  ],
  "spoilsTier": 2
 },
 "spoils-of-war-iii": {
  "apiName": "TFT9_Augment_DravenSpoilsOfWar3",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "LootDropChance": 0.4000000059604645,
    "{ac7ef35a}": 0.4000000059604645
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "enemy-kills",
    "every": 1,
    "repeat": true,
    "gifts": []
   }
  ],
  "spoilsTier": 3
 },
 "field-medic": {
  "apiName": "TFT13_Augment_FishCarry",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ManaReduction": 10.0,
    "TOOLTIPONLYModifiedDamage": 0.6499999761581421,
    "TOOLTIPONLYOmnivamp": 30.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "steb",
    "count": 1
   }
  ],
  "schedules": [],
  "hero": "steb"
 },
 "blade-dance": {
  "apiName": "TFT13_Augment_IreliaCarry",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "TOOLTIPBonusAS": 0.4000000059604645
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "irelia",
    "count": 1
   }
  ],
  "schedules": [],
  "hero": "irelia"
 },
 "shocking-troll": {
  "apiName": "TFT13_Augment_TrundleCarry",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ManaReduction": 50.0,
    "TOOLTIPONLYADPerCast": 1.5,
    "TOOLTIPONLYAS": 140.0,
    "TOOLTIPONLYDuration": 5.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "trundle",
    "count": 1
   }
  ],
  "schedules": [],
  "hero": "trundle"
 },
 "savage-revenge": {
  "apiName": "TFT13_Augment_ChainsawCarry",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "TOOLTIPAbilityDamage": 1.100000023841858,
    "TOOLTIPHexDistance": 2.0,
    "TOOLTIPManaReduction": 10.0,
    "{9dff3ac5}": 0.30000001192092896
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "renni",
    "count": 2
   }
  ],
  "schedules": [],
  "hero": "renni"
 },
 "all-out": {
  "apiName": "TFT13_Augment_PrimeCarry",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "TOOLTIPONLYSplashPerc": 0.25,
    "TooltipBonusDamage": 0.8500000238418579,
    "{8cfa39af}": 60.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "vander",
    "count": 1
   }
  ],
  "schedules": [],
  "hero": "vander"
 },
 "blood-pact": {
  "apiName": "TFT13_Augment_VladCarry",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BonusMana": 3.0,
    "IncRange": 3.0,
    "TOOLTIPDamageAmp": 0.10000000149011612,
    "TooltipBonusDamage": 0.800000011920929,
    "{256e31ce}": 50.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "vladimir",
    "count": 1
   }
  ],
  "schedules": [],
  "hero": "vladimir"
 },
 "tower-defense": {
  "apiName": "TFT_Augment_TowerDefense",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": null,
    "NumOfEmblems": 1.0,
    "{103ddd87}": 0.4000000059604645,
    "{fd3dbf9e}": 60.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "tower-dummy"
   }
  ],
  "schedules": [],
  "dummyEmblems": "NumOfEmblems",
  "combat": "towerDefense"
 },
 "the-golden-egg": {
  "apiName": "TFT6_Augment_TheGoldenEgg",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "EggTurns": 11.0,
    "{ecb4463d}": null
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "golden-egg",
    "every": 1,
    "repeat": false,
    "gifts": []
   }
  ]
 },
 "an-exalted-adventure": {
  "apiName": "TFT_Augment_AnExaltedAdventure",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "NumUnits": 3.0
   },
  },
  "gifts": [
   {
    "kind": "random-unit",
    "cost": 2,
    "count": 3,
    "distinct": true
   },
   {
    "kind": "consumable",
    "definitionId": "TFT_Consumable_ChampionDuplicator_III"
   }
  ],
  "schedules": [
   {
    "counter": "stage-start",
    "every": 1,
    "repeat": true,
    "gifts": [
     {
      "kind": "consumable",
      "definitionId": "TFT_Consumable_ChampionDuplicator_III"
     }
    ]
   },
   {
    "counter": "adventure-quest",
    "every": 1,
    "repeat": false,
    "gifts": []
   }
  ]
 },
 "support-mining": {
  "apiName": "TFT_Augment_SupportMining",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "NumDeaths": 7.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-deaths",
    "every": "NumDeaths",
    "repeat": false,
    "retireDummy": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "support",
      "count": 1
     }
    ]
   }
  ]
 },
 "support-mining-plus": {
  "apiName": "TFT_Augment_SupportMiningPlus",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "NumDeaths": 4.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-deaths",
    "every": "NumDeaths",
    "repeat": false,
    "retireDummy": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "support",
      "count": 1
     }
    ]
   }
  ]
 },
 "scapegoat": {
  "apiName": "TFT10_Augment_Scapegoat",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0,
    "InitialGold": 4.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-first-death",
    "every": 1,
    "repeat": true,
    "gold": "Gold",
    "gifts": []
   }
  ],
  "gold": "InitialGold"
 },
 "wandering-trainer-i": {
  "apiName": "TFT11_Augment_WanderingTrainerGold",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0,
    "NumOfEmblems": 2.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [],
  "gold": "Gold",
  "dummyEmblems": "NumOfEmblems"
 },
 "wandering-trainer-ii": {
  "apiName": "TFT9_Augment_WanderingTrainer",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 6.0,
    "NumOfEmblems": 3.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [],
  "gold": "Gold",
  "dummyEmblems": "NumOfEmblems"
 },
 "gold-for-dummies": {
  "apiName": "TFT_Augment_GoldForDummies",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "GoldAmount": 1.0,
    "GoldDuration": 10.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "training-dummy"
   }
  ],
  "schedules": [
   {
    "counter": "dummy-gold",
    "every": 1,
    "repeat": true,
    "gold": "GoldAmount",
    "gifts": []
   }
  ],
  "combat": "goldForDummies"
 },
 "bad-luck-protection": {
  "apiName": "TFT_Augment_BadLuckProtection",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ADPerCrit": 0.009999999776482582,
    "CritChancePercent": 1.0,
    "{1a2d5ea3}": null
   },
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "gloves"
   }
  ],
  "schedules": [],
  "combat": "badLuck"
 },
 "blazing-soul-i": {
  "apiName": "TFT_Augment_BlazingSoul",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AbilityPower": 20.0,
    "AttackSpeed": 0.20000000298023224,
    "TransferDuration": 3.0
   },
  },
  "gifts": [],
  "schedules": [],
  "combat": "blazingSoul"
 },
 "blazing-soul-ii": {
  "apiName": "TFT_Augment_BlazingSoul2",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AbilityPower": 35.0,
    "AttackSpeed": 0.30000001192092896,
    "TransferDuration": 3.0
   },
  },
  "gifts": [],
  "schedules": [],
  "combat": "blazingSoul"
 },
 "noble-sacrifice": {
  "apiName": "TFT_Augment_NobleSacrifice",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BaseResists": 25.0,
    "SharePerc": 0.10000000149011612
   },
  },
  "gifts": [],
  "schedules": [],
  "combat": "nobleSacrifice"
 },
 "wealthy-rehab-i": {
  "apiName": "TFT_Augment_WealthyRehab1",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 8.0,
    "HealingThreshold": 10000.0,
    "Omnivamp": 0.10000000149011612
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "team-healing",
    "every": "HealingThreshold",
    "repeat": false,
    "gold": "Gold",
    "gifts": []
   }
  ],
  "combat": "wealthyRehab"
 },
 "wealthy-rehab-ii": {
  "apiName": "TFT_Augment_WealthyRehab2",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 15.0,
    "HealingThreshold": 10000.0,
    "Omnivamp": 0.15000000596046448
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "team-healing",
    "every": "HealingThreshold",
    "repeat": false,
    "gold": "Gold",
    "gifts": []
   }
  ],
  "combat": "wealthyRehab"
 },


 "corrosion": {
  "apiName": "TFT_Augment_Corrosion",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "ResistLoss": 3.0,
    "Time": 2.0
   },
  },
  "gifts": [],
  "schedules": [],
  "corrosion": true
 },
 "building-a-collection-iii": {
  "apiName": "TFT9_Augment_BuildingACollectionPlusPlus",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": null,
    "roundsofbonusitems": 6.0
   },
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "component",
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "round-start",
    "every": 1,
    "repeat": true,
    "max": 5,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "worth-the-wait": {
  "apiName": "TFT_Augment_WorthTheWaitGold",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AdditionalCopies": 99.0,
    "Delay": 2.0,
    "UnitTier": 1.0,
    "{3a9ff59a}": 3.0
   },
  },
  "gifts": [
   {
    "kind": "random-unit",
    "cost": 1,
    "count": 1,
    "starLevel": 2
   }
  ],
  "schedules": [
   {
    "counter": "round-start",
    "every": 1,
    "repeat": true,
    "from": "Delay",
    "max": "AdditionalCopies",
    "copyOf": 0,
    "gifts": []
   }
  ]
 },
 "worth-the-wait-ii": {
  "apiName": "TFT_Augment_WorthTheWaitPrismatic",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AdditionalCopies": 99.0,
    "Delay": null,
    "UnitTier": 2.0,
    "{3a9ff59a}": 1.0
   },
  },
  "gifts": [
   {
    "kind": "random-unit",
    "cost": 2,
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "round-start",
    "every": 1,
    "repeat": true,
    "max": "AdditionalCopies",
    "copyOf": 0,
    "gifts": []
   }
  ]
 },
 "flexible": {
  "apiName": "TFT_Augment_Flexible",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BonusStages": 99.0,
    "HPPerEmblem": 40.0,
    "StartingEmblems": 1.0
   },
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "emblem",
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "stage-start",
    "every": 1,
    "repeat": true,
    "max": "BonusStages",
    "gifts": [
     {
      "kind": "random-item",
      "pool": "emblem",
      "count": 1
     }
    ]
   }
  ],
  "flexible": true
 },
 "rolling-for-days-i": {
  "apiName": "TFT9_Augment_Commander_RollingForDays",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numrolls": 11.0
   },
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "now": "Numrolls"
  }
 },
 "superstars-i": {
  "apiName": "TFT_Augment_SuperstarsSilver",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BaseBonusDamage": 0.05000000074505806,
    "BonusDamagePer3Star": 0.019999999552965164,
    "Rerolls": 2.0
   },
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "now": "Rerolls"
  },
  "superstars": true
 },
 "superstars-ii": {
  "apiName": "TFT_Augment_Superstars",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "BaseBonusDamage": 0.07000000029802322,
    "BonusDamagePer3Star": 0.05000000074505806,
    "Rerolls": 4.0
   },
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "now": "Rerolls"
  },
  "superstars": true
 },
 "trade-sector": {
  "apiName": "TFT6_Augment_TradeSector",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 1.0
   },
  },
  "gifts": [],
  "schedules": [],
  "freeRerolls": {
   "perRound": 1
  },
  "gold": "Gold"
 },
 "eye-for-an-eye-plus": {
  "apiName": "TFT_Augment_EyeForAnEyePlus",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AllyDeaths": 13.0,
    "NumComponents": 3.0,
    "{a6cb80ca}": 1.0
   },
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "component",
    "count": 1
   }
  ],
  "schedules": [
   {
    "counter": "allied-deaths",
    "every": "AllyDeaths",
    "max": "NumComponents",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "prizefighter": {
  "apiName": "TFT11_Augment_Prizefighter",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "WinsNeeded": 5.0,
    "component": 2.0
   },
  },
  "gifts": [
   {
    "kind": "random-item",
    "pool": "component",
    "count": 2
   }
  ],
  "schedules": [
   {
    "counter": "pvp-win",
    "every": "WinsNeeded",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "shimmerscale-essence": {
  "apiName": "TFT_Augment_ShimmerscaleEssence",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 5.0
   },
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT7_Item_ShimmerscaleMogulsMail"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT7_Item_ShimmerscaleGamblersBlade"
     }
    ]
   }
  ]
 },
 "eye-for-an-eye": {
  "apiName": "TFT_Augment_EyeForAnEye",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "AllyDeaths": 15.0,
    "NumComponents": 4.0,
    "{a6cb80ca}": null
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "allied-deaths",
    "every": "AllyDeaths",
    "max": "NumComponents",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "team-building": {
  "apiName": "TFT9_Augment_ArmyBuilding",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "PlayerCombatNum": 7.0
   },
  },
  "gifts": [
   {
    "kind": "consumable",
    "definitionId": "TFT_Consumable_ChampionDuplicator_III"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "PlayerCombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "consumable",
      "definitionId": "TFT_Consumable_ChampionDuplicator_III"
     }
    ]
   }
  ]
 },
 "latent-forge": {
  "apiName": "TFT9_Augment_LongTimeCrafting",
  "tier": "silver",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numberofcombats": 8.0
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "Numberofcombats",
    "repeat": false,
    "gifts": [
     {
      "kind": "unit",
      "definitionId": "TFT_ArmoryKeyOrnn"
     }
    ]
   }
  ]
 },
 "phreaky-friday": {
  "apiName": "TFT9_Augment_PhreakyFriday",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 5.0
   },
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT4_Item_OrnnInfinityForce"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT4_Item_OrnnInfinityForce"
     }
    ]
   }
  ]
 },
 "phreaky-friday-plus": {
  "apiName": "TFT9_Augment_PhreakyFridayPlus",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 3.0
   },
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT4_Item_OrnnInfinityForce"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT4_Item_OrnnInfinityForce"
     }
    ]
   }
  ]
 },
 "dark-alley-dealings": {
  "apiName": "TFT_Augment_DarkAlleyDealings",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "CombatNum": 3.0
   },
  },
  "gifts": [
   {
    "kind": "item",
    "definitionId": "TFT_Item_Artifact_SuspiciousTrenchCoat"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "CombatNum",
    "repeat": false,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT9_Item_OrnnTrickstersGlass"
     }
    ]
   }
  ]
 },
 "living-forge": {
  "apiName": "TFT7_Augment_LivingForge",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Numberofcombats": 9.0
   },
  },
  "gifts": [
   {
    "kind": "unit",
    "definitionId": "TFT_ArmoryKeyOrnn"
   }
  ],
  "schedules": [
   {
    "counter": "pvp-combat",
    "every": "Numberofcombats",
    "repeat": true,
    "gifts": [
     {
      "kind": "unit",
      "definitionId": "TFT_ArmoryKeyOrnn"
     }
    ]
   }
  ]
 },
 "what-doesnt-kill-you": {
  "apiName": "TFT9_Augment_WhatDoesntKillYou",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 2.0,
    "RoundsPerComponent": 4.0
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "pvp-loss",
    "every": 1,
    "repeat": true,
    "gold": "Gold",
    "gifts": []
   },
   {
    "counter": "pvp-loss",
    "every": "RoundsPerComponent",
    "repeat": true,
    "gifts": [
     {
      "kind": "random-item",
      "pool": "component",
      "count": 1
     }
    ]
   }
  ]
 },
 "warpath": {
  "apiName": "TFT_Augment_Warpath",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "PlayerDamage": 60.0,
    "{16253d09}": null,
    "{3dc22ab3}": 4.0,
    "{68c537b7}": null,
    "{6cf88c79}": 1.0,
    "{7c96bf44}": 1
   },
  },
  "gifts": [],
  "schedules": [
   {
    "counter": "damage-dealt",
    "every": "PlayerDamage",
    "repeat": false,
    "gifts": [
     {
      "kind": "random-unit",
      "cost": 5,
      "count": 4,
      "starLevel": 1
     },
     {
      "kind": "random-unit",
      "cost": 4,
      "count": 1,
      "starLevel": 2
     },
     {
      "kind": "unit",
      "definitionId": "TFT_ArmoryKeyCompleted"
     }
    ]
   }
  ]
 },
 "magic-roll": {
  "apiName": "TFT_Augment_MagicRoll",
  "tier": "gold",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "EggTurns": 3.0,
    "NumComponents": 2.0,
    "{3b0ef232}": 250.0,
    "{95ed8271}": 3,
    "{9a58ced6}": 4.0,
    "{b0892e64}": 2.0,
    "{c726cd82}": 1.0
   },
  },
  "gifts": [],
  "outcome": "magic-roll",
  "schedules": [
   {
    "counter": "outcome",
    "every": 1,
    "repeat": false,
    "gifts": []
   },
   {
    "counter": "magic-egg",
    "every": 1,
    "repeat": false,
    "gold": 5,
    "gifts": [
     {
      "kind": "item",
      "definitionId": "TFT_Item_ForceOfNature"
     },
     {
      "kind": "random-unit",
      "cost": 5,
      "count": 2
     }
    ]
   }
  ]
 },
 "call-to-chaos": {
  "apiName": "TFT11_Augment_Calltochaos",
  "tier": "prismatic",
  "source": {
   "patch": "14.24",
   "archive": "augments-research-2026-10-23/data/augments-14.24.json",
   "values": {
    "Gold": 58.0,
    "NumEmblems": 5.0,
    "Rerolls": 40.0,
    "XP": 64.0,
    "numtg": 3.0,
    "{5edfa63d}": 20.0,
    "{8c58ac06}": 3.0,
    "{8f15cad2}": 3.0
   },
  },
  "gifts": [],
  "outcome": "call-to-chaos",
  "schedules": [
   {
    "counter": "outcome",
    "every": 1,
    "repeat": false,
    "gifts": []
   }
  ]
 }
});
export type MagicRollKind='egg'|'high-triple'|'low-triple'|'health'|'units'|'components'|'pan';
/** P 2026-10-24 precedence: the ordered 6-2-6 egg, then triples, then the total's band (4–8, 9–11, 12–15, 16–17). */
export function magicRollKind(d:readonly number[]):MagicRollKind {
 if(d[0]===6&&d[1]===2&&d[2]===6)return 'egg';
 if(d[0]===d[1]&&d[1]===d[2])return d[0]>=4?'high-triple':'low-triple';
 const sum=d[0]+d[1]+d[2];
 return sum<=8?'health':sum<=11?'units':sum<=15?'components':'pan';
}
/** Avalanche finalizer (murmur3 fmix32) so neighbouring match seeds give independent first draws. */
export function mixSeed(value:number):number {
 let h=value>>>0;h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;
}
/** Call to Chaos: one of its ten S13 rewards (10% each; P 2026-10-24) on a source/seat/choice-bound stream. */
export const CALL_TO_CHAOS_OUTCOMES=['gold','three-star','hullbreakers','horizon-focus','thiefs-gloves','solari-dummy','zeke-dummy','emblems','xp','rerolls'] as const;
export type CallToChaosOutcome=(typeof CALL_TO_CHAOS_OUTCOMES)[number];
export function callToChaosOutcome(state:{readonly seed:number;readonly multiplayer?:{readonly seatId:string}},augment:{readonly choiceId:string;readonly definitionId:string}):CallToChaosOutcome {
 const namespace=JSON.stringify(['augment-pool-batch3','chaos',state.multiplayer?.seatId??'solo',augment.choiceId,augment.definitionId]);
 let rng=0x811c9dc5;for(let i=0;i<namespace.length;i++)rng=Math.imul(rng^namespace.charCodeAt(i),0x01000193)>>>0;
 return CALL_TO_CHAOS_OUTCOMES[Math.floor(nextRandom(mixSeed(state.seed^rng)).word*CALL_TO_CHAOS_OUTCOMES.length/4294967296)];
}
export function batch3Count(row:Batch3Content,key:string|number):number {
 const n=typeof key==='number'?key:row.source.values[key];
 if(!Number.isSafeInteger(n)||n!<1)throw new RangeError(`Batch3 source value ${String(key)}`);return n!;
}
export const HERO_UNITS=['steb','irelia','trundle','renni','vander','vladimir'] as const;
/** Every hero row carries every coefficient (0 when unused), so the mechanic has one fixed parameter set. */
export const HERO_FIELDS=['hero','manaReduction','hitBps','hits','omnivampBps','attackSpeedBps','dashAd1','dashAd2','dashAd3','dashAp1','dashAp2','dashAp3','dashRange','speedBps','speedTicks','permanentAdBps','mainBps','chargeBps','pounceRange','damageBps','splashBps','rangeBonus','attackMana','ampBps','overkillBps','near1','near2','near3'] as const;
/** Hero augment coefficients: 14.24 augment values plus the a-level Hero SpellObject values (s13-missing-values research C3,
 * star slots 1–3). Everything a later cast reads is frozen here; P 2026-10-24 for the unconfirmed timing/geometry. */
function batch3HeroValues(row:Batch3Content):Record<string,number> {
 const v=row.source.values as Record<string,number>,hero=HERO_UNITS.indexOf(row.hero!);
 const all=(x:Record<string,number>)=>({...Object.fromEntries(HERO_FIELDS.map(k=>[k,0])),...x});
 switch(row.hero){
  case 'steb':return all({hero,manaReduction:v.ManaReduction,hitBps:Math.round(v.TOOLTIPONLYModifiedDamage*10000),hits:3,omnivampBps:Math.round(v.TOOLTIPONLYOmnivamp*100)});
  case 'irelia':return all({hero,attackSpeedBps:Math.round(v.TOOLTIPBonusAS*10000),dashAd1:33500,dashAd2:33500,dashAd3:34500,dashAp1:40,dashAp2:60,dashAp3:90,dashRange:3});
  case 'trundle':return all({hero,manaReduction:v.ManaReduction,speedBps:Math.round(v.TOOLTIPONLYAS*100),speedTicks:Math.round(v.TOOLTIPONLYDuration*20),permanentAdBps:Math.round(v.TOOLTIPONLYADPerCast*100)});
  case 'renni':return all({hero,manaReduction:v.TOOLTIPManaReduction,mainBps:Math.round(v.TOOLTIPAbilityDamage*10000),chargeBps:Math.round(v['{9dff3ac5}']*10000),pounceRange:v.TOOLTIPHexDistance});
  case 'vander':return all({hero,damageBps:10000+Math.round(v.TooltipBonusDamage*10000),splashBps:Math.round(v.TOOLTIPONLYSplashPerc*10000)});
  default:return all({hero,rangeBonus:v.IncRange,attackMana:v.BonusMana,damageBps:10000+Math.round(v.TooltipBonusDamage*10000),ampBps:Math.round(v.TOOLTIPDamageAmp*10000),overkillBps:Math.round(v['{256e31ce}']*100),near1:90,near2:135,near3:205});
 }
}
function batch3CombatValues(row:Batch3Content):Record<string,number> {
 const bps=(key:string)=>Math.round(row.source.values[key]!*10000);
 switch(row.combat){
  case 'blazingSoul':return {abilityPower:batch3Count(row,'AbilityPower'),attackSpeedBps:bps('AttackSpeed'),periodTicks:batch3Count(row,'TransferDuration')*20};
  case 'badLuck':return {ratioBps:Math.round(row.source.values.ADPerCrit!*10000/row.source.values.CritChancePercent!*100)};
  case 'towerDefense':{const t=TOWER_DEFENSE_SPELL;return {apRatio1:t.apRatio[0],apRatio2:t.apRatio[1],apRatio3:t.apRatio[2],upgrade1Stage:t.upgrade1Stage,upgrade1AsBps:t.upgrade1AsBps,upgrade2Stage:t.upgrade2Stage,upgrade2Bps:t.upgrade2Bps};}
  case 'goldForDummies':return {periodTicks:batch3Count(row,'GoldDuration')*20};
  case 'nobleSacrifice':return {baseResists:batch3Count(row,'BaseResists'),shareBps:bps('SharePerc')};
  default:return {omnivampBps:bps('Omnivamp')};
 }
}
export const AUGMENT_BATCH3_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row]):[string,ChoiceDefinition]=>[id,{
 id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},
  ...(row.gold?[{kind:'mechanic' as const,mechanic:'acquisitionGold',values:{amount:batch3Count(row,row.gold)}}]:[]),
  ...(row.hero?[{kind:'mechanic' as const,mechanic:'heroCarry',values:batch3HeroValues(row)}]:[]),
  ...(row.forming?[{kind:'mechanic' as const,mechanic:'forming',values:row.forming==='dummy'
   ?{golem:0,healthBps:batch3Count(row,'HealthPercent')*100,attackBps:0,healthPerStage:batch3Count(row,'HPPerStage')}
   :{golem:1,healthBps:batch3Count(row,'HealthPercent')*100,attackBps:batch3Count(row,'ADPercent')*100,healthPerStage:batch3Count(row,'HPPerStage')}}]:[]),
  ...(row.outcome==='magic-roll'?[{kind:'mechanic' as const,mechanic:'magicRoll',values:{health:batch3Count(row,'{3b0ef232}')}}]:[]),
  ...(row.combat?[{kind:'mechanic' as const,mechanic:row.combat,values:batch3CombatValues(row)}]:[]),
  ...(row.corrosion?[{kind:'mechanic' as const,mechanic:'corrosion',values:{resistLoss:batch3Count(row,'ResistLoss'),periodTicks:batch3Count(row,'Time')*20}}]:[]),
  ...(row.flexible?[{kind:'mechanic' as const,mechanic:'flexible',values:{healthPerEmblem:batch3Count(row,'HPPerEmblem')}}]:[]),
  ...(row.superstars?[{kind:'mechanic' as const,mechanic:'superstars',values:{baseBps:Math.round(row.source.values.BaseBonusDamage!*10000),per3StarBps:Math.round(row.source.values.BonusDamagePer3Star!*10000)}}]:[])],
}])));
/** 14.24 stage ItemTags of the batch-3 rows, read as the batch-3 XP line does ({d02ae323}/{d12ae4b6}/{d22ae649} =
 * not at 2-1/3-2/4-2; P 2026-10-24, docs/S13_RULES_GAP.md). Copied from the research JSON's item_tags_raw (test-checked). */
export const AUGMENT_BATCH3_NODE_BANS:Readonly<Record<string,readonly string[]>>=freezeContent({
 TFT_Augment_Dummify:["2-1", "4-2"],
 TFT_Augment_Golemify:["2-1", "4-2"],
 TFT9_Augment_DravenSpoilsOfWar:["3-2", "4-2"],
 TFT9_Augment_DravenSpoilsOfWar2:["3-2", "4-2"],
 TFT9_Augment_DravenSpoilsOfWar3:["3-2", "4-2"],
 TFT13_Augment_FishCarry:["3-2", "4-2"],
 TFT13_Augment_IreliaCarry:["3-2", "4-2"],
 TFT13_Augment_TrundleCarry:["3-2", "4-2"],
 TFT13_Augment_ChainsawCarry:["2-1", "4-2"],
 TFT13_Augment_PrimeCarry:["3-2", "4-2"],
 TFT13_Augment_VladCarry:["3-2", "4-2"],
 TFT_Augment_TowerDefense:["4-2"],
 TFT6_Augment_TheGoldenEgg:["2-1", "3-2"],
 TFT_Augment_AnExaltedAdventure:["3-2", "4-2"],
 TFT_Augment_SupportMining:["3-2", "4-2"],
 TFT_Augment_SupportMiningPlus:["2-1", "4-2"],
 TFT10_Augment_Scapegoat:["3-2", "4-2"],
 TFT11_Augment_WanderingTrainerGold:["3-2", "4-2"],
 TFT9_Augment_WanderingTrainer:["3-2", "4-2"],
 TFT_Augment_GoldForDummies:["3-2", "4-2"],
 TFT_Augment_BadLuckProtection:["2-1"],
 TFT_Augment_BlazingSoul:["2-1"],
 TFT_Augment_BlazingSoul2:["2-1"],
 TFT_Augment_NobleSacrifice:["2-1"],
 TFT_Augment_WealthyRehab1:["2-1"],
 TFT_Augment_WealthyRehab2:["2-1"],
 TFT_Augment_Corrosion:["2-1"],
 TFT9_Augment_BuildingACollectionPlusPlus:["4-2"],
 TFT_Augment_WorthTheWaitGold:["3-2", "4-2"],
 TFT_Augment_WorthTheWaitPrismatic:["3-2", "4-2"],
 TFT_Augment_Flexible:["3-2", "4-2"],
 TFT9_Augment_Commander_RollingForDays:["2-1"],
 TFT_Augment_SuperstarsSilver:["3-2", "4-2"],
 TFT_Augment_Superstars:["3-2", "4-2"],
 TFT6_Augment_TradeSector:["3-2", "4-2"],
 TFT_Augment_EyeForAnEyePlus:["2-1", "4-2"],
 TFT11_Augment_Prizefighter:["3-2", "4-2"],
 TFT_Augment_ShimmerscaleEssence:["3-2", "4-2"],
 TFT_Augment_EyeForAnEye:["3-2", "4-2"],
 TFT9_Augment_ArmyBuilding:["4-2"],
 TFT9_Augment_LongTimeCrafting:["3-2", "4-2"],
 TFT9_Augment_PhreakyFriday:["3-2", "4-2"],
 TFT9_Augment_PhreakyFridayPlus:["2-1"],
 TFT_Augment_DarkAlleyDealings:["2-1", "4-2"],
 TFT7_Augment_LivingForge:["3-2", "4-2"],
 TFT9_Augment_WhatDoesntKillYou:["3-2", "4-2"],
 TFT_Augment_Warpath:["3-2", "4-2"],
 TFT_Augment_MagicRoll:["2-1", "4-2"],
 TFT11_Augment_Calltochaos:["2-1", "3-2"]
});
export const AUGMENT_BATCH3_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH3_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH3).map(([id,row])=>[id,row.apiName])));

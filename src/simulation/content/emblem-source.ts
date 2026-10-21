import { freezeContent } from './freeze';
/** Offline transcription: archived en_us.json + map22 ItemKeyDefinition_EMBLEM_SET13. See docs/V18_TRAIT_EXPANSION.md. */
export const EMBLEM_SOURCE = freezeContent([
  {
    "apiName": "TFT13_Item_AmbusherEmblemItem",
    "traitId": "ambusher",
    "name": "Ambusher Emblem",
    "recipe": [
      "gloves",
      "frying-pan"
    ],
    "values": {
      "CritChance": 20
    }
  },
  {
    "apiName": "TFT13_Item_RebelEmblemItem",
    "traitId": "rebel",
    "name": "Rebel Emblem",
    "recipe": [
      "spatula",
      "bow"
    ],
    "values": {
      "AS": 10
    }
  },
  {
    "apiName": "TFT13_Item_SquadEmblemItem",
    "traitId": "enforcer",
    "name": "Enforcer Emblem",
    "recipe": [
      "spatula",
      "vest"
    ],
    "values": {
      "Armor": 20
    }
  },
  {
    "apiName": "TFT13_Item_SorcererEmblemItem",
    "traitId": "sorcerer",
    "name": "Sorcerer Emblem",
    "recipe": [
      "rod",
      "frying-pan"
    ],
    "values": {
      "AP": 10
    }
  },
  {
    "apiName": "TFT13_Item_AcademyEmblemItem",
    "traitId": "academy",
    "name": "Academy Emblem",
    "recipe": [],
    "values": {
      "Health": 150
    }
  },
  {
    "apiName": "TFT13_Item_CabalEmblemItem",
    "traitId": "black-rose",
    "name": "Black Rose Emblem",
    "recipe": [
      "rod",
      "spatula"
    ],
    "values": {
      "AP": 10
    }
  },
  {
    "apiName": "TFT13_Item_ExperimentEmblemItem",
    "traitId": "experiment",
    "name": "Experiment Emblem",
    "recipe": [
      "belt",
      "spatula"
    ],
    "values": {
      "Health": 150,
      "NumCopies": 1,
      "PercentMaxHealth": 0.6,
      "SplitTime": 8
    }
  },
  {
    "apiName": "TFT13_Item_BruiserEmblemItem",
    "traitId": "bruiser",
    "name": "Bruiser Emblem",
    "recipe": [
      "belt",
      "frying-pan"
    ],
    "values": {
      "Health": 150
    }
  },
  {
    "apiName": "TFT13_Item_AutomataEmblemItem",
    "traitId": "automata",
    "name": "Automata Emblem",
    "recipe": [
      "spatula",
      "cloak"
    ],
    "values": {
      "MagicResist": 20
    }
  },
  {
    "apiName": "TFT13_Item_DemolitionistEmblemItem",
    "traitId": "artillerist",
    "name": "Artillerist Emblem",
    "recipe": [
      "sword",
      "frying-pan"
    ],
    "values": {
      "AD": 0.1
    }
  },
  {
    "apiName": "TFT13_Item_InfusedEmblemItem",
    "traitId": "dominator",
    "name": "Dominator Emblem",
    "recipe": [],
    "values": {
      "Health": 150
    }
  },
  {
    "apiName": "TFT13_Item_CrimeEmblemItem",
    "traitId": "chem-baron",
    "name": "Chem-Baron Emblem",
    "recipe": [],
    "values": {
      "Health": 150
    }
  },
  {
    "apiName": "TFT13_Item_ScrapEmblemItem",
    "traitId": "scrap",
    "name": "Scrap Emblem",
    "recipe": [],
    "values": {
      "Health": 150
    }
  },
  {
    "apiName": "TFT13_Item_HoverboardEmblemItem",
    "traitId": "firelight",
    "name": "Firelight Emblem",
    "recipe": [
      "gloves",
      "spatula"
    ],
    "values": {
      "CritChance": 20
    }
  },
  {
    "apiName": "TFT13_Item_WarbandEmblemItem",
    "traitId": "conqueror",
    "name": "Conqueror Emblem",
    "recipe": [
      "sword",
      "spatula"
    ],
    "values": {
      "AD": 0.1
    }
  },
  {
    "apiName": "TFT13_Item_ChallengerEmblemItem",
    "traitId": "quickstriker",
    "name": "Quickstriker Emblem",
    "recipe": [
      "bow",
      "frying-pan"
    ],
    "values": {
      "AS": 10
    }
  },
  {
    "apiName": "TFT13_Item_TitanEmblemItem",
    "traitId": "sentinel",
    "name": "Sentinel Emblem",
    "recipe": [
      "vest",
      "frying-pan"
    ],
    "values": {
      "Armor": 20
    }
  },
  {
    "apiName": "TFT13_Item_SniperEmblemItem",
    "traitId": "sniper",
    "name": "Sniper Emblem",
    "recipe": [],
    "values": {
      "Health": 150,
      "RangeIncrease": 2
    }
  },
  {
    "apiName": "TFT13_Item_PitFighterEmblemItem",
    "traitId": "pit-fighter",
    "name": "Pit Fighter Emblem",
    "recipe": [
      "cloak",
      "frying-pan"
    ],
    "values": {
      "MagicResist": 20
    }
  },
  {
    "apiName": "TFT13_Item_InvokerEmblemItem",
    "traitId": "visionary",
    "name": "Visionary Emblem",
    "recipe": [
      "tear",
      "frying-pan"
    ],
    "values": {
      "Mana": 15
    }
  },
  {
    "apiName": "TFT13_Item_FamilyEmblemItem",
    "traitId": "family",
    "name": "Family Emblem",
    "recipe": [
      "spatula",
      "tear"
    ],
    "values": {
      "Mana": 15
    }
  },
  {
    "apiName": "TFT13_Item_WatcherEmblemItem",
    "traitId": "watcher",
    "name": "Watcher Emblem",
    "recipe": [],
    "values": {
      "Health": 150
    }
  }
]);
export const EMBLEM_REFORGE_SOURCE = freezeContent([
  "TFT13_Item_CabalEmblemItem",
  "TFT13_Item_CrimeEmblemItem",
  "TFT13_Item_ExperimentEmblemItem",
  "TFT13_Item_FamilyEmblemItem",
  "TFT13_Item_HoverboardEmblemItem",
  "TFT13_Item_RebelEmblemItem",
  "TFT13_Item_SquadEmblemItem",
  "TFT13_Item_WarbandEmblemItem",
  "TFT13_Item_AcademyEmblemItem",
  "TFT13_Item_AutomataEmblemItem",
  "TFT13_Item_ScrapEmblemItem",
  "TFT13_Item_AmbusherEmblemItem",
  "TFT13_Item_BruiserEmblemItem",
  "TFT13_Item_ChallengerEmblemItem",
  "TFT13_Item_InvokerEmblemItem",
  "TFT13_Item_PitFighterEmblemItem",
  "TFT13_Item_SorcererEmblemItem",
  "TFT13_Item_DemolitionistEmblemItem",
  "TFT13_Item_SniperEmblemItem",
  "TFT13_Item_TitanEmblemItem",
  "TFT13_Item_WatcherEmblemItem",
  "TFT13_Item_InfusedEmblemItem"
]);

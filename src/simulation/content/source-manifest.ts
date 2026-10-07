import { freezeContent } from './freeze';
/** Provenance is distinct from runtime coefficients. Full unmodified selected records are archived next to this module. */
export const SOURCE_MANIFEST = freezeContent({
  "referencePatch": "S13-14.24b",
  "contentVersion": "s13-14.24b-slice-v1",
  "rawUrl": "https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json",
  "rawSha256": "c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3",
  "selector": "setData[mutator === \"TFTSet13\"]",
  "localArchive": "src/simulation/content/source/s13-14.24.json",
  "overrides": [
    {
      "path": "champions.loris.stats.initialMana",
      "from": 50,
      "to": 40
    },
    {
      "path": "champions.loris.stats.mana",
      "from": 90,
      "to": 80
    }
  ],
  "overrideSource": "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/",
  "anomalySource": "https://wiki.leagueoflegends.com/en-us/TFT:Anomaly?oldid=3848901",
  "championApiNames": {
    "irelia": "TFT13_Irelia",
    "maddie": "TFT13_Shooter",
    "darius": "TFT13_Darius",
    "lux": "TFT13_Lux",
    "zyra": "TFT13_Zyra",
    "tristana": "TFT13_Tristana",
    "urgot": "TFT13_Urgot",
    "rell": "TFT13_Rell",
    "leona": "TFT13_Leona",
    "vander": "TFT13_Prime",
    "kogmaw": "TFT13_KogMaw",
    "scar": "TFT13_FlyGuy",
    "ezreal": "TFT13_Ezreal",
    "loris": "TFT13_Beardy",
    "nami": "TFT13_Nami",
    "corki": "TFT13_Corki",
    "garen": "TFT13_Garen",
    "zoe": "TFT13_Zoe",
    "caitlyn": "TFT13_Caitlyn"
  },
  "itemApiNames": {
    "sword": "TFT_Item_BFSword",
    "bow": "TFT_Item_RecurveBow",
    "rod": "TFT_Item_NeedlesslyLargeRod",
    "tear": "TFT_Item_TearOfTheGoddess",
    "vest": "TFT_Item_ChainVest",
    "cloak": "TFT_Item_NegatronCloak",
    "belt": "TFT_Item_GiantsBelt",
    "rageblade": "TFT_Item_GuinsoosRageblade",
    "deathblade": "TFT_Item_Deathblade",
    "shojin": "TFT_Item_SpearOfShojin",
    "archangel": "TFT_Item_ArchangelsStaff",
    "deathcap": "TFT_Item_RabadonsDeathcap",
    "warmog": "TFT_Item_WarmogsArmor",
    "dragons-claw": "TFT_Item_DragonsClaw",
    "gargoyle": "TFT_Item_GargoyleStoneplate",
    "gunblade": "TFT_Item_HextechGunblade"
  },
  "augmentApiNames": {
    "placebo": "TFT_Augment_Placebo",
    "manaflow-i": "TFT_Augment_Manaflow1",
    "glass-cannon-i": "TFT_Augment_GlassCannonI",
    "pumping-up-i": "TFT9_Augment_PumpingUp",
    "investment-strategy-i": "TFT_Augment_InvestmentStrategy1",
    "bulky-buddies-i": "TFT_Augment_BulkyBuddies1"
  },
  "variableConvention": {
    "starSlots": [
      1,
      2,
      3
    ],
    "decimalPlaces": 4,
    "ratio": "fraction: multiply by 10000 to derive integer basis points",
    "duration": "seconds: multiply by 20 to derive ticks",
    "apAmount": "multiply by AP/100",
    "excludedPrefixes": [
      "HERO",
      "Experiment"
    ],
    "excludedModes": [
      "Hyperroll"
    ]
  },
  "disabledOriginTraits": {
    "irelia": [
      "Rebel"
    ],
    "maddie": [
      "Enforcer"
    ],
    "darius": [
      "Conqueror"
    ],
    "lux": [
      "Academy"
    ],
    "zyra": [
      "Experiment"
    ],
    "tristana": [
      "Emissary"
    ],
    "urgot": [
      "Experiment",
      "Pit Fighter"
    ],
    "rell": [
      "Conqueror",
      "Visionary"
    ],
    "leona": [
      "Academy"
    ],
    "vander": [
      "Family"
    ],
    "kogmaw": [
      "Automata"
    ],
    "scar": [
      "Firelight"
    ],
    "ezreal": [
      "Academy",
      "Rebel"
    ],
    "loris": [
      "Enforcer"
    ],
    "nami": [
      "Emissary"
    ],
    "corki": [
      "Scrap"
    ],
    "garen": [
      "Emissary"
    ],
    "zoe": [
      "Rebel"
    ],
    "caitlyn": [
      "Enforcer"
    ]
  },
  "approvedSimplifications": [
    "No origin-trait effects",
    "M5 hex line/cone geometry",
    "Fixed tick multi-shot cadence",
    "No Corki gameplay dash",
    "Template enemies, supply replaces carousel",
    "HP/AD star multipliers 1/1.8/3.24"
  ]
});

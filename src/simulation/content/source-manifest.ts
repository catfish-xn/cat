import { freezeContent } from './freeze';
/** Provenance is distinct from runtime coefficients. Full unmodified selected records are archived next to this module. */
export const SOURCE_MANIFEST = freezeContent({
  "referencePatch": "S13-14.24b",
  "contentVersion": "s13-14.24b-slice-v1",
  "equipmentCatalogVersion": "s13-14.24b-m8-b4-v3",
  "equipmentArchive": "src/simulation/content/source/s13-14.24b/normalized/items.json",
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
  "adaptive-helm": "TFT_Item_AdaptiveHelm",
  "archangel": "TFT_Item_ArchangelsStaff",
  "sword": "TFT_Item_BFSword",
  "bloodthirster": "TFT_Item_Bloodthirster",
  "blue-buff": "TFT_Item_BlueBuff",
  "bramble-vest": "TFT_Item_BrambleVest",
  "vest": "TFT_Item_ChainVest",
  "crownguard": "TFT_Item_Crownguard",
  "deathblade": "TFT_Item_Deathblade",
  "dragons-claw": "TFT_Item_DragonsClaw",
  "protectors-vow": "TFT_Item_FrozenHeart",
  "gargoyle": "TFT_Item_GargoyleStoneplate",
  "belt": "TFT_Item_GiantsBelt",
  "edge-of-night": "TFT_Item_GuardianAngel",
  "rageblade": "TFT_Item_GuinsoosRageblade",
  "gunblade": "TFT_Item_HextechGunblade",
  "infinity-edge": "TFT_Item_InfinityEdge",
  "ionic-spark": "TFT_Item_IonicSpark",
  "jeweled-gauntlet": "TFT_Item_JeweledGauntlet",
  "last-whisper": "TFT_Item_LastWhisper",
  "nashors-tooth": "TFT_Item_Leviathan",
  "giant-slayer": "TFT_Item_MadredsBloodrazor",
  "morellonomicon": "TFT_Item_Morellonomicon",
  "rod": "TFT_Item_NeedlesslyLargeRod",
  "cloak": "TFT_Item_NegatronCloak",
  "steadfast-heart": "TFT_Item_NightHarvester",
  "guardbreaker": "TFT_Item_PowerGauntlet",
  "quicksilver": "TFT_Item_Quicksilver",
  "deathcap": "TFT_Item_RabadonsDeathcap",
  "red-buff": "TFT_Item_RapidFireCannon",
  "bow": "TFT_Item_RecurveBow",
  "sunfire-cape": "TFT_Item_RedBuff",
  "redemption": "TFT_Item_Redemption",
  "runaans-hurricane": "TFT_Item_RunaansHurricane",
  "gloves": "TFT_Item_SparringGloves",
  "shojin": "TFT_Item_SpearOfShojin",
  "evenshroud": "TFT_Item_SpectralGauntlet",
  "statikk-shiv": "TFT_Item_StatikkShiv",
  "steraks-gage": "TFT_Item_SteraksGage",
  "tear": "TFT_Item_TearOfTheGoddess",
  "thiefs-gloves": "TFT_Item_ThiefsGloves",
  "titans-resolve": "TFT_Item_TitansResolve",
  "hand-of-justice": "TFT_Item_UnstableConcoction",
  "warmog": "TFT_Item_WarmogsArmor"
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

// Independently transcribed admitted 14.24b inventory; Swain deferred to G2-2.
export const G2_CATALOG = {
  "1": [
    "amumu",
    "darius",
    "irelia",
    "lux",
    "maddie",
    "powder",
    "singed",
    "violet",
    "zyra"
  ],
  "2": [
    "leona",
    "nocturne",
    "rell",
    "tristana",
    "urgot",
    "vander",
    "vladimir",
    "zeri"
  ],
  "3": [
    "blitzcrank",
    "ezreal",
    "kogmaw",
    "loris",
    "nami",
    "scar"
  ],
  "4": [
    "corki",
    "ekko",
    "garen",
    "illaoi",
    "twitch",
    "zoe"
  ],
  "5": [
    "caitlyn",
    "leblanc",
    "malzahar",
    "rumble"
  ]
} as const;
export const G2_HERO_IDS = Object.values(G2_CATALOG).flat().sort();

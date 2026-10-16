// G2-2 inventory transcribed from locked CDragon source; form-blocked heroes excluded.
export const G2_CATALOG = {
  "1": [
    "amumu",
    "darius",
    "draven",
    "irelia",
    "lux",
    "maddie",
    "morgana",
    "powder",
    "singed",
    "steb",
    "trundle",
    "vex",
    "violet",
    "zyra"
  ],
  "2": [
    "akali",
    "camille",
    "leona",
    "nocturne",
    "rell",
    "sett",
    "tristana",
    "urgot",
    "vander",
    "vladimir",
    "zeri",
    "ziggs"
  ],
  "3": [
    "blitzcrank",
    "ezreal",
    "kogmaw",
    "loris",
    "nami",
    "scar",
    "twistedfate"
  ],
  "4": [
    "ambessa",
    "corki",
    "ekko",
    "garen",
    "heimerdinger",
    "illaoi",
    "twitch",
    "vi",
    "zoe"
  ],
  "5": [
    "caitlyn",
    "jinx",
    "leblanc",
    "malzahar",
    "mordekaiser",
    "rumble"
  ]
} as const;
export const G2_HERO_IDS = Object.values(G2_CATALOG).flat().sort();

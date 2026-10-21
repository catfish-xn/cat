// Independent admission list: original Set13 roster plus the three approved v19 six costs.
export const G23_CATALOG = {
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
    "renata",
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
    "cassiopeia",
    "ezreal",
    "gangplank",
    "kogmaw",
    "loris",
    "nami",
    "nunu",
    "renni",
    "scar",
    "smeech",
    "swain",
    "twistedfate"
  ],
  "4": [
    "ambessa",
    "corki",
    "drmundo",
    "ekko",
    "elise",
    "garen",
    "heimerdinger",
    "illaoi",
    "silco",
    "twitch",
    "vi",
    "zoe"
  ],
  "5": [
    "caitlyn",
    "jayce",
    "jinx",
    "leblanc",
    "malzahar",
    "mordekaiser",
    "rumble",
    "sevika"
  ],
  "6": ["mel", "viktor", "warwick"]
} as const;

export const G23_HERO_IDS=Object.values(G23_CATALOG).flat().sort();

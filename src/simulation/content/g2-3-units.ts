// G2-3: hash-locked 14.24 source + explicitly documented 14.24b overrides.
import { freezeContent } from './freeze';
import type { UnitDefinition } from '../unit-types';
export const G23_UNITS: Readonly<Record<string, UnitDefinition>> = freezeContent({
  "renata": {
    "id": "renata",
    "name": "Renata Glasc",
    "symbol": "R",
    "color": 10466749,
    "cost": 2,
    "baseStats": {
      "health": 600,
      "attack": 35,
      "armor": 20,
      "magicResist": 20
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 20,
    "maxMana": 80,
    "abilityId": "renata-ability",
    "traits": [
      "chem-baron",
      "visionary"
    ]
  },
  "silco": {
    "id": "silco",
    "name": "Silco",
    "symbol": "S",
    "color": 10466749,
    "cost": 4,
    "baseStats": {
      "health": 800,
      "attack": 40,
      "armor": 30,
      "magicResist": 30
    },
    "attackRange": 4,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 30,
    "maxMana": 80,
    "abilityId": "silco-ability",
    "traits": [
      "chem-baron",
      "dominator"
    ]
  },
  "drmundo": {
    "id": "drmundo",
    "name": "Dr. Mundo",
    "symbol": "D",
    "color": 10466749,
    "cost": 4,
    "baseStats": {
      "health": 1100,
      "attack": 60,
      "armor": 60,
      "magicResist": 60
    },
    "attackRange": 1,
    "attackIntervalTicks": 31,
    "baseAttackSpeedBps": 6500,
    "initialMana": 30,
    "maxMana": 100,
    "abilityId": "drmundo-ability",
    "traits": [
      "experiment",
      "dominator"
    ]
  },
  "cassiopeia": {
    "id": "cassiopeia",
    "name": "Cassiopeia",
    "symbol": "C",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 700,
      "attack": 40,
      "armor": 25,
      "magicResist": 25
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 10,
    "maxMana": 40,
    "abilityId": "cassiopeia-ability",
    "traits": [
      "black-rose",
      "dominator"
    ]
  },
  "elise": {
    "id": "elise",
    "formSwap": true,
    "name": "Elise",
    "symbol": "E",
    "color": 10466749,
    "cost": 4,
    "baseStats": {
      "health": 1100,
      "attack": 60,
      "armor": 60,
      "magicResist": 60
    },
    "attackRange": 1,
    "attackIntervalTicks": 31,
    "baseAttackSpeedBps": 6500,
    "initialMana": 50,
    "maxMana": 160,
    "abilityId": "elise-ability",
    "traits": [
      "black-rose",
      "bruiser"
    ]
  },
  "elise-ranged": {
    "id": "elise-ranged",
    "name": "Elise (Ranged)",
    "symbol": "E",
    "color": 10466749,
    "cost": 4,
    "baseStats": {
      "health": 750,
      "attack": 45,
      "armor": 30,
      "magicResist": 30
    },
    "attackRange": 4,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 20,
    "maxMana": 80,
    "abilityId": "elise-ranged-ability",
    "traits": [
      "black-rose",
      "bruiser"
    ]
  },
  "jayce": {
    "id": "jayce",
    "formSwap": true,
    "name": "Jayce",
    "symbol": "J",
    "color": 10466749,
    "cost": 5,
    "baseStats": {
      "health": 1200,
      "attack": 90,
      "armor": 60,
      "magicResist": 60
    },
    "attackRange": 1,
    "attackIntervalTicks": 25,
    "baseAttackSpeedBps": 8000,
    "initialMana": 30,
    "maxMana": 80,
    "abilityId": "jayce-ability",
    "traits": [
      "academy"
    ]
  },
  "jayce-ranged": {
    "id": "jayce-ranged",
    "name": "Jayce (Ranged)",
    "symbol": "J",
    "color": 10466749,
    "cost": 5,
    "baseStats": {
      "health": 900,
      "attack": 60,
      "armor": 35,
      "magicResist": 35
    },
    "attackRange": 4,
    "attackIntervalTicks": 25,
    "baseAttackSpeedBps": 8000,
    "initialMana": 15,
    "maxMana": 65,
    "abilityId": "jayce-ranged-ability",
    "traits": [
      "academy"
    ]
  },
  "smeech": {
    "id": "smeech",
    "name": "Smeech",
    "symbol": "S",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 800,
      "attack": 70,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 25,
    "baseAttackSpeedBps": 8000,
    "initialMana": 20,
    "maxMana": 80,
    "abilityId": "smeech-ability",
    "traits": [
      "chem-baron",
      "ambusher"
    ]
  },
  "sevika": {
    "id": "sevika",
    "name": "Sevika",
    "symbol": "S",
    "color": 10466749,
    "cost": 5,
    "baseStats": {
      "health": 1200,
      "attack": 80,
      "armor": 60,
      "magicResist": 60
    },
    "attackRange": 1,
    "attackIntervalTicks": 23,
    "baseAttackSpeedBps": 9000,
    "initialMana": 0,
    "maxMana": 60,
    "abilityId": "sevika-ability",
    "traits": [
      "high-roller",
      "chem-baron",
      "pit-fighter"
    ]
  },
  "renni": {
    "id": "renni",
    "name": "Renni",
    "symbol": "R",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 850,
      "attack": 55,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 31,
    "baseAttackSpeedBps": 6500,
    "initialMana": 40,
    "maxMana": 100,
    "abilityId": "renni-ability",
    "traits": [
      "chem-baron",
      "bruiser"
    ]
  },
  "nunu": {
    "id": "nunu",
    "name": "Nunu & Willump",
    "symbol": "N",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 800,
      "attack": 50,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 34,
    "baseAttackSpeedBps": 6000,
    "initialMana": 60,
    "maxMana": 125,
    "abilityId": "nunu-ability",
    "traits": [
      "experiment",
      "bruiser",
      "visionary"
    ]
  },
  "gangplank": {
    "id": "gangplank",
    "formSwap": true,
    "name": "Gangplank",
    "symbol": "G",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 800,
      "attack": 65,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 27,
    "baseAttackSpeedBps": 7500,
    "initialMana": 0,
    "maxMana": 60,
    "abilityId": "gangplank-ability",
    "traits": [
      "scrap",
      "pit-fighter"
    ]
  },
  "gangplank-ranged": {
    "id": "gangplank-ranged",
    "name": "Gangplank (Ranged)",
    "symbol": "G",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 700,
      "attack": 50,
      "armor": 20,
      "magicResist": 20
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 0,
    "maxMana": 75,
    "abilityId": "gangplank-ranged-ability",
    "traits": [
      "scrap",
      "pit-fighter"
    ]
  },
  "swain": {
    "id": "swain",
    "formSwap": true,
    "name": "Swain",
    "symbol": "S",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 950,
      "attack": 45,
      "armor": 50,
      "magicResist": 50
    },
    "attackRange": 1,
    "attackIntervalTicks": 34,
    "baseAttackSpeedBps": 6000,
    "initialMana": 40,
    "maxMana": 100,
    "abilityId": "swain-ability",
    "traits": [
      "conqueror",
      "sorcerer"
    ]
  },
  "swain-ranged": {
    "id": "swain-ranged",
    "name": "Swain (Ranged)",
    "symbol": "S",
    "color": 10466749,
    "cost": 3,
    "baseStats": {
      "health": 650,
      "attack": 40,
      "armor": 25,
      "magicResist": 25
    },
    "attackRange": 4,
    "attackIntervalTicks": 29,
    "baseAttackSpeedBps": 7000,
    "initialMana": 20,
    "maxMana": 70,
    "abilityId": "swain-ranged-ability",
    "traits": [
      "conqueror",
      "sorcerer"
    ]
  }
});
export const G23_MEMBERSHIP: Readonly<Record<string, readonly string[]>> = freezeContent({
  "singed": [
    "chem-baron",
    "sentinel"
  ],
  "renata": [
    "chem-baron",
    "visionary"
  ],
  "silco": [
    "chem-baron",
    "dominator"
  ],
  "camille": [
    "enforcer",
    "ambusher"
  ],
  "blitzcrank": [
    "automata",
    "dominator"
  ],
  "vi": [
    "enforcer",
    "pit-fighter"
  ],
  "caitlyn": [
    "enforcer",
    "sniper"
  ],
  "ekko": [
    "firelight",
    "scrap",
    "ambusher"
  ],
  "amumu": [
    "automata",
    "watcher"
  ],
  "malzahar": [
    "automata",
    "visionary"
  ],
  "drmundo": [
    "experiment",
    "dominator"
  ],
  "twitch": [
    "experiment",
    "sniper"
  ],
  "akali": [
    "rebel",
    "quickstriker"
  ],
  "sett": [
    "rebel",
    "bruiser"
  ],
  "ezreal": [
    "academy",
    "rebel",
    "artillerist"
  ],
  "illaoi": [
    "rebel",
    "sentinel"
  ],
  "draven": [
    "conqueror",
    "pit-fighter"
  ],
  "rell": [
    "conqueror",
    "sentinel",
    "visionary"
  ],
  "cassiopeia": [
    "black-rose",
    "dominator"
  ],
  "vladimir": [
    "black-rose",
    "watcher",
    "sorcerer"
  ],
  "elise": [
    "black-rose",
    "bruiser"
  ],
  "leblanc": [
    "black-rose",
    "sorcerer"
  ],
  "heimerdinger": [
    "academy",
    "visionary"
  ],
  "jayce": [
    "academy"
  ],
  "trundle": [
    "scrap",
    "bruiser"
  ],
  "ziggs": [
    "scrap",
    "dominator"
  ],
  "rumble": [
    "junker-king",
    "scrap",
    "sentinel"
  ],
  "smeech": [
    "chem-baron",
    "ambusher"
  ],
  "sevika": [
    "high-roller",
    "chem-baron",
    "pit-fighter"
  ],
  "renni": [
    "chem-baron",
    "bruiser"
  ],
  "loris": [
    "enforcer",
    "sentinel"
  ],
  "steb": [
    "enforcer",
    "bruiser"
  ],
  "maddie": [
    "enforcer",
    "sniper"
  ],
  "powder": [
    "family",
    "scrap",
    "ambusher"
  ],
  "vander": [
    "family",
    "watcher"
  ],
  "scar": [
    "firelight",
    "watcher"
  ],
  "nunu": [
    "experiment",
    "bruiser",
    "visionary"
  ],
  "jinx": [
    "rebel",
    "ambusher"
  ],
  "zeri": [
    "firelight",
    "sniper"
  ],
  "violet": [
    "family",
    "pit-fighter"
  ],
  "nami": [
    "emissary",
    "sorcerer"
  ],
  "corki": [
    "scrap",
    "artillerist"
  ],
  "garen": [
    "emissary",
    "watcher"
  ],
  "vex": [
    "rebel",
    "visionary"
  ],
  "nocturne": [
    "automata",
    "quickstriker"
  ],
  "darius": [
    "conqueror",
    "watcher"
  ],
  "irelia": [
    "rebel",
    "sentinel"
  ],
  "ambessa": [
    "emissary",
    "conqueror",
    "quickstriker"
  ],
  "zyra": [
    "experiment",
    "sorcerer"
  ],
  "gangplank": [
    "scrap",
    "pit-fighter"
  ],
  "leona": [
    "academy",
    "sentinel"
  ],
  "kogmaw": [
    "automata",
    "sniper"
  ],
  "twistedfate": [
    "enforcer",
    "quickstriker"
  ],
  "lux": [
    "academy",
    "sorcerer"
  ],
  "mordekaiser": [
    "conqueror",
    "dominator"
  ],
  "morgana": [
    "black-rose",
    "visionary"
  ],
  "tristana": [
    "emissary",
    "artillerist"
  ],
  "swain": [
    "conqueror",
    "sorcerer"
  ],
  "urgot": [
    "experiment",
    "pit-fighter",
    "artillerist"
  ],
  "zoe": [
    "rebel",
    "sorcerer"
  ],
  "swain-ranged": [
    "conqueror",
    "sorcerer"
  ],
  "elise-ranged": [
    "black-rose",
    "bruiser"
  ],
  "gangplank-ranged": [
    "scrap",
    "pit-fighter"
  ],
  "jayce-ranged": [
    "academy"
  ]
});

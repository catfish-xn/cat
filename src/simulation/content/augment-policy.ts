import { P3_TIERS } from './s13-p3';
import { freezeContent } from './freeze';
import { S13_P2_TIERS } from './s13-augments-p2';
/** U: no primary historical offer probabilities found; preserve equal three-word sampling. */
export const AUGMENT_OFFER_POLICY = freezeContent({version:'aug30-equal-v1',evidence:'U',sampling:'equal-without-replacement',words:3} as const);
/** CDragon style 1 only, never merely the lowest implemented threshold. */
export const AUGMENT_BRONZE_THRESHOLDS: Readonly<Record<string, readonly number[]>> = freezeContent({
  // S13 14.24 source style 1; later content releases added these active traits.
  "ambusher": [2],
  "visionary": [2],
  "chem-baron": [3],
  "dominator": [2],
  "pit-fighter": [2],
  "experiment": [3],
  "bruiser": [2],
  "black-rose": [3],
  "quickstriker": [2],
  "automata": [
    2
  ],
  "sorcerer": [
    2
  ],
  "scrap": [
    2
  ],
  "artillerist": [
    2
  ],
  "emissary": [
    1
  ],
  "sentinel": [
    2
  ],
  "family": [],
  "sniper": [
    2
  ],
  "conqueror": [
    2
  ],
  "academy": [
    3
  ],
  "rebel": [
    3
  ],
  "enforcer": [
    2
  ],
  "firelight": [
    2
  ],
  "watcher": [
    2
  ]
});

export const AUGMENT_TIERS: Readonly<Record<string, 'silver' | 'gold' | 'prismatic'>> = freezeContent({
  "blinding-speed": "prismatic",
  "portable-forge": "gold",
  "radiant-relics": "prismatic",
  "going-long": "prismatic",
  "hedge-fund": "prismatic",
  "investment-strategy-ii": "prismatic",
  ...S13_P2_TIERS,
  ...P3_TIERS,
  "manaflow-ii": "gold",
  "glass-cannon-ii": "gold",
  "pumping-up-ii": "gold",
  "pumping-up-iii": "prismatic",
  "bulky-buddies-ii": "gold",
  "bulky-buddies-iii": "prismatic",
  "placebo-plus": "silver",
  "mentorship-i": "silver",
  "mentorship-ii": "gold",
  "item-collector-i": "silver",
  "item-collector-ii": "gold",
  "bronze-for-life-i": "gold",
  "bronze-for-life-ii": "prismatic",
  "little-buddies": "gold",
  "backup": "silver",
  "lineup": "silver",
  "find-your-center": "silver",
  "built-different": "gold",
  "blistering-strikes": "silver",
  "clockwork-accelerator": "gold",
  "lone-hero": "silver",
  "climb-the-ladder-i": "silver",
  "climb-the-ladder-ii": "gold",
  "inspiring-epitaph": "gold",
  "placebo": "silver",
  "manaflow-i": "silver",
  "glass-cannon-i": "silver",
  "pumping-up-i": "silver",
  "investment-strategy-i": "gold",
  "bulky-buddies-i": "silver"
});

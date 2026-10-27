import { AUGMENT_SHOP_TIERS } from './augment-pool-shop';
import { AUGMENT_BATCH5_TIERS } from './augment-pool-batch5';
import { AUGMENT_BATCH5_H5_TIERS } from './augment-pool-batch5-h5';
import { AUGMENT_BATCH4_TIERS } from './augment-pool-batch4';
import { AUGMENT_BATCH4_B4XP_TIERS } from './augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4REROLL_TIERS } from './augment-pool-batch4-b4reroll';
import { AUGMENT_BATCH4_B4COMBAT_TIERS } from './augment-pool-batch4-b4combat';
import { AUGMENT_BATCH2_TIERS } from './augment-pool-batch2';
import { AUGMENT_BATCH1_TIERS } from './augment-pool-batch1';
import { AUGMENT_BATCH3_TIERS } from './augment-pool-batch3';
import { AUGMENT_BATCH3_XP_TIERS } from './augment-pool-batch3-xp';
import { P3_TIERS } from './s13-p3';
import { D11_FILL_TIERS } from './d11-fill';
import { freezeContent } from './freeze';
import { S13_P2_TIERS } from './s13-augments-p2';
/** 14.24 client TFT9_AugmentArmoryConfiguration_Table, approved 2026-10-23.
 * CSV order, original integer weights / 109; omit zero-weight configurations.
 * RandomizeProbabilityTableGlobally=true: one shared match-level sample. */
export const AUGMENT_TIER_COMBINATIONS = freezeContent([
  {tiers:['silver','silver','gold'],weight:5},
  {tiers:['silver','silver','prismatic'],weight:5},
  {tiers:['silver','gold','gold'],weight:12},
  {tiers:['silver','gold','prismatic'],weight:5},
  {tiers:['silver','prismatic','prismatic'],weight:1},
  {tiers:['gold','silver','gold'],weight:18},
  {tiers:['gold','silver','prismatic'],weight:2},
  {tiers:['gold','gold','gold'],weight:22},
  {tiers:['gold','gold','prismatic'],weight:12},
  {tiers:['gold','prismatic','silver'],weight:6},
  {tiers:['gold','prismatic','gold'],weight:10},
  {tiers:['gold','prismatic','prismatic'],weight:1},
  {tiers:['prismatic','silver','gold'],weight:4},
  {tiers:['prismatic','silver','prismatic'],weight:1},
  {tiers:['prismatic','gold','gold'],weight:2},
  {tiers:['prismatic','gold','prismatic'],weight:1},
  {tiers:['prismatic','prismatic','gold'],weight:1},
  {tiers:['prismatic','prismatic','prismatic'],weight:1},
] as const);
/** One shared match-level tier draw; v15 card reroll rules remain unchanged. */
export const AUGMENT_OFFER_POLICY = freezeContent({version:'augment-tier-table-v22',evidence:'user-convention-2026-10-20',tierEvidence:'client-14.24-TFT9_AugmentArmoryConfiguration_Table-user-approved-2026-10-23',tiers:['silver','gold','prismatic'],tierSeedXor:0x61756774,tierStream:'augment-tier-sequence-v1',tierWeightTotal:109,tierCombinations:AUGMENT_TIER_COMBINATIONS,freeRerolls:1,rerollScope:'per-slot-per-choice',sampling:'equal-without-replacement',words:{initial:3,reroll:1},reroll:'single-card-locked-tier-exclude-current-owned-and-permanently-removed-reject-empty-pool'} as const);
/** CDragon style 1 only, never merely the lowest implemented threshold. */
export const AUGMENT_BRONZE_THRESHOLDS: Readonly<Record<string, readonly number[]>> = freezeContent({
  'form-swapper':[2],
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
  ...AUGMENT_BATCH1_TIERS,
  ...AUGMENT_BATCH2_TIERS,
  ...AUGMENT_BATCH3_TIERS,
  ...AUGMENT_SHOP_TIERS,
  ...AUGMENT_BATCH4_B4COMBAT_TIERS,
  ...AUGMENT_BATCH3_XP_TIERS,
  ...AUGMENT_BATCH4_TIERS,
  ...AUGMENT_BATCH5_TIERS,
  ...AUGMENT_BATCH5_H5_TIERS,
  ...AUGMENT_BATCH4_B4XP_TIERS,
  ...AUGMENT_BATCH4_B4REROLL_TIERS,
  sisters:'gold', mentorship:'gold',reunion:'gold',geniuses:'prismatic',menaces:'gold','unlikely-duo':'gold',
  ...D11_FILL_TIERS,
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

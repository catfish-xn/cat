import { AUGMENT_BATCH5_H1_API_NAMES } from './augment-pool-batch5-h1';
import { AUGMENT_BATCH5_H3_API_NAMES } from './augment-pool-batch5-h3';
import { AUGMENT_BATCH5_H4_API_NAMES } from './augment-pool-batch5-h4';
import { AUGMENT_BATCH5_H6_API_NAMES } from './augment-pool-batch5-h6';
import { AUGMENT_BATCH5_B5A_API_NAMES } from './augment-pool-batch5-b5a';
import { AUGMENT_BATCH5_S1A_API_NAMES } from './augment-pool-batch5-s1a';
import { AUGMENT_BATCH5_S1B_API_NAMES } from './augment-pool-batch5-s1b';
import { AUGMENT_BATCH5_S3A_API_NAMES } from './augment-pool-batch5-s3a';
import { AUGMENT_BATCH5_S3D_API_NAMES } from './augment-pool-batch5-s3d';
import { AUGMENT_BATCH5_H7_API_NAMES } from './augment-pool-batch5-h7';
import { AUGMENT_BATCH5_H8_API_NAMES } from './augment-pool-batch5-h8';
import { AUGMENT_SHOP_API_NAMES } from './augment-pool-shop';
import { AUGMENT_BATCH5_S3B_API_NAMES } from './augment-pool-batch5-s3b';
import { AUGMENT_BATCH5_S6C_API_NAMES } from './augment-pool-batch5-s6c';
import { AUGMENT_BATCH5_S8B_API_NAMES } from './augment-pool-batch5-s8b';
import { AUGMENT_BATCH5_S8C_API_NAMES } from './augment-pool-batch5-s8c';
import { AUGMENT_BATCH5_S11A_API_NAMES } from './augment-pool-batch5-s11a';
import { AUGMENT_BATCH5_S8A_API_NAMES } from './augment-pool-batch5-s8a';
import { AUGMENT_BATCH5_API_NAMES } from './augment-pool-batch5';
import { AUGMENT_BATCH5_H5_API_NAMES } from './augment-pool-batch5-h5';
import { AUGMENT_BATCH4_API_NAMES } from './augment-pool-batch4';
import { AUGMENT_BATCH4_B4XP_API_NAMES, AUGMENT_BATCH4_B4XP_NODE_BANS } from './augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4REROLL_API_NAMES, AUGMENT_BATCH4_B4REROLL_NODE_BANS } from './augment-pool-batch4-b4reroll';
import { AUGMENT_BATCH4_B4COMBAT_API_NAMES, AUGMENT_BATCH4_B4COMBAT_NODE_BANS } from './augment-pool-batch4-b4combat';
import { AUGMENT_BATCH2_API_NAMES } from './augment-pool-batch2';
import { AUGMENT_BATCH1_API_NAMES } from './augment-pool-batch1';
import { AUGMENT_BATCH3_API_NAMES, AUGMENT_BATCH3_NODE_BANS } from './augment-pool-batch3';
import { AUGMENT_BATCH3_XP_API_NAMES, AUGMENT_BATCH3_XP_NODE_BANS } from './augment-pool-batch3-xp';
import { freezeContent } from './freeze';
import { AUGMENT_STAGE_BANS } from './augment-stage-bans';
import { AUGMENT_ASSOCIATED_TRAITS, AUGMENT_MUTUALLY_EXCLUSIVE } from './augment-offer-source';

/**
 * Pool id → 14.24 apiName. Matched by client zh_cn/en_us name against augments-research-2026-10-23 (team-ups from
 * V20_TRAITS). Every offer rule below is written against apiNames; an augment absent from the pool leaves its rule inert,
 * so pool expansion only adds a row here.
 */
export const AUGMENT_POOL_API_NAMES: Readonly<Record<string, string>> = freezeContent({
  ...AUGMENT_BATCH1_API_NAMES,
  ...AUGMENT_BATCH2_API_NAMES,
  ...AUGMENT_BATCH3_API_NAMES,
  ...AUGMENT_SHOP_API_NAMES,
  ...AUGMENT_BATCH4_B4COMBAT_API_NAMES,
  ...AUGMENT_BATCH3_XP_API_NAMES,
  ...AUGMENT_BATCH4_API_NAMES,
  ...AUGMENT_BATCH5_API_NAMES,
  ...AUGMENT_BATCH5_H1_API_NAMES,
  ...AUGMENT_BATCH5_H3_API_NAMES,
  ...AUGMENT_BATCH5_H4_API_NAMES,
  ...AUGMENT_BATCH5_H5_API_NAMES,
  ...AUGMENT_BATCH5_H6_API_NAMES,
  ...AUGMENT_BATCH5_B5A_API_NAMES,
  ...AUGMENT_BATCH5_S1A_API_NAMES,
  ...AUGMENT_BATCH5_S1B_API_NAMES,
  ...AUGMENT_BATCH5_S3A_API_NAMES,
  ...AUGMENT_BATCH5_S3B_API_NAMES,
  ...AUGMENT_BATCH5_S3D_API_NAMES,
  ...AUGMENT_BATCH5_S6C_API_NAMES,
  ...AUGMENT_BATCH5_S8A_API_NAMES,
  ...AUGMENT_BATCH5_S8B_API_NAMES,
  ...AUGMENT_BATCH5_S8C_API_NAMES,
  ...AUGMENT_BATCH5_S11A_API_NAMES,
  ...AUGMENT_BATCH5_H7_API_NAMES,
  ...AUGMENT_BATCH5_H8_API_NAMES,
  ...AUGMENT_BATCH4_B4XP_API_NAMES,
  ...AUGMENT_BATCH4_B4REROLL_API_NAMES,
  sisters:'TFT13_TeamupAugment_Sisters', mentorship:'TFT13_TeamupAugment_Mentorship', reunion:'TFT13_TeamupAugment_Reunion',
  geniuses:'TFT13_TeamupAugment_Geniuses', menaces:'TFT13_TeamupAugment_Menaces', 'unlikely-duo':'TFT13_TeamupAugment_UnlikelyDuo',
  'all-for-one-i':'TFT_Augment_AllForOneI', 'all-for-one-ii':'TFT_Augment_AllForOneII', 'trifecta-i':'TFT_Augment_Trifecta1',
  'trifecta-ii':'TFT_Augment_Trifecta2', 'spirit-link':'TFT_Augment_SpiritLink1', 'blinding-speed':'TFT9_Augment_BlindingSpeed',
  'portable-forge':'TFT6_Augment_PortableForge', 'radiant-relics':'TFT6_Augment_RadiantRelics', 'going-long':'TFT10_Augment_GoingLong',
  'hedge-fund':'TFT9_Augment_HedgeFund', 'investment-strategy-i':'TFT_Augment_InvestmentStrategy1',
  'investment-strategy-ii':'TFT_Augment_InvestmentStrategy2', 'crown-guarded':'TFT10_Augment_CrownGuarded',
  'not-today':'TFT9_Augment_NotToday', 'belt-overflow':'TFT_Augment_BeltOverflow', 'sword-overflow':'TFT_Augment_SwordOverflow',
  'wand-overflow':'TFT_Augment_WandOverflow', 'calculated-enhancement':'TFT_Augment_CalculatedEnhancement',
  'crownguard-spirit':'TFT_Augment_CrownguardSpirit', 'guardbreaker-spirit':'TFT_Augment_GuardbreakerSpirit',
  'shojin-spirit':'TFT_Augment_ShojinSpirit', 'flurry-of-blows':'TFT_Augment_FlurryOfBlows', 'pair-of-fours':'TFT_Augment_PairOfFours',
  'immovable-object':'TFT_Augment_RanduinsImmovableObject', 'defense-call':'TFT_Augment_DefenseCall',
  'high-voltage':'TFT_Augment_HighVoltage', 'piercing-lotus-i':'TFT_Augment_PiercingLotus1', 'piercing-lotus-ii':'TFT_Augment_PiercingLotus2',
  pyromaniac:'TFT_Augment_Pyromaniac', 'thorn-plated-armor':'TFT_Augment_ThornPlatedArmor', 'unleash-the-beast':'TFT_Augment_UnleashTheBeast',
  placebo:'TFT_Augment_Placebo', 'placebo-plus':'TFT_Augment_PlaceboPlus', 'manaflow-i':'TFT_Augment_Manaflow1',
  'manaflow-ii':'TFT_Augment_Manaflow2', 'glass-cannon-i':'TFT_Augment_GlassCannonI', 'glass-cannon-ii':'TFT_Augment_GlassCannonII',
  'pumping-up-i':'TFT9_Augment_PumpingUp', 'pumping-up-ii':'TFT9_Augment_PumpingUp2', 'pumping-up-iii':'TFT9_Augment_PumpingUp3',
  'bulky-buddies-i':'TFT_Augment_BulkyBuddies1', 'bulky-buddies-ii':'TFT_Augment_BulkyBuddies2', 'bulky-buddies-iii':'TFT_Augment_BulkyBuddies3',
  'mentorship-i':'TFT_Augment_Mentorship1', 'mentorship-ii':'TFT_Augment_Mentorship2', 'item-collector-i':'TFT_Augment_ItemCollector1',
  'item-collector-ii':'TFT_Augment_ItemCollector2', 'bronze-for-life-i':'TFT_Augment_BronzeForLifeI',
  'bronze-for-life-ii':'TFT_Augment_BronzeForLife2', 'little-buddies':'TFT10_Augment_LittleBuddies', backup:'TFT_Augment_Backup',
  lineup:'TFT_Augment_Lineup', 'find-your-center':'TFT_Augment_FindYourCenter', 'built-different':'TFT6_Augment_Traitless2',
  'blistering-strikes':'TFT9_Augment_RedBuff', 'clockwork-accelerator':'TFT_Augment_ClockworkAccelerator',
  'lone-hero':'TFT_Augment_LoneHero', 'climb-the-ladder-i':'TFT_Augment_ClimbTheLadder1',
  'climb-the-ladder-ii':'TFT_Augment_ClimbTheLadder2', 'inspiring-epitaph':'TFT10_Augment_InspiringEpitaph',
});

/**
 * v22 offer rules (user approval 2026-10-23; docs/S13_RULES_GAP.md P decisions "强化选择过滤"):
 * - traitFilterNodes: an augment with AssociatedTraits is offered only while a fielded player unit carries one of them,
 *   read from the board when the node opens and reused by that node's rerolls. 2-1 is never tailored to the comp.
 * - nodeBans: 14.24 notes — Black Rose emblem/crown never at 2-1; v23 candidate: 14.24 stage tags with the Fine Vintage user override (augment-stage-bans.ts, P).
 * - crossPlayerExclusive: once another live player owns one member, the others are not offered (14.24 notes).
 * - onePerMatch: offered to at most one live player per match (14.24 notes: "offered", not "taken").
 * - mutuallyExclusive: 14.24 MutuallyExclusiveItems, applied (symmetrically) against the player's own augments.
 * - seen: every card shown to a player (initial three and reroll results) is never offered to that player again.
 */
export const AUGMENT_OFFER_RULES = freezeContent({
  version:'augment-offer-rules-v22',
  evidence:'augments-research-2026-10-23+user-approval-2026-10-23',
  traitFilterNodes:['3-2','4-2'],
  traitFilter:'any-associated-trait-on-a-fielded-player-unit-including-emblems-snapshot-at-open',
  seen:'initial-and-reroll-results-excluded-for-the-rest-of-the-match',
  nodeBans:{...AUGMENT_BATCH4_B4COMBAT_NODE_BANS,...AUGMENT_BATCH4_B4REROLL_NODE_BANS, ...AUGMENT_STAGE_BANS, ...AUGMENT_BATCH4_B4XP_NODE_BANS, TFT13_Augment_CabalCrest:['2-1'], TFT13_Augment_CabalCrown:['2-1'], ...AUGMENT_BATCH3_XP_NODE_BANS, ...AUGMENT_BATCH3_NODE_BANS},
  crossPlayerExclusive:[['TFT13_Augment_Family','TFT13_Augment_PrimeCarry']],
  onePerMatch:['TFT13_Augment_Chembaron'],
  externalScope:'live-seats-other-than-self',
  associatedTraits:AUGMENT_ASSOCIATED_TRAITS,
  mutuallyExclusive:AUGMENT_MUTUALLY_EXCLUSIVE,
} as const);

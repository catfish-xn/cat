import { AUGMENT_BATCH5_H6 } from './augment-pool-batch5-h6';
import { AUGMENT_SHOP } from './augment-pool-shop';
import { AUGMENT_BATCH5 } from './augment-pool-batch5';
import { AUGMENT_BATCH4, AUGMENT_BATCH4_BLOCKED } from './augment-pool-batch4';
import { AUGMENT_BATCH4_B4XP } from './augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4REROLL } from './augment-pool-batch4-b4reroll';
import { AUGMENT_BATCH4_B4COMBAT } from './augment-pool-batch4-b4combat';
import { TACTICIAN_ITEM_SOURCE } from './tactician-items';
import { AUGMENT_BATCH2, AUGMENT_BATCH2_BLOCKED } from './augment-pool-batch2';
import { AUGMENT_BATCH1, AUGMENT_BATCH1_BLOCKED } from './augment-pool-batch1';
import { AUGMENT_BATCH3 } from './augment-pool-batch3';
import { AUGMENT_BATCH3_XP, AUGMENT_BATCH3_XP_BLOCKED } from './augment-pool-batch3-xp';
import { AUGMENT_STAGE_BANS } from './augment-stage-bans';
import { ANVIL_POLICY } from './anvils';
import { ROUND_INCOME_TIMING } from './round-income-policy';
import { OPENING_ENCOUNTER_CONFIG } from './opening-encounters';
import { V20_TRAITS } from './v20-traits';
import { CHEM_BARON_B_OVERRIDES } from './chem-baron-b-overrides';
import { SIX_COST_POLICY } from './v19-six-cost';
import { FAMILY_HEIST_POLICY, FAMILY_REWARDS } from '../family-heist';
import { FAMILY_REUNION_POLICY } from '../family-reunion';
import { V19_EMBLEM_VALUES } from './v19-emblems';
import {G23_POLICY} from './g2-3-policy';
import { V19_MECHANICS } from './v19-mechanics';
import {G23_SUMMON_POLICY} from './g2-3-summons';
import {G23_ACADEMY_LISTS} from './g2-3-academy';
import { G22_CONVENTIONS } from './g2-2-traits';
import { SCRAP_LUCKY_POLICY, SCRAP_CHAMPION_ROLES, SCRAP_ROLE_ITEMS } from './scrap-lucky';
import { ENFORCER_CONFISCATION_POLICY } from './enforcer-confiscation';
import { PLAYER_DAMAGE_RULES, XP_TO_NEXT_LEVEL, MATCH_RULES } from '../match-rules';
import { freezeContent } from './freeze';
import { EPIC_LOOT } from './loot';
import { ORB_RULES, ORB_STAGE_PLAN, EPIC_SOURCES } from './orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from './consumables';
import { EQUIPMENT_RULES_VERSION } from '../equipment-policy';
import { EQUIPMENT_OPERATION_RULES_VERSION, MULTIPLAYER_OPERATION_RULES } from '../operation-policy';
import { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../opening-economy';

/** One release manifest is included in both content and loot replay identities. */
export const RULES_GAP_MANIFEST = freezeContent({
  tacticianItems:{source:TACTICIAN_ITEM_SOURCE,gold:'independent-item-collector-stream-10-percent-one-gold',population:'permanent-acquisition-and-crafted-receipts'},
  // Offer stages are replay input: augment offers re-derive from these bans at restore (P, 14.24 stage tags).
  augmentStageBans:{version:'augment-stage-bans-14.24-tags-v1',bans:AUGMENT_STAGE_BANS,reading:'d02ae323-d12ae4b6-d22ae649-not-at-2-1-3-2-4-2'},
  augmentPoolBatch5H6:{version:'augment-pool-batch5-h6-v1',content:AUGMENT_BATCH5_H6,convention:'P-B5-37-38-2026-10-27'},
  augmentPoolBatch5:{version:'augment-pool-batch5-v24',content:AUGMENT_BATCH5,convention:'P-B5-2026-10-25'},
  augmentPoolBatch4:{version:'augment-pool-batch4-levels-v23-candidate',content:AUGMENT_BATCH4,blocked:AUGMENT_BATCH4_BLOCKED,timing:'reached-thresholds-on-acquisition-later-levels-on-authoritative-transition',sampling:'existing-gift-stream-radiant-five-without-replacement',birthdayCost:'max-1-level-minus-4'},
  augmentPoolBatch4B4xp:{version:'augment-pool-batch4-b4xp-v23-candidate',content:AUGMENT_BATCH4_B4XP,timing:'pvp-end-before-settlement-rewards-and-deferred-upgrades',authority:'completed-battles-replay'},
  augmentPoolBatch4B4reroll:{version:'augment-pool-batch4-b4reroll-v23',content:AUGMENT_BATCH4_B4REROLL,timing:'next-entry-after-income-before-entry-grants',credits:'carry-over',patience:'previous-round-shop-purchases-including-combat',invested:'floor-clamp-gold-50-80-divide-10'},
  augmentPoolBatch3Xp:{version:'augment-pool-batch3-xp-v23-candidate',content:AUGMENT_BATCH3_XP,blocked:AUGMENT_BATCH3_XP_BLOCKED,timing:'pvp-xp-next-round-entry-draw-as-loss-stage-start-after-acquisition',levels:'recorded-at-acquisition'},
  augmentPoolBatch4B4Combat:{version:'augment-pool-batch4-b4combat-v23',content:AUGMENT_BATCH4_B4COMBAT,convention:'P-B4COMBAT-2026-10-25'},
  augmentPoolBatch3:{version:'augment-pool-batch3-v23-candidate',content:AUGMENT_BATCH3,counting:'pvp-battle-receipts-from-acquisition-round-inclusive-draw-not-loss'},
  augmentPoolShop:{version:'augment-pool-shop-v24-candidate',content:AUGMENT_SHOP,credits:'rigged-acquisition-and-ticket-seed-stream'},
  augmentPoolBatch2:{version:'augment-pool-batch2-v23-candidate',content:AUGMENT_BATCH2,blocked:AUGMENT_BATCH2_BLOCKED},
  augmentPoolBatch1:{version:'augment-pool-batch1-v23-candidate',content:AUGMENT_BATCH1,blocked:AUGMENT_BATCH1_BLOCKED,random:'source-seat-choice-spec-lcg32-uniform-sorted-with-replacement',anvilChoices:4,roundGold:'add-to-deferred-base-income-next-entry',unitEscrow:'solo-capacity-online-reward-orb'},
  openingEncounters: OPENING_ENCOUNTER_CONFIG,
  roundIncomeTiming: ROUND_INCOME_TIMING,
  combatStreaming: { version: 'live-tick-v1', terminalSettlement: 'all-terminal-fixed-seat-order', equipment: 'next-unsealed-tick-v2', equipmentTraits: 'opening-membership-and-non-item-effects-frozen', equipmentHp: 'existing-changeMaxHp-preserve-missing-health', equipmentReplay: 'private-input-and-source-receipts-v1' },
  v20Traits:V20_TRAITS,
  v19:V19_MECHANICS,v19Part2:{sixCost:SIX_COST_POLICY,family:{policy:FAMILY_HEIST_POLICY,rewards:FAMILY_REWARDS,reunion:FAMILY_REUNION_POLICY},emblems:V19_EMBLEM_VALUES},
  anvils:ANVIL_POLICY,
  release: 'g2-3-v1',chemBaronBOverrides:CHEM_BARON_B_OVERRIDES,g23:{policy:G23_POLICY,summons:G23_SUMMON_POLICY,academyLists:G23_ACADEMY_LISTS,forms:'frozen-starting-two-rows-v1',laboratories:'lcg-seed-xor-6c616273-uniform-without-replacement-v1',rewards:'conqueror-g2-4b-artifact-forge-tiers-10-14-v5',anvilChoices:4,crown:'permanent-team-size-per-granted-crown-v1',crownGold:'deployed-holder-win-roll-per-crown-v1',specialItems:'source-base-stats-finite-program-subset-b-overrides-v20-chem-baron',progress:'seat-mechanics-disjoint-v1',mechanicGold:'post-settlement-receipt-prefix-v1',unitRewards:'transaction-policy-empty-to-cost-v1',armoryTimeout:'zero-price-option-v1'},
  finiteExpansion: G22_CONVENTIONS,
  topTiers: { scrapLucky: { policy: SCRAP_LUCKY_POLICY, roles: SCRAP_CHAMPION_ROLES, roleItems: SCRAP_ROLE_ITEMS }, enforcerConfiscation: ENFORCER_CONFISCATION_POLICY },
  expansion: { inventory: '63-units-30-enabled-traits-30-anomalies-44-ordinary-items-36-radiant-28-chemtech-reward-items',
    blocked: ['two-teamups','cosmic-rhythm'], source: 'c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3',
    geometry: 'g2-finite-targeting-v1', tasks: 'g2-attached-infection-v1',
    twitchCrit: 'one-roll-per-piercing-attack', chain: 'initial-kill-empower-v1',
    unreachable: [], emblems:'custom-total-base-22/16-recipes/emblem-reforge-v19', traits:'all-source-tiers-through-10/numeric-subset-v18', quickstriker:'target-missing-health-linear/death-shield', pitHealing:'40-integer-pulses/40-ticks', sorcerer8:'all-ability-hits/25-percent/60-ticks', visionary8:'ability-hp-damage/20-percent/lowest-health-ally' },
  playerDamage: PLAYER_DAMAGE_RULES,
  progression: {policy:'project-xp68-user-2026-10-22-v1', thresholds:XP_TO_NEXT_LEVEL, maxLevel:MATCH_RULES.maxLevel},
  opening: { initial: OPENING_INITIAL_STATE, economy: OPENING_ECONOMY_RULES, rewards:'shared-stage-plan/per-seat-orb-box-v17/no-legacy-loot-words' },
  equipment: { version: EQUIPMENT_RULES_VERSION, operations: EQUIPMENT_OPERATION_RULES_VERSION,
    multiplayer: MULTIPLAYER_OPERATION_RULES, autoCombine: 'lowest-permanent-component-slot' },
  orbs: { rules: ORB_RULES, stagePlan: ORB_STAGE_PLAN, epicSources:EPIC_SOURCES, epic:EPIC_LOOT },
  consumables: { rules: CONSUMABLE_RULES, definitions: CONSUMABLE_DEFINITIONS, pools: REFORGE_POOLS },
  restoration: 'burn-refresh-canonical-program-v1',
  traitSettlement: 'locked-roster/trusted-frozen-receipt-tiers/unlocked-exact-current-v18',
  provenance: 'consumable-use-after-grant-v1',
});

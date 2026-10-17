import {G23_POLICY} from './g2-3-policy';
import {G23_SUMMON_POLICY} from './g2-3-summons';
import {G23_ACADEMY_LISTS} from './g2-3-academy';
import { G22_CONVENTIONS } from './g2-2-traits';
import { PLAYER_DAMAGE_RULES, XP_TO_NEXT_LEVEL, MATCH_RULES } from '../match-rules';
import { freezeContent } from './freeze';
import { ORB_RULES, ORB_SLOTS } from './orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from './consumables';
import { EQUIPMENT_RULES_VERSION } from '../equipment-policy';
import { EQUIPMENT_OPERATION_RULES_VERSION, MULTIPLAYER_OPERATION_RULES } from '../operation-policy';
import { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../opening-economy';

/** One release manifest is included in both content and loot replay identities. */
export const RULES_GAP_MANIFEST = freezeContent({
  release: 'g2-3-v1',g23:{policy:G23_POLICY,summons:G23_SUMMON_POLICY,academyLists:G23_ACADEMY_LISTS,forms:'frozen-starting-two-rows-v1',laboratories:'lcg-seed-xor-6c616273-uniform-without-replacement-v1',rewards:'conqueror-g2-4b-artifact-forge-tiers-10-14-v5',anvilChoices:4,specialItems:'source-base-stats-finite-program-subset-v1',progress:'seat-mechanics-disjoint-v1',mechanicGold:'post-settlement-receipt-prefix-v1',unitRewards:'transaction-policy-empty-to-cost-v1',armoryTimeout:'zero-price-option-v1'},
  finiteExpansion: G22_CONVENTIONS,
  expansion: { inventory: '60-units-25-enabled-traits-30-anomalies-44-ordinary-items-36-radiant-28-chemtech-reward-items',
    blocked: ['form-swapper-trait','seven-teamups','cosmic-rhythm'], source: 'c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3',
    geometry: 'g2-finite-targeting-v1', tasks: 'g2-attached-infection-v1',
    twitchCrit: 'one-roll-per-piercing-attack', chain: 'initial-kill-empower-v1',
    unreachable: ['automata-6','firelight-4','family-4','family-5'] },
  playerDamage: PLAYER_DAMAGE_RULES,
  progression: {policy:'s13-14.24b-nine-levels-v1', thresholds:XP_TO_NEXT_LEVEL, maxLevel:MATCH_RULES.maxLevel},
  opening: { initial: OPENING_INITIAL_STATE, economy: OPENING_ECONOMY_RULES, rewards: {'1-2':'maddie','1-3':'lux',reservedLootWordsPerReward:1} },
  equipment: { version: EQUIPMENT_RULES_VERSION, operations: EQUIPMENT_OPERATION_RULES_VERSION,
    multiplayer: MULTIPLAYER_OPERATION_RULES, autoCombine: 'lowest-permanent-component-slot' },
  orbs: { rules: ORB_RULES, slots: ORB_SLOTS },
  consumables: { rules: CONSUMABLE_RULES, definitions: CONSUMABLE_DEFINITIONS, pools: REFORGE_POOLS },
  restoration: 'burn-refresh-canonical-program-v1',
  provenance: 'consumable-use-after-grant-v1',
});

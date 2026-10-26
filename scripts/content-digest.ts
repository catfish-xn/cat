// Offline recomputation of the original full digest root; keep its coverage unchanged.
import { D14_POLICY } from '../src/simulation/content/d14-anomalies';
import { D14_FOURTH_ABILITY } from '../src/simulation/d14-anomalies/fourth-ability';
import { DUAL_WIELDING_POOLS, DUAL_WIELDING_ROLES } from '../src/simulation/content/s13-p1-dual-wielding';
import { G24_VOIDSPAWN_POLICY, G24_VOIDSPAWN_UNITS } from '../src/simulation/content/g2-4b-voidspawn';
import { P4_SOURCE } from '../src/simulation/anomalies/source';
import { ORBIT_PARAMETERS } from '../src/simulation/anomalies/orbit-parameters';
import { S13_ANOMALY_SUMMON_UNITS } from '../src/simulation/content/s13-anomaly-summons';
import { G23_SPECIAL_ITEMS } from '../src/simulation/content/g2-3-item-registry';
import { G23_SPECIAL_ITEM_SOURCE, G23_SPECIAL_ITEM_POOLS, G23_RADIANT_MAPPING } from '../src/simulation/content/g2-3-special-item-source';
import { G23_TRAIT_SOURCE } from '../src/simulation/content/g2-3-trait-source';
import { G23_ANOMALY_SOURCE } from '../src/simulation/content/g2-3-anomaly-source';
import { G24_ARTIFACT_SOURCE } from '../src/simulation/content/g2-4-artifact-source';
import { AUGMENT_OFFER_POLICY, AUGMENT_BRONZE_THRESHOLDS, AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { CAROUSEL_RULES, CAROUSEL_COST_ODDS } from '../src/simulation/carousel-policy';
import { RULES_GAP_MANIFEST } from './augment-content-archive';
import { EQUIPMENT_OPERATION_RULES_VERSION, MULTIPLAYER_OPERATION_RULES } from '../src/simulation/operation-policy';
import { M8_VERSION } from '../src/simulation/m8/version';
import { LOOT_RUNTIME_REVISION, LOOT_FREEZE_ALGORITHM, LOOT_POLICY_VERSION, ORB_BOXES, EPIC_LOOT } from '../src/simulation/content/loot';
import { NEUTRAL_RUNTIME_VERSION } from '../src/simulation/neutral-receipts';
import { NEUTRAL_DEFINITIONS } from '../src/simulation/content/neutrals';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from '../src/simulation/content/neutral-encounters';
import { COMPONENT_POOL, COMPONENT_POOL_VERSION } from '../src/simulation/component-pool';
import { TEMPORARY_EQUIPMENT_POOL } from '../src/simulation/temporary-equipment';
import { EQUIPMENT_RULES_VERSION } from '../src/simulation/equipment-policy';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { ABILITY_DEFINITIONS } from '../src/simulation/combat-abilities';
import { M5_UNIT_DEFINITIONS, NEUTRAL_UNIT_DEFINITIONS } from '../src/simulation/units';
import { DEPLOYMENT_RULES_VERSION, SHOP_CATALOG_BY_COST, SHOP_ODDS, XP_TO_NEXT_LEVEL, MATCH_RULES, STAGE_PLAYER_DAMAGE, ECONOMY_RULES } from '../src/simulation/match-rules';
import { FINAL_ROUND, ROUND_RULES_VERSION, ROUND_PREPARATION_RULES, ROUND_SCHEDULE } from '../src/simulation/round-schedule';
import { ENEMY_TEMPLATES, ENEMY_POSITIONS, ENEMY_GROWTH, ROUND_ENEMY_PROJECTIONS } from '../src/simulation/round-enemies';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../src/simulation/opening-economy';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from '../src/simulation/content/round-catalog';
import { SOURCE_MANIFEST } from '../src/simulation/content/source-manifest';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { ARCHIVED_AUGMENT_DEFINITIONS as AUGMENT_DEFINITIONS } from './augment-content-archive';
import { ANOMALY_DEFINITIONS, ANOMALY_OFFER_POLICY } from '../src/simulation/content/anomalies';
import { ORB_RULES, ORB_STAGE_PLAN } from '../src/simulation/content/orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from '../src/simulation/content/consumables';
import { G24_SUPPORT_DECLARATIONS } from '../src/simulation/content/g2-4-support-items';
import { G24_SUPPORT_ITEM_SOURCE } from '../src/simulation/content/g2-4-support-item-source';
import { G24_CHEST_POOL } from '../src/simulation/content/g2-4-chest-pool';
import { S13_P2_SOURCE } from '../src/simulation/content/s13-augments-p2-source';
import { P2_ITEM_GRANTS } from '../src/simulation/content/s13-augments-p2';
import { D11_FILL_SOURCE } from '../src/simulation/content/d11-fill-source';
import { D11_EXECUTION_POLICY } from '../src/simulation/content/d11-fill';
import { digestContent } from '../src/simulation/content';
export function recomputeContentDigest(): string {
  return digestContent({
  d14:{policy:D14_POLICY,fourthAbility:D14_FOURTH_ABILITY,singedFourthDRBps:6000},
  d11:{source:D11_FILL_SOURCE,execution:D11_EXECUTION_POLICY},
  anomalyOfferPolicy:ANOMALY_OFFER_POLICY,
  s13AugmentsP2: { source:S13_P2_SOURCE, itemGrants:P2_ITEM_GRANTS, acquisitionRng:'fnv1a32-seat-choice-lcg32', openingRng:'combat-after-existing-opening-consumers', sharing:'freeze-all-then-broadcast' },
  s13AnomaliesP4:{source:P4_SOURCE,orbit:ORBIT_PARAMETERS,summons:S13_ANOMALY_SUMMON_UNITS,wolfAttackSpeedBps:10000,miniTravelTicks:10},
  g24Voidspawn:{policy:G24_VOIDSPAWN_POLICY,units:G24_VOIDSPAWN_UNITS},
  rulesManifest: RULES_GAP_MANIFEST,g23:{specialItems:G23_SPECIAL_ITEMS,specialItemSource:G23_SPECIAL_ITEM_SOURCE,specialItemPools:G23_SPECIAL_ITEM_POOLS,radiantMapping:G23_RADIANT_MAPPING,traitSource:G23_TRAIT_SOURCE,anomalySource:G23_ANOMALY_SOURCE},
  g24:{artifactSource:G24_ARTIFACT_SOURCE,supportDeclarations:G24_SUPPORT_DECLARATIONS,supportItemSource:G24_SUPPORT_ITEM_SOURCE,chestPool:G24_CHEST_POOL},
  carousel:{rules:CAROUSEL_RULES,costOdds:CAROUSEL_COST_ODDS},
  // B9: the frozen rules/content identity and the replay event format are part of the digested runtime content.
  versions:{rulesVersion:M8_VERSION.rulesVersion,contentVersion:M8_VERSION.contentVersion,replayFormatVersion:M8_VERSION.replayFormatVersion},
  orbs:{rules:ORB_RULES,stagePlan:ORB_STAGE_PLAN},
  consumables:{rules:CONSUMABLE_RULES,definitions:CONSUMABLE_DEFINITIONS,pools:REFORGE_POOLS},
  loot:{runtime:LOOT_RUNTIME_REVISION,freeze:LOOT_FREEZE_ALGORITHM,policy:LOOT_POLICY_VERSION,boxes:ORB_BOXES,epic:EPIC_LOOT},
  neutralEncounters:{runtime:NEUTRAL_RUNTIME_VERSION,version:NEUTRAL_ENCOUNTER_CATALOG_VERSION,policy:NEUTRAL_ENCOUNTER_POLICY_VERSION,definitions:NEUTRAL_DEFINITIONS,encounters:NEUTRAL_ENCOUNTERS},
  deploymentRulesVersion:DEPLOYMENT_RULES_VERSION, multiplayerOperations:MULTIPLAYER_OPERATION_RULES,
  roundRulesVersion:ROUND_RULES_VERSION, roundCatalog:ROUND_CATALOG, roundSemanticNodes:ROUND_SEMANTIC_NODES,
  roundPreparation:ROUND_PREPARATION_RULES, opening:{initial:OPENING_INITIAL_STATE,economy:OPENING_ECONOMY_RULES}, finalRound:FINAL_ROUND,
  equipmentRulesVersion: EQUIPMENT_RULES_VERSION, equipmentOperations: EQUIPMENT_OPERATION_RULES_VERSION,
  temporaryEquipmentPool: TEMPORARY_EQUIPMENT_POOL,
  units: M5_UNIT_DEFINITIONS, neutralUnits: NEUTRAL_UNIT_DEFINITIONS, abilities: ABILITY_DEFINITIONS, s13Abilities: S13_ABILITY_DATA, traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS,
  dualWieldingPools:DUAL_WIELDING_POOLS,dualWieldingRoles:DUAL_WIELDING_ROLES,
  augmentPolicy:AUGMENT_OFFER_POLICY, augmentTiers:AUGMENT_TIERS, augmentBronzeThresholds:AUGMENT_BRONZE_THRESHOLDS, augments:AUGMENT_DEFINITIONS, anomalies:ANOMALY_DEFINITIONS, schedule: ROUND_SCHEDULE,
  shopCatalog: SHOP_CATALOG_BY_COST, shopOdds: SHOP_ODDS,
  enemyTemplates: ENEMY_TEMPLATES, enemyPositions: ENEMY_POSITIONS, enemyGrowth: ENEMY_GROWTH,
  opponents: ROUND_ENEMY_PROJECTIONS,
  economy: { rules: MATCH_RULES, stages: STAGE_PLAYER_DAMAGE, income: ECONOMY_RULES, experience: XP_TO_NEXT_LEVEL },
  componentPool: {version:COMPONENT_POOL_VERSION,entries:COMPONENT_POOL},
  reference: SOURCE_MANIFEST, combatRules: S13_COMBAT_RULES,
});
}

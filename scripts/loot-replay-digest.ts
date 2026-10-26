import { G24_FORGE_POLICY } from '../src/simulation/content/g2-4-forges';
// Offline recomputation of the original full digest root; keep its coverage unchanged.
import { EPIC_LOOT } from '../src/simulation/content/loot';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { RULES_GAP_MANIFEST } from './augment-content-archive';
import { LOOT_FREEZE_ALGORITHM, ORB_BOXES, LOOT_POLICY_VERSION } from '../src/simulation/content/loot';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from '../src/simulation/content/neutral-encounters';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { COMPONENT_POOL, COMPONENT_POOL_VERSION } from '../src/simulation/component-pool';
import { ORB_RULES, ORB_STAGE_PLAN, EPIC_SOURCES } from '../src/simulation/content/orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from '../src/simulation/content/consumables';
import { EQUIPMENT_RULES_VERSION } from '../src/simulation/equipment-policy';
import { OPENING_ECONOMY_RULES } from '../src/simulation/match-rules';
import { digestContent } from '../src/simulation/content';
import { LOOT_FREEZE_VERSION } from '../src/simulation/loot-freeze';
export function recomputeLootReplayDigest(): string {
  return digestContent({
  rulesManifest: RULES_GAP_MANIFEST,forges:G24_FORGE_POLICY,
  version:LOOT_FREEZE_VERSION, algorithm:LOOT_FREEZE_ALGORITHM,
  policy:NEUTRAL_ENCOUNTER_POLICY_VERSION, openingPolicy:OPENING_ECONOMY_RULES.version, lootPolicy:LOOT_POLICY_VERSION,
  equipment:EQUIPMENT_RULES_VERSION, orbs:{rules:ORB_RULES,stagePlan:ORB_STAGE_PLAN,epicSources:EPIC_SOURCES,epic:EPIC_LOOT},
  consumables:{rules:CONSUMABLE_RULES,definitions:CONSUMABLE_DEFINITIONS,pools:REFORGE_POOLS},
  componentPool:{version:COMPONENT_POOL_VERSION,entries:COMPONENT_POOL},
  epicHeroPools:{2:SHOP_CATALOG_BY_COST[2],3:SHOP_CATALOG_BY_COST[3],4:SHOP_CATALOG_BY_COST[4]},
  orbBoxes:ORB_BOXES,heroPools:SHOP_CATALOG_BY_COST,schedule:ROUND_CATALOG,
  encounters:{version:NEUTRAL_ENCOUNTER_CATALOG_VERSION,entries:NEUTRAL_ENCOUNTERS},
});
}

import { NEUTRAL_RUNTIME_VERSION } from '../neutral-receipts';
import { NEUTRAL_DEFINITIONS } from './neutrals';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from './neutral-encounters';
import { COMPONENT_POOL, COMPONENT_POOL_VERSION } from '../component-pool';
import { TEMPORARY_EQUIPMENT_POOL } from '../temporary-equipment';
import { EQUIPMENT_RULES_VERSION } from '../equipment-policy';
import { S13_COMBAT_RULES } from '../s13-rules';
import { ABILITY_DEFINITIONS } from '../combat-abilities';
import { M5_UNIT_DEFINITIONS, NEUTRAL_UNIT_DEFINITIONS } from '../units';
import { SHOP_CATALOG_BY_COST, SHOP_ODDS, XP_TO_NEXT_LEVEL, MATCH_RULES, STAGE_PLAYER_DAMAGE, ECONOMY_RULES } from '../match-rules';
import { FINAL_ROUND, ROUND_RULES_VERSION, ROUND_PREPARATION_RULES, ROUND_SCHEDULE } from '../round-schedule';
import { ENEMY_TEMPLATES, ENEMY_POSITIONS, ENEMY_GROWTH, ROUND_ENEMY_PROJECTIONS } from '../round-enemies';
import { S13_ABILITY_DATA } from './abilities';
import { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../opening-economy';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from './round-catalog';
import { SOURCE_MANIFEST } from './source-manifest';
import { TRAIT_DEFINITIONS } from './traits';
import { ITEM_DEFINITIONS } from './items';
import { AUGMENT_DEFINITIONS } from './augments';
import { ANOMALY_DEFINITIONS } from './anomalies';
export { TRAIT_DEFINITIONS, ITEM_DEFINITIONS, AUGMENT_DEFINITIONS, ANOMALY_DEFINITIONS };
export { COMPONENT_IDS } from './items';

/** JSON canonicalization preserves semantic array order and sorts object keys by ASCII. */
export function canonicalContent(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new TypeError('Content cannot contain sparse arrays');
    return `[${value.map(canonicalContent).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalContent((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new TypeError('Content must be finite plain JSON data');
}
/** FNV-1a over UTF-16 code units: deterministic in both browsers and Node; no platform API. */
export function digestContent(value: unknown): string {
  let hash = 0x811c9dc5;
  const text = canonicalContent(value);
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `fnv1a32-utf16:${hash.toString(16).padStart(8, '0')}`;
}
export const CONTENT_DIGEST = digestContent({
  neutralEncounters:{runtime:NEUTRAL_RUNTIME_VERSION,version:NEUTRAL_ENCOUNTER_CATALOG_VERSION,policy:NEUTRAL_ENCOUNTER_POLICY_VERSION,definitions:NEUTRAL_DEFINITIONS,encounters:NEUTRAL_ENCOUNTERS},
  roundRulesVersion:ROUND_RULES_VERSION, roundCatalog:ROUND_CATALOG, roundSemanticNodes:ROUND_SEMANTIC_NODES,
  roundPreparation:ROUND_PREPARATION_RULES, opening:{initial:OPENING_INITIAL_STATE,economy:OPENING_ECONOMY_RULES}, finalRound:FINAL_ROUND,
  equipmentRulesVersion: EQUIPMENT_RULES_VERSION, temporaryEquipmentPool: TEMPORARY_EQUIPMENT_POOL,
  units: M5_UNIT_DEFINITIONS, neutralUnits: NEUTRAL_UNIT_DEFINITIONS, abilities: ABILITY_DEFINITIONS, s13Abilities: S13_ABILITY_DATA, traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS,
  augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS, schedule: ROUND_SCHEDULE,
  shopCatalog: SHOP_CATALOG_BY_COST, shopOdds: SHOP_ODDS,
  enemyTemplates: ENEMY_TEMPLATES, enemyPositions: ENEMY_POSITIONS, enemyGrowth: ENEMY_GROWTH,
  opponents: ROUND_ENEMY_PROJECTIONS,
  economy: { rules: MATCH_RULES, stages: STAGE_PLAYER_DAMAGE, income: ECONOMY_RULES, experience: XP_TO_NEXT_LEVEL },
  componentPool: {version:COMPONENT_POOL_VERSION,entries:COMPONENT_POOL},
  reference: SOURCE_MANIFEST, combatRules: S13_COMBAT_RULES,
});

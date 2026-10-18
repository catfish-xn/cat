import {G23_SPECIAL_ITEMS} from './g2-3-item-registry';
import {G23_SPECIAL_ITEM_SOURCE,G23_SPECIAL_ITEM_POOLS,G23_RADIANT_MAPPING} from './g2-3-special-item-source';
import {G23_TRAIT_SOURCE} from './g2-3-trait-source';
import {G23_ANOMALY_SOURCE} from './g2-3-anomaly-source';
import {G24_ARTIFACT_SOURCE} from './g2-4-artifact-source';
import { AUGMENT_OFFER_POLICY, AUGMENT_BRONZE_THRESHOLDS, AUGMENT_TIERS } from './augment-policy';
import { CAROUSEL_RULES, CAROUSEL_COST_ODDS } from '../carousel-policy';
import { RULES_GAP_MANIFEST } from './rules-manifest';
import { EQUIPMENT_OPERATION_RULES_VERSION, MULTIPLAYER_OPERATION_RULES } from '../operation-policy';
import { M8_VERSION } from '../m8/version';
import { LOOT_RUNTIME_REVISION, LOOT_FREEZE_ALGORITHM, LOOT_POLICY_VERSION, LOOT_HERO_POOL_VERSION, LOOT_HERO_POOLS, LOOT_SLOTS, LOOT_CATEGORIES } from './loot';
import { NEUTRAL_RUNTIME_VERSION } from '../neutral-receipts';
import { NEUTRAL_DEFINITIONS } from './neutrals';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from './neutral-encounters';
import { COMPONENT_POOL, COMPONENT_POOL_VERSION } from '../component-pool';
import { TEMPORARY_EQUIPMENT_POOL } from '../temporary-equipment';
import { EQUIPMENT_RULES_VERSION } from '../equipment-policy';
import { S13_COMBAT_RULES } from '../s13-rules';
import { ABILITY_DEFINITIONS } from '../combat-abilities';
import { M5_UNIT_DEFINITIONS, NEUTRAL_UNIT_DEFINITIONS } from '../units';
import { DEPLOYMENT_RULES_VERSION, SHOP_CATALOG_BY_COST, SHOP_ODDS, XP_TO_NEXT_LEVEL, MATCH_RULES, STAGE_PLAYER_DAMAGE, ECONOMY_RULES } from '../match-rules';
import { FINAL_ROUND, ROUND_RULES_VERSION, ROUND_PREPARATION_RULES, ROUND_SCHEDULE } from '../round-schedule';
import { ENEMY_TEMPLATES, ENEMY_POSITIONS, ENEMY_GROWTH, ROUND_ENEMY_PROJECTIONS } from '../round-enemies';
import { S13_ABILITY_DATA } from './abilities';
import { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../opening-economy';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from './round-catalog';
import { SOURCE_MANIFEST } from './source-manifest';
import { TRAIT_DEFINITIONS } from './traits';
import { ITEM_DEFINITIONS } from './g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from './augments';
import { ANOMALY_DEFINITIONS } from './anomalies';
export { TRAIT_DEFINITIONS, ITEM_DEFINITIONS, AUGMENT_DEFINITIONS, ANOMALY_DEFINITIONS };
export { COMPONENT_IDS } from './items';

// `var` is intentional: content helpers are called while cyclic content imports
// initialize. The lazily allocated cache must be available before this module's body.
var frozenCanonical: WeakMap<object, string> | undefined;
// Certification is independent of text retention: large frozen ledgers may still
// cache their small digest without retaining canonical text at every depth.
var canonicalFrozen: WeakSet<object> | undefined;
var frozenDigests: WeakMap<object, string> | undefined;
var canonicalKeys: Map<string, string> | undefined;
var scalarPrototype: object | undefined;
function quoteKey(key: string): string {
  const cache = canonicalKeys ??= new Map<string, string>();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const text = JSON.stringify(key);
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, text); return text;
}
function rememberFrozen(value: object, text: string, keys: readonly string[]): string {
  // A frozen wrapper alone does not make children or getter results immutable.
  if (Object.isFrozen(value) && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return false;
    const child: unknown = descriptor.value;
    return child === null || typeof child !== 'object' || canonicalFrozen?.has(child);
  })) {
    (canonicalFrozen ??= new WeakSet()).add(value);
    // UTF-16 storage stays below 4 KiB per cached text.
    if (text.length < 2048) (frozenCanonical ??= new WeakMap()).set(value, text);
  }
  return text;
}
/** JSON canonicalization preserves semantic array order and sorts object keys by ASCII. */
export function canonicalContent(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value !== null && typeof value === 'object') {
    const cached = (frozenCanonical ??= new WeakMap()).get(value);
    if (cached !== undefined) return cached;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new TypeError('Content cannot contain sparse arrays');
    const text = `[${value.map(canonicalContent).join(',')}]`;
    return !Object.isFrozen(value) || Object.hasOwn(value, 'map') ? text : rememberFrozen(value, text, Array.from({ length: value.length }, (_, i) => String(i)));
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    // Native JSON handles a flat scalar record in one call. Keep numeric keys
    // on the original path (native enumeration would reorder them), and stop
    // at the first nested value so getter evaluation order remains unchanged.
    if (keys.some(key => key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57))
      return rememberFrozen(value, `{${keys.map(key => `${quoteKey(key)}:${canonicalContent((value as Record<string, unknown>)[key])}`).join(',')}}`, keys);
    const scalars = Object.create(scalarPrototype ??= Object.freeze(Object.create(null))) as Record<string, unknown>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], child = (value as Record<string, unknown>)[key];
      if (child === null || typeof child === 'string' || typeof child === 'boolean' || typeof child === 'number' && Number.isFinite(child)) {
        scalars[key] = child; continue;
      }
      const parts = keys.slice(0, i).map(key => `${quoteKey(key)}:${canonicalContent(scalars[key])}`);
      parts.push(`${quoteKey(key)}:${canonicalContent(child)}`);
      for (let rest = i + 1; rest < keys.length; rest++) {
        const key = keys[rest]; parts.push(`${quoteKey(key)}:${canonicalContent((value as Record<string, unknown>)[key])}`);
      }
      return rememberFrozen(value, `{${parts.join(',')}}`, keys);
    }
    return rememberFrozen(value, JSON.stringify(scalars), keys);
  }
  throw new TypeError('Content must be finite plain JSON data');
}
/** Equality for data already admitted by the restore boundary's full JSON validation.
 * Compares object keys without sorting or allocating canonical strings. Array order,
 * extra fields and JSON's -0/0 equivalence retain canonicalContent semantics.
 * This is not an input validator; callers must validate finite plain JSON first. */
export function equalValidatedContent(a: unknown, b: unknown): boolean {
  if (a === b) return a !== undefined;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length
    && a.every((value, index) => equalValidatedContent(value, b[index]));
  if (Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && equalValidatedContent(left[key], right[key]));
}
/** Validation-only walk for JSON.parse output, whose values are data properties in dense arrays and plain objects: there it
 * accepts and rejects exactly what canonicalContent does (the only possible rejection is a non-finite number), without
 * building the text. Values from anywhere else keep canonicalContent itself. */
export function assertParsedContent(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (Number.isFinite(value)) return; throw new TypeError('Content must be finite plain JSON data'); }
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) assertParsedContent(value[i]); return; }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) { for (const key of Object.keys(value)) assertParsedContent((value as Record<string, unknown>)[key]); return; }
  throw new TypeError('Content must be finite plain JSON data');
}
/** FNV-1a over UTF-16 code units: deterministic in both browsers and Node; no platform API. */
export function digestContent(value: unknown): string {
  const cached = value !== null && typeof value === 'object' ? frozenDigests?.get(value) : undefined;
  if (cached !== undefined) return cached;
  let hash = 0x811c9dc5;
  const text = canonicalContent(value);
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  const digest = `fnv1a32-utf16:${hash.toString(16).padStart(8, '0')}`;
  // canonicalContent certifies the entire frozen data graph, including children.
  if (value !== null && typeof value === 'object' && canonicalFrozen?.has(value)) (frozenDigests ??= new WeakMap()).set(value, digest);
  return digest;
}
import { ORB_RULES, ORB_SLOTS } from './orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from './consumables';
import { G24_SUPPORT_DECLARATIONS } from './g2-4-support-items';
import { G24_SUPPORT_ITEM_SOURCE } from './g2-4-support-item-source';
import { G24_CHEST_POOL } from './g2-4-chest-pool';
export const CONTENT_DIGEST = digestContent({
  rulesManifest: RULES_GAP_MANIFEST,g23:{specialItems:G23_SPECIAL_ITEMS,specialItemSource:G23_SPECIAL_ITEM_SOURCE,specialItemPools:G23_SPECIAL_ITEM_POOLS,radiantMapping:G23_RADIANT_MAPPING,traitSource:G23_TRAIT_SOURCE,anomalySource:G23_ANOMALY_SOURCE},
  g24:{artifactSource:G24_ARTIFACT_SOURCE,supportDeclarations:G24_SUPPORT_DECLARATIONS,supportItemSource:G24_SUPPORT_ITEM_SOURCE,chestPool:G24_CHEST_POOL},
  carousel:{rules:CAROUSEL_RULES,costOdds:CAROUSEL_COST_ODDS},
  // B9: the frozen rules/content identity and the replay event format are part of the digested runtime content.
  versions:{rulesVersion:M8_VERSION.rulesVersion,contentVersion:M8_VERSION.contentVersion,replayFormatVersion:M8_VERSION.replayFormatVersion},
  orbs:{rules:ORB_RULES,slots:ORB_SLOTS},
  consumables:{rules:CONSUMABLE_RULES,definitions:CONSUMABLE_DEFINITIONS,pools:REFORGE_POOLS},
  loot:{runtime:LOOT_RUNTIME_REVISION,freeze:LOOT_FREEZE_ALGORITHM,policy:LOOT_POLICY_VERSION,heroPoolVersion:LOOT_HERO_POOL_VERSION,heroPools:LOOT_HERO_POOLS,slots:LOOT_SLOTS,categories:LOOT_CATEGORIES},
  neutralEncounters:{runtime:NEUTRAL_RUNTIME_VERSION,version:NEUTRAL_ENCOUNTER_CATALOG_VERSION,policy:NEUTRAL_ENCOUNTER_POLICY_VERSION,definitions:NEUTRAL_DEFINITIONS,encounters:NEUTRAL_ENCOUNTERS},
  deploymentRulesVersion:DEPLOYMENT_RULES_VERSION, multiplayerOperations:MULTIPLAYER_OPERATION_RULES,
  roundRulesVersion:ROUND_RULES_VERSION, roundCatalog:ROUND_CATALOG, roundSemanticNodes:ROUND_SEMANTIC_NODES,
  roundPreparation:ROUND_PREPARATION_RULES, opening:{initial:OPENING_INITIAL_STATE,economy:OPENING_ECONOMY_RULES}, finalRound:FINAL_ROUND,
  equipmentRulesVersion: EQUIPMENT_RULES_VERSION, equipmentOperations: EQUIPMENT_OPERATION_RULES_VERSION,
  temporaryEquipmentPool: TEMPORARY_EQUIPMENT_POOL,
  units: M5_UNIT_DEFINITIONS, neutralUnits: NEUTRAL_UNIT_DEFINITIONS, abilities: ABILITY_DEFINITIONS, s13Abilities: S13_ABILITY_DATA, traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS,
  augmentPolicy:AUGMENT_OFFER_POLICY, augmentTiers:AUGMENT_TIERS, augmentBronzeThresholds:AUGMENT_BRONZE_THRESHOLDS, augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS, schedule: ROUND_SCHEDULE,
  shopCatalog: SHOP_CATALOG_BY_COST, shopOdds: SHOP_ODDS,
  enemyTemplates: ENEMY_TEMPLATES, enemyPositions: ENEMY_POSITIONS, enemyGrowth: ENEMY_GROWTH,
  opponents: ROUND_ENEMY_PROJECTIONS,
  economy: { rules: MATCH_RULES, stages: STAGE_PLAYER_DAMAGE, income: ECONOMY_RULES, experience: XP_TO_NEXT_LEVEL },
  componentPool: {version:COMPONENT_POOL_VERSION,entries:COMPONENT_POOL},
  reference: SOURCE_MANIFEST, combatRules: S13_COMBAT_RULES,
});

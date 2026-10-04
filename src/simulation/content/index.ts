import { ABILITY_DEFINITIONS } from '../combat-abilities';
import { UNIT_DEFINITIONS } from '../units';
import { SHOP_CATALOG_BY_COST, SHOP_ODDS } from '../match-rules';
import { ROUND_SCHEDULE } from '../round-schedule';
import { ENEMY_TEMPLATES, ENEMY_POSITIONS, ENEMY_GROWTH } from '../round-enemies';
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
  for (const char of canonicalContent(value).split('')) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return `fnv1a32-utf16:${hash.toString(16).padStart(8, '0')}`;
}
export const CONTENT_DIGEST = digestContent({
  units: UNIT_DEFINITIONS, abilities: ABILITY_DEFINITIONS, traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS,
  augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS, schedule: ROUND_SCHEDULE,
  shopCatalog: SHOP_CATALOG_BY_COST, shopOdds: SHOP_ODDS,
  enemyTemplates: ENEMY_TEMPLATES, enemyPositions: ENEMY_POSITIONS, enemyGrowth: ENEMY_GROWTH,
});

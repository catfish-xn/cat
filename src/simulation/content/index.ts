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
export { CONTENT_DIGEST } from './identity-constants';

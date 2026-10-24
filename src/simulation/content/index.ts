import { drainSetup } from '../setup-work';
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
// No memo or admission result: synchronous restore drains all setup work before
// returning. Keep cooperative callers and external object inputs on their
// original generator path; nested scopes (including failures) restore it.
var synchronousRestoreEncoding: boolean | undefined;
export function withSynchronousRestoreEncoding<T>(enabled: boolean, run: () => T): T {
  const previous = synchronousRestoreEncoding;
  synchronousRestoreEncoding = enabled;
  try { return run(); } finally { synchronousRestoreEncoding = previous; }
}
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
  return canonicalLeaf(value) ?? (synchronousRestoreEncoding ? canonicalSync(value, true)
    : drainSetup(canonicalSteps(value, { remaining: 64, retainFrozen: true })));
}
/** Setup uses bounded traversal without retaining short-lived snapshot text. */
export function* canonicalContentSteps(value: unknown): Generator<void, string, void> {
  if (synchronousRestoreEncoding) return canonicalSync(value, false);
  return yield* canonicalSteps(value, { remaining: 64, retainFrozen: false });
}
function canonicalLeaf(value: unknown): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value !== null && typeof value === 'object') return (frozenCanonical ??= new WeakMap()).get(value);
  return undefined;
}
function* canonicalSteps(value: unknown, budget: { remaining: number; retainFrozen: boolean }): Generator<void, string, void> {
  const leaf = canonicalLeaf(value);
  if (leaf !== undefined) return leaf;
  if (--budget.remaining === 0) { budget.remaining = 64; yield; }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new TypeError('Content cannot contain sparse arrays');
    // Preserve the synchronous API's native map/species behavior for non-plain arrays.
    if (Object.hasOwn(value, 'map') || Object.hasOwn(value, 'constructor') || Object.getPrototypeOf(value) !== Array.prototype)
      return `[${value.map(canonicalContent).join(',')}]`;
    const length = value.length, parts = new Array<string>(length);
    for (let i = 0; i < length; i++) if (i in value) {
      const child: unknown = value[i];
      parts[i] = canonicalLeaf(child) ?? (yield* canonicalSteps(child, budget));
    }
    const text = `[${parts.join(',')}]`;
    return !budget.retainFrozen || !Object.isFrozen(value) ? text : rememberFrozen(value, text, Array.from({ length: value.length }, (_, i) => String(i)));
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(key => key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57)) {
      const parts: string[] = [];
      for (const key of keys) {
        const quoted = quoteKey(key), child = (value as Record<string, unknown>)[key];
        parts.push(`${quoted}:${canonicalLeaf(child) ?? (yield* canonicalSteps(child, budget))}`);
      }
      const text = `{${parts.join(',')}}`;
      return budget.retainFrozen ? rememberFrozen(value, text, keys) : text;
    }
    const scalars = Object.create(scalarPrototype ??= Object.freeze(Object.create(null))) as Record<string, unknown>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], child = (value as Record<string, unknown>)[key];
      if (child === null || typeof child === 'string' || typeof child === 'boolean' || typeof child === 'number' && Number.isFinite(child)) {
        scalars[key] = child; continue;
      }
      const parts = keys.slice(0, i).map(key => `${quoteKey(key)}:${canonicalContent(scalars[key])}`);
      parts.push(`${quoteKey(key)}:${canonicalLeaf(child) ?? (yield* canonicalSteps(child, budget))}`);
      for (let rest = i + 1; rest < keys.length; rest++) {
        const key = keys[rest], quoted = quoteKey(key), child = (value as Record<string, unknown>)[key];
        parts.push(`${quoted}:${canonicalLeaf(child) ?? (yield* canonicalSteps(child, budget))}`);
      }
      const text = `{${parts.join(',')}}`;
      return budget.retainFrozen ? rememberFrozen(value, text, keys) : text;
    }
    const text = JSON.stringify(scalars);
    return budget.retainFrozen ? rememberFrozen(value, text, keys) : text;
  }
  throw new TypeError('Content must be finite plain JSON data');
}
/** Identical traversal, key order, array fallback, finite-data checks and
 * frozen-text policy, without generator allocation/delegation when the owning
 * restore will synchronously drain every chunk anyway. */
function canonicalSync(value: unknown, retainFrozen: boolean): string {
  const leaf = canonicalLeaf(value);
  if (leaf !== undefined) return leaf;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new TypeError('Content cannot contain sparse arrays');
    // Preserve the synchronous API's native map/species behavior for non-plain arrays.
    if (Object.hasOwn(value, 'map') || Object.hasOwn(value, 'constructor') || Object.getPrototypeOf(value) !== Array.prototype)
      return `[${value.map(canonicalContent).join(',')}]`;
    const length = value.length, parts = new Array<string>(length);
    for (let i = 0; i < length; i++) if (i in value) {
      const child: unknown = value[i];
      parts[i] = canonicalLeaf(child) ?? canonicalSync(child, retainFrozen);
    }
    const text = `[${parts.join(',')}]`;
    return !retainFrozen || !Object.isFrozen(value) ? text : rememberFrozen(value, text, Array.from({ length: value.length }, (_, i) => String(i)));
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(key => key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57)) {
      const parts: string[] = [];
      for (const key of keys) {
        const quoted = quoteKey(key), child = (value as Record<string, unknown>)[key];
        parts.push(`${quoted}:${canonicalLeaf(child) ?? canonicalSync(child, retainFrozen)}`);
      }
      const text = `{${parts.join(',')}}`;
      return retainFrozen ? rememberFrozen(value, text, keys) : text;
    }
    const scalars = Object.create(scalarPrototype ??= Object.freeze(Object.create(null))) as Record<string, unknown>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], child = (value as Record<string, unknown>)[key];
      if (child === null || typeof child === 'string' || typeof child === 'boolean' || typeof child === 'number' && Number.isFinite(child)) {
        scalars[key] = child; continue;
      }
      const parts = keys.slice(0, i).map(key => `${quoteKey(key)}:${canonicalContent(scalars[key])}`);
      parts.push(`${quoteKey(key)}:${canonicalLeaf(child) ?? canonicalSync(child, retainFrozen)}`);
      for (let rest = i + 1; rest < keys.length; rest++) {
        const key = keys[rest], quoted = quoteKey(key), child = (value as Record<string, unknown>)[key];
        parts.push(`${quoted}:${canonicalLeaf(child) ?? canonicalSync(child, retainFrozen)}`);
      }
      const text = `{${parts.join(',')}}`;
      return retainFrozen ? rememberFrozen(value, text, keys) : text;
    }
    const text = JSON.stringify(scalars);
    return retainFrozen ? rememberFrozen(value, text, keys) : text;
  }
  throw new TypeError('Content must be finite plain JSON data');
}
/** Equality for data already admitted by the restore boundary's full JSON validation.
 * Compares object keys without sorting or allocating canonical strings. Array order,
 * extra fields and JSON's -0/0 equivalence retain canonicalContent semantics.
 * This is not an input validator; callers must validate finite plain JSON first. */
export function equalValidatedContent(a: unknown, b: unknown): boolean {
  // Parsed restores may decode constructor metadata by immutable reference.
  // Still visit every object/array field in this invocation; identity is not
  // admission evidence. Object inputs retain the original dispatch.
  if (a === b && (!synchronousRestoreEncoding || a === null || typeof a !== 'object')) return a !== undefined;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    // Only the private parsed restore graph uses the loop. Other callers keep
    // native every dispatch, including custom methods and property reads.
    if (!synchronousRestoreEncoding) return a.every((value, index) => equalValidatedContent(value, b[index]));
    const length = a.length;
    for (let i = 0; i < length; i++) if (i in a && !equalValidatedContent(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) if (!Object.hasOwn(right, key) || !equalValidatedContent(left[key], right[key])) return false;
  return true;
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

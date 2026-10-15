import { freezeContent } from './content/freeze';

// Byte-preserving interning of immutable JSON metadata, never a validation cache.
// Restore callers enter only AFTER all authority/resource/runtime checks succeed.
const references = new Map<string, object>();
const declarations = new Map<string, object>();
const dataObjects = new WeakSet<object>();
function plainData(value: unknown, ancestors: Set<object>, owned: object[]): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  // JSON text erases negative zero; keep that case on the original path.
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0);
  if (typeof value !== 'object') return false;
  if (dataObjects.has(value)) return true;
  if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length) return false;
  const array = Array.isArray(value), keys = Object.keys(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) return false;
  if (Object.getOwnPropertyNames(value).length !== keys.length + (array ? 1 : 0)) return false;
  if (array && (keys.length !== value.length || keys.some((key, i) => key !== String(i)))) return false;
  ancestors.add(value);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !plainData(descriptor.value, ancestors, owned)) return false;
  }
  ancestors.delete(value); owned.push(value); return true;
}
function reuse<T extends object>(value: T, owned: readonly object[] = [], cache = references): T {
  const key = JSON.stringify(value), cached = cache.get(key);
  if (cached) {
    cache.delete(key); cache.set(key, cached);
    return cached as T;
  }
  freezeContent(value);
  for (const object of owned) dataObjects.add(object);
  dataObjects.add(value);
  if (cache.size >= (cache === declarations ? 256 : 64)) cache.delete(cache.keys().next().value!);
  cache.set(key, value); return value;
}
/** Constructor-owned data only; accessors, extra array fields and -0 never intern. */
export function shareGeneratedJson<T extends object>(value: T): T {
  if (dataObjects.has(value)) return value;
  const owned: object[] = [];
  return plainData(value, new Set(), owned) ? reuse(value, owned) : freezeContent(value);
}
/** Locally parsed, fully validated JSON with no negative-zero token. No external object inputs. */
export function shareParsedJson<T extends object>(value: T): T { return reuse(value); }

/** A complete finite JSON data graph frozen by this module, with no accessors. */
export function isImmutableJson(value: object): boolean {
  if (dataObjects.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  const owned: object[] = [];
  // History/checkpoint readers can own deep-frozen data without having used this
  // module. Prove the complete graph once; never freeze an external child here.
  if (!plainData(value, new Set(), owned) || !owned.every(Object.isFrozen)) return false;
  for (const object of owned) dataObjects.add(object);
  return true;
}

// Combat declarations have a separate bounded arena so a large army cannot
// evict the Match metadata needed by the every-tick restore path.
export function shareGeneratedDeclaration<T extends object>(value: T): T {
  if (dataObjects.has(value)) return value;
  const owned: object[] = [];
  return plainData(value, new Set(), owned) ? reuse(value, owned, declarations) : freezeContent(value);
}
export function shareParsedDeclaration<T extends object>(value: T): T { return reuse(value, [], declarations); }

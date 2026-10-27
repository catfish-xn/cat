import { freezeContent } from './content/freeze';

// Byte-preserving interning of immutable JSON metadata, never a validation cache.
// Interning callers enter AFTER all authority/resource/runtime checks succeed.
// Decoding can borrow only constructor data; it never certifies a saved Match.
const references = new Map<string, object>();
const declarations = new Map<string, object>();
const dataObjects = new WeakSet<object>();
// Constructor ownership only, never a restored/admitted-save certificate.
// Parsed saves are NEVER added here. The decoder still runs every Match check.
const constructorMetadata = new WeakSet<object>();
function plainData(value: unknown, ancestors: Set<object>, owned: object[], trustKnown = true, scoped?: WeakSet<object>): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  // JSON text erases negative zero; keep that case on the original path.
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0);
  if (typeof value !== 'object') return false;
  if (trustKnown && (dataObjects.has(value) || scoped?.has(value))) return true;
  if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length) return false;
  const array = Array.isArray(value), keys = Object.keys(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) return false;
  if (Object.getOwnPropertyNames(value).length !== keys.length + (array ? 1 : 0)) return false;
  if (array && (keys.length !== value.length || keys.some((key, i) => key !== String(i)))) return false;
  ancestors.add(value);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !plainData(descriptor.value, ancestors, owned, trustKnown, scoped)) return false;
  }
  ancestors.delete(value); owned.push(value); return true;
}
function reuse<T extends object>(value: T, owned: readonly object[] = [], cache = references, encoded?: string): T {
  const key = encoded ?? JSON.stringify(value), cached = cache.get(key);
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
  if (!plainData(value, new Set(), owned)) return freezeContent(value);
  const result = reuse(value, owned);
  if (result === value && Object.hasOwn(value, 'round') && Object.hasOwn(value, 'loot')
    && Object.hasOwn(value, 'preparation') && Object.hasOwn(value, 'encounterPlan')
    && !('toJSON' in Object.prototype) && !('toJSON' in Array.prototype)) {
    // Prove lossless native JSON round-trip even for a child that came from an
    // interner. This optional encoding check never changes constructor behavior.
    try { if (plainData(value, new Set(), [], false)) constructorMetadata.add(value); } catch { /* no decoder optimization */ }
  }
  return result;
}
/** Like shareGeneratedJson but always keeps the caller's object: no older JSON-equal hit can
 * swap out children (e.g. a frozen ledger) the caller still compares by identity. */
export function claimGeneratedJson<T extends object>(value: T): T {
  if (dataObjects.has(value)) return value;
  const owned: object[] = [];
  if (!plainData(value, new Set(), owned)) return freezeContent(value);
  freezeContent(value);
  for (const object of owned) dataObjects.add(object);
  dataObjects.add(value); return value;
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

/** Same complete frozen-data proof, with certificates owned only by one battle.
 * Finished event ledgers can outlive the task without growing the process-wide
 * weak table (and the cost of every subsequent collection). */
export function createImmutableJsonChecker(): (value: object) => boolean {
  const scoped = new WeakSet<object>();
  return value => {
    if (scoped.has(value) || dataObjects.has(value)) return true;
    if (!Object.isFrozen(value)) return false;
    const owned: object[] = [];
    if (!plainData(value, new Set(), owned, true, scoped) || !owned.every(Object.isFrozen)) return false;
    for (const object of owned) scoped.add(object);
    return true;
  };
}

// Combat declarations have a separate bounded arena so a large army cannot
// evict the Match metadata needed by the every-tick restore path.
export function shareGeneratedDeclaration<T extends object>(value: T): T {
  if (dataObjects.has(value)) return value;
  const owned: object[] = [];
  return plainData(value, new Set(), owned) ? reuse(value, owned, declarations) : freezeContent(value);
}
export function shareParsedDeclaration<T extends object>(value: T): T {
  return dataObjects.has(value) ? value : reuse(value, [], declarations);
}

/** Sharing only, never admission. Both graphs are owned JSON; preserve native
 * JSON.stringify property order as well as values before replacing a reference. */
export function equalOrderedJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!equalOrderedJson(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left), other = Object.keys(right);
  if (keys.length !== other.length) return false;
  for (let i = 0; i < keys.length; i++) if (keys[i] !== other[i] || !equalOrderedJson(left[keys[i]], right[other[i]])) return false;
  return true;
}


export interface DecodedMatchJson {
  readonly value: unknown;
  readonly sharedM8?: object;
  /** Refresh the existing immutable arena only after admission succeeds. */
  readonly finishM8?: () => object;
}
/** Decode representation only. No Match validation result is consulted or
 * stored: a full raw-byte comparison binds constructor-owned immutable data,
 * and the restore boundary still checks EVERY field on EVERY invocation. */
export function decodeMatchJson(source: string, allowBorrow = !source.includes('-0')): DecodedMatchJson {
  const ordinary = (): DecodedMatchJson => ({ value: JSON.parse(source) });
  if (!allowBorrow || source.includes('\\u') || 'toJSON' in Object.prototype || 'toJSON' in Array.prototype) return ordinary();
  const at = source.indexOf('"m8"');
  // Escaped or duplicate keys, whitespace variants and any ambiguous location
  // simply use native parsing. A string VALUE "m8" also disables this path.
  if (at < 0 || source.indexOf('"m8"', at + 4) >= 0 || !source.startsWith('"m8":{', at)) return ordinary();
  const start = at + 5;
  for (const [encoded, value] of references) {
    if (!constructorMetadata.has(value) || !source.startsWith(encoded, start)) continue;
    const end = start + encoded.length;
    if (source[end] !== ',' && source[end] !== '}') continue;
    try {
      const raw: unknown = JSON.parse(source.slice(0, start) + 'null' + source.slice(end));
      // The unique literal key must really be at the Match root. Nested-only
      // keys must never manufacture a missing root field.
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        && Object.hasOwn(raw, 'm8') && (raw as Record<string, unknown>).m8 === null) {
        (raw as Record<string, unknown>).m8 = value;
        return { value: raw, sharedM8: value, finishM8: () => reuse(value, [], references, encoded) };
      }
    } catch { /* replay native parsing below, preserving its original error text/position */ }
    break;
  }
  return ordinary();
}

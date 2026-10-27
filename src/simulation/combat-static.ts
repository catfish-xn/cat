import { equalOrderedJson, isImmutableJson, shareGeneratedDeclaration, shareParsedDeclaration } from './immutable-json';
import { freezeContent, freezeTransientContent } from './content/freeze';
import type { CombatState, CombatUnit } from './combat-types';

const fields = ['ability', 'sources', 'triggers', 'mechanics', 'itemPrograms', 'companionDefinitions', 'attackCone', 'mechanismDefinitions'] as const;
/** Declarations are read-only; every dynamic runtime field still belongs to its tick. */
export function freezeCombatDeclarations(unit: CombatUnit, parsed = false, freshAbility = false): CombatUnit {
  for (const key of fields) {
    const value = unit[key];
    if (value && typeof value === 'object') (unit as unknown as Record<string, unknown>)[key] =
      key === 'ability' && freshAbility ? freezeContent(value) : parsed ? shareParsedDeclaration(value) : shareGeneratedDeclaration(value);
  }
  return unit;
}
export function sharedCombatDeclarations(unit: CombatUnit): Partial<CombatUnit> {
  const shared: Partial<CombatUnit> = {};
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(unit, key);
    const value = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (value && typeof value === 'object' && isImmutableJson(value)) (shared as Record<string, unknown>)[key] = value;
  }
  return shared;
}

/** Restore-only, after all candidate checks. Reuse only certified immutable
 * declarations that also preserve every value AND native property order. No
 * dynamic state escapes the replay, and a mismatch simply keeps the candidate. */
export function shareValidatedCombatDeclarations(candidate: CombatState, expected: CombatState): void {
  const expectedUnits = new Map(expected.units.map(unit => [unit.id, unit]));
  for (const unit of candidate.units) {
    const source = expectedUnits.get(unit.id);
    if (!source) continue;
    const declarations = sharedCombatDeclarations(source);
    for (const key of fields) {
      const value = declarations[key];
      if (value && equalOrderedJson(unit[key], value)) (unit as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (expected.strategy && isImmutableJson(expected.strategy) && equalOrderedJson(candidate.strategy, expected.strategy))
    Object.assign(candidate, { strategy: expected.strategy });
}

// These records are only read or replaced by the combat pipeline. Arrays that
// receive push/filter updates belong to the new tick; their entries can share.
const tickRecords = new Set(['cell', 'maxHpBasis', 'spellCrit', 's13P2Opening']);
const tickLists = new Set(['statuses', 'shieldLayers', 'tasks', 'effectRuntime', 'combatItemGrants']);
// Records detached here stay out of the process-wide certification tables: a
// replay creates thousands of them, and growing those weak tables while a large
// save is loaded slows every later garbage collection.
const tickOwned = new WeakSet<object>();
// Descriptor-only speculation never invokes an accessor. Exotic graphs retain
// native structuredClone behavior, including cycles, aliases and built-ins.
const nativeTickClone = Symbol('native tick clone');
function cloneTickRecord<T extends object>(value: T): T {
  const copies = new Map<object, object>();
  const visiting = new Set<object>();
  const clone = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      if (typeof input === 'function' || typeof input === 'symbol') throw nativeTickClone;
      return input;
    }
    // tickOwned also contains native fallback roots (e.g. Date), whose internal
    // slots are still mutable despite Object.freeze. Only certified JSON may be
    // borrowed as a nested child of a newly detached record.
    if (isImmutableJson(input)) return input;
    if (visiting.has(input)) throw nativeTickClone;
    const previous = copies.get(input);
    if (previous) return previous;
    const array = Array.isArray(input), prototype = Object.getPrototypeOf(input);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null) throw nativeTickClone;
    const result: Record<string, unknown> | unknown[] = array ? new Array((input as unknown[]).length) : {};
    copies.set(input, result);
    visiting.add(input);
    for (const key of Object.keys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
      if (!('value' in descriptor)) throw nativeTickClone;
      const child = clone(descriptor.value);
      if (key === '__proto__') Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
      else (result as Record<string, unknown>)[key] = child;
    }
    visiting.delete(input);
    return Object.freeze(result);
  };
  try { return clone(value) as T; }
  catch (error) { if (error !== nativeTickClone) throw error; return freezeTransientContent(structuredClone(value)); }
}
function immutableTickRecord<T extends object>(value: T): T {
  // Never freeze a caller's mutable checkpoint. Detach it once, then reuse the
  // deeply immutable record on subsequent ticks, including nested receipt data.
  if (tickOwned.has(value) || isImmutableJson(value)) return value;
  const owned = cloneTickRecord(value);
  tickOwned.add(owned);
  return owned;
}
/** Copy writable runtime, share only certified read-only records/declarations. */
export function copyCombatUnitForTick(unit: CombatUnit): CombatUnit {
  const shared = sharedCombatDeclarations(unit);
  const copy = { ...unit };
  // Preserve the native boundary's observable order: enumerate/read every own
  // field first, then read the three exclusions, before cloning nested data.
  const omitDefinitions = unit.mechanismDefinitions;
  const omitState = unit.mechanismState;
  const omitLedger = unit.triggerLedger;
  // These are existing own data properties of the detached spread. Assign
  // directly instead of allocating a computed-key wrapper for every field.
  const writable = copy as unknown as Record<string, unknown>;
  for (const key of fields) if (Object.hasOwn(shared, key) && copy[key] !== shared[key]) writable[key] = shared[key];
  if (omitDefinitions) writable.mechanismDefinitions = undefined;
  if (omitState) writable.mechanismState = undefined;
  if (omitLedger) writable.triggerLedger = undefined;
  for (const key of Object.keys(copy) as (keyof CombatUnit)[]) {
    const value = copy[key];
    if (value === null || typeof value !== 'object') {
      // Preserve the native detach boundary's rejection of non-cloneable values,
      // including a getter that returns a function on its first (only) read.
      if (typeof value === 'function' || typeof value === 'symbol') structuredClone(value);
      continue;
    }
    if (Object.hasOwn(shared, key) || key === 'startingCell') continue;
    let next: unknown;
    if (key === 'runtime') next = { ...value };
    else if (tickRecords.has(key)) next = immutableTickRecord(value);
    else if (tickLists.has(key) && Array.isArray(value)) next = value.map(entry => immutableTickRecord(entry));
    else next = cloneWritable(value);
    writable[key] = next;
  }
  // Mechanism definitions already follow the resolver's copy-on-write contract;
  // preserve the original reference without freezing a mutable caller input.
  for (const key of fields) {
    if (Object.hasOwn(shared, key)) { if (copy[key] !== shared[key]) writable[key] = shared[key]; continue; }
    const value = copy[key];
    if (value && typeof value === 'object') writable[key] = shareGeneratedDeclaration(value);
  }
  // Re-read conditions and values just like the original native-copy overrides;
  // accessors may return different values after the nested clone has run.
  if (unit.mechanismDefinitions) writable.mechanismDefinitions = unit.mechanismDefinitions;
  if (unit.mechanismState) writable.mechanismState = unit.mechanismState;
  if (unit.triggerLedger) writable.triggerLedger = unit.triggerLedger;
  return copy;
}

// Detach ordinary runtime data without a native serialization round-trip.
// Descriptor reads are speculative only: accessors and built-ins take the
// unchanged native boundary, and aliases/cycles keep one copy per input node.
function cloneWritable<T>(value: T): T {
  const copies = new Map<object, object>();
  const clone = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      if (typeof input === 'function' || typeof input === 'symbol') throw nativeTickClone;
      return input;
    }
    const previous = copies.get(input);
    if (previous) return previous;
    const array = Array.isArray(input), prototype = Object.getPrototypeOf(input);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null) throw nativeTickClone;
    const result: Record<string, unknown> | unknown[] = array ? new Array((input as unknown[]).length) : {};
    copies.set(input, result);
    for (const key of Object.keys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
      if (!('value' in descriptor)) throw nativeTickClone;
      const child = clone(descriptor.value);
      if (key === '__proto__') Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
      else (result as Record<string, unknown>)[key] = child;
    }
    return result;
  };
  try { return clone(value) as T; }
  catch (error) { if (error !== nativeTickClone) throw error; return structuredClone(value); }
}

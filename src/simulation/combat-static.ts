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
const tickRecords = new Set(['cell', 'maxHpBasis', 'spellCrit']);
const tickLists = new Set(['statuses', 'shieldLayers', 'tasks', 'effectRuntime', 'combatItemGrants']);
// Records detached here stay out of the process-wide certification tables: a
// replay creates thousands of them, and growing those weak tables while a large
// save is loaded slows every later garbage collection.
const tickOwned = new WeakSet<object>();
function immutableTickRecord<T extends object>(value: T): T {
  // Never freeze a caller's mutable checkpoint. Detach it once, then reuse the
  // deeply immutable record on subsequent ticks, including nested receipt data.
  if (tickOwned.has(value) || isImmutableJson(value)) return value;
  const owned = freezeTransientContent(structuredClone(value));
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
  Object.assign(copy, shared);
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
    else next = structuredClone(value);
    writable[key] = next;
  }
  // Mechanism definitions already follow the resolver's copy-on-write contract;
  // preserve the original reference without freezing a mutable caller input.
  freezeCombatDeclarations(copy);
  Object.assign(copy, shared);
  // Re-read conditions and values just like the original native-copy overrides;
  // accessors may return different values after the nested clone has run.
  if (unit.mechanismDefinitions) writable.mechanismDefinitions = unit.mechanismDefinitions;
  if (unit.mechanismState) writable.mechanismState = unit.mechanismState;
  if (unit.triggerLedger) writable.triggerLedger = unit.triggerLedger;
  return copy;
}

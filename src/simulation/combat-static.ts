import { isImmutableJson, shareGeneratedDeclaration, shareParsedDeclaration } from './immutable-json';
import { freezeContent } from './content/freeze';
import type { CombatUnit } from './combat-types';

const fields = ['ability', 'sources', 'triggers', 'mechanics', 'itemPrograms', 'companionDefinitions', 'attackCone', 'mechanismDefinitions'] as const;
/** Declarations are read-only; every dynamic runtime field still belongs to its tick. */
export function freezeCombatDeclarations(unit: CombatUnit, parsed = false, freshAbility = false): CombatUnit {
  for (const key of fields) {
    const value = unit[key];
    if (value && typeof value === 'object') Object.assign(unit, { [key]: key === 'ability' && freshAbility ? freezeContent(value) : parsed ? shareParsedDeclaration(value) : shareGeneratedDeclaration(value) });
  }
  return unit;
}
export function sharedCombatDeclarations(unit: CombatUnit): Partial<CombatUnit> {
  const shared: Partial<CombatUnit> = {};
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(unit, key);
    const value = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (value && typeof value === 'object' && isImmutableJson(value)) Object.assign(shared, { [key]: value });
  }
  return shared;
}

// These records are only read or replaced by the combat pipeline. Arrays that
// receive push/filter updates belong to the new tick; their entries can share.
const tickRecords = new Set(['cell', 'maxHpBasis', 'spellCrit']);
const tickLists = new Set(['statuses', 'shieldLayers', 'tasks', 'effectRuntime', 'combatItemGrants']);
function immutableTickRecord<T extends object>(value: T): T {
  // Never freeze a caller's mutable checkpoint. Detach it once, then reuse the
  // deeply immutable record on subsequent ticks, including nested receipt data.
  return isImmutableJson(value) ? value : freezeContent(structuredClone(value));
}
/** Copy writable runtime, share only certified read-only records/declarations. */
export function copyCombatUnitForTick(unit: CombatUnit): CombatUnit {
  const shared = sharedCombatDeclarations(unit);
  const copy = { ...unit };
  for (const key of Object.keys(copy) as (keyof CombatUnit)[]) {
    const value = copy[key];
    if (value === null || typeof value !== 'object') {
      // Preserve the native detach boundary's rejection of non-cloneable values,
      // including a getter that returns a function on its first (only) read.
      if (typeof value === 'function' || typeof value === 'symbol') structuredClone(value);
      continue;
    }
    if (Object.hasOwn(shared, key) || key === 'mechanismDefinitions' || key === 'mechanismState' || key === 'triggerLedger' || key === 'startingCell') continue;
    let next: unknown;
    if (key === 'runtime') next = { ...unit.runtime };
    else if (tickRecords.has(key)) next = immutableTickRecord(value);
    else if (tickLists.has(key) && Array.isArray(value)) next = value.map(entry => immutableTickRecord(entry));
    else next = structuredClone(value);
    Object.assign(copy, { [key]: next });
  }
  // Mechanism definitions already follow the resolver's copy-on-write contract;
  // preserve the original reference without freezing a mutable caller input.
  const mechanisms = copy.mechanismDefinitions;
  if (mechanisms) Object.assign(copy, { mechanismDefinitions: undefined });
  freezeCombatDeclarations(copy);
  if (mechanisms) Object.assign(copy, { mechanismDefinitions: mechanisms });
  return copy;
}

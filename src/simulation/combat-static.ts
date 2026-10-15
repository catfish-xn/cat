import { isImmutableJson, shareGeneratedDeclaration, shareParsedDeclaration } from './immutable-json';
import type { CombatUnit } from './combat-types';

const fields = ['ability', 'sources', 'triggers', 'mechanics', 'itemPrograms', 'companionDefinitions', 'attackCone'] as const;
/** Declarations are read-only; every dynamic runtime field still belongs to its tick. */
export function freezeCombatDeclarations(unit: CombatUnit, parsed = false): CombatUnit {
  for (const key of fields) {
    const value = unit[key];
    if (value && typeof value === 'object') Object.assign(unit, { [key]: parsed ? shareParsedDeclaration(value) : shareGeneratedDeclaration(value) });
  }
  return unit;
}
export function sharedCombatDeclarations(unit: CombatUnit): Partial<CombatUnit> {
  const shared: Partial<CombatUnit> = {};
  for (const key of fields) {
    const value = unit[key];
    if (value && typeof value === 'object' && isImmutableJson(value)) Object.assign(shared, { [key]: value });
  }
  return shared;
}

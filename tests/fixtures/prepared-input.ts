import { freezeContent } from '../../src/simulation/content/freeze';

/** Store only fixture inputs, never restoration/validation decisions or the result being tested. */
export function prepareInput<T>(value: T): T {
  return freezeContent(structuredClone(value));
}

/** A fresh deep copy per caller; preserve Match's immutable content boundaries. */
export function copyInput<T>(value: T): T {
  const copy = structuredClone(value);
  const visited = new WeakSet<object>();
  function certify(value: unknown): void {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if ('m8' in value && 'resourceProvenance' in value) {
      freezeContent(value.m8); freezeContent(value.resourceProvenance);
      if ('combatInputBasis' in value && value.combatInputBasis) freezeContent(value.combatInputBasis);
      return;
    }
    for (const child of Object.values(value)) certify(child);
  }
  certify(copy);
  return copy;
}

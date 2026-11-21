import type { ItemInstance } from './strategy-types';
import type { Unit } from './unit-types';

/** P 2026-10-24: a hero augment's "strongest" copy = highest star, then most equipped items, then lowest id, among this
 * side's board copies of `definitionId`. Shared by the rules (augment-effects heroCarry) and the unit panel. */
export function strongestHeroCopy(allies: readonly Unit[], items: readonly ItemInstance[], definitionId: string): Unit | undefined {
  const held = (x: Unit) => items.filter(i => i.location.kind === 'unit' && i.location.unitId === x.id).length;
  return allies.filter(x => x.definitionId === definitionId && x.location.kind === 'board')
    .sort((a, b) => b.starLevel - a.starLevel || held(b) - held(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}

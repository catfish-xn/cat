import type { GameState } from './game';

/** Physical/save capacity stays nine. Only this overlay limits usable cells. */
export const usableBenchSlots = (preparation: GameState): number => preparation.usableBenchSlots ?? preparation.benchSize;
export const isOverflowUnit = (preparation: GameState, id: string): boolean => preparation.overflowUnitIds?.includes(id) ?? false;

/** Frozen combat keeps every owned resource, representing parked pieces as reserves.
 * This also preserves the nine-cell input-assets contract and excludes their traits. */
export function combatBenchProjection(preparation: GameState): GameState {
  if (preparation.usableBenchSlots === undefined && preparation.overflowUnitIds === undefined) return preparation;
  const ids = preparation.overflowUnitIds ?? [];
  const occupied = new Set(preparation.units.flatMap(u => u.location.kind === 'bench' ? [u.location.slot] : []));
  const slots = Array.from({ length: preparation.benchSize }, (_, i) => i).filter(i => !occupied.has(i));
  if (slots.length < ids.length) throw new RangeError('Invalid over-encumbered capacity');
  const { overflowUnitIds: _overflow, usableBenchSlots: _usable, ...base } = preparation;
  return { ...base, units: preparation.units.map(u => ids.includes(u.id)
    ? { ...u, location: { kind: 'bench', slot: slots[ids.indexOf(u.id)] } } : u) };
}

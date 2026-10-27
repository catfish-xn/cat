import type { CombatUnit } from './combat-types';
import type { Effect, TraitSnapshot } from './strategy-types';
import type { Unit } from './unit-types';
import { isTraitSnapshotMember } from './traits/effective-membership';

export interface AerialWarfareRuntime { readonly hexes: number; readonly dashes: number }

/** Membership includes emblems and does not require an active Firelight tier. */
export function compileBatch5G3Effect(effect: Effect, unit: Unit, traits: readonly TraitSnapshot[]): Effect[] {
  return traits.some(t => t.team === unit.team && t.traitId === 'firelight' && isTraitSnapshotMember(t, unit)) ? [effect] : [];
}

export function aerialWarfareBonus(unit: Pick<CombatUnit, 'mechanics' | 'aerialWarfare'>, stat: 'adBps' | 'ap'): number {
  const mechanic = unit.mechanics?.find(m => m.mechanic === 'aerialWarfare'), runtime = unit.aerialWarfare;
  if (!mechanic || !runtime) return 0;
  const v = mechanic.values;
  return stat === 'adBps' ? runtime.hexes * v.hexAdBps + runtime.dashes * v.dashAdBps : runtime.hexes * v.hexAp + runtime.dashes * v.dashAp;
}

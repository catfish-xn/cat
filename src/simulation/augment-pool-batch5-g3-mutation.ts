import { sameCell, DEFAULT_BOARD, type Board, type HexCell, type Team } from './board';
import type { CombatStrategyInputs } from './combat-input';
import type { Effect, OwnedAugment, TraitSnapshot, StrategySnapshot } from './strategy-types';
import type { Unit } from './unit-types';
import { isTraitSnapshotMember } from './traits/effective-membership';

/** P-B5-71-G3: second row from the back, fourth column; own coordinates before two-sided mirroring. */
export function mutationSacrificeCell(team: Team = 'player', board: Board = DEFAULT_BOARD): HexCell {
  const zone = board.deploymentZones[team];
  return { col: 3, row: team === 'player' ? zone.lastRow - 1 : zone.firstRow + 1 };
}
export function hasMutationSurvives(augments: readonly OwnedAugment[]): boolean { return augments.some(a => a.definitionId === 'natural-selection'); }

export function mutationDonor(state: CombatStrategyInputs, traits: readonly TraitSnapshot[]): Unit | undefined {
  if (!hasMutationSurvives(state.augments)) return undefined;
  const cell = mutationSacrificeCell('player', state.preparation.board), trait = traits.find(t => t.team === 'player' && t.traitId === 'experiment');
  return trait && state.preparation.units.find(u => u.team === 'player' && u.location.kind === 'board' && sameCell(u.location.cell, cell) && isTraitSnapshotMember(trait, u));
}
export function compileMutationEffect(effect: Extract<Effect, {kind:'mechanic'}>, state: CombatStrategyInputs, unit: Unit, traits: readonly TraitSnapshot[]): Effect[] {
  const member = traits.some(t => t.team === unit.team && t.traitId === 'experiment' && isTraitSnapshotMember(t, unit));
  if (!member) return [];
  return [{ kind: 'statPercentBps', stat: 'maxHp', bps: effect.values.healthBps },
    ...(mutationDonor(state, traits)?.id === unit.id ? [{ kind: 'mechanic' as const, mechanic: 'mutationSacrifice', values: { enabled: 1 } }] : [])];
}

/** Remove equipment/anomaly effects from this combat's view only, after emblem membership was frozen.
 * The original input is retained by the caller for the donated Experiment bonus. */
export function mutationEquipmentProjection(state: CombatStrategyInputs, traits: readonly TraitSnapshot[]): CombatStrategyInputs {
  const donor = mutationDonor(state, traits); if (!donor) return state;
  return { ...state, items: state.items.filter(i => i.location.kind !== 'unit' || i.location.unitId !== donor.id),
    temporaryEquipment: state.temporaryEquipment.filter(i => i.holderId !== donor.id),
    anomalyBinding: state.anomalyBinding?.unitId === donor.id ? null : state.anomalyBinding };
}

/** One extra donation, even if a normal Laboratory already donates the same champion's bonus. */
export function addMutationDonation(state: CombatStrategyInputs, unit: Unit, traits: readonly TraitSnapshot[], effects: Effect[], tier: number, labs: readonly HexCell[], cloneHealthBps: number, splitTick: number): Effect[] {
  const donor = mutationDonor(state, traits), location = unit.location;
  if (!donor || donor.team !== unit.team || donor.id === unit.id || location.kind !== 'board' || !labs.some(c => sameCell(c, location.cell))) return effects;
  const factor = tier >= 7 ? 2 : 1;
  const bonus: Record<string, Record<string, number>> = { drmundo: { mundo: 60 }, nunu: { nunu: 300 }, zyra: { zyra: 5000 }, urgot: { urgot: 2000 }, twitch: { twitch: 2000 }, warwick: { warwick: 20 } };
  const extra = bonus[donor.definitionId] ?? {};
  const result = effects.map(e => e.kind === 'mechanic' && e.mechanic === 'g23Experiment' ? { ...e, values: Object.fromEntries([...new Set([...Object.keys(e.values), ...Object.keys(extra)])].map(k => [k, (e.values[k] ?? 0) + (extra[k] ?? 0) * factor])) }
    : e.kind === 'statFlat' && e.stat === 'maxHp' && donor.definitionId === 'drmundo' ? { ...e, amount: e.amount + 120 * factor } : e);
  if (state.items.some(i => i.definitionId === 'TFT13_Item_ExperimentEmblemItem' && i.location.kind === 'unit' && i.location.unitId === donor.id) && !result.some(e => e.kind === 'mechanic' && e.mechanic === 'g23ExperimentClone')) {
    result.push({ kind: 'mechanic', mechanic: 'g23ExperimentClone', values: { healthBps: cloneHealthBps, splitTick } });
  }
  return result;
}

/** Exclusion is neither a death nor a resource removal; no opening/death hooks can run for the donor. */
export function isMutationSacrifice(strategy: StrategySnapshot | undefined, unitId: string): boolean {
  return strategy?.units.some(u => u.unitId === unitId && u.mechanics?.some(m => m.mechanic === 'mutationSacrifice')) ?? false;
}
export function excludeMutationSacrifice(units: readonly Unit[], strategy?: StrategySnapshot): readonly Unit[] {
  const ids = new Set(strategy?.units.filter(u => u.mechanics?.some(m => m.mechanic === 'mutationSacrifice')).map(u => u.unitId));
  return ids.size ? units.filter(u => !ids.has(u.id) && ![...ids].some(id => u.id === id + ':g23-forge')) : units;
}

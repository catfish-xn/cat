import type { AnomalyBinding, AnomalySelection, ItemInstance, StrategyEvent } from './strategy-types';
import { portableAnomalyId } from './content/augment-pool-batch5-r2';
import type { MatchBase, MatchState, MatchEvent } from './match-types';

type Hero = { readonly id: string; readonly definitionId: string; readonly starLevel: number };

/** R5 project policy: keep the current instance (and upgrade lineage). When it leaves,
 * use the lexicographically first owned copy, independent of board position. Ultimate
 * Hero still needs a physical three-star copy. Custodied cards are passed only when
 * they already own the binding, never as candidates for a second active instance. */
export function resolveAnomalyBinding(
  selection: AnomalySelection | null | undefined, binding: AnomalyBinding | null, units: readonly Hero[],
): AnomalyBinding | null {
  if (!selection) return binding;
  const eligible = (unit: Hero) => unit.definitionId === selection.championDefinitionId
    && (selection.definitionId !== 'ultimate-hero' || unit.starLevel === 3);
  const unit = units.find(u => u.id === binding?.unitId && eligible(u))
    ?? units.filter(eligible).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0];
  if (unit?.id === binding?.unitId && binding?.definitionId === selection.definitionId
    && binding.choiceId === selection.choiceId && binding.boundRound === selection.boundRound) return binding;
  return unit ? { definitionId: selection.definitionId, choiceId: selection.choiceId,
    boundRound: selection.boundRound, unitId: unit.id } : null;
}

/** Native identity wins if restoration makes a portable holder the native holder.
 * Return the real item; never clone its accumulated state or grant acquisition rewards. */
export function reconcileAnomalyResources(
  selection: AnomalySelection | null | undefined, binding: AnomalyBinding | null,
  units: readonly Hero[], items: readonly ItemInstance[],
): { anomalyBinding: AnomalyBinding | null; items: readonly ItemInstance[]; events: StrategyEvent[] } {
  const next = resolveAnomalyBinding(selection, binding, units), events: StrategyEvent[] = [];
  if (next?.unitId !== binding?.unitId) {
    if (binding && next) events.push({ type: 'anomalyTransferred', fromId: binding.unitId, toId: next.unitId });
    else if (binding) events.push({ type: 'anomalyRemoved', unitId: binding.unitId });
    else if (next) events.push({ type: 'anomalyRestored', ...next });
  }
  const returned = items.filter(i => portableAnomalyId(i.definitionId) !== null
    && i.location.kind === 'unit' && i.location.unitId === next?.unitId);
  if (!returned.length) return { anomalyBinding: next, items, events };
  const ids = new Set(returned.map(i => i.id));
  events.push({ type: 'itemsReturned', itemIds: [...ids].sort(), unitId: next!.unitId });
  return { anomalyBinding: next, items: items.map(i => ids.has(i.id) ? { ...i, location: { kind: 'inventory' } } : i), events };
}

export function anomalyHolderCandidates(state: Pick<MatchBase, 'preparation' | 'carousel' | 'd14'>) {
  const deferred = new Set(state.carousel?.receipts.filter(r => !state.carousel!.preparationReceipts.includes(r.id)).map(r => r.unitId));
  return [...state.preparation.units.filter(u => u.team === 'player' && !deferred.has(u.id)),
    ...(state.d14?.held ? [state.d14.held.unit] : [])];
}

export function reconcileMatchAnomaly(state: MatchState, events: MatchEvent[] = []): MatchState {
  const resources = reconcileAnomalyResources(state.anomalySelection, state.anomalyBinding, anomalyHolderCandidates(state), state.items);
  events.push(...resources.events);
  return resources.anomalyBinding === state.anomalyBinding && resources.items === state.items ? state
    : { ...state, anomalyBinding: resources.anomalyBinding, items: resources.items };
}

import type { StrategyEvent } from './strategy-types';
import type { UnitUpgradedEvent } from './unit-types';
import type { MatchState } from './match-types';
import { appendResourceProvenance, mergeGrowthLedger } from './resource-provenance';
import { planDeferredUpgrades, transferUpgradeResources } from './upgrades';
import { planTemporaryEquipment } from './temporary-equipment';

/** Internal settlement hook. Growth commits first, then follows the normal upgrade survivor. */
export function resolveDeferredUpgrades(state: MatchState): { state: MatchState; events: readonly (StrategyEvent | UnitUpgradedEvent)[] } {
  if (!state.multiplayer) return { state, events: [] };
  const plan = planDeferredUpgrades(state.preparation);
  if (!plan.events.length) return { state, events: [] };
  const resources = transferUpgradeResources(state.items, state.anomalyBinding, plan.events);
  const equipment = planTemporaryEquipment({ ...state, preparation: plan.preparation, items: resources.items,
    anomalyBinding: resources.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, plan.events),
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
      plan.events.map(event => ({ kind: 'unit-upgraded-after-combat' as const, event }))) });
  return { state: equipment.state, events: [...plan.events, ...resources.events, ...equipment.events] };
}

import type { GameState } from './game';
import type { ResourceFact, UnitAcquisitionSource } from './resource-provenance';
import type { AnomalyBinding, ItemInstance, StrategyEvent } from './strategy-types';
import type { UnitUpgradedEvent } from './unit-types';
import { planPurchase, transferUpgradeResources } from './upgrades';

export interface UnitAcquisitionInput {
  readonly preparation: GameState;
  readonly items: readonly ItemInstance[];
  readonly anomalyBinding: AnomalyBinding | null;
  readonly nextUnitSerial: number;
}
export type UnitAcquisitionPlan = { readonly ok: false; readonly reason: 'bench-full' }
  | (UnitAcquisitionInput & {
    readonly ok: true;
    readonly unitId: string;
    readonly upgradeEvents: readonly UnitUpgradedEvent[];
    readonly events: readonly (UnitUpgradedEvent | StrategyEvent)[];
    readonly facts: readonly ResourceFact[];
  });

/** One candidate birth and its real upgrades, without economy, growth, RNG or receipt commits. */
export function planUnitAcquisition(
  input: UnitAcquisitionInput, definitionId: string, source: UnitAcquisitionSource, acquisitionSequence: number,
): UnitAcquisitionPlan {
  const serial = input.nextUnitSerial;
  if (!Number.isSafeInteger(serial) || serial < 1 || !Number.isSafeInteger(serial + 1)) throw new RangeError('Invalid unit serial');
  const unitId = `unit-${serial}`, purchase = planPurchase(input.preparation, definitionId, unitId);
  if (!purchase.ok) return purchase;
  const resources = transferUpgradeResources(input.items, input.anomalyBinding, purchase.events);
  return { ok: true, unitId, nextUnitSerial: serial + 1, preparation: purchase.preparation,
    items: resources.items, anomalyBinding: resources.anomalyBinding, upgradeEvents: purchase.events,
    events: [...purchase.events, ...resources.events], facts: [
      { kind: 'unit-acquired', unitId, source },
      ...purchase.events.map(event => ({ kind: 'unit-upgraded' as const, acquisitionSequence, event })),
    ] };
}

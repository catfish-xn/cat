/**
 * C18-B: the room's dispatch of `useConsumable` (contract §18.1/§18.3/§18.6). The room only hands the command to the
 * rules' shared-pool transaction; it never checks the tool, the target, the phase or a reforge result itself. On
 * success the pool, the latest seat state and the events are published together; on failure the input references come
 * back unchanged with the rules' reason (§18.5: no event, no revision, no RNG, the tool is not consumed).
 */
import { runSharedMatchCommand, type SharedPoolResult } from '../../server-entry';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import type { ConsumableCommand, ConsumableDisplayEvent, ConsumableTarget } from '../protocol';
import type { SharedPoolState } from './types';

export function useSeatConsumable(pool: SharedPoolState, state: MatchState, command: ConsumableCommand): SharedPoolResult {
  return runSharedMatchCommand(pool, state, { type: 'useConsumable', consumableId: command.consumableId, target: command.target });
}

const stamp = (event: { readonly domain?: 'match'; readonly eventSeq?: number }) =>
  ({ ...(event.domain !== undefined ? { domain: event.domain } : {}), ...(event.eventSeq !== undefined ? { eventSeq: event.eventSeq } : {}) });
const targetCopy = (target: ConsumableTarget): ConsumableTarget =>
  target.kind === 'unit' ? { kind: 'unit', unitId: target.unitId } : { kind: 'item', itemId: target.itemId };

/**
 * §18.8 SR-C18-03: the `consumable-used` receipt's events, copied field by field from the rules' own events in their
 * order (itemsRemoved / itemReforged, then consumableUsed). Every other event and field (provenance, RNG) is left out.
 */
export function consumableDisplayEvents(events: readonly MatchEvent[]): ConsumableDisplayEvent[] {
  return events.flatMap((event): ConsumableDisplayEvent[] => {
    switch (event.type) {
      case 'itemsRemoved': return [{ type: event.type, unitId: event.unitId, itemIds: [...event.itemIds], ...stamp(event) }];
      case 'itemReforged': return [{ type: event.type, itemId: event.itemId, definitionId: event.definitionId, outputItemId: event.outputItemId,
        outputDefinitionId: event.outputDefinitionId, consumableId: event.consumableId, ...stamp(event) }];
      case 'consumableUsed': return [{ type: event.type, consumableId: event.consumableId, definitionId: event.definitionId, target: targetCopy(event.target),
        effect: event.effect, affectedItemIds: [...event.affectedItemIds], outputItemId: event.outputItemId, ...stamp(event) }];
      default: return [];
    }
  });
}

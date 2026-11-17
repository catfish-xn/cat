import type { DisplayCombatEvent } from '../../presentation/combat-display';

/**
 * When a unit's StatusPose (manifest) turns on or off: on with its own completed cast, off when the named status ends for
 * any reason (not applied/refreshed) or the unit dies. `statusOf` gives a unit's StatusPose.status, if its model has one.
 * A replayed event (eventSeq not past the last one seen) changes nothing, so a resent cast cannot raise an expired pose.
 */
export function createStatusPoseEvents(statusOf: (id: string) => string | undefined) {
  let lastSeq = -Infinity;
  const change = (event: DisplayCombatEvent): { id: string; on: boolean } | undefined => {
    if (event.type === 'cast') return event.completed !== false && statusOf(event.sourceId) !== undefined ? { id: event.sourceId, on: true } : undefined;
    if (event.type === 'statusChanged') {
      const status = statusOf(event.targetId);
      return status !== undefined && event.kind === status && event.reason !== 'applied' && event.reason !== 'refreshed' ? { id: event.targetId, on: false } : undefined;
    }
    if (event.type === 'death') return statusOf(event.unitId) !== undefined ? { id: event.unitId, on: false } : undefined;
    return undefined;
  };
  return {
    next(event: DisplayCombatEvent): { id: string; on: boolean } | undefined {
      if ('eventSeq' in event) {
        if (event.eventSeq <= lastSeq) return undefined;
        lastSeq = event.eventSeq;
      }
      return change(event);
    },
    /** A new combat or rewind starts its sequence again. */
    clear(): void { lastSeq = -Infinity; },
  };
}

import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import { CUE_RULE_STOPS } from './cue-overrides';

/** One stop: the runs of these systems cast by (`source`) or played on (`target`) unit `id` end. */
export interface SustainStop { readonly by: 'source' | 'target'; readonly id: string; readonly systems: readonly string[] }

const ENDED = (reason: string) => reason !== 'applied' && reason !== 'refreshed';

/**
 * Rule events that end the persistent layers of CUE_RULE_STOPS ownStatusEnded, allyStatusEnded and vexSecondHit
 * (cue-overrides.ts); the renderer runs the stops. Vex's area waits for the direct ability hit after the one that started it.
 */
export function createSustainStops(definitionOf: (id: string) => string | undefined) {
  /** Per target: the tick Vex's first hit on it landed, waiting for her second. */
  const vex = new Map<string, number>();
  return {
    next(event: DisplayCombatEvent): SustainStop[] {
      const stops: SustainStop[] = [];
      if (event.type === 'statusChanged' && ENDED(event.reason)) {
        const own = CUE_RULE_STOPS.ownStatusEnded.systems as Readonly<Record<string, { kind: string; systems: readonly string[] }>>;
        const def = definitionOf(event.targetId);
        if (def && Object.hasOwn(own, def) && own[def].kind === event.kind) stops.push({ by: 'source', id: event.targetId, systems: own[def].systems });
        const ally = CUE_RULE_STOPS.allyStatusEnded.systems as Readonly<Record<string, readonly string[]>>;
        if (Object.hasOwn(ally, event.kind)) stops.push({ by: 'target', id: event.targetId, systems: ally[event.kind] });
      }
      if (event.type === 'packetDamage' && definitionOf(event.sourceId) === 'vex'
        && (event as { sourceKind?: string }).sourceKind === 'ability' && (event as { delivery?: string }).delivery === 'ability-direct') {
        const first = vex.get(event.targetId);
        if (first !== undefined && event.tick > first) { vex.delete(event.targetId); stops.push({ by: 'target', id: event.targetId, systems: CUE_RULE_STOPS.vexSecondHit.systems }); }
        else if (first === undefined) vex.set(event.targetId, event.tick);
      }
      if (event.type === 'death') vex.delete(event.unitId);
      return stops;
    },
    /** A new combat or rewind starts with nothing pending. */
    clear(): void { vex.clear(); },
  };
}

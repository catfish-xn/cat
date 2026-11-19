import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import { CUE_RULE_STOPS } from './cue-overrides';

/** One stop: the runs of these systems cast by (`source`) or played on (`target`) unit `id` end. */
export interface SustainStop { readonly by: 'source' | 'target'; readonly id: string; readonly systems: readonly string[] }

/** Where Jayce's forge plays its systems: the id batch2-bridge.ts plays them from, and the source sustain-stops ends. */
export const jayceForgeSource = (jayceId: string) => `${jayceId}:g23-forge`;

const ENDED = (reason: string) => reason !== 'applied' && reason !== 'refreshed';

/**
 * Rule events that end the persistent layers of CUE_RULE_STOPS ownStatusEnded, allyStatusEnded and vexSecondHit
 * (cue-overrides.ts); the renderer runs the stops. Vex's area waits for the direct ability hit after the one that started it.
 */
export function createSustainStops(definitionOf: (id: string) => string | undefined) {
  /** Per target: the tick Vex's first hit on it landed, waiting for her second. */
  const vex = new Map<string, number>();
  /**
   * Jayce's forge glow (CUE_RULE_STOPS allyStatusEnded) plays at his forge (`<jayce>:g23-forge`, batch2-bridge.ts), not on
   * the allies: each ally his cast's attack speed reached, by the forge that gave it, so its end stops that forge's glow.
   * The rules give the buff on the cast tick (combat-g2-3.ts jayce-ranged), so a stat buff applied then is his.
   */
  const jayceCast = new Map<number, string[]>(), forgeOf = new Map<string, string>();
  return {
    next(event: DisplayCombatEvent): SustainStop[] {
      const stops: SustainStop[] = [];
      if (event.type === 'cast' && definitionOf(event.sourceId) === 'jayce') {
        for (const tick of jayceCast.keys()) if (tick < event.tick) jayceCast.delete(tick);
        jayceCast.set(event.tick, [...(jayceCast.get(event.tick) ?? []), event.sourceId]);
      }
      if (event.type === 'statusChanged' && event.kind === 'stat-buff' && !ENDED(event.reason)) {
        const casters = jayceCast.get(event.tick);
        if (casters?.length === 1) forgeOf.set(event.targetId, jayceForgeSource(casters[0]!));
      }
      if (event.type === 'statusChanged' && ENDED(event.reason)) {
        const own = CUE_RULE_STOPS.ownStatusEnded.systems as Readonly<Record<string, { kind: string; systems: readonly string[] }>>;
        const def = definitionOf(event.targetId);
        if (def && Object.hasOwn(own, def) && own[def].kind === event.kind) stops.push({ by: 'source', id: event.targetId, systems: own[def].systems });
        const ally = CUE_RULE_STOPS.allyStatusEnded.systems as Readonly<Record<string, readonly string[]>>;
        const forge = Object.hasOwn(ally, event.kind) ? forgeOf.get(event.targetId) : undefined;
        if (forge) { forgeOf.delete(event.targetId); stops.push({ by: 'source', id: forge, systems: ally[event.kind]! }); }
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
    clear(): void { vex.clear(); jayceCast.clear(); forgeOf.clear(); },
  };
}

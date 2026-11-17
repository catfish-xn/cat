import type { DisplayCombatEvent } from '../../presentation/combat-display';

/**
 * When a unit's timed form (rendering3d TIMED_FORMS) is on, told by rule events only (Fable 2026-11-17):
 * - drmundo: on with the first heal his ability pays him after a cast; off with his closing blast (the first ability hit
 *   after his heal over time ends, abilityEffectEnded drmundo-heal), on his death, or, when the blast hits no one, with
 *   his next attack or cast.
 */
export function createTimedFormEvents(definitionOf: (id: string) => string | undefined) {
  let lastSeq = -Infinity;
  /** Per unit: cast seen (waiting for the first heal), on, and the tick his heal over time ended (blast pending). */
  const mundo = new Map<string, { phase: 'cast' | 'on'; endedTick?: number }>();
  const change = (event: DisplayCombatEvent): { id: string; on: boolean } | undefined => {
    if (event.type === 'death') return mundo.delete(event.unitId) ? { id: event.unitId, on: false } : undefined;
    if (event.type === 'cast' && definitionOf(event.sourceId) === 'drmundo') {
      const was = mundo.get(event.sourceId)?.phase === 'on';
      if (event.completed === false) return undefined;
      mundo.set(event.sourceId, { phase: 'cast' });
      return was ? { id: event.sourceId, on: false } : undefined;
    }
    if (event.type === 'heal') {
      const state = mundo.get(event.targetId);
      const own = event.shares.some(share => share.sourceId === event.targetId && share.sourceKind === 'ability');
      if (state?.phase === 'cast' && own) { state.phase = 'on'; return { id: event.targetId, on: true }; }
      return undefined;
    }
    if (event.type === 'abilityEffectEnded' && event.effect === 'drmundo-heal') {
      const state = mundo.get(event.unitId);
      if (state?.phase === 'on') state.endedTick = event.tick;
      return undefined;
    }
    if (event.type === 'packetDamage') {
      const state = mundo.get(event.sourceId);
      const ability = (event as { sourceKind?: string }).sourceKind === 'ability' && (event as { delivery?: string }).delivery === 'ability-direct';
      if (state?.phase === 'on' && state.endedTick !== undefined && event.tick > state.endedTick && ability) {
        mundo.delete(event.sourceId); return { id: event.sourceId, on: false };
      }
      return undefined;
    }
    if (event.type === 'attack') {
      const state = mundo.get(event.attackerId);
      if (state?.phase === 'on' && state.endedTick !== undefined && event.tick > state.endedTick) {
        mundo.delete(event.attackerId); return { id: event.attackerId, on: false };
      }
    }
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
    /** A new combat or rewind starts again with every form off. */
    clear(): void { lastSeq = -Infinity; mundo.clear(); },
  };
}

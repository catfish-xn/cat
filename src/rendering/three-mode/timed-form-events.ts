import type { DisplayCombatEvent } from '../../presentation/combat-display';
import { DRMUNDO_BLAST_AFTER_PULSE_TICKS } from './vfx-ltk/cue-overrides';

/**
 * When a unit's timed form (rendering3d TIMED_FORMS) is on, told by rule events only (Fable 2026-11-17):
 * - drmundo: on with the first heal his ability pays him after a cast; off with his closing blast (the first ability hit
 *   after his heal over time ends, abilityEffectEnded drmundo-heal), on his death, with a new cast, or, when the blast hits
 *   no one, at the blast's tick (the rules' DRMUNDO_BLAST_AFTER_PULSE_TICKS after the heal's end; advance()).
 * - swain (Fable 2026-11-21): on with a completed cast in his front form (the rules' ascension starts with it; his back
 *   form's cast has none); off when the ascension ends (abilityEffectEnded swain-ascension) or on his death. A recast
 *   while on keeps it on (the rules restart the ascension).
 */
export function createTimedFormEvents(definitionOf: (id: string) => string | undefined, formOf: (id: string) => 'front' | 'back' | undefined = () => undefined) {
  let lastSeq = -Infinity;
  /** Per unit: cast seen (waiting for the first heal), on, and the tick his heal over time ended (blast pending). */
  const mundo = new Map<string, { phase: 'cast' | 'on'; endedTick?: number }>();
  /** Swains whose ascension is on. */
  const ascended = new Set<string>();
  const change = (event: DisplayCombatEvent): { id: string; on: boolean } | undefined => {
    if (event.type === 'death') return mundo.delete(event.unitId) || ascended.delete(event.unitId) ? { id: event.unitId, on: false } : undefined;
    if (event.type === 'cast' && definitionOf(event.sourceId) === 'swain') {
      if (event.completed === false || formOf(event.sourceId) !== 'front' || ascended.has(event.sourceId)) return undefined;
      ascended.add(event.sourceId); return { id: event.sourceId, on: true };
    }
    if (event.type === 'abilityEffectEnded' && event.effect === 'swain-ascension')
      return ascended.delete(event.unitId) ? { id: event.unitId, on: false } : undefined;
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
    return undefined;
  };
  /** Forms whose blast tick has come with no blast hit (it hit no one): off. */
  const blastDue = (tick: number): { id: string; on: boolean }[] => {
    const due: { id: string; on: boolean }[] = [];
    for (const [id, state] of mundo) if (state.phase === 'on' && state.endedTick !== undefined && tick >= state.endedTick + DRMUNDO_BLAST_AFTER_PULSE_TICKS) {
      mundo.delete(id); due.push({ id, on: false });
    }
    return due;
  };
  return {
    next(event: DisplayCombatEvent): { id: string; on: boolean } | undefined {
      if ('eventSeq' in event) {
        if (event.eventSeq <= lastSeq) return undefined;
        lastSeq = event.eventSeq;
      }
      return change(event);
    },
    /** The display has reached `tick`: forms whose blast is due end (call once per event batch with its latest tick). */
    advance(tick: number): { id: string; on: boolean }[] { return Number.isFinite(tick) ? blastDue(tick) : []; },
    /** A new combat or rewind starts again with every form off. */
    clear(): void { lastSeq = -Infinity; mundo.clear(); ascended.clear(); },
  };
}

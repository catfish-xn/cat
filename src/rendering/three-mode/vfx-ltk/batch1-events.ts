import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { TimelineAction, TimelineVariant } from './timeline';

export interface Batch1Visual {
  champion: string; sourceId: string; targets: readonly string[]; action: TimelineAction; variant?: TimelineVariant;
}
export interface Batch1EventPlan {
  /** fresh gates batch 1 VFX selection only; animation and lifecycle consumers always receive event. */
  event: DisplayCombatEvent; fresh: boolean; variant?: TimelineVariant; targets?: readonly string[];
  skipCast?: boolean; stopCast?: string; extra: Batch1Visual[];
}
interface SeenUnit { attacks: number; cast: boolean; luxAttack: boolean; twitchShots: number; nocturneUntil: number; leonaUntil: number; pulseTick: number }
const champions = new Set(['amumu', 'zeri', 'draven', 'lux', 'leona', 'nocturne', 'kogmaw', 'twitch']);
/** Presentation memory of observed events only. No resource, targeting or damage rules.
 * 14.24b visual forms: Zeri every third observed attack; Twitch eight bolts after cast;
 * Nocturne six seconds after cast. Catch-up events advance this memory without playback.
 * The wire omits packet provenance: Amumu only uses magic packets on ticks without an
 * observed basic attack, avoiding re-playing W for every ordinary on-hit item proc. */
export function createBatch1VfxEvents(definition: (id: string) => string | undefined) {
  const units = new Map<string, SeenUnit>();
  let lastSeq = -1;
  const unit = (id: string) => {
    let state = units.get(id);
    if (!state) { state = { attacks: 0, cast: false, luxAttack: false, twitchShots: 0, nocturneUntil: -1, leonaUntil: -1, pulseTick: -1 }; units.set(id, state); }
    return state;
  };
  return {
    clear() { units.clear(); lastSeq = -1; },
    batch(events: readonly DisplayCombatEvent[]): Batch1EventPlan[] {
      const packets = new Map<string, string[]>(), attacks = new Set<string>();
      const key = (tick: number, id: string, type: string) => JSON.stringify([tick, id, type]);
      for (const event of events) {
        if (event.type === 'attack') attacks.add(key(event.tick, event.attackerId, 'attack'));
        if (event.type === 'packetDamage') {
          const k = key(event.tick, event.sourceId, event.damageType), ids = packets.get(k) ?? [];
          if (!ids.includes(event.targetId)) ids.push(event.targetId);
          packets.set(k, ids);
        }
      }
      return events.map(event => {
        const plan: Batch1EventPlan = { event, fresh: true, extra: [] };
        const owner = event.type === 'attack' ? event.attackerId : event.type === 'cast' || event.type === 'packetDamage' ? event.sourceId
          : event.type === 'statusChanged' ? event.targetId : event.type === 'death' ? event.unitId : undefined;
        const tracked = owner !== undefined && champions.has(definition(owner) ?? '');
        // Preserve the existing cast path for every champion outside this batch.
        if (tracked && event.type === 'cast' && event.completed === false) plan.skipCast = true;
        if ('eventSeq' in event) {
          if (event.eventSeq <= lastSeq) { plan.fresh = !tracked; return plan; }
          lastSeq = event.eventSeq;
        }
        if (!tracked) return plan;
        if (event.type === 'cast' && event.completed !== false) {
          const champion = definition(event.sourceId), state = unit(event.sourceId);
          state.cast = true;
          if (champion === 'lux') { state.luxAttack = true; if (event.targetIds[0] === event.sourceId) plan.variant = 'self'; }
          if (champion === 'twitch') state.twitchShots = 8;
          if (champion === 'nocturne') { state.nocturneUntil = event.tick + 120; plan.stopCast = event.sourceId; }
          if (champion === 'leona') { state.leonaUntil = event.tick + 60; plan.stopCast = event.sourceId; }
        } else if (event.type === 'attack') {
          const champion = definition(event.attackerId), state = unit(event.attackerId);
          state.attacks++;
          if (champion === 'zeri' && state.attacks % 3 === 0 || champion === 'draven' && state.cast
            || champion === 'lux' && state.luxAttack || champion === 'nocturne' && event.tick < state.nocturneUntil
            || champion === 'twitch' && state.twitchShots > 0) plan.variant = 'empowered';
          if (champion === 'lux') state.luxAttack = false;
          if (champion === 'twitch' && state.twitchShots > 0) {
            state.twitchShots--;
            // The attack event retains the pre-replacement target; packets name the actual pierced enemies.
            plan.targets = packets.get(key(event.tick, event.attackerId, 'physical')) ?? [event.targetId];
          }
        } else if (event.type === 'statusChanged' && event.kind === 'damage-reduction' && event.reason === 'expired'
          && definition(event.targetId) === 'leona' && unit(event.targetId).leonaUntil === event.tick) {
          unit(event.targetId).leonaUntil = -1; plan.stopCast = event.targetId;
          plan.extra.push({ champion: 'leona', sourceId: event.targetId, targets: [], action: 'end' });
          const targets = packets.get(key(event.tick, event.targetId, 'magic'));
          if (targets?.length) plan.extra.push({ champion: 'leona', sourceId: event.targetId, targets, action: 'passive' });
        } else if (event.type === 'packetDamage' && event.damageType === 'magic' && definition(event.sourceId) === 'amumu'
          && !attacks.has(key(event.tick, event.sourceId, 'attack')) && unit(event.sourceId).pulseTick !== event.tick) {
          unit(event.sourceId).pulseTick = event.tick;
          plan.extra.push({ champion: 'amumu', sourceId: event.sourceId, targets: packets.get(key(event.tick, event.sourceId, 'magic'))!, action: 'passive' });
        } else if (event.type === 'death') {
          const state = units.get(event.unitId);
          if (state) { state.leonaUntil = -1; state.nocturneUntil = -1; }
          if (definition(event.unitId) === 'leona' || definition(event.unitId) === 'nocturne') plan.stopCast = event.unitId;
        }
        return plan;
      });
    },
  };
}

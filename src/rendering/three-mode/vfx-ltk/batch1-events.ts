import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { TimelineAction, TimelineVariant } from './timeline';

export interface Batch1Visual {
  champion: string; sourceId: string; targets: readonly string[]; action: TimelineAction; variant?: TimelineVariant;
  /** A display branch of the champion's catalogue (LtkPlayOptions.skill) instead of its own list. */
  skill?: string;
  /** Its targets' places are taken when it plays, alive or not (LtkPlayOptions.snapshotTargets): a hit that may have killed them. */
  snapshotTargets?: boolean;
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
/**
 * Caitlyn's Air Raid lands as TotalShots separate shots over RaidDuration (combat-s13-abilities.ts executeTask 'caitlyn'):
 * each picks a random enemy centre and sends one ability-direct physical packet to every enemy within a cell of it, then
 * a second one (the headshot) to the centre. So one shot is her ability-direct packets of one tick, and its centre is the
 * enemy struck twice in it (the last one struck, should none be). Visual only: the shot is drawn where the packets landed.
 * Premise: a batch holds whole ticks. The replay keeps one record per combat step with all of that step's events
 * (combat-replay-view.ts recorder.record), the online session plays whole records (remote-session.ts advanceDisplay) and
 * offline passes the ledger of whole steps (BoardScene.ts), so a shot's packets never straddle two batches
 * (tests/vfx-ltk-caitlyn-shots.test.ts).
 */
/** Caitlyn's shots planned, and how many found no enemy struck twice and fell back to the last one struck (dev load harness). */
export const CAITLYN_SHOT_STATS = { shots: 0, fallback: 0 };
export function caitlynShotCentre(events: readonly DisplayCombatEvent[], tick: number, sourceId: string): string | undefined {
  const hits = new Map<string, number>(); let last: string | undefined;
  for (const event of events) {
    if (event.type !== 'packetDamage' || event.tick !== tick || event.sourceId !== sourceId || !isAbilityDirect(event)) continue;
    hits.set(event.targetId, (hits.get(event.targetId) ?? 0) + 1); last = event.targetId;
  }
  for (const [id, count] of hits) if (count >= 2) return id;
  if (last !== undefined) CAITLYN_SHOT_STATS.fallback++;
  return last;
}
const isAbilityDirect = (event: Extract<DisplayCombatEvent, { type: 'packetDamage' }>) =>
  (event as { sourceKind?: string }).sourceKind === 'ability' && (event as { delivery?: string }).delivery === 'ability-direct';

export function createBatch1VfxEvents(definition: (id: string) => string | undefined, star: (id: string) => number | undefined = () => undefined) {
  const units = new Map<string, SeenUnit>();
  /** Caitlyn: shots drawn since her last cast (3 stars alternate comet and burst only), and the last shot's tick. */
  const shots = new Map<string, { count: number; tick: number }>();
  let lastSeq = -1;
  const unit = (id: string) => {
    let state = units.get(id);
    if (!state) { state = { attacks: 0, cast: false, luxAttack: false, twitchShots: 0, nocturneUntil: -1, leonaUntil: -1, pulseTick: -1 }; units.set(id, state); }
    return state;
  };
  return {
    clear() { units.clear(); shots.clear(); lastSeq = -1; },
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
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'caitlyn') shots.set(event.sourceId, { count: 0, tick: -1 });
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'caitlyn') {
          const seen = shots.get(event.sourceId) ?? { count: 0, tick: -1 };
          if (seen.tick !== event.tick) {
            const centre = caitlynShotCentre(events, event.tick, event.sourceId);
            if (centre !== undefined) {
              CAITLYN_SHOT_STATS.shots++;
              const skill = star(event.sourceId) === 3 ? (seen.count % 2 === 0 ? 'caitlyn-shot-3-comet' : 'caitlyn-shot-3') : 'caitlyn-shot';
              plan.extra.push({ champion: 'caitlyn', sourceId: event.sourceId, targets: [centre], action: 'passive', skill, snapshotTargets: true });
            }
            shots.set(event.sourceId, { count: seen.count + 1, tick: event.tick });
          }
        }
        // Steb: every heal he sends draws from his heal events, not from his cast's target (an enemy). A heal on someone else
        // (his passive share) flies his heal missile to that ally and lands its heal ring there; his own heal rings on him.
        if (event.type === 'heal' && event.actual > 0) {
          const steb = event.shares.find(share => share.sourceId !== undefined && definition(share.sourceId) === 'steb')?.sourceId;
          if (steb !== undefined) plan.extra.push({ champion: 'steb', sourceId: steb, targets: [event.targetId], action: 'passive',
            skill: event.targetId === steb ? 'steb-heal' : 'steb-share' });
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

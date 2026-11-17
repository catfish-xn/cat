import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { TimelineAction, TimelineVariant } from './timeline';

/** A looping buff ended by game state eases out over this long rather than clearing in one frame. */
export const SOFT_STOP_SECONDS = 0.6;

/** Play one extra visual; a `once` visual is skipped while its source already runs that action at full strength. */
export function playBatch1Visual(ltk: { play(champion: string, sourceId: string, targets: readonly string[], action: TimelineAction, options?: TimelineVariant | { variant?: TimelineVariant; skill?: string; snapshotTargets?: boolean }): boolean; playing(sourceId: string, action: TimelineAction): boolean }, fx: Batch1Visual): boolean {
  if (fx.once && ltk.playing(fx.sourceId, fx.action)) return false;
  return ltk.play(fx.champion, fx.sourceId, fx.targets, fx.action,
    fx.skill || fx.snapshotTargets ? { variant: fx.variant, skill: fx.skill, snapshotTargets: fx.snapshotTargets } : fx.variant);
}

export interface Batch1Visual {
  champion: string; sourceId: string; targets: readonly string[]; action: TimelineAction; variant?: TimelineVariant;
  /** Skip it while the source already runs this action at full strength (one that is fading out does not count). */
  once?: boolean;
  /** A display branch of the champion's catalogue (LtkPlayOptions.skill) instead of its own list. */
  skill?: string;
  /** Its targets' places are taken when it plays, alive or not (LtkPlayOptions.snapshotTargets): a hit that may have killed them. */
  snapshotTargets?: boolean;
}
export interface Batch1EventPlan {
  /** fresh gates batch 1 VFX selection only; animation and lifecycle consumers always receive event. */
  event: DisplayCombatEvent; fresh: boolean; variant?: TimelineVariant; targets?: readonly string[];
  skipCast?: boolean; stopCast?: string;
  /** Fade this unit's cast cues out over SOFT_STOP_SECONDS (Singed's W when his damage reduction ends, or before his next cast). */
  fadeCast?: string; extra: Batch1Visual[];
  /** The cast plays none of its effects, but the caster still turns and moves as for any cast (skipCast drops all of it). */
  noCastEffect?: boolean;
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
const SMEECH_QTAR_EVERY_STAB = false;
const isAbilityDirect = (event: Extract<DisplayCombatEvent, { type: 'packetDamage' }>) =>
  (event as { sourceKind?: string }).sourceKind === 'ability' && (event as { delivery?: string }).delivery === 'ability-direct';

/** Nunu's ability as its damage packets name it (combat-replay-view.ts packetDamage definitionId). */
const NUNU_ABILITY = 'nunu-ability';
const isNunuAbility = (event: Extract<DisplayCombatEvent, { type: 'packetDamage' }>) => (event as { definitionId?: string }).definitionId === NUNU_ABILITY;

/** Vladimir's ability as heal shares name it (combat-replay-view.ts 'heal' shares: definitionId). */
const VLADIMIR_ABILITY = 'vladimir-ability';
/** Steb's ability as heal shares name it (combat-replay-view.ts 'heal' shares: definitionId). */
const STEB_ABILITY = 'steb-ability';
/**
 * Whether a shield layer key (combat-replay-view.ts 'shieldLayerChanged': the layer's source key, a JSON array
 * [combat, owner, kind, definition, ...]) is Irelia's own ability shield on `holder`.
 */
export function isIreliaShield(key: unknown, holder: string): boolean {
  if (typeof key !== 'string') return false;
  try { const k = JSON.parse(key); return Array.isArray(k) && k[1] === holder && k[2] === 'ability' && k[3] === 'irelia-ability'; } catch { return false; }
}

export function createBatch1VfxEvents(definition: (id: string) => string | undefined, star: (id: string) => number | undefined = () => undefined) {
  const units = new Map<string, SeenUnit>();
  /** Caitlyn: shots drawn since her last cast (3 stars alternate comet and burst only), and the last shot's tick. */
  const shots = new Map<string, { count: number; tick: number }>();
  const smeechStabs = new Map<string, number>();
  /** Nunu since his last cast: the tick his damage reduction ended (-1 before), and the enemies his blast splash has played on. */
  const nunu = new Map<string, { ended: number; hit: Set<string> }>();
  /** Dr. Mundo since his last cast: the enemy his pulses hit, and the tick his heal ended (-1 before). */
  const mundo = new Map<string, { target: string | undefined; ended: number }>();
  /** Renni: her running cast's stun, until its final slam lands: the units stunned on her cast's tick, and which one she holds. */
  const grabs = new Map<string, { candidates: readonly string[]; held: string | null }>();
  let lastSeq = -1;
  const unit = (id: string) => {
    let state = units.get(id);
    if (!state) { state = { attacks: 0, cast: false, luxAttack: false, twitchShots: 0, nocturneUntil: -1, leonaUntil: -1, pulseTick: -1 }; units.set(id, state); }
    return state;
  };
  return {
    clear() { units.clear(); shots.clear(); nunu.clear(); mundo.clear(); grabs.clear(); lastSeq = -1; },
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
        // Singed's cast visuals (cue-overrides.ts) last while his damage reduction does: they fade when it ends for any
        // reason or he dies, and a new cast fades the last one's before its own start. An interrupted cast plays nothing.
        if (owner !== undefined && definition(owner) === 'singed') {
          if (event.type === 'cast') { if (event.completed === false) plan.skipCast = true; else plan.fadeCast = event.sourceId; }
          else if (event.type === 'statusChanged' && event.kind === 'damage-reduction' && event.reason !== 'applied' && event.reason !== 'refreshed') plan.fadeCast = event.targetId;
          else if (event.type === 'death') plan.fadeCast = event.unitId;
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
        // Renni (combat-g2-3.ts 'renni'): her cast stuns one enemy and mauls it every tick of the stun; on the stun's last
        // tick the final slam strikes that enemy and every enemy next to it. Her cast event names no targets and a stun event
        // names no source, so the grab is the stun applied on her cast's tick; should another stun land on that tick too,
        // the held one is the first of them her ability-direct packets strike. The slam is the tick those packets strike the
        // held enemy twice (its last maul and the slam): every enemy they strike that tick takes FinalSlam_Tar.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'renni') {
          const candidates = [...new Set(events.filter(e => e.type === 'statusChanged' && e.tick === event.tick && e.kind === 'stun'
            && e.reason === 'applied' && e.targetId !== event.sourceId).map(e => (e as { targetId: string }).targetId))];
          const held = candidates.length === 1 ? candidates[0]! : null;
          grabs.set(event.sourceId, { candidates, held });
          if (held !== null) plan.extra.push({ champion: 'renni', sourceId: event.sourceId, targets: [held], action: 'passive', skill: 'renni-grab' });
        }
        const grab = event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'renni' ? grabs.get(event.sourceId) : undefined;
        if (grab && event.type === 'packetDamage') {
          if (grab.held === null && grab.candidates.includes(event.targetId)) {
            grab.held = event.targetId;
            plan.extra.push({ champion: 'renni', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'renni-grab' });
          }
          const held = grab.held;
          const struck = events.filter(e => e.type === 'packetDamage' && e.tick === event.tick && e.sourceId === event.sourceId && isAbilityDirect(e)) as Extract<DisplayCombatEvent, { type: 'packetDamage' }>[];
          if (held !== null && struck.filter(e => e.targetId === held).length >= 2) {
            grabs.delete(event.sourceId);
            plan.extra.push({ champion: 'renni', sourceId: event.sourceId, targets: [held, ...new Set(struck.map(e => e.targetId).filter(id => id !== held))],
              action: 'passive', skill: 'renni-slam', snapshotTargets: true });
          }
        }
        // Vladimir: his heal ring plays on him when his ability really heals him (sourceKind ability, definitionId
        // vladimir-ability, actual > 0), not on his cast's enemies. With Blood Pact his cast heals nothing, so no ring; item or
        // vamp heals draw nothing here.
        if (event.type === 'heal' && definition(event.targetId) === 'vladimir'
          && event.shares.some(s => s.sourceId === event.targetId && s.sourceKind === 'ability' && s.definitionId === VLADIMIR_ABILITY && s.actual > 0))
          plan.extra.push({ champion: 'vladimir', sourceId: event.targetId, targets: [event.targetId], action: 'passive', skill: 'vladimir-heal' });
        // Steb: his heal visuals come from his own heal events, not from his cast's target (an enemy). Only a share his ability
        // sends counts (sourceKind ability, definitionId steb-ability, actual > 0): one to someone else is his passive share
        // and flies his heal missile to that ally, one to himself is his ability's heal and rings on him. Item or vamp heals
        // (sourceKind item) and every other unit's heals draw nothing here. Telling his share from his own heal by whether
        // the target is himself is all today's heal events allow: both carry the same share fields (tests/vfx-ltk-steb-heal.test.ts
        // asserts them). Should the rules give the share its own definitionId, change this and that test with it.
        if (event.type === 'heal') {
          const share = event.shares.find(s => s.sourceId !== undefined && s.sourceKind === 'ability' && s.definitionId === STEB_ABILITY
            && definition(s.sourceId) === 'steb' && s.actual > 0);
          if (share) plan.extra.push({ champion: 'steb', sourceId: share.sourceId!, targets: [event.targetId], action: 'passive',
            skill: event.targetId === share.sourceId ? 'steb-heal' : 'steb-share' });
        }
        // Trundle's cast list holds only his bite's hit, which now comes with the bite's damage: his cast itself plays nothing.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'trundle') plan.noCastEffect = true;
        // Trundle, Zyra: their hits play when the skill's damage lands (cast-windup.ts), once per tick, on every enemy hit
        // that tick, in hit order (Zyra's primary target first).
        if (event.type === 'packetDamage' && isAbilityDirect(event) && ['trundle', 'zyra'].includes(definition(event.sourceId) ?? '')
          && !events.some(e => e !== event && e.type === 'packetDamage' && e.sourceId === event.sourceId && e.tick === event.tick
            && isAbilityDirect(e) && e.eventSeq < event.eventSeq)) {
          const name = definition(event.sourceId)!;
          const hitTargets = [...new Set(events.filter((e): e is Extract<DisplayCombatEvent, { type: 'packetDamage' }> => e.type === 'packetDamage'
            && e.sourceId === event.sourceId && e.tick === event.tick && isAbilityDirect(e)).map(e => e.targetId))];
          const skill = name === 'trundle' ? 'trundle-bite' : 'zyra-vines';
          plan.extra.push({ champion: name, sourceId: event.sourceId, targets: hitTargets, action: 'passive', skill });
        }
        // REC ONLY (do not merge): Smeech candidate C. One vertical swipe on his weapon per stab (each ability packet), and Q_tar
        // on the stabbed enemy's chest: on every stab (C1) or only on the third stab at one enemy since his cast (C2).
        if (event.type === 'cast' && definition(event.sourceId) === 'smeech') for (const k of [...smeechStabs.keys()]) if (k.startsWith(event.sourceId + '|')) smeechStabs.delete(k);
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'smeech') {
          plan.extra.push({ champion: 'smeech', sourceId: event.sourceId, targets: [event.sourceId], action: 'passive', skill: 'smeech-swipe' });
          const key = event.sourceId + '|' + event.targetId, count = (smeechStabs.get(key) ?? 0) + 1; smeechStabs.set(key, count);
          if (SMEECH_QTAR_EVERY_STAB || count % 3 === 0)
            plan.extra.push({ champion: 'smeech', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'smeech-qtar' });
        }
        // Powder: her cast list has no cast cues left (they moved to her damage), so her cast plays nothing rather than falling
        // back to the old placeholder cast effect.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'powder') plan.noCastEffect = true;
        // Powder: her blast plays once per tick, on every enemy its damage hit that tick.
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'powder'
          && !events.some(e => e !== event && e.type === 'packetDamage' && e.sourceId === event.sourceId && e.tick === event.tick
            && isAbilityDirect(e) && e.eventSeq < event.eventSeq)) {
          const targets = [...new Set(events.filter((e): e is Extract<DisplayCombatEvent, { type: 'packetDamage' }> => e.type === 'packetDamage'
            && e.sourceId === event.sourceId && e.tick === event.tick && isAbilityDirect(e)).map(e => e.targetId))];
          plan.extra.push({ champion: 'powder', sourceId: event.sourceId, targets, action: 'passive', skill: 'powder-blast' });
        }
        // Blitzcrank: his shock's arcs and bursts play when its damage lands, once per tick, to every enemy it hit that tick.
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'blitzcrank'
          && !events.some(e => e !== event && e.type === 'packetDamage' && e.sourceId === event.sourceId && e.tick === event.tick
            && isAbilityDirect(e) && e.eventSeq < event.eventSeq)) {
          const targets = [...new Set(events.filter((e): e is Extract<DisplayCombatEvent, { type: 'packetDamage' }> => e.type === 'packetDamage'
            && e.sourceId === event.sourceId && e.tick === event.tick && isAbilityDirect(e)).map(e => e.targetId))];
          plan.extra.push({ champion: 'blitzcrank', sourceId: event.sourceId, targets, action: 'passive', skill: 'blitzcrank-shock' });
          // The white flash on Blitzcrank himself plays on the same tick (ab66b54f, blitzcrank-shock-self).
          plan.extra.push({ champion: 'blitzcrank', sourceId: event.sourceId, targets: [event.sourceId], action: 'passive', skill: 'blitzcrank-shock-self' });
        }
        // Nunu: his hit splash (R_hit_tar) plays on each enemy his blast strikes. His cast names no targets (each damage tick is
        // scheduled per enemy, combat-g2-3.ts 'nunu'), so the splash waits for the blast itself. The blast lands after his last
        // periodic tick (NUNU_SECOND_AFTER_PULSE_TICKS, wind-up batch 2), and his last periodic tick is the tick his cast's
        // damage reduction ends (both last DamageDuration): his ability's direct packets on an enemy after that end, until his
        // next cast, are the blast; it plays once per enemy. Another source's packet, his attack, or an item proc never counts.
        if (event.type === 'cast' && definition(event.sourceId) === 'nunu') nunu.set(event.sourceId, { ended: -1, hit: new Set() });
        if (event.type === 'statusChanged' && event.kind === 'damage-reduction' && event.reason !== 'applied' && definition(event.targetId) === 'nunu') {
          const state = nunu.get(event.targetId); if (state && state.ended < 0) state.ended = event.tick;
        }
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'nunu' && isNunuAbility(event)) {
          const state = nunu.get(event.sourceId);
          if (state && state.ended >= 0 && event.tick > state.ended && !state.hit.has(event.targetId)) {
            // The blast itself on Nunu, once, with its first packet.
            if (state.hit.size === 0) plan.extra.push({ champion: 'nunu', sourceId: event.sourceId, targets: [event.sourceId], action: 'passive', skill: 'nunu-blast' });
            state.hit.add(event.targetId);
            plan.extra.push({ champion: 'nunu', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'nunu-blast-hit', snapshotTargets: true });
          }
        }
        // Camille: her hit plays on the target when her kick's damage lands (CAMILLE_KICK_TICKS after the cast), the variant her
        // adaptive damage picks: physical when the target's armor is below its magic resist, magic otherwise.
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'camille'
          && (event.damageType === 'physical' || event.damageType === 'magic'))
          plan.extra.push({ champion: 'camille', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: `camille-q-${event.damageType}` });
        // Irelia: her stance and her swipe follow her shield, not fixed times. Her cast plays the stance; when the rules end
        // her ability shield (shieldLayerChanged depleted, emptied early, or expired, at the end of its time) the stance stops
        // and the swipe plays there, as her strike lands (its damage packet follows within a tick). A cast that grants her
        // no shield (Blade Dance) draws no stance at all; she still turns to her target as for any cast.
        if (event.type === 'shieldLayerChanged' && (event.reason === 'depleted' || event.reason === 'expired')
          && definition(event.targetId) === 'irelia' && isIreliaShield(event.key, event.targetId)) {
          plan.stopCast = event.targetId;
          plan.extra.push({ champion: 'irelia', sourceId: event.targetId, targets: [], action: 'passive', skill: 'irelia-swipe' });
        }
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'irelia'
          && !events.some(e => e.type === 'shieldLayerChanged' && e.reason === 'granted' && e.tick === event.tick && e.targetId === event.sourceId && isIreliaShield(e.key, e.targetId)))
          plan.noCastEffect = true;
        // Dr. Mundo: his once-a-second damage plays the beam to the enemy it hits; his closing blast plays the zap on each enemy it
        // hits and the blast body on him once. The blast is told by his heal's end (abilityEffectEnded drmundo-heal, sent whether or
        // not his target lives): his ability hits on that tick, but for the pulse to the enemy his earlier pulses hit, and any after
        // it until his next cast, are the blast.
        if (event.type === 'cast' && definition(event.sourceId) === 'drmundo') mundo.set(event.sourceId, { target: undefined, ended: -1 });
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'drmundo') {
          const state = mundo.get(event.sourceId) ?? { target: undefined, ended: -1 }; mundo.set(event.sourceId, state);
          if (state.ended < 0 && events.some(e => e.type === 'abilityEffectEnded' && e.effect === 'drmundo-heal' && e.unitId === event.sourceId && e.tick === event.tick))
            state.ended = event.tick;
          const same = events.filter((e): e is Extract<DisplayCombatEvent, { type: 'packetDamage' }> => e.type === 'packetDamage'
            && e.sourceId === event.sourceId && e.tick === event.tick && isAbilityDirect(e));
          const lastPulse = state.ended === event.tick && state.target !== undefined ? same.find(e => e.targetId === state.target) : undefined;
          if (state.ended < 0 || event === lastPulse) {
            if (state.ended < 0) state.target = event.targetId;
            plan.extra.push({ champion: 'drmundo', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'drmundo-beam' });
          } else {
            plan.extra.push({ champion: 'drmundo', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'drmundo-zap' });
            if (same.filter(e => e !== lastPulse)[0] === event) plan.extra.push({ champion: 'drmundo', sourceId: event.sourceId, targets: [event.sourceId], action: 'passive', skill: 'drmundo-zap-body' });
          }
        }
        // Sett: a cast that grabbed one enemy plays his one-target slam ('single'); two enemies keep the plain cast.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'sett' && event.targetIds.length === 1)
          plan.variant = 'single';
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

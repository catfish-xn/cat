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
interface SeenUnit { attacks: number; empoweredThrows: number; cast: boolean; luxAttack: boolean; twitchShots: number; nocturneUntil: number; leonaFrom: number; pulseTick: number }
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
/**
 * The rules' LeBlanc NumAttacks (src/simulation/content/g2-abilities.ts, the same at every star): the attacks after each
 * cast that are empowered (combat-g2.ts planG2Attack). Mirrored here as CAST_WINDUP_TICKS is; tests/vfx-ltk-leblanc-empowered.test.ts
 * checks it against the rules' data.
 */
export const LEBLANC_EMPOWERED_ATTACKS = 3;
/**
 * Zeri's spark bounce damage as the display names it (combat-g2.ts planG2Attack): her ability's 'attack-extra' packets. She never
 * casts, so her ability's packets of that delivery are only those.
 */
export function isZeriBounce(event: Extract<DisplayCombatEvent, { type: 'packetDamage' }>): boolean {
  return event.delivery === 'attack-extra' && event.sourceKind === 'ability';
}
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
  /** Nunu since his last cast: the tick his damage reduction ended (-1 before), and the enemies his blast splash has played on. */
  const nunu = new Map<string, { ended: number; hit: Set<string> }>();
  /** Dr. Mundo since his last cast: the enemy his pulses hit, and the tick his heal ended (-1 before). */
  const mundo = new Map<string, { target: string | undefined; ended: number }>();
  /** Renni: the enemy she lifted, until her final slam lands, and the tick she set it down (-1 while held). */
  const grabs = new Map<string, { held: string; down: number }>();
  // Nocturne's last empowered swing: its tick and the enemies his strike already played on (its target, then each one bled).
  const strikes = new Map<string, { tick: number; struck: Set<string> }>();
  /** Smeech since his last cast: stabs drawn (his swing turns with each) and the enemy his last stab hit (a new one is a leap). */
  const smeech = new Map<string, { stabs: number; target: string | undefined }>();
  /** Mordekaisers whose cast's empowered time is running (from the cast to the rules' mordekaiser-empower end). */
  const empoweredMorde = new Set<string>();
  /** LeBlanc: her empowered attacks left since her last cast (LEBLANC_EMPOWERED_ATTACKS from each cast). */
  const leblancAttacks = new Map<string, number>();
  let lastSeq = -1;
  const unit = (id: string) => {
    let state = units.get(id);
    if (!state) { state = { attacks: 0, empoweredThrows: 0, cast: false, luxAttack: false, twitchShots: 0, nocturneUntil: -1, leonaFrom: -1, pulseTick: -1 }; units.set(id, state); }
    return state;
  };
  return {
    clear() { units.clear(); shots.clear(); nunu.clear(); mundo.clear(); grabs.clear(); strikes.clear(); smeech.clear(); empoweredMorde.clear(); leblancAttacks.clear(); lastSeq = -1; },
    batch(events: readonly DisplayCombatEvent[]): Batch1EventPlan[] {
      const packets = new Map<string, string[]>(), attacks = new Set<string>(), bounces = new Map<string, string[]>();
      const key = (tick: number, id: string, type: string) => JSON.stringify([tick, id, type]);
      for (const event of events) {
        if (event.type === 'attack') attacks.add(key(event.tick, event.attackerId, 'attack'));
        if (event.type === 'packetDamage' && isZeriBounce(event) && definition(event.sourceId) === 'zeri') {
          const k = key(event.tick, event.sourceId, 'bounce'), ids = bounces.get(k) ?? [];
          if (!ids.includes(event.targetId)) ids.push(event.targetId);
          bounces.set(k, ids);
        }
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
        // Renni (combat-g2-3.ts 'renni'): RENNI_LIFT_TICKS after her cast she lifts one enemy (carryChanged true) and holds it
        // stunned, mauling it every tick; she sets it down on the stun's last tick, or at once if either of them dies
        // (carryChanged false). RENNI_SLAM_AFTER_STUN_TICKS later the final slam strikes the enemies taken on her cast:
        // the first tick after the set-down's her ability-direct packets strike, every enemy struck that tick takes
        // FinalSlam_Tar (the held one first). A new cast drops whatever the last one left.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'renni') grabs.delete(event.sourceId);
        if (event.type === 'carryChanged' && definition(event.holderId) === 'renni') {
          if (event.carried) {
            grabs.set(event.holderId, { held: event.targetId, down: -1 });
            plan.extra.push({ champion: 'renni', sourceId: event.holderId, targets: [event.targetId], action: 'passive', skill: 'renni-grab' });
          } else {
            const grab = grabs.get(event.holderId);
            if (grab) grab.down = event.tick;
          }
        }
        const grab = event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'renni' ? grabs.get(event.sourceId) : undefined;
        if (grab && grab.down >= 0 && event.type === 'packetDamage' && event.tick > grab.down) {
          grabs.delete(event.sourceId);
          const struck = new Set((events.filter(e => e.type === 'packetDamage' && e.tick === event.tick && e.sourceId === event.sourceId && isAbilityDirect(e)) as
            Extract<DisplayCombatEvent, { type: 'packetDamage' }>[]).map(e => e.targetId));
          plan.extra.push({ champion: 'renni', sourceId: event.sourceId, targets: struck.has(grab.held) ? [grab.held, ...[...struck].filter(id => id !== grab.held)] : [...struck],
            action: 'passive', skill: 'renni-slam', snapshotTargets: true });
        }
        // Draven: an empowered axe that lands flies back up to his hand in an arc (CUE_EXTRA_SKILLS draven-return), from the
        // enemy it hit; it goes with either of them dying (placeholder-renderer.ts stops DRAVEN_AXE on a death).
        if (event.type === 'attackLanded' && event.hit && definition(event.attackerId) === 'draven' && unit(event.attackerId).cast)
          plan.extra.push({ champion: 'draven', sourceId: event.targetId, targets: [event.attackerId], action: 'passive', skill: 'draven-return' });
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
        // Smeech: his cast names no target, so each stab's damage draws his stab's slash and its hit on the enemy stabbed; a
        // stab on a new enemy (his cast's first, or after a leap) also draws the leap's trail to it.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'smeech') smeech.set(event.sourceId, { stabs: 0, target: undefined });
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'smeech') {
          const seen = smeech.get(event.sourceId) ?? { stabs: 0, target: undefined };
          if (seen.target !== event.targetId) plan.extra.push({ champion: 'smeech', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'smeech-leap' });
          plan.extra.push({ champion: 'smeech', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'smeech-stab' });
          smeech.set(event.sourceId, { stabs: seen.stabs + 1, target: event.targetId });
        }
        // Maddie: one shot per damage packet of her volley, to the enemy it hit.
        if (event.type === 'packetDamage' && isAbilityDirect(event) && definition(event.sourceId) === 'maddie')
          plan.extra.push({ champion: 'maddie', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'maddie-shot' });
        // Maddie: her cast list has no cast cues left (they moved to her damage), so her cast plays nothing rather
        // than falling back to the old placeholder cast effect.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'maddie') plan.noCastEffect = true;
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
        // Mordekaiser: his attacks while his cast's empowered time runs are his empowered ones (the mace glow, CUE_OVERRIDES).
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'mordekaiser') empoweredMorde.add(event.sourceId);
        if (event.type === 'abilityEffectEnded' && event.effect === 'mordekaiser-empower') empoweredMorde.delete(event.unitId);
        if (event.type === 'death') empoweredMorde.delete(event.unitId);
        if (event.type === 'attack' && empoweredMorde.has(event.attackerId)) plan.variant = 'empowered';
        // LeBlanc: her cast empowers her next LEBLANC_EMPOWERED_ATTACKS attacks (the rules count them from each cast, whether
        // or not they land), so those attacks play her empowered missile; a new cast starts the count again.
        if (event.type === 'cast' && event.completed !== false && definition(event.sourceId) === 'leblanc') leblancAttacks.set(event.sourceId, LEBLANC_EMPOWERED_ATTACKS);
        if (event.type === 'death') leblancAttacks.delete(event.unitId);
        if (event.type === 'attack' && (leblancAttacks.get(event.attackerId) ?? 0) > 0) {
          plan.variant = 'empowered'; leblancAttacks.set(event.attackerId, leblancAttacks.get(event.attackerId)! - 1);
        }
        if (!tracked) return plan;
        // Nocturne's strike (P_tar) plays on every enemy his empowered swing bleeds: its own target with the swing's hit, each
        // other one when its first bleed tick lands. The rules name no bleed targets at the swing (Fable 11-18, C71 option A).
        if (event.type === 'packetDamage' && event.delivery === 'ability-periodic' && definition(event.sourceId) === 'nocturne') {
          const strike = strikes.get(event.sourceId);
          if (strike && event.tick > strike.tick && !strike.struck.has(event.targetId)) {
            strike.struck.add(event.targetId);
            plan.extra.push({ champion: 'nocturne', sourceId: event.sourceId, targets: [event.targetId], action: 'passive', skill: 'nocturne-tar' });
          }
        }
        if (event.type === 'cast' && event.completed !== false) {
          const champion = definition(event.sourceId), state = unit(event.sourceId);
          state.cast = true;
          if (champion === 'lux') { state.luxAttack = true; if (event.targetIds[0] === event.sourceId) plan.variant = 'self'; }
          if (champion === 'twitch') state.twitchShots = 8;
          if (champion === 'nocturne') { state.nocturneUntil = event.tick + 120; plan.stopCast = event.sourceId; }
          // Leona's W runs from her cast until the rules' damage reduction on her expires (its own event, not a fixed tick count).
          if (champion === 'leona') { state.leonaFrom = event.tick; plan.stopCast = event.sourceId; }
        } else if (event.type === 'attack') {
          const champion = definition(event.attackerId), state = unit(event.attackerId);
          state.attacks++;
          if (champion === 'zeri' && state.attacks % 3 === 0 || champion === 'draven' && state.cast
            || champion === 'lux' && state.luxAttack || champion === 'nocturne' && event.tick < state.nocturneUntil
            || champion === 'twitch' && state.twitchShots > 0) plan.variant = 'empowered';
          if (champion === 'lux') state.luxAttack = false;
          // Zeri's spark bounces: every enemy her attack's bounce damage strikes on its tick (the rules pick them) gets her
          // empowered hit and an arc from her main target ('zeri-bounce'), whether or not this attack counted as her empowered one.
          if (champion === 'zeri') {
            const bounced = (bounces.get(key(event.tick, event.attackerId, 'bounce')) ?? []).filter(id => id !== event.targetId);
            if (bounced.length) plan.extra.push({ champion: 'zeri', sourceId: event.attackerId, targets: [event.targetId, ...bounced],
              action: 'passive', skill: 'zeri-bounce', snapshotTargets: true });
          }
          // Draven throws his empowered axes from each hand in turn: every second one is the other hand's axe.
          if (champion === 'draven' && plan.variant === 'empowered' && ++state.empoweredThrows % 2 === 0) plan.variant = 'empowered-alt';
          if (champion === 'nocturne' && plan.variant === 'empowered') strikes.set(event.attackerId, { tick: event.tick, struck: new Set([event.targetId]) });
          if (champion === 'twitch' && state.twitchShots > 0) {
            state.twitchShots--;
            // The attack event retains the pre-replacement target; packets name the actual pierced enemies.
            plan.targets = packets.get(key(event.tick, event.attackerId, 'physical')) ?? [event.targetId];
          }
        } else if (event.type === 'statusChanged' && event.kind === 'damage-reduction' && event.reason === 'expired'
          && definition(event.targetId) === 'leona' && unit(event.targetId).leonaFrom >= 0) {
          unit(event.targetId).leonaFrom = -1; plan.stopCast = event.targetId;
          plan.extra.push({ champion: 'leona', sourceId: event.targetId, targets: [], action: 'end' });
          const targets = packets.get(key(event.tick, event.targetId, 'magic'));
          if (targets?.length) plan.extra.push({ champion: 'leona', sourceId: event.targetId, targets, action: 'passive' });
        } else if (event.type === 'packetDamage' && event.damageType === 'magic' && definition(event.sourceId) === 'amumu'
          && !attacks.has(key(event.tick, event.sourceId, 'attack')) && unit(event.sourceId).pulseTick !== event.tick) {
          unit(event.sourceId).pulseTick = event.tick;
          plan.extra.push({ champion: 'amumu', sourceId: event.sourceId, targets: packets.get(key(event.tick, event.sourceId, 'magic'))!, action: 'passive' });
        } else if (event.type === 'death') {
          const state = units.get(event.unitId);
          if (state) { state.leonaFrom = -1; state.nocturneUntil = -1; }
          if (definition(event.unitId) === 'leona' || definition(event.unitId) === 'nocturne') plan.stopCast = event.unitId;
        }
        return plan;
      });
    },
  };
}

/**
 * Reviewed replacements for a champion's exported skill timeline (the asset root's vfx-ltk index `skills`), kept in
 * the repository so a fix needs no asset-root rebuild. 2026-11-03 1080p video review (castcmp-1103) found exported cues
 * on the wrong host, too early or late, or from another spell. A row replaces that champion's whole cue list (attack
 * and cast); it applies only when every system it names is present in the loaded index, else the exported list stays.
 * Cue fields as in timeline.ts: `cast-start` plays on the caster (at `bone`), `hit` on each target (at `bone`),
 * `projectile` flies caster → target over `travelSeconds`. `scale` (default 1) shrinks that one
 * system about its anchor and does not move the anchor or the flight; it multiplies the cue's size factor
 * (fx-size.ts cueSize: the body scale on a weapon or hand bone, the arena scale elsewhere). `kept(x)` is a size
 * measured against footage at the older 0.44 base, drawn as it was: a range in cells (ground rings, blasts, swipes).
 * `hugged(x)` is such a size that wraps or hugs a body (shields, binds, per-target splashes): it shrinks with the body.
 */
import { strikeOffsetTicks, type TimelineCue } from './timeline';
import { measuredAtFxScale as kept, measuredOnBody as hugged } from './fx-size';
import { BATCH1_TIMELINES } from './batch1-timelines';
import { JINX_EVENT_SKILLS, jinxSkills } from './champions/jinx';
import { JAYCE_EVENT_SKILLS, jayceSkills } from './champions/jayce';
import { MEL_EVENT_SKILLS, melSkills } from './champions/mel';
import { sevikaSkills } from './champions/sevika';
import { viktorSkills } from './champions/viktor';
import { warwickSkills } from './champions/warwick';
import { S13_TIMELINES, VI_LANDING } from './s13-timelines';
import { elise as eliseBatch3 } from './batch3/elise';
import { swain as swainBatch3 } from './batch3/swain';
import { rell as rellBatch3 } from './batch3/rell';

const chest = 'C_BUFFBONE_GLB_CHEST_LOC';
/** Seconds after Malzahar's cast that his gate's end portals open (fitted, 自定，非原版). */
export const MALZAHAR_GATE_DELAY = 0.2;
/**
 * Seconds after Ambessa's chain cast that her chain swipe (3b4c15e0) starts. Fitted, measured on live-server 3-star footage,
 * not original data: neither her character data nor her animation graph times it, and the export's estimate drew it
 * later than the original's arc. The swipe's own emitters still start after their authored wait.
 */
export const AMBESSA_CHAIN_SWIPE_DELAY = 0.1;
/**
 * Seconds a cue that plays out at its end (TimelineCue.playOut) may keep its particles after it, at most: our own cap
 * (自定，非原版, Fable 11-19), only on the cues the 11-19 cut-off evidence found cut while still thick.
 */
export const PLAY_OUT_AT_DEADLINE = 0.5;
/**
 * Garen's falling sword (97c28077) starts GAREN_SWORD_DELAY after his cast, and his landing burst (5bbccb8c) starts
 * GAREN_SWORD_INTO_BODY after that: when the sword's tip comes down into Garen's height, before it reaches the ground, so the
 * burst covers the blade going in. Both measured from the official game's footage, not original data (量自正式服画面，非原版
 * 数据): there his sword shows a beat after the cast starts, and the burst flashes a moment after it comes into view.
 */
export const GAREN_SWORD_DELAY = 0.3, GAREN_SWORD_INTO_BODY = 0.28;
/**
 * Skill systems that may take more root places than ROOT_PARTICLES_MOST, by system: the most this one run may take. Only for
 * a system measured past that cap whose later emitters the cap visibly starves (11-24: Garen's landing burst 5bbccb8c measures
 * about half again past it, and its spark and fire waves, part of its white flash, lost much of their particles). Our own
 * cap (自定，非原版), measured on the asset.
 */
export const ROOT_ROOM_MOST: Readonly<Record<string, number>> = {
  '5bbccb8c': 640,
};
/** Vi's landing group (s13-timelines.ts): played when the rules' slam lands (CUE_EXTRA_SKILLS 'vi-slam', batch2-bridge.ts). */
export const VI_SLAM_SYSTEMS: readonly string[] = ['18e22631', 'd27b3044', '66c600e8', '84b969e0'];
/** Vi's right hand's trail: from her cast until the slam lands, where batch2-bridge.ts stops it. */
export const VI_HAND_TRAIL = 'c11e6814';
/** Draven's empowered axe, thrown and (CUE_EXTRA_SKILLS draven-return) flying back. */
export const DRAVEN_AXE = '5d31debe';
/** Seconds his landed axe takes to fly back to his hand (自定，非原版). */
const DRAVEN_RETURN_SECONDS = 1.2;
/**
 * Maddie's volley shot flies this many rule ticks a cell, and at least MADDIE_SHOT_MIN_TICKS (fitted, not original data).
 * The rules will time each shot's damage by the same flight (src/simulation/cast-windup.ts, coming): until then these
 * stand in for it, and are to be imported from there once it lands.
 */
export const MADDIE_SHOT_TICKS_PER_HEX = 2, MADDIE_SHOT_MIN_TICKS = 4;
/**
 * Maddie's volley hit (b1b77889, her R target effect) drawn at this size: drawn as exported, every shot's flash was much
 * larger than the original's. Our own value (Fable 11-19 picked it side by side from 0.55 and 0.4), not original data.
 */
export const MADDIE_HIT_SCALE = 0.55;
/** Smeech's stab slash: the vertical swing his skill's stab clips carry (CUE_EXTRA_SKILLS smeech-stab). */
export const SMEECH_STAB_SWING = '90b31f27';
const ground = 'BUFFBONE_GLB_GROUND_LOC';
const center = 'C_BUFFBONE_GLB_CENTER_LOC';

/**
 * Caitlyn's Air Raid comet, one per shot, falling onto that shot's damage centre (TimelineCue.fromAbove). Every value is a
 * fitted value, not original data: the blimp that drops it is off screen in 14.24 and the export carries no path for it.
 */
export const CAITLYN_COMET = {
  /**
   * Cells from where the target stands: left on screen, up, and toward the top of the screen. Fitted, not original data:
   * far enough and slanted enough that the comet comes in from the upper left at about the angle the 14.24 footage shows,
   * with the long streak it leaves there (the board camera looks down along -Z, so screen left is -X and screen up is
   * mostly +Y and -Z). It still falls in CAITLYN_COMET.fall, so it lands when it did; it reads faster than the footage's,
   * whose shot the renderer cannot see coming (a shot's centre is drawn by the rule when the shot executes).
   */
  from: [-4, 6, -2.5] as const,
  /**
   * Seconds it falls. Fitted: a shot's damage is already settled when its event arrives, so the comet starts then and
   * lands this much later, short enough to read as the cause of that hit.
   */
  fall: 0.15,
  /** Seconds its trail fades out over once it lands (fitted: in the footage the column is gone soon after the burst). */
  linger: 0.15,
  /** Seconds a 3-star shot's burst (R_Bombardment_Impact) plays, eased out from its middle: twenty shots in five seconds. */
  burst3: 0.6,
} as const;

/**
 * Cells Gangplank's ground-fire line runs from his feet through the target. A FIT, not the original's value: its scorch
 * strand emits for only part of the flight, so the line runs this far for the scorch it leaves to reach about as far past
 * the target as it does in footage (11-13).
 */
export const GP_GROUND_LINE_CELLS = 2.7;
/**
 * Cells behind Gangplank (away from the target) his ground-fire line starts. A FIT, not the original's value: in the
 * 3-star full-board footage the scorch starts on his far side and runs through the target (11-13).
 */
export const GP_GROUND_LINE_BACK = 0.5;
/**
 * Fallback only, not original data: the longest Irelia's stance may play when her shield's end event never arrives. Her
 * shield's end (shieldLayerChanged depleted or expired, batch1-events.ts) is what stops it; this is set past any shield
 * the rules grant her so it never cuts one short.
 */
export const IRELIA_STANCE_FALLBACK_SECONDS = 4;
/**
 * The rules' cast wind-ups (src/simulation/cast-windup.ts CAST_WINDUP_TICKS), mirrored here: importing that module from the 3D
 * code pulled it into the render3d chunk and made the 2D entry load that chunk eagerly (rendering3d-isolation). The test
 * vfx-ltk-windup-hits checks the two stay equal.
 */
export const CAST_WINDUP_TICKS = Object.freeze({ drmundo: 10, trundle: 4, zyra: 6, tristana: 12, renata: 17 } as const);
/**
 * Heimerdinger's rockets, one a rule strike (combat-g2-2.ts strikes once per rocket, all on the cast tick today): the k-th of
 * n leaves HEIMER_ROCKETS.launchTicks plus its stagger after the mana bar empties and lands flightTicks later, so it lands at
 * cast tick + heimerRocketLandTick(k, n). The first rocket keeps the launch, flight and hit of the exported cue; the
 * stagger is 1 tick a rocket, the whole volley squeezed into 9 ticks (0.45 s) when it has
 * more than 10 rockets. A cast draws at most `shown` rockets (its later strikes play only their hits, on the same stagger),
 * and every Heimerdinger together queues at most `tickCap` rockets on one rule tick, so several casting at once do not crowd
 * other effects out (11-19 Windows hrB). So a 3-star cast, and the extra rocket each later cast adds, look like a 2-star first
 * cast's five: a known difference. The strikes past `shown` play neither rocket nor hit (their damage numbers still show).
 * Hits: decorative rank, so they never take a slot from a skill or basic-attack visual; at most hitTickCap queued on one rule
 * tick across casters; a strike's hit is merged away when the same cast hit the same target under hitMergeTicks before.
 * A perStrike cast's rows past its first take no system slot (runtime slotsNow), so one cast holds two slots (rocket, hit);
 * every row still needs particle room. Each rocket draws at rocketScale and rocketBrightness, thicker and brighter than the
 * exported system (Fable 11-19 picked this over the as-exported look side by side). All designed display values (Fable
 * 11-19), not original data.
 * This is the one definition of when each rocket lands. When the rules move each rocket's damage to its landing
 * (Fable 11-19 (b), L2), the rules side gets a copy in src/simulation/cast-windup.ts beside CAST_WINDUP_TICKS, and a test
 * checks the two stay equal (as vfx-ltk-windup-hits does for CAST_WINDUP_TICKS) so neither side changes alone.
 */
export const HEIMER_ROCKETS = Object.freeze({ launchTicks: 4, flightTicks: 10, staggerTicks: 1, spreadTicks: 9, shown: 5, tickCap: 8, rocketScale: 1.5, rocketBrightness: 2,
  hitTickCap: 8, hitMergeTicks: 3 } as const);
/** The rule tick, counted from the cast, on which Heimerdinger's k-th of n rockets lands (HEIMER_ROCKETS). */
export function heimerRocketLandTick(k: number, n: number): number {
  return HEIMER_ROCKETS.launchTicks + HEIMER_ROCKETS.flightTicks + strikeOffsetTicks(k, n, HEIMER_ROCKETS.staggerTicks, HEIMER_ROCKETS.spreadTicks);
}
/** The rules' DRMUNDO_BLAST_AFTER_PULSE_TICKS (src/simulation/cast-windup.ts), mirrored like CAST_WINDUP_TICKS (rendering3d-timed-form checks it). */
export const DRMUNDO_BLAST_AFTER_PULSE_TICKS = 5;
/** The rules' CAMILLE_KICK_TICKS (src/simulation/combat-g2-2.ts), mirrored as CAST_WINDUP_TICKS is (tests/sustain-stops.test.ts checks it). */
export const CAMILLE_KICK_TICKS = 5;
/** Tristana's shell flight in seconds (fitted, not original data). */
const TRISTANA_SHELL_TRAVEL = 0.4;
/**
 * Display branches the export never had, by `<champion>-<branch>` key, played through LtkPlayOptions.skill. Each is added
 * to a loaded index that has the champion's own list and every system the branch names (withCueOverrides).
 */
/**
 * Rumble's missiles (Fable 11-24). His rules settle every missile's damage on the cast's own tick; the explosions show on the
 * ground of his row's cells (rumble-row.ts) from that tick, one after another along the row from the end nearest him, `step`
 * seconds apart, and each after the first is preceded by its missile falling onto its cell for `fall` seconds (the asset's
 * missile falls: its sparks are shot downward and its rocket spins about the vertical). Display values, fitted, not
 * original data: `step` from the 14.24 footage at 60 fps (the row's explosions follow each other a few frames apart), `fall`
 * and `from` (cells above the cell) chosen so a drop never lands after its explosion; the first has none, as it shows on the
 * damage's own tick.
 */
export const RUMBLE_MISSILE = { step: 0.05, fall: 0.05, from: [0, 3, 0] as const } as const;
export const CUE_EXTRA_SKILLS: Readonly<Record<string, readonly TimelineCue[]>> = {
  // Rumble's missiles (RUMBLE_MISSILE; placeholder-renderer.ts): on each cell of his row the renderer picks (rumble-row.ts
  // rowStrikeCells), its explosion on the ground and, before each but the first, its missile's short fall onto that cell.
  'rumble-drop': [{ system: '721e9fbc', action: 'cast', event: 'projectile', location: 'board', delay: 0, duration: RUMBLE_MISSILE.fall + 0.15,
    travelSeconds: RUMBLE_MISSILE.fall, stopAfter: RUMBLE_MISSILE.fall, fadeOut: true, fromAbove: RUMBLE_MISSILE.from }],
  'rumble-strike': [{ system: '89fc6454', action: 'cast', event: 'cast-start', location: 'board', delay: 0, duration: 1 }],
  // Gangplank's ranged-form attack (batch2-bridge.ts), drawn from the rules' attackLaunched / attackLanded: the shot leaves
  // his right hand on the launch and flies the rule's own flight (LtkPlayOptions.flightSeconds), so it lands on the tick his
  // damage does; its hit plays on a landing that hit. The travelSeconds here is only a stand-in the rule's flight replaces.
  'gangplank-ranged-flight': [
    { system: 'bb62fca2', action: 'passive', event: 'projectile', bone: 'r_hand', targetBone: chest, delay: 0, duration: 0.3, travelSeconds: 0.3 },
  ],
  'gangplank-ranged-land': [
    { system: '0f2af66b', action: 'passive', event: 'hit', bone: chest, delay: 0, duration: 1.5 },
  ],
  // Dr. Mundo (batch1-events.ts): the beam from him to the enemy his once-a-second damage hits; at his closing blast, the blast
  // body on him and the zap on each enemy it hits.
  // Malzahar's gate (placeholder-renderer.ts): its portal at each end of the cast's line of cells (CastReceipt.area), on the
  // board, facing the other end. It opens just after his cast (fitted, 自定): its frame, crystals and ground band first, its
  // own close flash a moment later, after the damage the rules deal at the cast.
  'malzahar-gate': [{ system: '10e4e326', action: 'cast', event: 'cast-start', location: 'board', delay: MALZAHAR_GATE_DELAY, duration: 2 }],
  'drmundo-beam': [{ system: 'b8ba6c19', action: 'passive', event: 'link', delay: 0, duration: 0.6, bone: chest, targetBone: chest }],
  'drmundo-zap': [{ system: '56c38cb9', action: 'passive', event: 'hit', delay: 0, duration: 1.5, bone: chest }],
  // Nocturne (batch1-events.ts): his strike on each other enemy his empowered swing bleeds, when its first bleed tick lands
  // (the swing's own target takes it with the swing's hit). Played to its own end (ownLife), like the swing's (C71).
  'nocturne-tar': [{ system: '6fb6c5e5', action: 'passive', event: 'hit', delay: 0, duration: 1, ownLife: true, bone: chest }],
  'drmundo-zap-body': [{ system: 'b8021b81', action: 'passive', event: 'cast-start', delay: 0, duration: 2, bone: chest }],
  // Trundle's bite and Zyra's vines (batch1-events.ts): their hits play when the damage lands, CAST_WINDUP_TICKS after the cast,
  // on every enemy hit that tick (Zyra's first is her primary target). Cues as in their cast lists before.
  'trundle-bite': [{ system: '8bb9f6ab', action: 'passive', event: 'hit', delay: 0, duration: 1 }],
  'zyra-vines': [
    { system: '7ce6b652', action: 'passive', event: 'hit', delay: 0, duration: 1.4, stopAfter: 0.8, fadeOut: true, bone: ground, primary: true, scale: kept(0.5) },
    { system: '7ce6b652', action: 'passive', event: 'hit', delay: 0, duration: 1.4, stopAfter: 0.8, fadeOut: true, bone: ground, others: true, targetLimit: 2, optional: true, scale: kept(0.5) },
    { system: 'b888a24f', action: 'passive', event: 'hit', delay: 0, duration: 1.4, stopAfter: 0.8, fadeOut: true, bone: ground, primary: true, scale: kept(1.6) },
    { system: '9d413df0', action: 'passive', event: 'hit', delay: 0, duration: 0.4, bone: chest, primary: true, scale: hugged(1) },
    { system: '9d413df0', action: 'passive', event: 'hit', delay: 0, duration: 0.6, bone: chest, others: true, scale: hugged(1) },
  ],
  // Draven (batch1-events.ts): an empowered axe that lands bounces off the enemy it hit and comes down into his hand in a
  // high arc. Travel and arc are our own (自定，非原版); decoration, never taking a slot from a skill; it goes at once when either
  // unit dies (placeholder-renderer.ts).
  'draven-return': [{ system: DRAVEN_AXE, action: 'passive', event: 'projectile', delay: 0, duration: DRAVEN_RETURN_SECONDS,
    travelSeconds: DRAVEN_RETURN_SECONDS, bone: chest, targetBone: 'R_hand', arc: { gravity: 2200, targetOffset: 80 }, rank: 'decorative' }],
  // Camille's kick (batch1-events.ts): Q_tar on the target when her ability damage lands, the variant her adaptive damage type
  // picks — 69b207a4 for physical, aff93381 (Q_tar_MagicDamage) for magic. Both durations reach past each system's own end.
  // Blitzcrank's shock (batch1-events.ts): the arcs from him and the burst on each enemy play when the shock's damage lands
  // (BLITZ_SHOCK_TICKS after the cast), so the order is shield, damage, arcs. Durations as in his cast list before.
  // Maddie: each shot of her volley is drawn with its own damage (batch1-events.ts): a shot from her rifle's muzzle
  // (Weapon_Shooter: our skeleton has no barrel-root bone) to the enemy it hit, flying MADDIE_SHOT_TICKS_PER_HEX ticks a
  // cell and at least MADDIE_SHOT_MIN_TICKS, and the hit there when it lands (TimelineCue.flightTicks). Her damage numbers
  // still show at the shot's start until the rules move them to its landing (known interim state, Fable 11-19).
  'maddie-shot': [
    { system: 'f0aa0d95', action: 'passive', event: 'projectile', delay: 0, duration: 0.4, bone: 'Weapon_Shooter', travelSeconds: 0.2, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC',
      flightTicks: { perCell: MADDIE_SHOT_TICKS_PER_HEX, min: MADDIE_SHOT_MIN_TICKS } },
    { system: 'b1b77889', action: 'passive', event: 'hit', delay: 0, duration: 0.8, bone: 'C_BUFFBONE_GLB_CHEST_LOC', scale: MADDIE_HIT_SCALE,
      flightTicks: { perCell: MADDIE_SHOT_TICKS_PER_HEX, min: MADDIE_SHOT_MIN_TICKS } },
  ],
  // Smeech (batch1-events.ts): his cast names no target (the rules leap and schedule his stabs), so his stab's slash and its
  // hit play with each stab's damage: the thin vertical slash his skill's stab clips carry, and the hit on the enemy stabbed.
  // His other three swings belong to his attack clips, not his skill. Each leap's first stab also draws his leap's trail to
  // that enemy, timed from the cast as the export gives it.
  'smeech-stab': [
    // On his ground point, where his stab clips put it (the export's cue had his weapon).
    { system: SMEECH_STAB_SWING, action: 'passive', event: 'cast-start', delay: 0, duration: 0.7, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '9acdae50', action: 'passive', event: 'hit', delay: 0, duration: 1 },
  ],
  'smeech-leap': [{ system: 'a664114c', action: 'passive', event: 'projectile', delay: 0.4, duration: 0.8, travelSeconds: 0.8 }],
  // ab66b54f on Blitzcrank himself when his shock's damage lands (was a hand-picked delay after the cast).
  'blitzcrank-shock-self': [{ system: 'ab66b54f', action: 'passive', event: 'cast-start', delay: 0, duration: 1.6, bone: center }],
  'blitzcrank-shock': [
    { system: '9d35c42d', action: 'passive', event: 'link', delay: 0, duration: 0.28, bone: chest, targetBone: chest },
    { system: '065c16b8', action: 'passive', event: 'hit', delay: 0, duration: 0.4, bone: chest },
  ],
  // Vi: her landing group (her landing's light column, burst, hit and row shockwave) when the rules' slam lands
  // (batch2-bridge.ts), each at its own offset from the export's landing frame (none lands before it).
  'vi-slam': S13_TIMELINES.vi.filter(cue => VI_SLAM_SYSTEMS.includes(cue.system))
    .map(cue => ({ ...cue, delay: Math.max(0, cue.delay - VI_LANDING) })),
  // Powder: her blast's target burst plays when its damage lands, on each enemy it hits (batch1-events.ts); its explosion
  // plays once, on the cell her monkey arrives at ('powder-arrive', placeholder-renderer.ts powder-monkey-arrived).
  // Jayce (champions/jayce.ts, placeholder-renderer.ts): his crystals land and explode on the rules' events, on their cells.
  ...Object.fromEntries(JAYCE_EVENT_SKILLS.map(skill => [skill, jayceSkills[skill]!])),
  // Jinx (champions/jinx.ts, batch2-bridge.ts): her rocket follows the rules' events, not fixed times.
  ...Object.fromEntries(JINX_EVENT_SKILLS.map(skill => [skill, jinxSkills[skill]!])),
  // Mel (champions/mel.ts, batch2-bridge.ts): her dash, bolts and hits follow the rules' events, not fixed times.
  ...Object.fromEntries(MEL_EVENT_SKILLS.map(skill => [skill, melSkills[skill]!])),
  'powder-blast': [
    { system: '8747b362', action: 'passive', event: 'hit', delay: 0, duration: 1 },
  ],
  'powder-arrive': [
    { system: '805215e2', action: 'passive', event: 'hit', location: 'board', delay: 0, duration: 1.5 },
  ],
  // Nunu's blast (batch1-events.ts): R_hit_tar on each enemy the blast strikes, when its damage lands; 0.05 s after it, as the
  // splash followed the blast in his cast list, at the size it had there.
  // Nunu's blast (batch1-events.ts): R's blast on him when the blast's damage lands, at the default skill size (11-16 review
  // against footage: at the pool's fit it covered too little of the board).
  'nunu-blast': [{ system: '8c256426', action: 'passive', event: 'cast-start', delay: 0, duration: 1.5, bone: 'Spine2_Wil', main: true }],
  'nunu-blast-hit': [{ system: '5dfd387b', action: 'passive', event: 'hit', delay: 0.05, duration: 1, scale: hugged(0.7) }],
  'camille-q-physical': [{ system: '69b207a4', action: 'passive', event: 'hit', delay: 0, duration: 1 }],
  'camille-q-magic': [{ system: 'aff93381', action: 'passive', event: 'hit', delay: 0, duration: 1.2 }],
  // Renni's grab (batch1-events.ts): Q_tar on the enemy her cast holds, when her stun lands. Event, bone and duration
  // are our fit (not original data).
  'renni-grab': [{ system: 'be12cd52', action: 'passive', event: 'hit', delay: 0, duration: 1, bone: chest }],
  // Renni's final slam (batch1-events.ts): the impact on the ground under the held enemy, and FinalSlam_Tar on each
  // enemy the slam strikes, on the tick its damage lands. Bones and durations are our fit (not original data).
  'renni-slam': [
    { system: '2f79da6f', action: 'passive', event: 'hit', delay: 0, duration: 2, bone: ground, primary: true },
    { system: '32bd44a4', action: 'passive', event: 'hit', delay: 0, duration: 1, bone: chest },
  ],
  // One Air Raid shot (batch1-events.ts caitlynShots): the comet falls onto the shot's damage centre and bursts there.
  'caitlyn-shot': [
    { system: '92bbeaf7', action: 'passive', event: 'projectile', targetBone: ground, delay: 0, duration: CAITLYN_COMET.fall + CAITLYN_COMET.linger,
      travelSeconds: CAITLYN_COMET.fall, stopAfter: CAITLYN_COMET.fall, fadeOut: true, fromAbove: CAITLYN_COMET.from },
    { system: '8d6e1c2e', action: 'passive', event: 'hit', delay: CAITLYN_COMET.fall, duration: 1.5 },
  ],
  // 3 stars (twenty shots): every shot bursts, shorter; every other shot also shows its comet.
  'caitlyn-shot-3': [
    { system: '8d6e1c2e', action: 'passive', event: 'hit', delay: CAITLYN_COMET.fall, duration: CAITLYN_COMET.burst3, stopAfter: CAITLYN_COMET.burst3 / 2, fadeOut: true },
  ],
  'caitlyn-shot-3-comet': [
    { system: '92bbeaf7', action: 'passive', event: 'projectile', targetBone: ground, delay: 0, duration: CAITLYN_COMET.fall + CAITLYN_COMET.linger,
      travelSeconds: CAITLYN_COMET.fall, stopAfter: CAITLYN_COMET.fall, fadeOut: true, fromAbove: CAITLYN_COMET.from },
    { system: '8d6e1c2e', action: 'passive', event: 'hit', delay: CAITLYN_COMET.fall, duration: CAITLYN_COMET.burst3, stopAfter: CAITLYN_COMET.burst3 / 2, fadeOut: true },
  ],
  // Vladimir (batch1-events.ts heal plans): his heal ring (Q_heal_tar) plays on him when his ability heals him, never on
  // his cast's enemies.
  'vladimir-heal': [
    // At his heal itself (the heal event's tick), not the index's later start.
    { system: '28c6427d', action: 'passive', event: 'hit', delay: 0, duration: 1.5, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Steb (batch1-events.ts heal plans). His heal missile belongs to his heal share, not to his cast: it flies to the ally
  // his share heals and the heal ring shows there once it arrives (its travel time is a display value). His own heal
  // rings on him. Neither plays on an enemy.
  // Body rank, not critical (Fable 11-14 display priority, not original data): with vamp on him a share follows nearly
  // every attack, and it must not crowd skill impacts out. His own heal ring stays critical.
  'steb-share': [
    { system: '36c79ae9', action: 'passive', event: 'projectile', bone: 'L_Hand', delay: 0, duration: 0.8, travelSeconds: 0.6, rank: 'body' },
    { system: 'cf50856e', action: 'passive', event: 'hit', delay: 0.6, duration: 1.2, rank: 'body' },
  ],
  'steb-heal': [
    { system: 'cf50856e', action: 'passive', event: 'hit', delay: 0, duration: 1.2 },
  ],
  // Irelia's swipe where her shield ends (batch1-events.ts). It reaches the front row, as in the original; at the 0.44 base
  // it drew 2.9 cells and at the arena scale 1.9 (pr572-report 11-09 14:35), so it keeps the older size.
  'irelia-swipe': [
    { system: '08b7a939', action: 'passive', event: 'cast-start', delay: 0, duration: 0.8, bone: 'Buffbone_Glb_Ground_Loc', scale: kept(1) },
  ],
};

/** Singed's flask: released this long into his cast (a fitted display value), then in flight this long. */
const SINGED_FLASK_RELEASE = 0.5, SINGED_FLASK_FLIGHT = 0.35;
/**
 * Ziggs's bomb, as drawn (C71): his main bomb's release and flight (fitted, as before), when it lands, and his split bombs'
 * flight from there: 10 combat ticks (0.05 s each), a display rhythm of our own, not the original's; their lob too is our own.
 */
const ZIGGS_BOMB = (() => {
  const release = 0.3, flight = 0.5;
  return { release, flight, lands: release + flight, split: 10 * 0.05, arc: { gravity: 6000, targetOffset: 0 } } as const;
})();
/** When the flask lands on the ally's head: what it brings starts then. */
const SINGED_FLASK_LANDS = SINGED_FLASK_RELEASE + SINGED_FLASK_FLIGHT;
/**
 * How long a stun's own layers (CUE_RULE_STOPS stunEnded) take to ease out once their target is no longer stunned: a short
 * fade of our own (自定，非原版), so the layer leaves with the stun instead of being cut.
 */
export const STUN_END_FADE_SECONDS = 0.25;
/** How long a shield's layers (CUE_RULE_STOPS abilityShieldEndedFade) take to ease out when its layer ends: our own (自定，非原版). */
export const SHIELD_END_FADE_SECONDS = 0.25;
/** When Akali's mark (bc4a9e0d) lands on her target after the cast: with her shuriken's hit. */
export const AKALI_MARK_DELAY = 0.3;
/**
 * Akali's exposure as the rules time it (from the tick after her cast, for her ability's Duration in rule ticks), mirrored here
 * as CAST_WINDUP_TICKS is: importing the ability data from the 3D code pulls it into the render3d chunk and makes the 2D entry
 * load that chunk eagerly (rendering3d-isolation). Kept in step with the rules' constant, enforced by
 * tests/vfx-ltk-status-follows-rules.test.ts.
 */
export const AKALI_EXPOSURE = Object.freeze({ fromTick: 1, ticks: 80, ticksPerSecond: 20 } as const);
/**
 * How long Akali's mark shows: until the rules' exposure on that target ends, counted from when the mark lands. The exposure
 * has no other end in the rules (it is not consumed or cleansed; a recast on the same target restarts it, as a recast
 * replaces the mark: SUSTAIN_REFRESH); the target's death takes the mark at once (SUSTAIN_CAPS).
 */
export const AKALI_MARK_SECONDS = (AKALI_EXPOSURE.fromTick + AKALI_EXPOSURE.ticks) / AKALI_EXPOSURE.ticksPerSecond - AKALI_MARK_DELAY;
export const CUE_OVERRIDES: Readonly<Record<string, readonly TimelineCue[]>> = {
  // Elise's front-row cast as exported (batch3/elise.ts, baked into the asset index), with the Cocoon hit 6d6525e8 playing to its
  // system's own end instead of the default: no rule event ends it (11-15).
  'elise-front': eliseBatch3['elise-front']!.map(cue => cue.system === '6d6525e8' ? { ...cue, duration: 2.1 } : cue),
  // Swain's back-row cast as exported (batch3/swain.ts, baked into the asset index), its crow flying as the whole crow
  // system 3d2697ac (its smoke and red flash, with the crow 9ad716c2 that system carries) rather than the bare crow, and
  // to the primary target only for now; the nearby targets get none until the look is judged (Fable 11-21).
  'swain-back': swainBatch3['swain-back']!.map(cue => cue.system === '9ad716c2' ? { ...cue, system: '3d2697ac', primary: true } : cue),
  // Rell's list as exported (her defence-steal hit 5fe3dc8a plays once per hit, as the asset does: a resistance cut shows
  // nothing more in the original, 11-25), her basic-attack hit on the target's chest like every attack hit named here (#627).
  rell: rellBatch3.rell!.map(cue => cue.action === 'attack' && cue.event === 'hit' ? { ...cue, bone: chest } : cue),
  // Steb's cast keeps its strike on the enemy only; his heal missile and heal ring play from his heal events
  // (CUE_EXTRA_SKILLS 'steb-share' / 'steb-heal'), never on the cast's enemy target.
  steb: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.3333333333333333, duration: 1.5 },
    { system: '8b302521', action: 'cast', event: 'hit', delay: 0.6, duration: 0.8 },
  ],
  // Q: missile, then one ground ring on the primary target, then the burst. R1 marker stays out.
  // The shadow zone and its edge are authored well over the original's drawn size; 0.68 brings them back.
  vex: [
    { system: '85788d2c', action: 'attack', event: 'projectile', bone: 'L_Hand', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5666666666666667, duration: 1.5 },
    { system: 'c173eb0c', action: 'cast', event: 'projectile', delay: 0, duration: 0.35, travelSeconds: 0.28, bone: 'R_Buffbone_Glb_Hand_Loc', targetBone: ground },
    { system: '8682c9ee', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true, scale: kept(0.68) },
    { system: 'eb9da1d5', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true, scale: kept(0.68) },
    { system: 'c4da788c', action: 'cast', event: 'hit', delay: 1.2, duration: 0.9, bone: ground, primary: true },
    { system: '37f7cb35', action: 'cast', event: 'hit', delay: 1.2, duration: 1, bone: ground, primary: true },
  ],
  // R: shield on Garen, then one sky beam and one impact on his own ground. Not one copy per target.
  // The landing burst is authored far wider than the original's drawn burst (castcmp-1103); 0.45 keeps it on his feet.
  // 11-24: his package's cast burst (cbccc667: the energy rising off him and a glow at his feet) and its falling sword
  // (97c28077: the golden blade dropping from above onto his ground, with its glow) were never cued. The burst plays from the
  // cast; the sword a beat later (GAREN_SWORD_DELAY), and the landing burst as the sword's tip comes down into him.
  garen: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.3333333333333333, duration: 1.5 },
    { system: 'cbccc667', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: ground },
    { system: '97c28077', action: 'cast', event: 'cast-start', delay: GAREN_SWORD_DELAY, duration: 1.2, bone: ground },
    { system: 'ea21ae27', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: chest },
    { system: '44aa54ff', action: 'cast', event: 'cast-start', delay: 0.4, duration: 1, bone: ground },
    { system: '5bbccb8c', action: 'cast', event: 'cast-start', delay: GAREN_SWORD_DELAY + GAREN_SWORD_INTO_BODY, duration: 0.7, bone: ground, scale: kept(0.45) },
  ],
  // E (14.24 field: the main root lands a beat after the cast, the second roots a beat later): E_Sequence_Impact is the index's own ground
  // missile (travel 0.3): one crawls to the primary target, then short ones reach up to two others. The brown branching
  // vines (E_Outer) sprout around each rooted target, not at Zyra's feet (ca23e060: they spread from her toward empty
  // ground). E_Sequence_Root binds the primary target; the plant flash marks every one. No E_Mis or E_Mis_Child exists.
  zyra: [
    { system: 'ec6aaee6', action: 'attack', event: 'projectile', bone: 'L_Hand', delay: 0.3333333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.6333333333333333, duration: 1.5 },
    // The whole E was sized together against the footage at the 0.44 base, so every cast cue keeps that size (pr572-report,
    // 11-09: only the two vine systems kept it and the sprouts and flash shrank to 0.29 and 0.59 cells beside them).
    // The ground cues are ranges and keep it; the chest hit on each rooted target hugs that body and shrinks with it.
    // Sizes from the cdacbcc9 isolated renders against the 14.24 footage: E_Outer drew
    // far too wide and was cut off at its end; the root cluster drew too thin to read as the vine mass.
    // Faded out (3e90bd1c, d650fcf2 fields: both drew at full strength to the end, then vanished): their long-lived single
    // particles never reach their own authored fade inside the cue, so from the stop the cue eases them out itself.
    // The vines' damage lands CAST_WINDUP_TICKS.zyra after the cast (cast-windup.ts): every vine missile arrives then, and the
    // hits on the rooted targets play at that damage event ('zyra-vines', batch1-events.ts), not at fixed times.
    { system: '857fe049', action: 'cast', event: 'projectile', delay: CAST_WINDUP_TICKS.zyra / 20 - 0.3, duration: 0.6, travelSeconds: 0.3, bone: ground, targetBone: ground, primary: true, scale: kept(1) },
    { system: '857fe049', action: 'cast', event: 'projectile', delay: CAST_WINDUP_TICKS.zyra / 20 - 0.3, duration: 0.6, travelSeconds: 0.3, bone: ground, targetBone: ground, others: true, targetLimit: 2, optional: true, scale: kept(1) },
  ],
  // The shield plays its own life (up to the index cap) and ends with the rule's shield (CUE_RULE_STOPS). Arcs finish before the purple burst so the burst cannot evict the bubble. Hook missile and Q_cas stay out.
  blitzcrank: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.43200000127156574, duration: 1.5 },
    { system: 'fc783cba', action: 'cast', event: 'cast-start', delay: 0, duration: 10, bone: center },
  ],
  // R: muzzle flash, one spiked shell, then the burst and dust on the primary. Ricochet is a later event. The shell's damage
  // lands CAST_WINDUP_TICKS.tristana after the cast (cast-windup.ts): the shell is fired TRISTANA_SHELL_TRAVEL before that and
  // arrives with it, the muzzle flash with the firing (travel fitted, not original data).
  tristana: [
    { system: 'ed157b4e', action: 'attack', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', delay: 0.21541666984558105, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5154166698455811, duration: 1.5 },
    { system: '7d4c2d45', action: 'cast', event: 'cast-start', bone: 'Buffbone_Glb_Weapon_1', delay: CAST_WINDUP_TICKS.tristana / 20 - TRISTANA_SHELL_TRAVEL - 0.05, duration: 0.5 },
    { system: '98c2c347', action: 'cast', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', targetBone: chest, delay: CAST_WINDUP_TICKS.tristana / 20 - TRISTANA_SHELL_TRAVEL, duration: TRISTANA_SHELL_TRAVEL + 0.2, travelSeconds: TRISTANA_SHELL_TRAVEL, primary: true },
    { system: '5930ca7b', action: 'cast', event: 'hit', bone: chest, delay: CAST_WINDUP_TICKS.tristana / 20, duration: 0.8, primary: true },
    { system: 'fb4ea008', action: 'cast', event: 'hit', bone: ground, delay: CAST_WINDUP_TICKS.tristana / 20, duration: 0.7, primary: true },
  ],
  // R (Air Raid): the exported list without the comet (R_Bombardment_Mis) and its burst (R_Bombardment_Impact). The export
  // kept the comet as a cast-start with no bone, so it stood on Caitlyn's feet (11-03 castcmp review; #622 keyframes), and
  // it played one comet and one burst on the cast target at 1 s, while the rule drops TotalShots shots over RaidDuration,
  // each on a random enemy centre. Each shot now plays its own comet and burst where its damage lands (CUE_EXTRA_SKILLS
  // caitlyn-shot, driven by the shot's packetDamage events in batch1-events.ts).
  // Rumble's cast as exported, without its flight and explosion: both now come from his struck units and row cells
  // (CUE_EXTRA_SKILLS rumble-drop / rumble-strike, played by the renderer).
  rumble: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.36666666666666664, duration: 1.5 },
    { system: '59e2ab23', action: 'cast', event: 'cast-start', delay: 0, duration: 1.2, bone: 'BUFFBONE_CSTM_IGNITE' },
    { system: '5b8e7f02', action: 'cast', event: 'cast-start', delay: 0.1, duration: 1.2, bone: 'BUFFBONE_CSTM_IGNITE' },
    { system: '7562ce09', action: 'cast', event: 'cast-start', delay: 0.2, duration: 0.7, bone: 'BUFFBONE_CSTM_ROCKET' },
  ],
  caitlyn: [
    { system: '4ddee85c', action: 'attack', event: 'projectile', bone: 'Rifle_TopBarrel2', delay: 0.2833333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5833333333333333, duration: 1.5 },
    { system: '3a811b77', action: 'attack', event: 'cast-start', bone: 'Buffbone_Cstm_Rifle_Barrel_Loc', delay: 0.3333333333333333, duration: 1.5 },
    { system: 'ce2a567b', action: 'cast', event: 'cast-start', bone: 'Buffbone_Cstm_Rifle_Barrel_Loc', delay: 0, duration: 0.4 },
    { system: '4ecddce4', action: 'cast', event: 'cast-start', bone: 'Buffbone_Cstm_Rifle_Scope_Loc', delay: 0, duration: 0.5 },
    { system: 'a1ab2507', action: 'cast', event: 'hit', delay: 0.1, duration: 0.5 },
  ],
  // Ekko's list as exported, but his passive's burst 970252f2 plays until its own particles have all but gone (its petals,
  // sparks and glow outlasted the exported second): played to where the asset's own visible weight falls to almost nothing
  // (拟合，非原版数值, 11-24).
  ekko: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'Spine', delay: 0.26666666666666666, duration: 1.5 },
    { system: '006b32b1', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: 'C_Buffbone_Glb_Center_Loc' },
    { system: '5af49b76', action: 'cast', event: 'hit', delay: 0, duration: 0.5 },
    { system: '970252f2', action: 'cast', event: 'hit', delay: 0.6, duration: 1.57 },
    { system: 'dda9e01c', action: 'cast', event: 'hit', delay: 0.6, duration: 1 },
  ],
  // Q: the grenade keeps emitting after it arrives, so the lightning sits on each target. Crystal travel is smoke, not the yellow arc. Straight flight only.
  scar: [
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.2990000089009603, duration: 1.5 },
    { system: 'bef025dc', action: 'cast', event: 'projectile', delay: 0.1, duration: 0.9, travelSeconds: 0.25, bone: 'L_Hand', targetBone: chest, targetLimit: 3 },
    { system: 'd07052bc', action: 'cast', event: 'hit', delay: 0.4, duration: 0.55, bone: chest, targetLimit: 3 },
    { system: 'f4a6240a', action: 'cast', event: 'cast-start', delay: 1.1, duration: 1.1, bone: chest },
  ],
  // His cast: the hand glow and trail, his grasp played whole along the struck line (its pit and walls held off in
  // DISABLED_EMITTERS), its shockwave and flash on each enemy struck, and his aura. His empowered attacks carry the mace
  // glow and charge. Ult enter stays out.
  mordekaiser: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6, duration: 1.5 },
    // The swing his attack clip carries, with that clip (the one our renderer plays for his attacks), at its layout point;
    // the lowest, attack rank (Fable 11-19). Plain attacks only: his empowered attack clip carries the mace glow and charge
    // and no swing, so his empowered attacks (the empowered cues below) draw none.
    { system: '867941e7', action: 'attack', event: 'cast-start', delay: 16 / 30, duration: 0.8, bone: 'C_Buffbone_Glb_Layout_Loc' },
    { system: '5449dd85', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6, bone: 'Buffbone_Glb_Mace_Loc' },
    { system: '0a5d1c08', action: 'cast', event: 'cast-start', delay: 0.05, duration: 0.7, bone: 'Buffbone_Glb_Mace_Loc' },
    // His grasp: the claw, its swipes, the cracks and the closing burn play out along the line his cast strikes (the cast's
    // first target lies on it: the anchor aims there); its pit and walls are held off (DISABLED_EMITTERS). The skill's body.
    { system: 'a7c49a29', action: 'cast', event: 'cast-start', delay: 0.05, duration: 3.5, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    // The grasp's ground shockwave and its hit flash on each enemy his cast strikes.
    { system: '38c1db88', action: 'cast', event: 'hit', delay: 0.8, duration: 1.5 },
    { system: 'ed3f2170', action: 'cast', event: 'hit', delay: 0.8, duration: 1.5 },
    // His empowered attacks (batch1-events.ts: while his cast's empowered time runs) light and charge his mace, as his
    // empowered attack clip carries them (not his cast); decoration.
    { system: '21bee60f', action: 'attack', variant: 'empowered', event: 'cast-start', delay: 0, duration: 1, bone: 'Buffbone_Glb_Mace_Loc', rank: 'decorative' },
    { system: '04ae533c', action: 'attack', variant: 'empowered', event: 'cast-start', delay: 0, duration: 0.7, bone: 'Buffbone_Glb_Mace_Loc', rank: 'decorative' },
    // An empowered attack plays only the empowered cues (a play selects by variant), so it carries its own copy of the attack
    // hit: without it his empowered attacks would show no hit at all. One hit per attack, not two.
    { system: '0f2af66b', action: 'attack', variant: 'empowered', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6, duration: 1.5 },
    // His slam's red ground burst: once on each empowered attack's hit, on the ground at its main target, for the asset's own
    // time (ownLife); nothing held between hits (Fable 11-20, from the original's slams). The enemies the slam splashes get no
    // burst of their own. Its dark ground glow stays held off (DISABLED_EMITTERS).
    { system: '938c104f', action: 'attack', variant: 'empowered', event: 'hit', bone: 'BUFFBONE_GLB_GROUND_LOC', delay: 0.6, duration: 1.5, ownLife: true, primary: true },
  ],
  // The index list without Q_tar: her hit plays at her kick's damage event instead, by damage type (CUE_EXTRA_SKILLS camille-q-*).
  camille: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BuffBone_Glb_Center_Loc', delay: 0.3, duration: 1.5 },
    { system: 'b0db024b', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6, bone: 'R_Buffbone_Glb_Foot_Loc' },
    // Her heal (174f1125) plays as the kick's heal lands: the rules heal her by her kick's damage (CAMILLE_KICK_TICKS).
    { system: '174f1125', action: 'cast', event: 'cast-start', delay: CAMILLE_KICK_TICKS / 20, duration: 1, bone: 'C_Buffbone_Glb_Center_Loc' },
    { system: '14e5f3aa', action: 'cast', event: 'cast-start', delay: 0.1, duration: 0.6, bone: 'R_Buffbone_Glb_Foot_Loc' },
  ],
  // Sigil to the primary, then one rose and a chain to each enemy. Weapon ribbons stay out. The chain, the mark and the
  // empowered glow play their own life and end when the rule's chain does (CUE_END_STOPS 'leblanc-chain').
  leblanc: [
    { system: '9ad0dd7c', action: 'attack', event: 'projectile', bone: 'weapon_b', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5666666666666667, duration: 1.5 },
    // Her empowered attacks after a cast (batch1-events.ts LEBLANC_EMPOWERED_ATTACKS) fly her empowered missile, with the
    // plain attack's timing, bones and hit (Fable 11-21: the hit stays as it is for now).
    { system: '0ea87983', action: 'attack', variant: 'empowered', event: 'projectile', bone: 'weapon_b', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', variant: 'empowered', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5666666666666667, duration: 1.5 },
    { system: '93fe62de', action: 'cast', event: 'projectile', delay: 0.12, duration: 0.45, travelSeconds: 0.18, bone: 'BUFFBONE_CSTM_WEAPON_2', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'c54516b3', action: 'cast', event: 'hit', delay: 0.32, duration: 1, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    { system: 'ed58bcfc', action: 'cast', event: 'hit', delay: 0.55, duration: 7.55, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    { system: '898ab758', action: 'cast', event: 'hit', delay: 0.72, duration: 7.5, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    { system: '1b624dee', action: 'cast', event: 'hit', delay: 0.72, duration: 6.4, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    // The chain runs from her primary target to each other enemy it binds, chest to chest (its spell data's start and end
    // bones), never from her and never to the primary itself (11-25): played by the renderer with the primary as its source
    // ('passive', placeholder-renderer.ts), ended with her chain (LEBLANC_CHAIN_FROM_PRIMARY).
    { system: '29d01632', action: 'passive', event: 'link', delay: 0.78, duration: 5, bone: 'C_BUFFBONE_GLB_CHEST_LOC', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '4ea54e59', action: 'cast', event: 'hit', delay: 0.8, duration: 6.5, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    // Her channel glow and swirling petals at her weapon hand, held until the rules' chain ends (SUSTAIN_CAPS, CUE_END_STOPS
    // 'leblanc-chain'). The skill's body: it never yields (Fable 11-19).
    { system: 'acd84091', action: 'cast', event: 'cast-start', delay: 0, duration: 0.8, bone: 'BUFFBONE_GLB_WEAPON_1', rank: 'critical' },
    { system: '0a2eef95', action: 'cast', event: 'hit', delay: 0.85, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Cast keeps the green aura; every bolt is an empowered attack (batch1-events aims it at the enemies it pierced).
  // The cast event targets Twitch himself, so a cast-time bolt had nowhere to fly and failed the whole cast (11-13).
  // The weapon glow plays its own life and ends when the empowered bolts are spent (CUE_END_STOPS 'twitch-volley').
  twitch: [
    { action: 'attack', system: 'ba5fe1c0', event: 'projectile', delay: 0.25, duration: 0.3, travelSeconds: 0.3, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: 0.55, duration: 0.45, bone: 'C_BUFFBONE_GLB_CHEST_LOC', stopAfter: 0.1 },
    { action: 'cast', system: '54af463f', event: 'cast-start', delay: 0, duration: 0.5, stopAfter: 0.2, bone: 'Buffbone_Glb_Weapon_1' },
    { action: 'cast', system: '2beb0657', event: 'cast-start', delay: 0, duration: 4, stopAfter: 3.6, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'cast', system: '900dd2d2', event: 'cast-start', delay: 0, duration: 8, stopAfter: 7.6, fadeOut: true, bone: 'Buffbone_Glb_Weapon_1' },
    { action: 'attack', variant: 'empowered', system: '5938e29d', event: 'projectile', delay: 0.25, duration: 0.3, travelSeconds: 0.3, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', variant: 'empowered', system: '4e7cc3b1', event: 'hit', delay: 0.55, duration: 0.6, stopAfter: 0.1, fadeOut: true, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Attacks as exported. His cast keeps only its on-target hit; his heal ring plays from his heal events ('vladimir-heal').
  // An empty cast list would not do: the cast would fall back to the host's old effects (manifest actionEffects), which
  // are this same heal missile and heal ring.
  vladimir: [
    { system: 'ffa688fa', action: 'attack', event: 'projectile', bone: 'BUFFBONE_GLB_WEAPON_1', delay: 0.3, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6, duration: 1.5 },
    // His cast draws the thin red strands (Q_heal_mis 45b69079) between him and each enemy he strikes, as the original's
    // cast shows; it is no longer a heal missile onto the enemy (the heal ring plays on him, 'vladimir-heal'). Timings are
    // the old cue's. Which way the strands run (him to the enemy, as here, or back) is not verified against the original.
    { system: '45b69079', action: 'cast', event: 'projectile', delay: 0.45, duration: 0.95, travelSeconds: 0.35, bone: 'R_Buffbone_Glb_Hand_Loc', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC', targetLimit: 3 },
  ],
  // The purple disc plays under each empowered swing only: the original's cast shows no disc (11-15 review). His cast keeps
  // its buff (97366927); the cast's jump-slash light has no exported system yet.
  nocturne: [
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: 0.3, duration: 0.45, stopAfter: 0.1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'cast', system: '97366927', event: 'cast-start', delay: 0, duration: 6, stopAfter: 5.5, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    // The cleave disc and the strike on the target play their systems' whole own life (ownLife): only a rule event ends an
    // effect early, and nothing in the rules ends these (Fable 11-18, C71). The disc lies under Nocturne's feet.
    { action: 'attack', variant: 'empowered', system: '3e224f4a', event: 'cast-start', delay: 0.3, duration: 1, ownLife: true, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { action: 'attack', variant: 'empowered', system: '6fb6c5e5', event: 'hit', delay: 0.3, duration: 1, ownLife: true, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Ziggs's main bomb (Q_mis_01, 52963b0a) flies to the target and lands on the index's explosion (04c3cba0) at its index timing. The
  // engine draws it on a straight line, not the original's high lob; its release and flight time are fitted. It leaves his
  // weapon buff bone, as his attack does: the skeleton has no bone named `weapon`, which fell back to his feet (C71). The explosion is the
  // primary target's and plays its whole own life (its smoke clouds included, ownLife).
  ziggs: [
    { system: '7f403068', action: 'attack', event: 'projectile', bone: 'buffbone_glb_weapon_1', delay: 0.3333333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6333333333333333, duration: 1.5 },
    { system: '52963b0a', action: 'cast', event: 'projectile', bone: 'buffbone_glb_weapon_1', delay: ZIGGS_BOMB.release, duration: ZIGGS_BOMB.flight, travelSeconds: ZIGGS_BOMB.flight, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '04c3cba0', action: 'cast', event: 'hit', delay: ZIGGS_BOMB.lands, duration: 1.2, ownLife: true, primary: true },
    // His split bombs, one per bomb the rules sent (receipt targets after the first, repeats kept): each leaves the main
    // bomb's crater when it lands and arcs to its enemy (the same missile, 52963b0a), and bursts there (04c3cba0). The rules
    // still settle every bomb on the cast tick; the display times them off the main bomb's landing until the rules time them.
    // Bombs landing on one enemy together burst once there (mergeTicks): stacked copies of the burst at one spot added up
    // to a flat white block (11-20).
    { system: '52963b0a', action: 'cast', event: 'projectile', everyReceipt: true, fromPrimary: true, delay: ZIGGS_BOMB.lands, duration: ZIGGS_BOMB.split,
      travelSeconds: ZIGGS_BOMB.split, arc: ZIGGS_BOMB.arc, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC', optional: true },
    { system: '04c3cba0', action: 'cast', event: 'hit', everyReceipt: true, mergeTicks: 1, delay: ZIGGS_BOMB.lands + ZIGGS_BOMB.split, duration: 1.2, ownLife: true, optional: true },
  ],
  // Sett's slam (11-15): the cast plays his whole E_cas (f7d4d344, the exported cue's E_cas_child twice plus its ground
  // lines and ground planes) in the child's place, from the cast itself (fitted: lines its bright light up with the
  // original's). Two enemies keep the collision hit and dust on each; one enemy (variant 'single', batch1-events.ts) gets
  // the one-target slam E_tar_single_front (2794d903: the same hit, dust and ground planes as one system) instead. The
  // single slam's duration is the collision hit's; the other timings are the index's.
  sett: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CENTER_LOC', delay: 0.2990000089009603, duration: 1.5 },
    { system: 'f7d4d344', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '5c1a47f1', action: 'cast', event: 'hit', delay: 0.6, duration: 1 },
    { system: 'c6d42f70', action: 'cast', event: 'hit', delay: 0.6, duration: 1 },
    { system: 'f7d4d344', action: 'cast', variant: 'single', event: 'cast-start', delay: 0, duration: 0.6, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '2794d903', action: 'cast', variant: 'single', event: 'hit', delay: 0.6, duration: 1 },
  ],
  // Draven: his index list, plus his other hand's axe for every second empowered attack (variant empowered-alt, chosen in
  // batch1-events.ts), from his left hand, with the same hit.
  draven: [
    { action: 'attack', system: '617e850e', event: 'projectile', delay: .24, duration: .3, travelSeconds: .3, bone: 'R_hand', targetBone: chest },
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: .54, duration: .45, bone: chest, stopAfter: .1 },
    { action: 'cast', system: '3381c8eb', event: 'cast-start', delay: 0, duration: .6, stopAfter: .2, bone: 'R_Weapon' },
    { action: 'cast', system: 'd86cc9bc', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: 'L_Weapon' },
    { action: 'attack', variant: 'empowered', system: DRAVEN_AXE, event: 'projectile', delay: .24, duration: .3, travelSeconds: .3, bone: 'R_hand', targetBone: chest },
    { action: 'attack', variant: 'empowered', system: '5e3986cd', event: 'hit', delay: .54, duration: .6, stopAfter: .1, bone: chest },
    { action: 'attack', variant: 'empowered-alt', system: '5a268f4e', event: 'projectile', delay: .24, duration: .3, travelSeconds: .3, bone: 'L_hand', targetBone: chest },
    { action: 'attack', variant: 'empowered-alt', system: '5e3986cd', event: 'hit', delay: .54, duration: .6, stopAfter: .1, bone: chest },
  ],
  // Maddie: her volley's shots and hits moved from one estimated time after her cast to each shot's damage (maddie-shot).
  // Her attack shot leaves her rifle's Weapon_Shooter, as her volley's do: her skeleton has no C_Barrel_Root, which fell back
  // to her feet (11-18 cue bone scan).
  maddie: [
    { system: 'ec4a03aa', action: 'attack', event: 'projectile', bone: 'Weapon_Shooter', delay: 0.23333333333333334, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5333333333333333, duration: 1.5 },
  ],
  // Smeech: his swings, their hit and his leap's trail moved from his cast (which names no target) to his stabs' damage
  // (CUE_EXTRA_SKILLS smeech-stab, smeech-leap); his cast keeps the launch and the trail on him.
  smeech: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.30833333333333335, duration: 1.5 },
    // The horizontal swing his attack clip carries, with that clip (the one our renderer plays for his attacks), at its
    // layout point: decoration at the attack rank (Fable 11-19).
    { system: '343e410d', action: 'attack', event: 'cast-start', delay: 8 / 30, duration: 0.7, bone: 'C_Buffbone_Glb_Layout_Loc' },
    { system: '17b8eb5c', action: 'cast', event: 'cast-start', delay: 0, duration: 0.7, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '5cde9f59', action: 'cast', event: 'cast-start', delay: 0.2, duration: 1, bone: 'C_Buffbone_Glb_Chest_Loc' },
  ],
  // Powder: the target burst and explosion moved from fixed times after her cast to her blast's damage (CUE_EXTRA_SKILLS powder-blast).
  powder: [
    { system: '01873936', action: 'attack', event: 'projectile', bone: 'R_hand', delay: 0.25, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CENTER_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CENTER_LOC', delay: 0.55, duration: 1.5 },
  ],
  // Q: the missile e0afe94c flies to the primary; when it lands (its delay plus travelSeconds), Q_tar bd903b08 bursts on the
  // primary and Q_Explosion fd5fd6cc on every enemy hit. Both have system files in the asset root now.
  urgot: [
    { system: 'e0afe94c', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.85, travelSeconds: 0.25, bone: 'LowerBarrel', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'bd903b08', action: 'cast', event: 'hit', delay: 0.45, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    { system: 'fd5fd6cc', action: 'cast', event: 'hit', delay: 0.45, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '5a18496c', action: 'attack', event: 'projectile', bone: 'UpperBarrel', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CENTER_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CENTER_LOC', delay: 0.5666666666666667, duration: 1.5 },
  ],
  // Ambessa: her exported list, with her chain-stance swipe (3b4c15e0) on the unit instead of her weapon locator. The
  // swipe is a half-disc of meshes drawn around its anchor toward the cast's target; on the weapon locator it turned with
  // the weapon and flew off over her head (11-25 review against the 3-star original). On the unit it faces her primary
  // target and sits on her. Its start is earlier than the export's estimate (AMBESSA_CHAIN_SWIPE_DELAY). The export's bones
  // and delays elsewhere are kept; CUE_BRANCHES still tags chain and fist.
  ambessa: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.21666666666666667, duration: 1.5 },
    { system: '754b6c78', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6, bone: 'C_Buffbone_Glb_Chest_Loc' },
    { system: 'a429a900', action: 'cast', event: 'cast-start', delay: 0.2, duration: 0.6, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '6390530e', action: 'cast', event: 'cast-start', delay: 0.4, duration: 0.7, bone: 'Buffbone_Glb_Weapon_1' },
    { system: 'cba05b6e', action: 'cast', event: 'hit', delay: 0.8, duration: 1 },
    { system: '3b4c15e0', action: 'cast', event: 'cast-start', delay: AMBESSA_CHAIN_SWIPE_DELAY, duration: 0.7 },
    { system: '8a64f4dd', action: 'cast', event: 'hit', delay: 0.6, duration: 0.7 },
  ],
  // The spell is a hand comet plus one primary splash. The third cast also splashes the next two receipt targets. There is
  // no separate hand-glow system. Her bolt's hit lands on the primary target every cast, when the comet does. Her unplayed
  // ground system stays out (purpose unverified, see tests/fixtures/cue-dropped-systems.ts).
  cassiopeia: [
    { system: '714bd6e8', action: 'attack', event: 'projectile', bone: 'L_Hand', delay: 0.31666666666666665, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6166666666666667, duration: 1.5 },
    { system: '9f19f946', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, travelSeconds: 0.4, bone: 'C_buffbone_Glb_Chest_Loc', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    // Branch from the rule's cast event (combat-g2-3.ts): `single` hits the primary target, `splash` every third cast.
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true, branch: 'single' },
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', branch: 'splash', targetLimit: 3 },
    { system: '259c4cbc', action: 'cast', event: 'hit', delay: 0.6, duration: 1, ownLife: true, bone: 'C_BUFFBONE_GLB_CENTER_LOC', primary: true },
  ],
  // E: run/dash dust on self, fast shuriken, gold hit ~0.3s, mark on primary, blue dash hit ~1.1s (no back-dash motion in harness).
  akali: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BuffBone_Glb_Center_Loc', delay: 0.32000001271565753, duration: 1.5 },
    { system: 'd900f5b3', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '76f80db8', action: 'cast', event: 'projectile', delay: 0.12, duration: 0.35, travelSeconds: 0.15, bone: 'Buffbone_Glb_Weapon_1', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '838f31e4', action: 'cast', event: 'hit', delay: 0.28, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    // Her mark on the primary target, held until the rules' exposure on it ends (SUSTAIN_CAPS: AKALI_MARK_SECONDS).
    { system: 'bc4a9e0d', action: 'cast', event: 'hit', delay: AKALI_MARK_DELAY, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    { system: '1edf4c0e', action: 'cast', event: 'cast-start', delay: 0.85, duration: 0.6, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: 'd7cede72', action: 'cast', event: 'hit', delay: 1.1, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
  ],
  // The gate (11-21): its portal (10e4e326) opens at the two ends of the line of cells the rules' cast names
  // (CastReceipt.area), facing each other, from the renderer (placeholder-renderer.ts, CUE_EXTRA_SKILLS malzahar-gate);
  // nothing flies from him to it (Windows review 11-21: the gate appears on the ground straight away), so its bolt system
  // (7d0f4b1e) is not played. Then the spell ring on targets and the infection, as before.
  // The E mark (88a717e0, looping emitters) ends when the target's shred does (CUE_RULE_STOPS); its duration is only a cap.
  malzahar: [
    { system: '3c65ee71', action: 'attack', event: 'projectile', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.8666666666666667, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 1.1666666666666667, duration: 1.5 },
    { system: '6d06c644', action: 'cast', event: 'cast-start', delay: 0, duration: 0.4, bone: 'R_hand' },
    { system: 'a3390cb7', action: 'cast', event: 'hit', delay: 0.35, duration: 0.8, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { system: '88a717e0', action: 'cast', event: 'hit', delay: 0.8, duration: 6, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'd5de11de', action: 'cast', event: 'hit', delay: 1, duration: 2.7, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Q_tar and the final slam's Impact / Tar play from Renni's grab and slam events (batch1-events.ts, CUE_EXTRA_SKILLS
  // renni-*): her cast names no targets.
  renni: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.3, duration: 1.5 },
    { system: 'da33678c', action: 'cast', event: 'cast-start', bone: 'L_Rotor', delay: 0, duration: 2.2 },
  ],
  // The attack hit is the exported list's own cue, unchanged (an override replaces the whole list).
  // W: Singed's flask flies from his left hand to the target's head attach point along a gravity arc; when he is his own
  // target it still flies (selfFlight). Its release time is a fitted display value. When it lands, the target gets
  // W_Ally_Activate, W_Ally_Buf and W_Buff_Avatar2 and Singed gets W_Self_Buff: their delay is the release plus the flight.
  // All of it fades out over SOFT_STOP_SECONDS when his damage reduction ends for any reason or he dies (batch1-events.ts);
  // the durations are only upper bounds, the fade is what ends them.
  singed: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.4881666819254557, duration: 1.5 },
    { system: '4fb68964', action: 'cast', event: 'projectile', bone: 'L_Hand', targetBone: 'C_BUFFBONE_GLB_HEAD_LOC', delay: SINGED_FLASK_RELEASE, duration: 0.6, travelSeconds: SINGED_FLASK_FLIGHT, arc: { gravity: 10000, targetOffset: 150 }, selfFlight: true },
    { system: '2639dd7d', action: 'cast', event: 'hit', bone: ground, delay: SINGED_FLASK_LANDS, duration: 2.5 },
    { system: '6e34a4e1', action: 'cast', event: 'hit', bone: ground, delay: SINGED_FLASK_LANDS, duration: 5 },
    { system: '58f996d2', action: 'cast', event: 'hit', bone: chest, delay: SINGED_FLASK_LANDS, duration: 4.2 },
    { system: 'db0f8e0d', action: 'cast', event: 'cast-start', bone: ground, delay: SINGED_FLASK_LANDS, duration: 10 },
  ],
  // R: in 14.24 the gas cloud lasts its whole damage window, then detonates (11-06 field review: ours burst early, white and
  // too wide). The burst and each target's splash wait for the cloud's end.
  nunu: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.48566665649414065, duration: 1.5 },
    // The channel's pool keeps its fitted size (fitted, not original: 2a4dfaba playtest, pale green over most of the screen
    // at full size; 11-16 review: at the default size its outer ring grew a ring too wide). It keeps emitting until the
    // blast starts: stopping at 2.8 s left the board empty for 0.2 s before the blast (clean4 frames 58-61).
    // Wind-up batch 2: the blast now lands NUNU_SECOND_AFTER_PULSE_TICKS (9) after his last tick, at 3.45 s, so the pool keeps
    // emitting to then (fitted, not original data).
    { system: '78d04f27', action: 'cast', event: 'cast-start', delay: 0, duration: 3.75, stopAfter: 3.5, bone: 'Spine2_Wil', scale: kept(0.43), main: true },
    // The blast itself plays with the blast's damage (CUE_EXTRA_SKILLS 'nunu-blast', batch1-events.ts), not at a fixed time.
    // The hit splash on each enemy is not here: the cast receipt names no targets, so it plays from the blast's damage instead
    // (CUE_EXTRA_SKILLS 'nunu-blast-hit', batch1-events.ts).
  ],
  // W then Q, as 14.24 plays it: the orb flies to the primary and its ring bursts there, then the shot lands on it.
  // The exported list fired both missiles with no target bone and every ring on every recipient (one heap by Ezreal).
  ezreal: [
    { system: 'bdceb760', action: 'attack', event: 'projectile', bone: 'L_hand', delay: 0.31666666666666665, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.6166666666666667, duration: 1.5 },
    { system: '11416b6c', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: 'Cstm_Buffbone_Cast_FX' },
    // At its end its trail plays out (PLAY_OUT_AT_DEADLINE) instead of being cut while still thick (11-19 evidence).
    { system: '9cb99eb2', action: 'cast', event: 'projectile', delay: 0.05, duration: 0.4, travelSeconds: 0.25, bone: 'Cstm_Buffbone_Cast_FX', targetBone: chest, playOut: PLAY_OUT_AT_DEADLINE },
    { system: 'd887e7a6', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true },
    { system: '79219c1e', action: 'cast', event: 'hit', delay: 0.3, duration: 0.8, bone: chest, targetLimit: 3 },
    { system: 'bc884cd6', action: 'cast', event: 'cast-start', delay: 0.7, duration: 0.5, bone: 'Cstm_Buffbone_Cast_FX' },
    { system: 'd7fee2d8', action: 'cast', event: 'projectile', delay: 0.75, duration: 0.45, travelSeconds: 0.2, bone: 'Cstm_Buffbone_Cast_FX', targetBone: chest },
    { system: 'e4979a04', action: 'cast', event: 'hit', delay: 0.95, duration: 0.8, bone: chest, primary: true },
  ],
  // Q: exported cues, with the hit spark optional: a spin with nobody adjacent, or one that kills its targets, still shows
  // the ring, the spin and the heal (11-06 field: both casts refused and fell back to the plain charge ring).
  darius: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.36666666666666664, duration: 1.5 },
    { system: 'a7efa545', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6, bone: 'Buffbone_Glb_Ground_Loc' },
    // Its five emitters already wait most of a second before their first particle; a 0.6 s cue delay on top pushed the blade
    // ring to the very end of the cue (11-08 audit). The original shows it with the swing and fades it soon after.
    { system: '97f3e391', action: 'cast', event: 'cast-start', delay: 0, duration: 1.2, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: 'a5373796', action: 'cast', event: 'hit', delay: 0.6, duration: 0.6, optional: true },
    { system: 'd2b2862d', action: 'cast', event: 'cast-start', delay: 0.7, duration: 1, bone: 'C_Buffbone_Glb_Center_Loc' },
  ],
  // Leona: the asset index bakes an older list, the same systems with her end burst cut short and no burst at the cast;
  // batch1-timelines.ts holds the reviewed one, used whole.
  leona: BATCH1_TIMELINES.leona,
  // The batch-1 list, with the shield bubble at the size that wraps her shoulders (1.3 cells at the 0.44 base; 0.83 at the
  // arena scale sank into her chest, pr572-report 11-09 14:35, and 1.3 again in pr580-report).
  // It wraps her body, so it shrinks with the body (fx-size.ts measuredOnBody).
  // The bubble is a state its target carries: it is not drawn where a dead ally stood (livingTarget).
  // Its end fades from its stop (fadeOut) instead of cutting there, as the other shields that end with their layer do: a broken
  // shield ends it earlier (CUE_RULE_STOPS abilityShieldEndedOnHolder).
  lux: BATCH1_TIMELINES.lux.map(cue => cue.system === '44c9516a' ? { ...cue, scale: hugged(1), fadeOut: true, ...(cue.event === 'hit' ? { livingTarget: true } : {}) } : cue),
  // W: the guard holds until the shield runs out, and the swipe lands then (11-06 field). Both follow her shield's own end
  // (batch1-events.ts: shieldLayerChanged depleted or expired, an expiry being an event too), not fixed times: the stance
  // plays from the cast and is stopped where the shield ends; the swipe is 'irelia-swipe' (CUE_EXTRA_SKILLS), played at that
  // end. IRELIA_STANCE_FALLBACK_SECONDS only bounds a stance whose end event never comes. The original stance goes almost
  // at once at its end (11-08 blind recheck).
  irelia: [
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.3333333333333333, duration: 1.5 },
    { system: '67665513', action: 'cast', event: 'cast-start', delay: 0, duration: IRELIA_STANCE_FALLBACK_SECONDS, bone: 'C_Buffbone_Glb_Center_Loc' },
  ],
  // Q: the curse rides the target for its 8 pulses (11-06 field review: gone within a second).
  morgana: [
    { system: 'cbd8e1cc', action: 'attack', event: 'projectile', bone: 'R_hand', delay: 0.23333333333333334, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5333333333333333, duration: 1.5 },
    { system: '809dc7ac', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.6, travelSeconds: 0.4, bone: 'Buffbone_Glb_Weapon_1', targetBone: chest },
    { system: '9d79232b', action: 'cast', event: 'hit', delay: 0.6, duration: 1.5, primary: true },
    // The curse rides its target: it is not drawn where a dead target stood (livingTarget).
    { system: '7fb1a74c', action: 'cast', event: 'hit', delay: 0.6, duration: 8.4, stopAfter: 7.4, primary: true, livingTarget: true },
  ],
  // The export carries Renata's attack only, so every cast fell back to the procedural shot (11-06 field: 4/4 no-cues).
  // Order and timing follow the system names and the handwritten shot: canisters fire, the missile flies 0.3–0.9 s,
  // then the blast pool on the primary and a hit on each enemy struck. The ally shield stays on its own receipt path.
  renata: [
    { system: '06e90178', action: 'attack', event: 'projectile', bone: 'Muzzle', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BuffBone_Glb_Center_Loc' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BuffBone_Glb_Center_Loc', delay: 0.5666666666666667, duration: 1.5 },
    // The canisters' own launch puffs only: their missiles fly on in a straight line, so past E_Mis's start one crossed the
    // whole screen (11-07 field). The flight itself is E_Mis.
    { system: 'cff69d8a', action: 'cast', event: 'cast-start', delay: 0, duration: 0.35, bone: 'C_Canister' },
    // Wind-up batch 3: the missiles' damage lands CAST_WINDUP_TICKS.renata after the cast; the missile flies its 0.6 s to arrive
    // then, and the blast pool and hits play on its arrival (fitted, not original data).
    { system: 'faf1aeac', action: 'cast', event: 'projectile', delay: CAST_WINDUP_TICKS.renata / 20 - 0.6, duration: 0.9, travelSeconds: 0.6, bone: 'C_Canister', targetBone: chest },
    { system: 'f9926ae8', action: 'cast', event: 'hit', delay: CAST_WINDUP_TICKS.renata / 20, duration: 2, bone: ground, primary: true },
    { system: 'd5579768', action: 'cast', event: 'hit', delay: CAST_WINDUP_TICKS.renata / 20, duration: 1, bone: chest, targetLimit: 3, optional: true },
    // E_Shield on each ally the missiles shield, for the ability's 3 s ShieldDuration. Played by the renderer on the
    // shield receipt with that ally as the source ('passive': it is not the caster's cast timeline). A hit on the ally
    // itself, so a full board keeps it like other receipt feedback instead of dropping it as a flourish (#546 review).
    { system: 'fdf79734', action: 'passive', event: 'hit', delay: 0, duration: 3, stopAfter: 2.7, fadeOut: true, bone: chest },
  ],
  // 弹道从下面写的骨骼出发（选骨骼看我们模型上的出手位置）
  corki: [
    { system: '4f6da7bc', action: 'attack', event: 'projectile', bone: 'gun', delay: 0.13999999364217122, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BuffBone_Glb_Center_Loc' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BuffBone_Glb_Center_Loc', delay: 0.43999999364217124, duration: 1.5 },
    { system: 'ee7fccd1', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, bone: 'R_missile_b', travelSeconds: 0.7 },
    { system: '444c30d5', action: 'cast', event: 'hit', delay: 0.8, duration: 1 },
    // 022fe9ec 换过别的出手骨骼，在我们模型上位于机尾下方、复录更偏，所以保留 L_missile
    { system: '022fe9ec', action: 'cast', event: 'projectile', delay: 0.3, duration: 0.7, bone: 'L_missile', travelSeconds: 0.7 },
    { system: '0e89bea0', action: 'cast', event: 'hit', delay: 0.9, duration: 1 },
    { system: '4f440b84', action: 'cast', event: 'hit', delay: 0.9, duration: 1 },
  ],
  // 弹道从下面写的骨骼出发（选骨骼看我们模型上的出手位置）
  gangplank: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.3, duration: 1.5 },
    { system: '00c3621b', action: 'cast', event: 'hit', delay: 0, duration: 1 },
    { system: '80ab2d1b', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, bone: 'r_hand', travelSeconds: 0.7 },
    // Ground-fire line: in the original a line missile cast at a location, with no start bone and not following its target
    // (14.24 spell data), whose scorch lies flat on the ground through the target. Played on the floor along the way from
    // Gangplank to the target, starting a little behind him (TimelineCue.lineCells, lineBack); it flew from his weapon bone
    // to the target's feet before and its scorch hid under both bodies (11-13 A/B/C keyframes). GP_GROUND_LINE_CELLS and
    // GP_GROUND_LINE_BACK are FITS, not the original's values.
    { system: '20cd67dc', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, travelSeconds: 0.7, lineCells: GP_GROUND_LINE_CELLS, lineBack: GP_GROUND_LINE_BACK },
    { system: 'cf147eda', action: 'cast', event: 'hit', delay: 0.8, duration: 0.8 },
    { system: '2a495226', action: 'cast', event: 'hit', delay: 0.9, duration: 1 },
    { system: '8da84aa4', action: 'cast', event: 'hit', delay: 0.9, duration: 1.5 },
    { system: '5d21d7bb', action: 'cast', event: 'hit', delay: 0.8, duration: 0.8 },
    { system: 'f9ead72c', action: 'cast', event: 'cast-start', delay: 0.6, duration: 1, bone: 'C_Buffbone_Glb_Chest_Loc' },
  ],
  // 弹道从下面写的骨骼出发（选骨骼看我们模型上的出手位置）
  nami: [
    { system: '952026ec', action: 'attack', event: 'projectile', bone: 'L_Buffbone_Glb_Hand_Loc', delay: 0.2833333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5833333333333333, duration: 1.5 },
    { system: 'e4b6f1a3', action: 'cast', event: 'cast-start', delay: 0, duration: 0.8, bone: 'Weapon' },
    // At its end it plays out (PLAY_OUT_AT_DEADLINE) instead of being cut while still thick (11-19 evidence).
    { system: 'a64f66ee', action: 'cast', event: 'projectile', delay: 0.3, duration: 1, bone: 'L_Buffbone_Glb_Hand_Loc', travelSeconds: 1, playOut: PLAY_OUT_AT_DEADLINE },
    { system: '95bbab3d', action: 'cast', event: 'hit', delay: 0.8, duration: 1.5 },
    { system: '03b4d6ac', action: 'cast', event: 'hit', delay: 0.8, duration: 1.5 },
  ],
  // The asset root's exported list is S13_TIMELINES.vi as of 10-27 plus its attack hit (copied unchanged from the
  // export); this replaces it so the landing play-out (s13-timelines.ts) reaches the live board without an asset rebuild.
  // 11-21 (Fable): her landing group (VI_SLAM_SYSTEMS) plays when the rules' slam lands (CUE_EXTRA_SKILLS 'vi-slam',
  // batch2-bridge.ts), not at the export's landing frame; her right hand's trail stops there too, so it holds no fixed stop.
  vi: [
    ...S13_TIMELINES.vi.filter(cue => !VI_SLAM_SYSTEMS.includes(cue.system))
      .map(cue => cue.system === VI_HAND_TRAIL ? { ...cue, stopAfter: undefined, fadeOut: undefined } : cue),
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.26666666666666666, duration: 1.5 },
  ],
  // #627 (11-12): these batch-2 lists are the repository tables themselves, so a cue edit (here: basic-attack hits and
  // missiles on the target's chest, the bone their attacks name for a hit) plays from code without rebuilding the asset index.
  // The asset root's vfx-ltk/batch2/tft13_*/index.json keeps the older copy; it is not hand-edited.
  jinx: jinxSkills.jinx,
  'jayce-front': jayceSkills['jayce-front'],
  'jayce-back': jayceSkills['jayce-back'],
  'jayce-forge-front': jayceSkills['jayce-forge-front'],
  mel: melSkills.mel,
  'mel-third': melSkills['mel-third'],
  'mel-shield': melSkills['mel-shield'],
  sevika: sevikaSkills.sevika,
  // Her slot machine and its result layers over her bar (champions/sevika.ts SLOT_BONE, 11-25), from code likewise: the
  // asset index's copy stands them on her feet.
  ...Object.fromEntries(Object.entries(sevikaSkills).filter(([key]) => key.startsWith('sevika-slots'))),
  viktor: viktorSkills.viktor,
  warwick: warwickSkills.warwick,
  // Exported to the asset index (0c59) and repeated as exported, but for the cast's W_Mis rocket and W_Tar hit: one each
  // per rule strike (perStrike), staggered by HEIMER_ROCKETS and each flying its own side-then-in curve to its own target,
  // where the export flew one rocket to the first target and hit every target at once (the original footage, Aub1UkT6uYM,
  // shows many rockets in the air at once). The rockets are body rank (Fable 11-19). Curve sizes are designed, not traced
  // from the original.
  heimerdinger: [
    { system: '9ad2672c', action: 'attack', event: 'projectile', bone: 'R_hand', delay: 0.20078125, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.50078125, duration: 1.5 },
    { system: 'c44d51d0', action: 'cast', event: 'cast-start', delay: 0, duration: 0.3, bone: 'C_Buffbone_Cstm_Rocket' },
    { system: 'c8d6ee2e', action: 'cast', event: 'projectile', delay: HEIMER_ROCKETS.launchTicks * 0.05, duration: HEIMER_ROCKETS.flightTicks * 0.05,
      bone: 'C_Buffbone_Cstm_Rocket', travelSeconds: HEIMER_ROCKETS.flightTicks * 0.05, rank: 'body', scale: HEIMER_ROCKETS.rocketScale,
      brightness: HEIMER_ROCKETS.rocketBrightness,
      perStrike: { staggerTicks: HEIMER_ROCKETS.staggerTicks, spreadTicks: HEIMER_ROCKETS.spreadTicks, fan: { side: 0.9, lift: 0.6 },
        shown: HEIMER_ROCKETS.shown, tickCap: HEIMER_ROCKETS.tickCap } },
    { system: '07c9833a', action: 'cast', event: 'hit', delay: (HEIMER_ROCKETS.launchTicks + HEIMER_ROCKETS.flightTicks) * 0.05, duration: 1,
      rank: 'decorative', perStrike: { staggerTicks: HEIMER_ROCKETS.staggerTicks, spreadTicks: HEIMER_ROCKETS.spreadTicks,
        shown: HEIMER_ROCKETS.shown, tickCap: HEIMER_ROCKETS.hitTickCap }, mergeTicks: HEIMER_ROCKETS.hitMergeTicks },
  ],
  // Exported to the asset index; repeated here so the R heal plays its own life (up to the index cap) and ends
  // with the heal (CUE_END_STOPS).
  drmundo: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.3231666564941406, duration: 1.5 },
    { system: '5443cd9f', action: 'cast', event: 'cast-start', delay: 0, duration: 9.25, bone: 'C_Buffbone_Glb_Chest_Loc' },
    { system: '4caada37', action: 'cast', event: 'cast-start', delay: 0.3, duration: 10, bone: 'C_Buffbone_Glb_Center_Loc' },
  ],
  // Exported to the asset index; repeated here so the Q brace plays its own life and ends with the brace (CUE_END_STOPS).
  vander: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.3, duration: 1.5 },
    { system: '68e8ca37', action: 'cast', event: 'cast-start', delay: 0, duration: 4.12, bone: 'C_Buffbone_Glb_Center_Loc' },
    { system: '3ecf22e8', action: 'cast', event: 'hit', delay: 0.4, duration: 1 },
  ],
};

/**
 * Which rule branch each cast system belongs to, by champion and system. Tags only: the exported timing stays as it is.
 * A tagged cue plays only when the cast event names its branch (TimelineCue.branch), so one cast no longer plays every
 * branch's effects at once. Untagged cues play on every cast. Applied only when every tagged system is in the list.
 */
export const CUE_BRANCHES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // Ambessa: odd casts chain (Q: the chain swipe and its hit), even casts fist (R: dash, ground, weapon and slam hit).
  // Rule side: combat-g2-2.ts writes the branch (PR #623); the 11-11 live index played all six on every cast.
  ambessa: { '3b4c15e0': 'chain', '8a64f4dd': 'chain', '754b6c78': 'fist', 'a429a900': 'fist', '6390530e': 'fist', 'cba05b6e': 'fist' },
  // Jinx W/E/R (combat writes zap/chompers/rocket). The live batch-2 index was staged from the old jinx.ts and still tags
  // these cues with the dropped `phase` 0/1/2 instead of a branch, so without these tags every cast played all three
  // (11-12 #629 Windows run). Same systems as champions/jinx.ts.
  // Since 11-21 her rocket's flash, flight and explosion play from the rules' events (their own display branches), so her
  // cast list tags only what plays with the cast.
  jinx: { a6a2b1cc: 'zap', '3496e112': 'zap', '10fede7e': 'zap', '40140250': 'zap', '9bd80364': 'chompers', cd05488e: 'chompers', '7e6f06b5': 'rocket' },
};
/** `cues` with their CUE_BRANCHES tags, when every tagged system is among the champion's cast cues; else undefined. */
export function withCueBranches(champion: string, cues: readonly TimelineCue[] | undefined): readonly TimelineCue[] | undefined {
  const tags = Object.hasOwn(CUE_BRANCHES, champion) ? CUE_BRANCHES[champion] : undefined;
  if (!tags || !cues) return undefined;
  const cast = new Set(cues.filter(cue => (cue.action ?? 'cast') === 'cast').map(cue => cue.system));
  if (!Object.keys(tags).every(system => cast.has(system))) return undefined;
  return cues.map(cue => (cue.action ?? 'cast') === 'cast' && Object.hasOwn(tags, cue.system) ? { ...cue, branch: tags[cue.system] } : cue);
}

/** The override for `champion` when every system it names is present in `systems`. */
export function cueOverride(champion: string, systems: Readonly<Record<string, string>>): readonly TimelineCue[] | undefined {
  const cues = Object.hasOwn(CUE_OVERRIDES, champion) ? CUE_OVERRIDES[champion] : undefined;
  if (!cues?.length) return undefined;
  const missing = cues.filter(cue => !Object.hasOwn(systems, cue.system)).map(cue => cue.system);
  noteOverride(champion, missing);
  return missing.length ? undefined : cues;
}
/**
 * Dev builds only: which overrides applied and which were skipped for a missing system (warned once per key), kept on
 * `globalThis.__vfxCueOverrides` so a capture can prove an override reached the page (#627). Production does nothing.
 */
function noteOverride(key: string, missing: readonly string[]): void {
  if (!import.meta.env?.DEV) return;
  const log = ((globalThis as { __vfxCueOverrides?: { applied: string[]; skipped: Record<string, string[]> } }).__vfxCueOverrides ??= { applied: [], skipped: {} });
  if (!missing.length) { if (!log.applied.includes(key)) log.applied.push(key); return; }
  if (log.skipped[key]) return;
  log.skipped[key] = [...missing];
  console.warn(`[vfx-ltk] cue override '${key}' skipped: system(s) ${missing.join(', ')} not in the loaded index`);
}

/**
 * Cues added to a champion's list (exported or replaced above), each only when its system is in the loaded index.
 * For a layer the export never cued, where copying the champion's whole list into CUE_OVERRIDES would freeze the rest.
 * Times count from the mana bar emptying (0); each is a fitted display time, not original data.
 */
export const CUE_ADDITIONS: Readonly<Record<string, readonly TimelineCue[]>> = {
  // Kog'Maw: every basic attack carries his skill's extra magic packet, whose hit (633e1b82) already plays as the attack
  // lands. Its flight now plays too: it leaves with the attack's own projectile, from his jaw, and lands with it, so it
  // arrives on that hit. Times are the attack's (fitted display times, not original data).
  kogmaw: [
    { system: 'b9318ef6', action: 'attack', event: 'projectile', delay: .25, duration: .3, travelSeconds: .3, bone: 'Jaw', targetBone: chest },
  ],
  // R_Energy_Avatar: the red body glow of her cast, a short flash that turns orange and fades. The delay is fitted to a
  // 3-star original side by side (Ambessa thread, 11-11), our fit. No rule event ends it: it plays to its system's own end (11-15).
  ambessa: [
    { system: 'c07aa972', action: 'cast', event: 'cast-start', delay: 0.05, duration: 1, bone: chest },
  ],
  // R_Aura: the dark red body and red inner edge (Avatar_BodyMult, Avatar_BodyFresnel_In1) through his empowered stretch.
  // The original keeps it for about as long as the empower lasts (sweep thread side by side, 11-11). Our rule holds the
  // empower for EmpowerDuration, so the layer runs that long and fades over its last half second (our fit). A recast refreshes the
  // empower, so it refreshes the layer rather than stacking a second (refresh).
  mordekaiser: [
    { system: '3292fe09', action: 'cast', event: 'cast-start', delay: 0, duration: 10, stopAfter: 9.5, fadeOut: true, bone: chest, refresh: true },
  ],
};
export function cueAdditions(champion: string, systems: Readonly<Record<string, string>>): readonly TimelineCue[] {
  return (Object.hasOwn(CUE_ADDITIONS, champion) ? CUE_ADDITIONS[champion] : []).filter(cue => Object.hasOwn(systems, cue.system));
}

/**
 * Projectile systems whose beams keep flying with the system instead of being pinned between caster and target
 * (runtime beamSplit), each with why. The pin is the default for every projectile beam (Fable 11-13).
 * - 7029bc3c Sevika's chomp: its beam is a streamed mesh rope that may belong to the flying head rather than to her;
 *   held at its old behaviour until it is checked against the original.
 * - 92d79254 Jayce's back-form forge: it plays only when his cast buffs an ally, which no recording setup can stage yet;
 *   it cannot be checked on screen, so it is not changed for now (Fable 11-13).
 * - 4f2eb343 Mel's third cast: before and after show no difference that can be judged on screen, so it is not changed
 *   (Fable 11-13).
 */
export const UNPINNED_BEAM_SYSTEMS: Readonly<Record<string, string>> = {
  '7029bc3c': 'streamed rope, not checked against the original',
  '92d79254': 'cannot be recorded to check, not changed for now',
  '4f2eb343': 'no difference that can be checked on screen, not changed',
};

/**
 * Emitters of a system left undrawn, by emitter name: an emitter meant to flash once at the cast that glares for the
 * whole of a stretched cue, or one measured to draw wrong on the board and held back until it is checked.
 */
export const MUTED_EMITTERS: Readonly<Record<string, readonly string[]>> = {
  // Nunu R_Cas runs for the 3 s channel (authored far shorter). Its two white ground flashes kept a radial glare in the middle
  // of the pool the whole time; in 14.24 the channel is a dim green mist and only the blast (R_full_explo) flares
  // (11-07 field batches f544/c4a).
  '78d04f27': ['Explosion_Flash_ground', 'Explosion_Flash_ground1'],
  // Sevika punch hit: BUBBLE_START1 is an attached-mesh emitter (draws the host's own skinned mesh) yet carries the
  // bubble mesh's large birth scale, the only attached-mesh emitter of Set 13 with a mesh name or a birth scale that big. On
  // the struck unit it drew a 4–12× purple copy of that unit for 0.2 s over the board (11-10 a96aac47 recording).
  '95fb90ce': ['BUBBLE_START1'],
  // TEMPORARY departure from the data (Fable 11-18): the shared crit flash's two dark backing layers (alpha-blended dark grey
  // and dark red) are authored to scale with the struck unit's size (scaleBirthScaleByBoundObjectSize), which the engine
  // does not do yet; drawn at their fixed size they left a black-edged blot over the target. Restore them once the engine
  // scales by the bound object (docs/S13_RULES_GAP.md, 2026-11-18).
  '2436e086': ['flash2', 'flash3'],
};

/**
 * Trail emitters, by system and emitter name, whose head fades out over twice its own drawn half-width once the strand
 * stops growing, instead of ending on a flat cut across the trail (Trails.ts). A fit, not the original's behaviour: how
 * the original ends a trail whose emitter stopped is not known.
 * Vi's row shockwave Trench: its head kept widening after the run landed and drew a straight vertical edge at the row end
 * (11-12 isolate recordings; back on screen once the run's rock children and play-out were in, Fable 11-12).
 */
export const TRAIL_END_FADE: Readonly<Record<string, readonly string[]>> = {
  '84b969e0': ['Trench'],
};

/**
 * Projectile systems that play out when they land: emission stops at arrival and the run stays until its particles have
 * finished their own curves (runtime PLAY_OUT_CAP at most), instead of being removed whole at the cue's end. Particles of
 * emitters without particleLinger still go at the stop, as the engine does for any stopped system, so a beam or missile
 * head still ends on the hit. Decided system by system against original footage (Fable 11-12): on some projectiles the
 * hit effect taking over at once is the original's own design, so this is no default.
 * - 20cd67dc Gangplank's ground-fire line: its ground strand carries a long particleLinger; in the original the burning
 *   line stays on the ground well after it is drawn, then chars and fades (11-12 footage).
 * Each entry ends its play-out on its own clock: gone `seconds` after landing, every draw fading out over the last `fade`.
 */
export interface PlayOut {
  readonly seconds: number; readonly fade: number;
  /**
   * Playing out, it does not give way to a newcomer that lacks room, as other tails do; it is weighed by the usual
   * eviction at its own importance instead, and its reserve still follows what it has live.
   */
  readonly hold?: boolean;
}
/**
 * A basic attack that crits (the display's packetDamage: delivery basic-attack, critical) plays the shared crit flash in
 * place of the shared attack hit, at the same bone and moment (a swap, never both). The binding per champion is the
 * original's: `keepHit` champions keep the plain hit on a crit. Skill crits are not bound here yet.
 */
export const CRIT_ATTACK_HIT: Readonly<{ hit: string; crit: string; keepHit: ReadonlySet<string>;
  /** A champion's own crit variants: `swap` replaces its attack systems on a crit, `flash` is its crit flash cue when its hit is its own. */
  own: Readonly<Record<string, { readonly swap?: Readonly<Record<string, string>>; readonly flash?: TimelineCue }>> }> = {
  hit: '0f2af66b', crit: '2436e086', keepHit: new Set(['cassiopeia', 'renata', 'swain', 'zeri']),
  own: {
    // Warwick: his hit is his own slash, so the crit flash plays on the target beside it at the slash's moment. His own crit
    // swipe (BA_Swipe_crit 94adb056 in place of 6b46d17d) waits for the original's footage (Fable 11-17): not swapped here.
    warwick: { flash: { system: '2436e086', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.2, duration: 1 } },
  },
};
/**
 * A skill's direct damage that crits (packetDamage: delivery ability-direct, critical) flashes the same crit system on its
 * target, beside the skill's own hit (Fable 11-16: the original's binding for skill crits is inferred, not read). Every
 * champion whose package has the system gets this display branch `<champion>-crit`; a periodic tick does not flash.
 */
export const CRIT_SKILL_HIT: Readonly<{ skill: (champion: string) => string; cue: TimelineCue }> = {
  skill: champion => `${champion}-crit`,
  cue: { system: '2436e086', action: 'passive', event: 'hit', delay: 0, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
};
/**
 * Projectiles whose drawn emitters author a particleLinger: at arrival they stop emitting and their lingering particles
 * finish on their own (runtime PLAY_OUT_CAP at most), instead of the whole system being removed at the cue's end, which
 * cut the trails the asset keeps behind a landed missile (Fable 11-21, from Mel's barrage trails). Emitters without a
 * linger still go at the stop, so a missile head ends on the hit. No forced end or fade: their own curves end them.
 * The set is the rule applied to the 0c59 asset snapshot; tests/vfx-ltk-linger-play-out.test.ts recomputes it from the
 * assets (VFX_LTK_ROOT) and fails on any difference. A list change that fires a new projectile updates it with that change
 * (11-24: LeBlanc's empowered missile, Swain's ranged missile, Kog'Maw's attack missile and Gangplank's ranged flight were
 * cued without it, and two systems no longer fired as projectiles stayed in it). PLAY_OUT_SYSTEMS entries and cues with their own playOut are not here.
 */
export const LINGER_PLAY_OUT: ReadonlySet<string> = new Set([
  '01873936', '022fe9ec', '06e90178', '0ea87983', '1e05be94', '215abe6e', '2b0232bc', '3496e112',
  '36c79ae9', '3c65ee71', '3d2697ac', '40140250', '45b69079', '4d0368dc', '4ddee85c', '4f2eb343',
  '4f6da7bc', '4fb68964', '52963b0a', '52da669c', '539901e6', '53b93f82', '5938e29d', '5a18496c',
  '5a268f4e', '5c6b6f6a', '5d31debe', '617e850e', '6d9e0430', '721e9fbc', '76f80db8', '7f403068',
  '809dc7ac', '80ab2d1b', '84b969e0', '85788d2c', '857fe049', '87913524', '8b59c09d', '92bbeaf7',
  '92ff3d2c', '93fe62de', '952026ec', '98c2c347', '9ad0dd7c', '9ad2672c', '9bd80364', '9ea5538e',
  '9f19f946', 'a0484f04', 'a664114c', 'a6bde11c', 'b5077b11', 'b9318ef6', 'ba5fe1c0', 'bb62fca2',
  'bdceb760', 'bef025dc', 'c173eb0c', 'c8d6ee2e', 'cbd8e1cc', 'd7fee2d8', 'dcebd22f', 'e0afe94c',
  'ec4a03aa', 'ec6aaee6', 'ed157b4e', 'ee2e840c', 'ee7fccd1', 'f0aa0d95', 'f16dfc56', 'f2b3f090',
  'f2d605de', 'f4e3e1bc', 'faf1aeac', 'fe407ac6', 'ffa688fa',
]);
export const PLAY_OUT_SYSTEMS: Readonly<Record<string, PlayOut>> = {
  // A FIT to original footage (the 3-star full-board clip, 11-13), not the original's own values: the scorch stays clear
  // for a while after the line lands and then fades, sooner than its authored curves would end it on their own. Whether
  // that time changes with the star level is not checked yet.
  // hold: it lasts as the original's does (11-13 Node 8 v 8: without it, it gave way the frame it began to play out).
  '20cd67dc': { seconds: 2.3, fade: 0.5, hold: true },
};

/**
 * Emitters of a system that never emit here, by emitter name: their particles and every child they would spawn are gone.
 * Each Sevika slot result layer (14.24 map22.bin TFT13_Lieutenant_Base_Slots_*_Child_Mirrored) opens with an
 * `Alpha_Boarder` whose child is the whole slot machine again; the board already plays that machine as its own cue, so
 * the layer's copy drew a second frame over the first, and pushed Jackpot to 65 drawn emitters, past the 64 a system
 * may take, so its Jinx face never loaded (11-09 #579 recording).
 */
export const DISABLED_EMITTERS: Readonly<Record<string, readonly string[]>> = {
  '75cc1285': ['Alpha_Boarder'], '5875fa39': ['Alpha_Boarder'], '85a3c691': ['Alpha_Boarder'], '066fd22b': ['Alpha_Boarder'],
  // LeBlanc's channel: its dark ground-layer backdrop draws a dark smudge beside her on our board (Windows probe 11-19: only
  // this emitter darkens that spot). A temporary departure held off as a known difference until its look is checked
  // (Fable 11-19); the rest of the system draws.
  'acd84091': ['Alpha_Glow'],
  // Mordekaiser's aura: its dark ground glow draws a dark red smudge beside him on our board (Windows probe 11-19: it is the
  // main cause there). Held off as a known difference like LeBlanc's (Fable 11-19); the red glow, scorch and cracks draw.
  '938c104f': ['Alpha_Glow_Dark'],
  // Mordekaiser's grasp: the pit it opens and its walls stay off; the claw, swipes, cracks and burn draw (Fable 11-19).
  'a7c49a29': ['Stencil_Cap', 'Mesh_Edge', 'Stencil_Gradient', 'Mesh_Edge_Red', 'Mesh_Edge_Dark', 'Stencil_InnerDarkness', 'Mesh_Walls_Red', 'Mesh_Walls_Dark'],
  // Smeech's stab hit: its large background glow draws a dark block on the enemy stabbed on our board. Held off as a known
  // difference (Fable 11-19); the rest of the hit draws.
  '9acdae50': ['Alpha_BgGlow_GreenBrown'],
  // Irelia's shield: the cyan ring glow round the bubble is left out, with the bubble itself fainter (EMITTER_ALPHA; Fable
  // 11-20, picked from a three-column toggle).
  '67665513': ['Alpha_RingGlow'],
  // Renni's final slam: when the slam kills, its dark ground decal draws a large near-black disc on our board where it
  // lands, for about 0.5 s (Linux probe 11-20, with a kill; without one it never draws). Held off as a known difference
  // (Fable 11-20, three columns with a kill); the rest of the system draws.
  '2f79da6f': ['onKill_GlowDecal'],
  // Ziggs's bomb burst: one emitter drew large white wedges thrown out of the first frame of every burst on our board.
  // Held off as a known difference (Fable 11-21); the fireball and the rest of the burst draw.
  '04c3cba0': ['SmokeHeat'],
};

/**
 * Emitters drawn fainter here, by system and emitter name: each particle's alpha is multiplied by the factor. The factors
 * are fitted/own values (拟合/自定，非原版), picked by eye on our board; colours are left as the asset has them.
 */
export const EMITTER_ALPHA: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // Irelia's shield bubble read as a solid ball over her at full strength; half lets her body show through it (Fable 11-20,
  // three-column toggle: this is that column as recorded, the swirl meshes included).
  '67665513': { Add_Shield: 0.5, Swirl_Mesh: 0.5, Swirl_Mesh1: 0.5 },
};

/**
 * Attached-mesh emitters held off screen, by system and emitter name, until their look is checked against the original.
 * The rest of each system draws as before. Only for an overlay measured to draw wrong on the board.
 */
export const ATTACHED_HELD_BACK: Readonly<Record<string, readonly string[]>> = {
  // Jayce R_Melee_LightningCall: Avatar_Fresnel is a black-based layer lit only by its rim, and our rim leaves it unlit, so
  // the layer adds nothing (#619 Windows probe, 11-12). Held with Avatar_Hammer until the rim is checked against an
  // original of the same star.
  '8d9d784b': ['Avatar_Hammer', 'Avatar_Fresnel'],
  // Jayce E_Knockback_Wave, which plays with it: Avatar_Dark is a near-black copy of the body, meant to sit under
  // Avatar_Orange and Avatar_Yellow, black-based layers lit only by their rims; with those unlit, the dark copy alone drew
  // a black shell over Jayce (#619 Windows probe, 11-12).
  'e07c8088': ['Avatar_Dark', 'Avatar_Orange', 'Avatar_Yellow'],
};

/**
 * Attached-mesh emitters that keep covering the whole host although they name parts, by system and emitter name.
 * Only for a cued emitter that drew before the part filter (11-11) and whose parts our host model does not hold, so the
 * filter would take away something the board shows today. Each stays until its host model is split into those parts.
 */
export const ATTACHED_WHOLE_BODY: Readonly<Record<string, readonly string[]>> = {
  // Jinx R_Cast_Mouth: Avatar_BodyLight names Weapon (her launcher); our Jinx model is one Body part (11-11 parts audit).
  // Remove when the Jinx model holds the launcher as its own Weapon part (or phase two filters it by bone weights).
  '7e6f06b5': ['Avatar_BodyLight'],
  // Leona W_buf: Avatar3 names a part hashed 0xddb924a1 that is none of her model's Body, Sword, Equipment (11-11).
  // Remove when the Leona model holds the part 0xddb924a1 names. Both stay provisional: if the side-by-side with the
  // original shows the whole-body layer clearly overdone, the entry goes and the filter leaves it undrawn (Fable, 11-11).
  '8d9a4ccc': ['Avatar3'],
  // Sion Unleash_Cas and its Cabal copy: Avatar_Fresnel names Head, Body and Weapon, which is near enough his whole body;
  // our Sion model is one merged part (Sion_Base_MD_lambert2SG1, 11-11 live parts audit). Remove when the model is split.
  '9118f221': ['Avatar_Fresnel'],
  '5afb9708': ['Avatar_Fresnel'],
};

/**
 * Emitters drawn without their world acceleration, by system and emitter name. Garen's falling sword (97c28077 sword_drop)
 * authors a world acceleration far beyond any other emitter's and no drag; drawn with it, the sword plunged to the ground in
 * a fraction of its fall. The official game's sword lands when its own steady fall reaches the ground, so it is drawn falling
 * at its own speed alone (自定，依据正式服画面的落地时刻，非原版数据).
 */
export const WORLD_ACCELERATION_OFF: Readonly<Record<string, readonly string[]>> = {
  '97c28077': ['sword_drop'],
};

/**
 * Emitters that keep emitting for their run's whole life instead of stopping at their own `lifetime` (fitted, not
 * original data): a form's look held at its first strength until the form ends (TIMED_FORM_STOPS stops the run).
 * Dr. Mundo R_Buf Avatar2: its shell pulses for the whole form (Fable 11-18).
 */
export const EMITTERS_HELD_ON: Readonly<Record<string, readonly string[]>> = {
  '4caada37': ['Avatar2'],
};

/** Systems a unit's timed form (timed-form-events.ts) ends when it turns off: the form's look ends with it. */
export const TIMED_FORM_STOPS: Readonly<Record<string, readonly string[]>> = {
  drmundo: ['5443cd9f', '4caada37'],
};

/**
 * Systems a rule's display-only "effect ended" event (abilityEffectEnded) ends early: the caster's runs of these systems
 * stop emitting and leave within half a second. Each cue lists the system's own end as its duration, so without the event
 * it plays out; with it, it ends when the rule's effect does.
 */
/**
 * LeBlanc's chain links (29d01632) run from her primary target to the other enemies her cast binds: played from that primary
 * (a 'passive' play the renderer makes on her cast), so her chain's end (abilityEffectEnded 'leblanc-chain', which names
 * every bound unit) ends them on each bound unit as their source.
 */
export const LEBLANC_CHAIN_FROM_PRIMARY = { system: '29d01632', effect: 'leblanc-chain' } as const;
export const CUE_END_STOPS: Readonly<Record<'leblanc-chain' | 'twitch-volley' | 'drmundo-heal' | 'vander-brace' | 'mordekaiser-empower' | 'swain-ascension', readonly string[]>> = {
  // The chain to each target (it holds a looping emitter), the primary's mark, the empowered glow, the orb and the ground mark;
  // and her channel glow (acd84091, held for the chain: SUSTAIN_CAPS).
  // Her chain links themselves run from the primary, not from her: they end on each bound unit (LEBLANC_CHAIN_FROM_PRIMARY).
  'leblanc-chain': ['4ea54e59', 'ed58bcfc', '898ab758', '1b624dee', 'acd84091'],
  // The volley's buff glow (2beb0657) goes with the volley's last shot too.
  'twitch-volley': ['900dd2d2', '2beb0657'],
  // Swain's demon form (takedowns extend it in the rules). Mordekaiser's slam burst plays per hit and holds nothing to end.
  'mordekaiser-empower': [],
  'swain-ascension': ['796b6af2'],
  // Dr. Mundo's cast and buff systems end with his timed form instead (TIMED_FORM_STOPS).
  'drmundo-heal': [],
  'vander-brace': ['68e8ca37'],
};

/**
 * Systems that end with a rule event the simulation already sends: each plays its own life (its cue's duration) unless the
 * rule's effect ends first. `on` 'source' ends the caster's runs, 'target' the runs on the unit the event names.
 */
export const CUE_RULE_STOPS = {
  // Warwick's blood frenzy aura goes when the frenzy does (bloodFrenzyChanged active: false).
  frenzyEnded: { systems: ['8c054bed'], on: 'source' },
  // An ability shield's visual goes when that ability's shield layer ends (shieldLayerChanged depleted / expired / replaced /
  // death-cleanup), matched by the ability in the layer's key: Blitzcrank's and Vi's Q shields.
  // Garen's, Vi's and Loris's retaliation ring: every layer goes at once on a stop (checked per layer, 11-25).
  abilityShieldEnded: { systems: { 'vi-ability': ['9614ffb4'], 'garen-ability': ['ea21ae27'], 'loris-ability': ['2f1f3b60'] }, on: 'source' },
  // The same, eased out over SHIELD_END_FADE_SECONDS rather than stopped: Sevika's roulette shield, whose layers live for very
  // different times, so a stop left its pink rings alone on screen for a moment after the rest had gone (11-25).
  // Blitzcrank's barrier and Loris's shield likewise (11-25): stopped, Blitzcrank's sparkles stayed well over a second after
  // the barrier had gone, and Loris's dark shield face and lightning seconds after its edges.
  abilityShieldEndedFade: { systems: { 'sevika-ability': ['518dee63'], 'blitzcrank-ability': ['fc783cba'], 'loris-ability': ['e22b48b0'] }, on: 'source' },
  // The same, for shields an ability puts on others: the visual runs on the shielded ally and ends with that ally's layer
  // (Mel's shield, Jayce's forge shield).
  abilityShieldEndedOnHolder: { systems: { 'mel-ability': ['71e871c8'], 'jayce-ability': ['e8cd793f'],
    // Lux's bubble on the ally she shields and Renata's shield on each ally her missiles shield: gone when that layer breaks
    // or runs out (11-24).
    'lux-ability': ['44c9516a'], 'renata-ability': ['fdf79734'] }, on: 'target' },
  // The same for a shield a caster's cast put on itself, drawn as its own cast-start (no target): Lux's self-cast bubble goes
  // when her own layer ends (the runtime's stopSystemsOnSelf). Her bubbles on allies are not touched.
  abilityShieldEndedOnSelf: { systems: { 'lux-ability': ['44c9516a'] }, on: 'self' },
  // Viktor's board-wide warning goes when his slam lands (the ability's later direct magic hit, batch2-bridge.ts).
  viktorSlamLanded: { systems: ['12ac9712'], on: 'source' },
  // Malzahar's E mark goes when its target's shred ends (statusChanged kind shred, an end reason).
  shredEnded: { systems: ['88a717e0'], on: 'target' },
  // A champion's own status from its cast ends (statusChanged on that unit, an end reason): Leona's damage reduction.
  ownStatusEnded: { systems: { leona: { kind: 'damage-reduction', systems: ['8d9a4ccc'] } }, on: 'source' },
  // Jayce's back-form forge gives allies attack speed (a 'stat-buff' status): its gate glow plays at his forge
  // (`<jayce>:g23-forge`, batch2-bridge.ts) and goes when the buff his cast gave ends on an ally (sustain-stops.ts ties each
  // buffed ally to its forge). Another stat buff on that ally ending first ends it too (the display event names no source).
  allyStatusEnded: { systems: { 'stat-buff': ['afb2ec69'] }, on: 'source' },
  // Elise's cocoon on a target goes when that target is no longer stunned (its control in the board frame ends: the rules'
  // stun state, whatever else stunned it too; sustain-stops.ts createControlEndStops). Her spider form is not touched (11-24).
  // Zyra's root cluster on her rooted target likewise (11-24; her vines' hit on the target's body, 9d413df0, is not a stun
  // display and keeps its own cue).
  stunEnded: { systems: ['6d6525e8', 'b888a24f'], on: 'target' },

  // Vex's opening area holds until her delayed second hit lands on that target (the next direct ability hit after the first).
  vexSecondHit: { systems: ['8682c9ee', 'eb9da1d5'], on: 'target' },
} as const;

/**
 * Persistent layers held until a rule event ends them (the stop tables above, or death through stopUnit) instead of the
 * short cue the index gives: each listed cue runs up to this many seconds, without stopAfter. The rule event ends them;
 * the cap is only a fallback for a missed event (Fable 11-19): the rule's longest time for that state plus 1 s (自定，非原版;
 * tests/sustain-stops.test.ts checks each against the ability data). A state without a time limit in the rules has a cap of
 * our own, said per line.
 */
export const SUSTAIN_CAPS: Readonly<Record<string, number>> = {
  '2beb0657': 10, // Twitch volley buff → twitch-volley (no time limit: a recast re-arms the volley; 自定上限)
  'acd84091': 6, // LeBlanc channel → leblanc-chain
  '796b6af2': 20, // Swain demon form → swain-ascension (each takedown extends it; 自定上限)
  'ea21ae27': 5, // Garen shield → his shield layer ends
  'e22b48b0': 5, // Loris shield → his shield layer ends
  '8d9a4ccc': 4, // Leona damage reduction → that status ends
  'afb2ec69': 4, // Jayce forge attack speed → the ally's status ends
  'd86cc9bc': 60, // Draven spinning axes: every attack stays empowered after his first cast → his death (自定上限)
  '56e6971e': 60, // Amumu passive → his death (自定上限)
  '6889455c': 60, // Kog'Maw attack speed stacks (no end in the rules) → his death (自定上限)
  '9f805f6e': 60,
  // Akali's mark: exactly the rules' exposure time (AKALI_MARK_SECONDS), which nothing ends early; death ends it at once.
  'bc4a9e0d': AKALI_MARK_SECONDS,
  'b888a24f': 2, // Zyra's root cluster on her rooted target → that target's stun ends (eased out: STUN_END_FADE_SECONDS)
  '8682c9ee': 1.8, // Vex opening area → her delayed second hit
  'eb9da1d5': 1.8,
};
/**
 * Held layers whose system also plays elsewhere as a short cue: held as SUSTAIN_CAPS holds them, but only in the skill named
 * here. Loris's Q ground ring stays until his shield layer ends (CUE_RULE_STOPS abilityShieldEnded), capped at the rules'
 * longest shield time plus 1 s (自定，非原版; tests check it against the data); the same ring in his blast (loris-retaliation)
 * keeps its own short cue.
 */
export const SUSTAIN_SKILL_CAPS: Readonly<Record<string, Readonly<Record<string, number>>>> = { loris: { '2f1f3b60': 5 } };
/**
 * Every held layer's next play replaces the last one instead of drawing a second layer over it: from the same caster, and
 * for a hit cue on the same target (Ekko's mark). Held layers last seconds to a whole fight, so each recast or pulse would
 * otherwise stack another (Draven's axes per cast; Amumu's passive per pulse filled 24 slots in a 1 v 2 by 10 s and pushed
 * Draven's axes out: Node, 11-19).
 */
export const SUSTAIN_REFRESH: ReadonlySet<string> = new Set(Object.keys(SUSTAIN_CAPS));
/**
 * Held layers ranked below every skill body (Fable 11-19: Draven's axes and Kog'Maw's stacks, shown all fight long, are
 * decoration): any skill visual takes their slot, and they come back when room frees (SUSTAIN_READMIT).
 */
export const SUSTAIN_RANKS: Readonly<Record<string, 'decorative'>> = { 'd86cc9bc': 'decorative', '6889455c': 'decorative', '9f805f6e': 'decorative' };
/** Held layers that, evicted or kept out by a full board, wait for free room and play the rest of their time then. */
export const SUSTAIN_READMIT: ReadonlySet<string> = new Set(['d86cc9bc', '6889455c', '9f805f6e']);

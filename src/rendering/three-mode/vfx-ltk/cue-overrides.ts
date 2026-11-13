/**
 * Reviewed replacements for a champion's exported skill timeline (the asset root's vfx-ltk index `skills`), kept in
 * the repository so a fix needs no asset-root rebuild. 2026-11-03 1080p video review (castcmp-1103) found exported cues
 * on the wrong host, too early or late, or from another spell. A row replaces that champion's whole cue list (attack
 * and cast); it applies only when every system it names is present in the loaded index, else the exported list stays.
 * Cue fields as in timeline.ts: `cast-start` plays on the caster (at `bone`), `hit` on each target (at `bone`),
 * `projectile` flies caster → target over `travelSeconds`. `scale` (default 1) shrinks that one
 * system about its anchor and does not move the anchor or the flight; it multiplies the cue's size factor
 * (fx-size.ts cueSize: the body scale on a weapon or hand bone, the arena scale elsewhere). `kept(x)` is a size
 * measured against footage at the older 0.44 base, drawn as it was.
 */
import type { TimelineCue } from './timeline';
import { measuredAtFxScale as kept } from './fx-size';
import { BATCH1_TIMELINES } from './batch1-timelines';
import { jinxSkills } from './champions/jinx';
import { jayceSkills } from './champions/jayce';
import { melSkills } from './champions/mel';
import { sevikaSkills } from './champions/sevika';
import { viktorSkills } from './champions/viktor';
import { warwickSkills } from './champions/warwick';
import { S13_TIMELINES } from './s13-timelines';

const chest = 'C_BUFFBONE_GLB_CHEST_LOC';
const ground = 'BUFFBONE_GLB_GROUND_LOC';
const center = 'C_BUFFBONE_GLB_CENTER_LOC';

/**
 * Caitlyn's Air Raid comet, one per shot, falling onto that shot's damage centre (TimelineCue.fromAbove). Every value is a
 * fitted value, not original data: the blimp that drops it is off screen in 14.24 and the export carries no path for it.
 */
export const CAITLYN_COMET = {
  /** Cells from where the target stands: left on screen, up, and toward the top of the screen. Steep, as in the footage. */
  from: [-1, 5, -1.5] as const,
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
 * Display branches the export never had, by `<champion>-<branch>` key, played through LtkPlayOptions.skill. Each is added
 * to a loaded index that has the champion's own list and every system the branch names (withCueOverrides).
 */
export const CUE_EXTRA_SKILLS: Readonly<Record<string, readonly TimelineCue[]>> = {
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
};

export const CUE_OVERRIDES: Readonly<Record<string, readonly TimelineCue[]>> = {
  // Q: missile, then one ground ring on the primary target, then the burst. R1 marker stays out.
  // The shadow zone and its edge are authored about 1.46× the reference diameter (2.46 and 2.9 cells); 0.68 brings them back.
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
  // The landing burst is authored about 2.2× the reference diameter (castcmp-1103); 0.45 keeps it on his feet.
  garen: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.3333333333333333, duration: 1.5 },
    { system: 'ea21ae27', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: chest },
    { system: '44aa54ff', action: 'cast', event: 'cast-start', delay: 0.4, duration: 1, bone: ground },
    { system: '5bbccb8c', action: 'cast', event: 'cast-start', delay: 0.6, duration: 0.7, bone: ground, scale: kept(0.45) },
  ],
  // E (14.24 field: cast 13.9 s, main root 14.4 s, second roots 14.9 s): E_Sequence_Impact is the index's own ground
  // missile (travel 0.3): one crawls to the primary target, then short ones reach up to two others. The brown branching
  // vines (E_Outer) sprout around each rooted target, not at Zyra's feet (ca23e060: they spread from her toward empty
  // ground). E_Sequence_Root binds the primary target; the plant flash marks every one. No E_Mis or E_Mis_Child exists.
  zyra: [
    { system: 'ec6aaee6', action: 'attack', event: 'projectile', bone: 'L_Hand', delay: 0.3333333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.6333333333333333, duration: 1.5 },
    // The whole E was sized together against the footage at the 0.44 base, so every cast cue keeps that size (pr572-report,
    // 11-09: only the two vine systems kept it and the sprouts and flash shrank to 0.29 and 0.59 cells beside them).
    // Sizes from the cdacbcc9 isolated renders against the 14.24 footage (main wrap about 2.2 cells): E_Outer drew
    // 4.5 cells wide and was cut off at its end; the root cluster drew 1.1 cells, too thin to read as the vine mass.
    // Faded out (3e90bd1c, d650fcf2 fields: both drew at full strength to the end, then vanished): their long-lived single
    // particles never reach their own authored fade inside the cue, so from the stop the cue eases them out itself.
    { system: '7ce6b652', action: 'cast', event: 'hit', delay: 0.5, duration: 1.4, stopAfter: 0.8, fadeOut: true, bone: ground, primary: true, scale: kept(0.5) },
    { system: '7ce6b652', action: 'cast', event: 'hit', delay: 1, duration: 1.4, stopAfter: 0.8, fadeOut: true, bone: ground, others: true, targetLimit: 2, optional: true, scale: kept(0.5) },
    { system: '857fe049', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.6, travelSeconds: 0.3, bone: ground, targetBone: ground, primary: true, scale: kept(1) },
    { system: '857fe049', action: 'cast', event: 'projectile', delay: 0.6, duration: 0.7, travelSeconds: 0.4, bone: ground, targetBone: ground, others: true, targetLimit: 2, optional: true, scale: kept(1) },
    { system: 'b888a24f', action: 'cast', event: 'hit', delay: 0.5, duration: 1.4, stopAfter: 0.8, fadeOut: true, bone: ground, primary: true, scale: kept(1.6) },
    { system: '9d413df0', action: 'cast', event: 'hit', delay: 0.5, duration: 0.4, bone: chest, primary: true, scale: kept(1) },
    { system: '9d413df0', action: 'cast', event: 'hit', delay: 1, duration: 0.6, bone: chest, scale: kept(1) },
  ],
  // Shield stays up. Arcs finish before the purple burst so the burst cannot evict the bubble. Hook missile and Q_cas stay out.
  blitzcrank: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.43200000127156574, duration: 1.5 },
    { system: 'fc783cba', action: 'cast', event: 'cast-start', delay: 0, duration: 3, bone: center },
    { system: '9d35c42d', action: 'cast', event: 'link', delay: 0.15, duration: 0.28, bone: chest, targetBone: chest, targetLimit: 3 },
    { system: '065c16b8', action: 'cast', event: 'hit', delay: 0.5, duration: 0.4, bone: chest, targetLimit: 3 },
    { system: 'ab66b54f', action: 'cast', event: 'cast-start', delay: 0.95, duration: 1.6, bone: center },
  ],
  // R: muzzle flash, one spiked shell, then the burst and dust on the primary. Ricochet is a later event.
  tristana: [
    { system: 'ed157b4e', action: 'attack', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', delay: 0.21541666984558105, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5154166698455811, duration: 1.5 },
    { system: '7d4c2d45', action: 'cast', event: 'cast-start', bone: 'Buffbone_Glb_Weapon_1', delay: 0.15, duration: 0.5 },
    { system: '98c2c347', action: 'cast', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', targetBone: chest, delay: 0.2, duration: 0.5, travelSeconds: 0.3, primary: true },
    { system: '5930ca7b', action: 'cast', event: 'hit', bone: chest, delay: 0.5, duration: 0.8, primary: true },
    { system: 'fb4ea008', action: 'cast', event: 'hit', bone: ground, delay: 0.5, duration: 0.7, primary: true },
  ],
  // R (Air Raid): the exported list without the comet (R_Bombardment_Mis) and its burst (R_Bombardment_Impact). The export
  // kept the comet as a cast-start with no bone, so it stood on Caitlyn's feet (11-03 castcmp review; #622 keyframes), and
  // it played one comet and one burst on the cast target at 1 s, while the rule drops TotalShots shots over RaidDuration,
  // each on a random enemy centre. Each shot now plays its own comet and burst where its damage lands (CUE_EXTRA_SKILLS
  // caitlyn-shot, driven by the shot's packetDamage events in batch1-events.ts).
  caitlyn: [
    { system: '4ddee85c', action: 'attack', event: 'projectile', bone: 'Rifle_TopBarrel2', delay: 0.2833333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5833333333333333, duration: 1.5 },
    { system: '3a811b77', action: 'attack', event: 'cast-start', bone: 'Buffbone_Cstm_Rifle_Barrel_Loc', delay: 0.3333333333333333, duration: 1.5 },
    { system: 'ce2a567b', action: 'cast', event: 'cast-start', bone: 'Buffbone_Cstm_Rifle_Barrel_Loc', delay: 0, duration: 0.4 },
    { system: '4ecddce4', action: 'cast', event: 'cast-start', bone: 'Buffbone_Cstm_Rifle_Scope_Loc', delay: 0, duration: 0.5 },
    { system: 'a1ab2507', action: 'cast', event: 'hit', delay: 0.1, duration: 0.5 },
  ],
  // Q: the grenade keeps emitting after it arrives, so the lightning sits on each target. Crystal travel is smoke, not the yellow arc. Straight flight only.
  scar: [
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.2990000089009603, duration: 1.5 },
    { system: 'bef025dc', action: 'cast', event: 'projectile', delay: 0.1, duration: 0.9, travelSeconds: 0.25, bone: 'L_Hand', targetBone: chest, targetLimit: 3 },
    { system: 'd07052bc', action: 'cast', event: 'hit', delay: 0.4, duration: 0.55, bone: chest, targetLimit: 3 },
    { system: 'f4a6240a', action: 'cast', event: 'cast-start', delay: 1.1, duration: 1.1, bone: chest },
  ],
  // Mace glow only. E_floor's pit and its claw share one system, so emission stops before the pit. Ult enter stays out.
  mordekaiser: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6, duration: 1.5 },
    { system: '04ae533c', action: 'cast', event: 'cast-start', delay: 0, duration: 0.7, bone: 'Buffbone_Glb_Mace_Loc' },
    { system: '5449dd85', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6, bone: 'Buffbone_Glb_Mace_Loc' },
    { system: '0a5d1c08', action: 'cast', event: 'cast-start', delay: 0.05, duration: 0.7, bone: 'Buffbone_Glb_Mace_Loc' },
    // Walls and the pit are born at 0.18s inside this system. Stop before that and keep the opening slash.
    { system: 'a7c49a29', action: 'cast', event: 'cast-start', delay: 0.05, duration: 1.4, stopAfter: 0.08, bone: 'BUFFBONE_GLB_GROUND_LOC' },
  ],
  // Sigil to the primary, then one rose and a chain to each enemy. Weapon ribbons stay out.
  leblanc: [
    { system: '9ad0dd7c', action: 'attack', event: 'projectile', bone: 'weapon_b', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5666666666666667, duration: 1.5 },
    { system: '93fe62de', action: 'cast', event: 'projectile', delay: 0.12, duration: 0.45, travelSeconds: 0.18, bone: 'BUFFBONE_CSTM_WEAPON_2', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'c54516b3', action: 'cast', event: 'hit', delay: 0.32, duration: 0.45, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    { system: 'ed58bcfc', action: 'cast', event: 'hit', delay: 0.55, duration: 0.45, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    { system: '898ab758', action: 'cast', event: 'hit', delay: 0.72, duration: 5, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true, stopAfter: 4.5 },
    { system: '1b624dee', action: 'cast', event: 'hit', delay: 0.72, duration: 3.5, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    { system: '29d01632', action: 'cast', event: 'link', delay: 0.78, duration: 5, bone: 'BUFFBONE_GLB_WEAPON_1', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '4ea54e59', action: 'cast', event: 'hit', delay: 0.8, duration: 5, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true, stopAfter: 4.5 },
    { system: '0a2eef95', action: 'cast', event: 'hit', delay: 0.85, duration: 0.6, bone: 'C_BUFFBONE_GLB_CHEST_LOC', stopAfter: 0.2 },
  ],
  // Cast keeps the green aura and fires one bolt. Later bolts stay on the empowered attacks.
  twitch: [
    { action: 'attack', system: 'ba5fe1c0', event: 'projectile', delay: 0.25, duration: 0.3, travelSeconds: 0.3, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: 0.55, duration: 0.45, bone: 'C_BUFFBONE_GLB_CHEST_LOC', stopAfter: 0.1 },
    { action: 'cast', system: '54af463f', event: 'cast-start', delay: 0, duration: 0.5, stopAfter: 0.2, bone: 'Buffbone_Glb_Weapon_1' },
    { action: 'cast', system: '2beb0657', event: 'cast-start', delay: 0, duration: 4, stopAfter: 3.6, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'cast', system: '900dd2d2', event: 'cast-start', delay: 0, duration: 4, stopAfter: 3.6, fadeOut: true, bone: 'Buffbone_Glb_Weapon_1' },
    { action: 'cast', system: '5938e29d', event: 'projectile', delay: 0.15, duration: 0.8, travelSeconds: 0.55, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'cast', system: '4e7cc3b1', event: 'hit', delay: 0.7, duration: 0.55, stopAfter: 0.15, fadeOut: true, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', variant: 'empowered', system: '5938e29d', event: 'projectile', delay: 0.25, duration: 0.3, travelSeconds: 0.3, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', variant: 'empowered', system: '4e7cc3b1', event: 'hit', delay: 0.55, duration: 0.6, stopAfter: 0.1, fadeOut: true, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Blood strands aim at each enemy; the red burst is on them, not on Vladimir's hand.
  vladimir: [
    { system: 'ffa688fa', action: 'attack', event: 'projectile', bone: 'BUFFBONE_GLB_WEAPON_1', delay: 0.3, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6, duration: 1.5 },
    { system: '45b69079', action: 'cast', event: 'projectile', delay: 0.45, duration: 0.95, travelSeconds: 0.35, bone: 'R_Buffbone_Glb_Hand_Loc', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC', targetLimit: 3 },
    { system: '28c6427d', action: 'cast', event: 'hit', delay: 0.95, duration: 0.9, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // The purple disc plays once on the cast as well as on each empowered swing.
  nocturne: [
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: 0.3, duration: 0.45, stopAfter: 0.1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'cast', system: '97366927', event: 'cast-start', delay: 0, duration: 6, stopAfter: 5.5, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    // The shadow disc has no linger and was cleared in one frame at stopAfter; the original eases it out over about 0.5 s
    // (11-08 blind recheck of the empowered swing). Both cues of the system fade from their stop.
    { action: 'cast', system: '3e224f4a', event: 'cast-start', delay: 0.35, duration: 0.8, stopAfter: 0.3, fadeOut: true, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { action: 'attack', variant: 'empowered', system: '3e224f4a', event: 'cast-start', delay: 0.3, duration: 0.5, stopAfter: 0.1, fadeOut: true, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { action: 'attack', variant: 'empowered', system: '6fb6c5e5', event: 'hit', delay: 0.3, duration: 0.6, stopAfter: 0.1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Q_tar (bd903b08) and Q_Explosion (fd5fd6cc) are named in the index but have no system file.
  // Dropping this cue lets the legacy cast run; that still has no orange blast, only a charge ring.
  urgot: [
    { system: 'e0afe94c', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.85, travelSeconds: 0.25, bone: 'LowerBarrel', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '5a18496c', action: 'attack', event: 'projectile', bone: 'UpperBarrel', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CENTER_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CENTER_LOC', delay: 0.5666666666666667, duration: 1.5 },
  ],
  // Q_Proc is the ground disk (indicator ring, floor mesh). The spell is a hand comet plus one primary splash.
  // The third cast also splashes the next two receipt targets. There is no separate hand-glow system.
  cassiopeia: [
    { system: '714bd6e8', action: 'attack', event: 'projectile', bone: 'L_Hand', delay: 0.31666666666666665, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6166666666666667, duration: 1.5 },
    { system: '9f19f946', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, travelSeconds: 0.4, bone: 'C_buffbone_Glb_Chest_Loc', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    // Branch from the rule's cast event (combat-g2-3.ts): `single` hits the primary target, `splash` every third cast.
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true, branch: 'single' },
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', branch: 'splash', targetLimit: 3 },
  ],
  // E: run/dash dust on self, fast shuriken, gold hit ~0.3s, mark on primary, blue dash hit ~1.1s (no back-dash motion in harness).
  akali: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BuffBone_Glb_Center_Loc', delay: 0.32000001271565753, duration: 1.5 },
    { system: 'd900f5b3', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: '76f80db8', action: 'cast', event: 'projectile', delay: 0.12, duration: 0.35, travelSeconds: 0.15, bone: 'Buffbone_Glb_Weapon_1', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '838f31e4', action: 'cast', event: 'hit', delay: 0.28, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'bc4a9e0d', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
    { system: '1edf4c0e', action: 'cast', event: 'cast-start', delay: 0.85, duration: 0.6, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: 'd7cede72', action: 'cast', event: 'hit', delay: 1.1, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC', primary: true },
  ],
  // No q_mis; spell ring on targets then infection. Portal mesh ids are not in the asset root.
  malzahar: [
    { system: '3c65ee71', action: 'attack', event: 'projectile', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.8666666666666667, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 1.1666666666666667, duration: 1.5 },
    { system: '6d06c644', action: 'cast', event: 'cast-start', delay: 0, duration: 0.4, bone: 'R_hand' },
    { system: 'a3390cb7', action: 'cast', event: 'hit', delay: 0.35, duration: 0.8, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { system: '88a717e0', action: 'cast', event: 'hit', delay: 0.8, duration: 3, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'd5de11de', action: 'cast', event: 'hit', delay: 1, duration: 2.7, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
  ],
  // Asset root only ships WeaponSmoke + BA hit; q_tar / slam systems lack JSON files.
  renni: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.3, duration: 1.5 },
    { system: 'da33678c', action: 'cast', event: 'cast-start', bone: 'L_Rotor', delay: 0, duration: 2.2 },
  ],
  // R: 14.24 is a 3 s gas cloud that then detonates (11-06 field review: ours burst at 1.2 s, white and about 3.8 cells).
  // The cloud stays for the whole damage window; the burst and each target's splash wait for its end. Burst 0.5 is about 2.9 cells.
  nunu: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.48566665649414065, duration: 1.5 },
    // The channel's pool marks where the blast lands, so it takes the blast's own scale (2a4dfaba playtest: pale green over
    // most of the screen once the mesh pool stopped lending other systems' meshes). It keeps emitting until the blast
    // starts: stopping at 2.8 s left the board empty for 0.2 s before the blast (clean4 frames 58-61).
    { system: '78d04f27', action: 'cast', event: 'cast-start', delay: 0, duration: 3.3, stopAfter: 3.05, bone: 'Spine2_Wil', scale: kept(0.43), main: true },
    // The blast spans the 2-hex cloud, about 5 cells across: at 0.5 it measured 5.8 cells at 3.4 s (cdacbcc9), 16% wide.
    { system: '8c256426', action: 'cast', event: 'cast-start', delay: 3, duration: 1.5, bone: 'Spine2_Wil', scale: kept(0.43), main: true },
    // The cast receipt names no targets (damage is scheduled per tick), so this splash is optional or the whole cast fell back.
    { system: '5dfd387b', action: 'cast', event: 'hit', delay: 3.05, duration: 1, scale: kept(0.7), optional: true },
  ],
  // W then Q, as 14.24 plays it: the orb flies to the primary and its ring bursts there, then the shot lands on it.
  // The exported list fired both missiles with no target bone and every ring on every recipient (one heap by Ezreal).
  ezreal: [
    { system: 'bdceb760', action: 'attack', event: 'projectile', bone: 'L_hand', delay: 0.31666666666666665, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.6166666666666667, duration: 1.5 },
    { system: '11416b6c', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: 'Cstm_Buffbone_Cast_FX' },
    { system: '9cb99eb2', action: 'cast', event: 'projectile', delay: 0.05, duration: 0.4, travelSeconds: 0.25, bone: 'Cstm_Buffbone_Cast_FX', targetBone: chest },
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
    // Its five emitters already wait 0.75 s before their first particle; a 0.6 s cue delay on top pushed the blade ring to
    // 1.35 s of a cue ending at 1.40 s (11-08 audit). The original shows it at 0.70 s, fading 0.93–1.13 s.
    { system: '97f3e391', action: 'cast', event: 'cast-start', delay: 0, duration: 1.2, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: 'a5373796', action: 'cast', event: 'hit', delay: 0.6, duration: 0.6, optional: true },
    { system: 'd2b2862d', action: 'cast', event: 'cast-start', delay: 0.7, duration: 1, bone: 'C_Buffbone_Glb_Center_Loc' },
  ],
  // The batch-1 list, with the shield bubble at the size that wraps her shoulders (1.3 cells at the 0.44 base; 0.83 at the
  // arena scale sank into her chest, pr572-report 11-09 14:35, and 1.3 again in pr580-report).
  lux: BATCH1_TIMELINES.lux.map(cue => cue.system === '44c9516a' ? { ...cue, scale: kept(1) } : cue),
  // W: the guard holds until the shield runs out (about 1.5 s in 14.24), and the swipe lands then, not 0.6 s in (11-06 field).
  irelia: [
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.3333333333333333, duration: 1.5 },
    // The original stance holds to about 1.6 s and goes almost at once (11-08 blind recheck, ±2 frames): no early stop at
    // 1.4 s, which cleared it in one frame; the tail fade covers its last 0.25 s.
    { system: '67665513', action: 'cast', event: 'cast-start', delay: 0, duration: 1.6, bone: 'C_Buffbone_Glb_Center_Loc' },
    // The swipe reaches the front row, about 3 cells in the original; at the 0.44 base it drew 2.9 and at the arena scale
    // 1.9 (pr572-report 11-09 14:35), so it keeps the older size.
    { system: '08b7a939', action: 'cast', event: 'cast-start', delay: 1.5, duration: 0.8, bone: 'Buffbone_Glb_Ground_Loc', scale: kept(1) },
  ],
  // Q: the curse rides the target for its 8 pulses (11-06 field review: gone within a second).
  morgana: [
    { system: 'cbd8e1cc', action: 'attack', event: 'projectile', bone: 'R_hand', delay: 0.23333333333333334, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5333333333333333, duration: 1.5 },
    { system: '809dc7ac', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.6, travelSeconds: 0.4, bone: 'Buffbone_Glb_Weapon_1', targetBone: chest },
    { system: '9d79232b', action: 'cast', event: 'hit', delay: 0.6, duration: 1.5, primary: true },
    { system: '7fb1a74c', action: 'cast', event: 'hit', delay: 0.6, duration: 8.4, stopAfter: 7.4, primary: true },
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
    { system: 'faf1aeac', action: 'cast', event: 'projectile', delay: 0.3, duration: 0.9, travelSeconds: 0.6, bone: 'C_Canister', targetBone: chest },
    { system: 'f9926ae8', action: 'cast', event: 'hit', delay: 0.9, duration: 2, bone: ground, primary: true },
    { system: 'd5579768', action: 'cast', event: 'hit', delay: 0.9, duration: 1, bone: chest, targetLimit: 3, optional: true },
    // E_Shield on each ally the missiles shield, for the ability's 3 s ShieldDuration. Played by the renderer on the
    // shield receipt with that ally as the source ('passive': it is not the caster's cast timeline). A hit on the ally
    // itself, so a full board keeps it like other receipt feedback instead of dropping it as a flourish (#546 review).
    { system: 'fdf79734', action: 'passive', event: 'hit', delay: 0, duration: 3, stopAfter: 2.7, fadeOut: true, bone: chest },
  ],
  // 弹道发射骨骼按原版 mStartBoneName
  corki: [
    { system: '4f6da7bc', action: 'attack', event: 'projectile', bone: 'gun', delay: 0.13999999364217122, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BuffBone_Glb_Center_Loc' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BuffBone_Glb_Center_Loc', delay: 0.43999999364217124, duration: 1.5 },
    { system: 'ee7fccd1', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, bone: 'R_missile_b', travelSeconds: 0.7 },
    { system: '444c30d5', action: 'cast', event: 'hit', delay: 0.8, duration: 1 },
    // 022fe9ec 原版骨骼 Cstm_Buffbone_Gatling_Gun_Origin 在我们模型上位于机尾下方，复录更偏，保留 L_missile
    { system: '022fe9ec', action: 'cast', event: 'projectile', delay: 0.3, duration: 0.7, bone: 'L_missile', travelSeconds: 0.7 },
    { system: '0e89bea0', action: 'cast', event: 'hit', delay: 0.9, duration: 1 },
    { system: '4f440b84', action: 'cast', event: 'hit', delay: 0.9, duration: 1 },
  ],
  // 弹道发射骨骼按原版 mStartBoneName
  gangplank: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.3, duration: 1.5 },
    { system: '00c3621b', action: 'cast', event: 'hit', delay: 0, duration: 1 },
    { system: '80ab2d1b', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, bone: 'r_hand', travelSeconds: 0.7 },
    { system: '20cd67dc', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, bone: 'Buffbone_Glb_Weapon_2', travelSeconds: 0.7 },
    { system: 'cf147eda', action: 'cast', event: 'hit', delay: 0.8, duration: 0.8 },
    { system: '2a495226', action: 'cast', event: 'hit', delay: 0.9, duration: 1 },
    { system: '8da84aa4', action: 'cast', event: 'hit', delay: 0.9, duration: 1.5 },
    { system: '5d21d7bb', action: 'cast', event: 'hit', delay: 0.8, duration: 0.8 },
    { system: 'f9ead72c', action: 'cast', event: 'cast-start', delay: 0.6, duration: 1, bone: 'C_Buffbone_Glb_Chest_Loc' },
  ],
  // 弹道发射骨骼按原版 mStartBoneName
  nami: [
    { system: '952026ec', action: 'attack', event: 'projectile', bone: 'L_Buffbone_Glb_Hand_Loc', delay: 0.2833333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5833333333333333, duration: 1.5 },
    { system: 'e4b6f1a3', action: 'cast', event: 'cast-start', delay: 0, duration: 0.8, bone: 'Weapon' },
    { system: 'a64f66ee', action: 'cast', event: 'projectile', delay: 0.3, duration: 1, bone: 'L_Buffbone_Glb_Hand_Loc', travelSeconds: 1 },
    { system: '95bbab3d', action: 'cast', event: 'hit', delay: 0.8, duration: 1.5 },
    { system: '03b4d6ac', action: 'cast', event: 'hit', delay: 0.8, duration: 1.5 },
  ],
  // The asset root's exported list is S13_TIMELINES.vi as of 10-27 plus its attack hit (copied unchanged from the
  // export); this replaces it so the landing play-out (s13-timelines.ts) reaches the live board without an asset rebuild.
  vi: [
    ...S13_TIMELINES.vi,
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.26666666666666666, duration: 1.5 },
  ],
  // #627 (11-12): these batch-2 lists are the repository tables themselves, so a cue edit (here: basic-attack hits and
  // missiles on the target's chest, 14.24 BasicAttack mHitBoneName) plays from code without rebuilding the asset index.
  // The asset root's vfx-ltk/batch2/tft13_*/index.json keeps the older copy; it is not hand-edited.
  jinx: jinxSkills.jinx,
  'jayce-front': jayceSkills['jayce-front'],
  'jayce-back': jayceSkills['jayce-back'],
  mel: melSkills.mel,
  'mel-third': melSkills['mel-third'],
  sevika: sevikaSkills.sevika,
  viktor: viktorSkills.viktor,
  warwick: warwickSkills.warwick,
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
  jinx: { a6a2b1cc: 'zap', '3496e112': 'zap', '10fede7e': 'zap', '40140250': 'zap', '9bd80364': 'chompers', cd05488e: 'chompers',
    '7e6f06b5': 'rocket', '449d6617': 'rocket', '8b59c09d': 'rocket', '809da1b1': 'rocket' },
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
 * Times are measured on the original, with 0 at the mana bar emptying.
 */
export const CUE_ADDITIONS: Readonly<Record<string, readonly TimelineCue[]>> = {
  // R_Energy_Avatar: the red body glow of her cast, a short flash that turns orange and fades. The timings below are
  // fitted to a 3-star original side by side (Ambessa thread, 11-11); they are our fit, not values read from the game.
  ambessa: [
    { system: 'c07aa972', action: 'cast', event: 'cast-start', delay: 0.05, duration: 0.45, stopAfter: 0.4, fadeOut: true, bone: chest },
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
  // Nunu R_Cas runs for the 3 s channel (authored 0.8 s). Its two white ground flashes kept a radial glare in the middle
  // of the pool the whole time; in 14.24 the channel is a dim green mist and only the blast (R_full_explo) flares
  // (11-07 field batches f544/c4a).
  '78d04f27': ['Explosion_Flash_ground', 'Explosion_Flash_ground1'],
  // Sevika punch hit: BUBBLE_START1 is an attached-mesh emitter (draws the host's own skinned mesh) yet carries the
  // bubble mesh's 12× birth scale, the only attached-mesh emitter of Set 13 with a mesh name or a scale past 1.35. On
  // the struck unit it drew a 4–12× purple copy of that unit for 0.2 s over the board (11-10 a96aac47 recording).
  '95fb90ce': ['BUBBLE_START1'],
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
 * Emitters of a system that never emit here, by emitter name: their particles and every child they would spawn are gone.
 * Each Sevika slot result layer (14.24 map22.bin TFT13_Lieutenant_Base_Slots_*_Child_Mirrored) opens with an
 * `Alpha_Boarder` whose child is the whole slot machine again; the board already plays that machine as its own cue, so
 * the layer's copy drew a second frame over the first, and pushed Jackpot to 65 drawn emitters, past the 64 a system
 * may take, so its Jinx face never loaded (11-09 #579 recording).
 */
export const DISABLED_EMITTERS: Readonly<Record<string, readonly string[]>> = {
  '75cc1285': ['Alpha_Boarder'], '5875fa39': ['Alpha_Boarder'], '85a3c691': ['Alpha_Boarder'], '066fd22b': ['Alpha_Boarder'],
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

/**
 * Reviewed replacements for a champion's exported skill timeline (the asset root's vfx-ltk index `skills`), kept in
 * the repository so a fix needs no asset-root rebuild. 2026-11-03 1080p video review (castcmp-1103) found exported cues
 * on the wrong host, too early or late, or from another spell. A row replaces that champion's whole cue list (attack
 * and cast); it applies only when every system it names is present in the loaded index, else the exported list stays.
 * Cue fields as in timeline.ts: `cast-start` plays on the caster (at `bone`), `hit` on each target (at `bone`),
 * `projectile` flies caster → target over `travelSeconds`. `scale` (default 1) shrinks that one
 * system about its anchor and does not move the anchor or the flight.
 */
import type { TimelineCue } from './timeline';

const chest = 'C_BUFFBONE_GLB_CHEST_LOC';
const ground = 'BUFFBONE_GLB_GROUND_LOC';
const center = 'C_BUFFBONE_GLB_CENTER_LOC';

export const CUE_OVERRIDES: Readonly<Record<string, readonly TimelineCue[]>> = {
  // Q: missile, then one ground ring on the primary target, then the burst. R1 marker stays out.
  // The shadow zone and its edge are authored about 1.46× the reference diameter (2.46 and 2.9 cells); 0.68 brings them back.
  vex: [
    { system: '85788d2c', action: 'attack', event: 'projectile', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5666666666666667, duration: 1.5 },
    { system: 'c173eb0c', action: 'cast', event: 'projectile', delay: 0, duration: 0.35, travelSeconds: 0.28, bone: 'R_Buffbone_Glb_Hand_Loc', targetBone: ground },
    { system: '8682c9ee', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true, scale: 0.68 },
    { system: 'eb9da1d5', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true, scale: 0.68 },
    { system: 'c4da788c', action: 'cast', event: 'hit', delay: 1.2, duration: 0.9, bone: ground, primary: true },
    { system: '37f7cb35', action: 'cast', event: 'hit', delay: 1.2, duration: 1, bone: ground, primary: true },
  ],
  // R: shield on Garen, then one sky beam and one impact on his own ground. Not one copy per target.
  // The landing burst is authored about 2.2× the reference diameter (castcmp-1103); 0.45 keeps it on his feet.
  garen: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.3333333333333333, duration: 1.5 },
    { system: 'ea21ae27', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: chest },
    { system: '44aa54ff', action: 'cast', event: 'cast-start', delay: 0.4, duration: 1, bone: ground },
    { system: '5bbccb8c', action: 'cast', event: 'cast-start', delay: 0.6, duration: 0.7, bone: ground, scale: 0.45 },
  ],
  // E: the vine meshes only read when they stay on her ground. Plant flashes are the part that shows on the targets.
  // There is no directional vine missile in the index.
  zyra: [
    { system: 'ec6aaee6', action: 'attack', event: 'projectile', delay: 0.3333333333333333, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.6333333333333333, duration: 1.5 },
    { system: 'b888a24f', action: 'cast', event: 'cast-start', delay: 0.1, duration: 0.7, bone: ground },
    { system: '7ce6b652', action: 'cast', event: 'cast-start', delay: 0.12, duration: 0.8, bone: ground },
    { system: '857fe049', action: 'cast', event: 'cast-start', delay: 0.15, duration: 0.9, bone: ground },
    { system: '9d413df0', action: 'cast', event: 'hit', delay: 0.15, duration: 0.4, bone: chest, primary: true },
    { system: '9d413df0', action: 'cast', event: 'hit', delay: 0.7, duration: 0.6, bone: chest },
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
  // Q: the grenade keeps emitting after it arrives, so the lightning sits on each target. Crystal travel is smoke, not the yellow arc. Straight flight only.
  scar: [
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.2990000089009603, duration: 1.5 },
    { system: 'bef025dc', action: 'cast', event: 'projectile', delay: 0.1, duration: 0.9, travelSeconds: 0.25, bone: chest, targetBone: chest, targetLimit: 3 },
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
    { system: '93fe62de', action: 'cast', event: 'projectile', delay: 0.12, duration: 0.45, travelSeconds: 0.18, bone: 'BUFFBONE_GLB_WEAPON_1', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
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
    { action: 'cast', system: '900dd2d2', event: 'cast-start', delay: 0, duration: 4, stopAfter: 3.6, bone: 'Buffbone_Glb_Weapon_1' },
    { action: 'cast', system: '5938e29d', event: 'projectile', delay: 0.15, duration: 0.8, travelSeconds: 0.55, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'cast', system: '4e7cc3b1', event: 'hit', delay: 0.7, duration: 0.55, stopAfter: 0.15, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', variant: 'empowered', system: '5938e29d', event: 'projectile', delay: 0.25, duration: 0.3, travelSeconds: 0.3, bone: 'Winch', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { action: 'attack', variant: 'empowered', system: '4e7cc3b1', event: 'hit', delay: 0.55, duration: 0.6, stopAfter: 0.1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
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
    { action: 'cast', system: '3e224f4a', event: 'cast-start', delay: 0.35, duration: 1.1, stopAfter: 0.3, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { action: 'attack', variant: 'empowered', system: '3e224f4a', event: 'cast-start', delay: 0.3, duration: 0.5, stopAfter: 0.1, bone: 'BUFFBONE_GLB_GROUND_LOC' },
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
    { system: '714bd6e8', action: 'attack', event: 'projectile', delay: 0.31666666666666665, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.6166666666666667, duration: 1.5 },
    { system: '9f19f946', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.7, travelSeconds: 0.4, bone: 'R_BUFFBONE_GLB_HAND_LOC', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true, phase: 0 },
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true, phase: 1 },
    { system: 'b124a9c5', action: 'cast', event: 'hit', delay: 0.6, duration: 1.2, bone: 'BUFFBONE_GLB_GROUND_LOC', phase: 2, targetLimit: 3 },
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
    { system: '78d04f27', action: 'cast', event: 'cast-start', delay: 0, duration: 3.2, stopAfter: 2.8, bone: 'Spine2_Wil' },
    { system: '8c256426', action: 'cast', event: 'cast-start', delay: 3, duration: 1.5, bone: 'Spine2_Wil', scale: 0.5 },
    // The cast receipt names no targets (damage is scheduled per tick), so this splash is optional or the whole cast fell back.
    { system: '5dfd387b', action: 'cast', event: 'hit', delay: 3.05, duration: 1, scale: 0.7, optional: true },
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
    { system: '97f3e391', action: 'cast', event: 'cast-start', delay: 0.6, duration: 0.8, bone: 'Buffbone_Glb_Ground_Loc' },
    { system: 'a5373796', action: 'cast', event: 'hit', delay: 0.6, duration: 0.6, optional: true },
    { system: 'd2b2862d', action: 'cast', event: 'cast-start', delay: 0.7, duration: 1, bone: 'C_Buffbone_Glb_Center_Loc' },
  ],
  // W: the guard holds until the shield runs out (about 1.5 s in 14.24), and the swipe lands then, not 0.6 s in (11-06 field).
  irelia: [
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.3333333333333333, duration: 1.5 },
    { system: '67665513', action: 'cast', event: 'cast-start', delay: 0, duration: 1.6, stopAfter: 1.4, bone: 'C_Buffbone_Glb_Center_Loc' },
    { system: '08b7a939', action: 'cast', event: 'cast-start', delay: 1.5, duration: 0.8, bone: 'Buffbone_Glb_Ground_Loc' },
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
    { system: 'cff69d8a', action: 'cast', event: 'cast-start', delay: 0, duration: 1.2, bone: 'C_Canister' },
    { system: 'faf1aeac', action: 'cast', event: 'projectile', delay: 0.3, duration: 0.9, travelSeconds: 0.6, bone: 'C_Canister', targetBone: chest },
    { system: 'f9926ae8', action: 'cast', event: 'hit', delay: 0.9, duration: 2, bone: ground, primary: true },
    { system: 'd5579768', action: 'cast', event: 'hit', delay: 0.9, duration: 1, bone: chest, targetLimit: 3, optional: true },
  ],
};

/** The override for `champion` when every system it names is present in `systems`. */
export function cueOverride(champion: string, systems: Readonly<Record<string, string>>): readonly TimelineCue[] | undefined {
  const cues = Object.hasOwn(CUE_OVERRIDES, champion) ? CUE_OVERRIDES[champion] : undefined;
  return cues?.length && cues.every(cue => Object.hasOwn(systems, cue.system)) ? cues : undefined;
}

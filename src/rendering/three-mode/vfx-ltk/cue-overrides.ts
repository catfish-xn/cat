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
  vex: [
    { system: '85788d2c', action: 'attack', event: 'projectile', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: chest },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: chest, delay: 0.5666666666666667, duration: 1.5 },
    { system: 'c173eb0c', action: 'cast', event: 'projectile', delay: 0, duration: 0.35, travelSeconds: 0.28, bone: 'R_Buffbone_Glb_Hand_Loc', targetBone: ground },
    { system: '8682c9ee', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true },
    { system: 'eb9da1d5', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: ground, primary: true },
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
};

/** The override for `champion` when every system it names is present in `systems`. */
export function cueOverride(champion: string, systems: Readonly<Record<string, string>>): readonly TimelineCue[] | undefined {
  const cues = Object.hasOwn(CUE_OVERRIDES, champion) ? CUE_OVERRIDES[champion] : undefined;
  return cues?.length && cues.every(cue => Object.hasOwn(systems, cue.system)) ? cues : undefined;
}

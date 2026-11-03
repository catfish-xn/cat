/**
 * Reviewed replacements for a champion's exported skill timeline (the asset root's vfx-ltk index `skills`), kept in
 * the repository so a fix needs no asset-root rebuild. 2026-11-03 1080p video review (castcmp-1103) found exported cues
 * on the wrong host, too early or late, or from another spell. A row replaces that champion's whole cue list (attack
 * and cast); it applies only when every system it names is in the loaded index, else the exported list stays.
 * Cue fields as in timeline.ts: `cast-start` plays on the caster (at `bone`), `hit` on each target (at `bone`),
 * `projectile` flies caster → target over `travelSeconds`.
 */
import type { TimelineCue } from './timeline';

export const CUE_OVERRIDES: Readonly<Record<string, readonly TimelineCue[]>> = {
  // Q: missile, then one ground ring on the primary target, then the burst. R1 marker stays out.
  vex: [
    { system: '85788d2c', action: 'attack', event: 'projectile', delay: 0.26666666666666666, duration: 1.5, travelSeconds: 0.3, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.5666666666666667, duration: 1.5 },
    { system: 'c173eb0c', action: 'cast', event: 'projectile', delay: 0, duration: 0.35, travelSeconds: 0.28, bone: 'R_Buffbone_Glb_Hand_Loc', targetBone: 'BUFFBONE_GLB_GROUND_LOC' },
    { system: '8682c9ee', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    { system: 'eb9da1d5', action: 'cast', event: 'hit', delay: 0.3, duration: 1, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    { system: 'c4da788c', action: 'cast', event: 'hit', delay: 1.2, duration: 0.9, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
    { system: '37f7cb35', action: 'cast', event: 'hit', delay: 1.2, duration: 1, bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true },
  ],
  // R: shield on Garen, then one sky beam and one impact on his own ground. Not one copy per target.
  garen: [
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.3333333333333333, duration: 1.5 },
    { system: 'ea21ae27', action: 'cast', event: 'cast-start', delay: 0, duration: 0.5, bone: 'C_Buffbone_Glb_Chest_Loc' },
    { system: '44aa54ff', action: 'cast', event: 'cast-start', delay: 0.4, duration: 1, bone: 'BUFFBONE_GLB_GROUND_LOC' },
    { system: '5bbccb8c', action: 'cast', event: 'cast-start', delay: 0.6, duration: 0.7, bone: 'BUFFBONE_GLB_GROUND_LOC' },
  ],
};

/** The override for `champion` when every system it names is present in `systems`. */
export function cueOverride(champion: string, systems: Readonly<Record<string, string>>): readonly TimelineCue[] | undefined {
  const cues = Object.hasOwn(CUE_OVERRIDES, champion) ? CUE_OVERRIDES[champion] : undefined;
  return cues?.length && cues.every(cue => Object.hasOwn(systems, cue.system)) ? cues : undefined;
}

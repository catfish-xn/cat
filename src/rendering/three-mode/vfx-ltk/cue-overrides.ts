/**
 * Reviewed replacements for a champion's exported skill timeline (the asset root's vfx-ltk index `skills`), kept in
 * the repository so a fix needs no asset-root rebuild. 2026-11-03 1080p video review (castcmp-1103) found exported cues
 * on the wrong host, too early or late, or from another spell. A row replaces that champion's whole cue list (attack
 * and cast); it applies only when every system it names is in the loaded index, else the exported list stays.
 * Cue fields as in timeline.ts: `cast-start` plays on the caster (at `bone`), `hit` on each target (at `bone`),
 * `projectile` flies caster → target over `travelSeconds`.
 */
import type { TimelineCue } from './timeline';

export const CUE_OVERRIDES: Readonly<Record<string, readonly TimelineCue[]>> = {};

/** The override for `champion` when every system it names is present in `systems`. */
export function cueOverride(champion: string, systems: Readonly<Record<string, string>>): readonly TimelineCue[] | undefined {
  const cues = Object.hasOwn(CUE_OVERRIDES, champion) ? CUE_OVERRIDES[champion] : undefined;
  return cues?.length && cues.every(cue => Object.hasOwn(systems, cue.system)) ? cues : undefined;
}

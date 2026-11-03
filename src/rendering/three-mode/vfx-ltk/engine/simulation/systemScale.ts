/**
 * Cue scale about a system's rig anchor.
 *
 * A scale of 1 is the authored system. Any other finite scale multiplies lengths that
 * belong to the system (offsets from the anchor, particle size, velocity and acceleration)
 * and does not multiply the anchor itself or the rig's travel, so a hit stays on its
 * point and a missile still flies from its start to its end.
 */

/** `scale` from a cue or a step, treating a missing value as 1. */
export function cueScale(scale: number | undefined): number {
  return scale === undefined ? 1 : scale;
}

/**
 * Multiplies the three components of `out` at `at` by `scale`.
 * Scale 1 does not write, so an unscaled run keeps the values the integrator stored.
 */
export function scaleAxes(out: Float32Array | number[], at: number, scale: number): void {
  if (scale === 1) return;
  out[at] *= scale;
  out[at + 1] *= scale;
  out[at + 2] *= scale;
}

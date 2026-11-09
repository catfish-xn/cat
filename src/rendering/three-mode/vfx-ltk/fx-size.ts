/**
 * Drawn size of skill particles relative to their authored size (2026-11-09).
 *
 * Particles share the world with the arena, not with the champion bodies: a body is drawn at FX_SCALE × its official
 * skinScale, but a particle has no skinScale, and the default arena maps one League unit to √3·34/178 × 7.2/8.48
 * ≈ 0.281 board units (boards-plan alignmentScale, #526), not FX_SCALE's 0.44. At 0.44 every system drew about 1.57×
 * its original size against the grid: Darius's Q ring (half-extent 485) 7.2 cells across against about 4.5 in the
 * original footage, and Viktor's board-wide R spilling over the bench. The earlier per-cue shrinks (Garen 2.2×,
 * Vex 1.43×, Nunu 1.9×, measured 11-03 and 11-06) were the same mismatch.
 *
 * Kept free of the particle bundle so cue tables can import it.
 */
export const FX_SOURCE_SCALE = 0.44; // Must equal particles.ts FX_SCALE.
/** League units → board units for the default arena model (boardAlignment 0.3306 × alignmentScale 7.2 / 8.48). */
export const ARENA_UNIT_SCALE = 0.3306 * (7.2 / 8.48);
/** Multiplies every cue's scale. */
export const SKILL_FX_SIZE = ARENA_UNIT_SCALE / FX_SOURCE_SCALE;
/** A cue size measured against footage before SKILL_FX_SIZE existed, kept as drawn. */
export const measuredAtFxScale = (scale: number): number => scale / SKILL_FX_SIZE;

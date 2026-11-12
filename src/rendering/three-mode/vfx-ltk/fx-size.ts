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
/** League units across one board cell: the arena alignment maps this many to a cell's width (see above). */
export const CELL_LEAGUE_UNITS = 178;
/** League units → board units for the default arena model (boardAlignment 0.3306 × alignmentScale 7.2 / 8.48). */
export const ARENA_UNIT_SCALE = 0.3306 * (7.2 / 8.48);
/** Multiplies a cue's scale (see cueSize for the weapon-bone exception). */
export const SKILL_FX_SIZE = ARENA_UNIT_SCALE / FX_SOURCE_SCALE;
/** A cue size measured against footage before SKILL_FX_SIZE existed, kept as drawn. Not for weapon-held cues. */
export const measuredAtFxScale = (scale: number): number => scale / SKILL_FX_SIZE;
/**
 * What is fitted to a model mesh follows the body; everything else takes the arena's scale.
 *
 * A system held on a weapon or hand bone is authored against that mesh (Jinx's muzzle flash, Twitch's crossbow glow,
 * Vi's glove), and the mesh is drawn at the body scale: at the arena scale those sank into the weapon (pr572-report).
 * Every other cue (ground rings, board points, but also hits, auras and shields on the chest or centre locators, and
 * any missile or link that travels) is a world-sized effect: at the body scale those drew 1.57x the arena-scaled size
 * the follow-ups judged right (pr580-report, 11-09: Garen's shield 1.9 cells, Irelia's W ball 2.2-2.6, Jinx's and Vi's
 * chest hits, LeBlanc's 5 s marks and her chain). The 11-09 14:40 body rule for every non-ground bone was too broad.
 */
export const WEAPON_BONE = /weapon|pistol|rocket|launcher|muzzle|barrel|hand|mace|glove|claw|winch|clamp|rotor|engine|canister|backarm|cast_fx/i;
/** The size factor for one cue: 1 for a cue that stays on a weapon or hand bone, SKILL_FX_SIZE for everything else. */
export function cueSize(cue: { readonly bone?: string; readonly event: string; readonly stationary?: boolean; readonly location?: string }): number {
  if (cue.location === 'board') return SKILL_FX_SIZE;
  const travels = (cue.event === 'projectile' && cue.stationary !== true) || cue.event === 'link';
  return !travels && cue.bone !== undefined && WEAPON_BONE.test(cue.bone) ? 1 : SKILL_FX_SIZE;
}

/**
 * Drawn size of skill particles relative to their authored size (2026-11-09).
 *
 * Particles share the world with the arena: the default arena maps one League unit to √3·34/178 × 7.2/8.48 ≈ 0.281
 * board units (boards-plan alignmentScale, #526), not FX_SCALE's 0.44. Since 2026-11-12 the champion bodies take the
 * same scale (CHAMPION_SOURCE_SCALE), so a body-sized cue and an arena-sized one come out the same size.
 * At 0.44 every system drew about 1.57× its original size against the grid: Darius's Q ring (half-extent 485) 7.2 cells across against about 4.5 in the
 * original footage, and Viktor's board-wide R spilling over the bench. The earlier per-cue shrinks (Garen 2.2×,
 * Vex 1.43×, Nunu 1.9×, measured 11-03 and 11-06) were the same mismatch.
 *
 * Kept free of the particle bundle so cue tables can import it.
 */
export const FX_SOURCE_SCALE = 0.44; // Must equal particles.ts FX_SCALE.
/**
 * Board units across one cell of the board: √3 × the hex radius of the board layout (layout-config.ts BOARD_LAYOUT,
 * 34), in which pieces stand. Kept here because a 3D module does not import that 2D module; a test keeps the two equal.
 */
export const BOARD_CELL = Math.sqrt(3) * 34;
/** League units → board units for the default arena model (boardAlignment 0.3306 × alignmentScale 7.2 / 8.48). */
export const ARENA_UNIT_SCALE = 0.3306 * (7.2 / 8.48);
/** Multiplies a cue's scale (see cueSize for the weapon-bone exception). */
export const SKILL_FX_SIZE = ARENA_UNIT_SCALE / FX_SOURCE_SCALE;
/**
 * League source units → board units for a champion body (board, bench, PvE): the arena's own scale, so a body stands
 * on the grid at the size its skin data gives it (2026-11-12: at FX_SCALE the bodies drew larger than the original
 * against the grid; same-star, same-camera frames, height and width). The one place this coefficient is defined.
 */
export const CHAMPION_SOURCE_SCALE = ARENA_UNIT_SCALE;
/** A body-sized particle's factor (a cue held on a weapon or hand bone): the body's scale over the engine's. Equals SKILL_FX_SIZE. */
export const BODY_TO_FX = CHAMPION_SOURCE_SCALE / FX_SOURCE_SCALE;
/** A cue size measured against footage before SKILL_FX_SIZE existed, kept as drawn. Not for weapon-held cues. */
export const measuredAtFxScale = (scale: number): number => scale / SKILL_FX_SIZE;
/**
 * A cue size measured against footage at the 0.44 base to wrap or hug a body (a shield round the shoulders, a bind on
 * the chest): that body now draws at BODY_TO_FX of its old size, so the wrap shrinks with it. Range-sized cues (a ground
 * ring or blast measured in cells) stay on measuredAtFxScale: the board did not change.
 */
export const measuredOnBody = (scale: number): number => measuredAtFxScale(scale) * BODY_TO_FX;
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
/** The size factor for one cue: the body's (BODY_TO_FX) for a cue that stays on a weapon or hand bone, SKILL_FX_SIZE for everything else. */
export function cueSize(cue: { readonly bone?: string; readonly event: string; readonly stationary?: boolean; readonly location?: string }): number {
  if (cue.location === 'board') return SKILL_FX_SIZE;
  const travels = (cue.event === 'projectile' && cue.stationary !== true) || cue.event === 'link';
  return !travels && cue.bone !== undefined && WEAPON_BONE.test(cue.bone) ? BODY_TO_FX : SKILL_FX_SIZE;
}

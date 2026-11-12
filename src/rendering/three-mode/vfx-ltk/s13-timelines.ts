/** 14.24 converted event IDs/bones from out/README.md. Seconds and script-only impacts are P conventions, 2026-10-26. */
import type { TimelineCue } from './timeline';
const chest = 'C_BUFFBONE_GLB_CHEST_LOC', ground = 'BUFFBONE_GLB_GROUND_LOC';
const frame = (at: number) => at / 30; // Presentation fallback only; exporter does not supply the animation graph's clock.
/** Vi lands on the export's frame 17, where her landing systems start. */
export const VI_LANDING = frame(17);
/**
 * Vi's row shockwave (TFT13_Vi_Base_Q_Landing_Mis): a line missile the export lists as a spell of its own, cast at a
 * location with no animation, not her leap. It goes out from her landing along her target's row both ways to the ends of
 * that row, where her slam's secondary damage lands. When it is cast and the location it aims at are not in the export: every value here is
 * a fitted value, not original data.
 */
export const VI_ROW_SHOCKWAVE = {
  /** Fitted value, not original data: seconds after the cast it leaves the landing point. */
  delay: VI_LANDING - 0.03,
  /** Fitted value, not original data: cells per second it runs along the row. */
  speed: 8,
  /** Fitted value, not original data: it runs to the end of its row, this many cells past the last cell's centre. */
  beyond: 0.5,
  /** At most this many cells (a whole row and its end), so a lost board still gives a bounded run. */
  cells: 7,
  /**
   * Fitted value, not original data: seconds its particles play out after it lands. Long enough for its lingering trail
   * particles to fade by their own colour curve: a shorter run cut them off at once while still half opaque (11-12 probe).
   */
  linger: 0.6,
} as const;
const viRowTravel = VI_ROW_SHOCKWAVE.cells / VI_ROW_SHOCKWAVE.speed;
const viRowCue = (rowSide: -1 | 1): TimelineCue => ({ system: '84b969e0', event: 'projectile', delay: VI_ROW_SHOCKWAVE.delay,
  duration: viRowTravel + VI_ROW_SHOCKWAVE.linger, travelSeconds: viRowTravel, bone: ground, targetBone: ground, primary: true,
  rowSide, rowCells: VI_ROW_SHOCKWAVE.cells, rowToEnd: true, rowBeyond: VI_ROW_SHOCKWAVE.beyond, rowSpeed: VI_ROW_SHOCKWAVE.speed, together: 'row' });
export const S13_TIMELINES: Record<'jinx' | 'vi', readonly TimelineCue[]> = {
  jinx: [
    { phase: 0, system: 'a6a2b1cc', event: 'cast-start', delay: frame(14), duration: 0.9, stopAfter: frame(25 - 14), bone: 'Cstm_Buffbone_Pistol' },
    { phase: 0, system: '3496e112', event: 'projectile', delay: frame(7.53000020980835), duration: 0.45, travelSeconds: 0.3, bone: 'Cstm_Buffbone_Pistol', targetBone: 'C_Buffbone_Glb_Chest_Loc' },
    { phase: 0, system: '10fede7e', event: 'hit', delay: frame(7.53000020980835) + 0.3, duration: 1, bone: 'C_Buffbone_Glb_Chest_Loc' },
    { phase: 1, system: '9bd80364', event: 'projectile', delay: 0.15, duration: 0.6, travelSeconds: 0.45, bone: 'L_Hand', targetBone: ground },
    { phase: 1, system: 'cd05488e', event: 'hit', delay: 0.6, duration: 1.2, bone: ground, stopAfter: 0.15 },
    { phase: 2, system: '7e6f06b5', event: 'cast-start', delay: frame(5), duration: 1, bone: 'Cstm_Buffbone_Rocket_Launcher', stopAfter: 0.3 },
    { phase: 2, system: '449d6617', event: 'cast-start', delay: frame(20), duration: 0.8, bone: 'Cstm_Buffbone_Rocket_Launcher' },
    { phase: 2, system: '8b59c09d', event: 'projectile', delay: frame(20), duration: 0.75, travelSeconds: 0.6, bone: 'Cstm_Buffbone_Rocket_Launcher', targetBone: ground },
    { phase: 2, system: '809da1b1', event: 'hit', delay: frame(20) + 0.6, duration: 2, bone: ground, primary: true },
  ],
  vi: [
    { system: 'c11e6814', event: 'cast-start', delay: 0, duration: 1.2, stopAfter: frame(17), fadeOut: true, bone: 'R_Buffbone_Glb_Hand_Loc' },
    { system: '0314626c', event: 'cast-start', delay: 0, duration: 1, bone: ground },
    { system: '25afa6a6', event: 'cast-start', delay: 0, duration: 1, bone: ground }, // Original empty event: explicit no-op.
    { system: '18e22631', event: 'cast-start', delay: frame(17), duration: 1.5, bone: ground },
    { system: 'd27b3044', event: 'hit', delay: frame(17), duration: 1.5, bone: ground, primary: true },
    { system: '66c600e8', event: 'hit', delay: frame(17), duration: 1, bone: chest },
    viRowCue(-1), viRowCue(1),
    { system: '9614ffb4', event: 'cast-start', delay: 0, duration: 1.5, bone: chest, stopAfter: 0.6, fadeOut: true },
  ],
};
/** Opt in only to the complete known export. An explicit caller timeline always wins. */
export function convertedTimelines(systems: Record<string, string>): Partial<typeof S13_TIMELINES> {
  return Object.fromEntries(Object.entries(S13_TIMELINES).filter(([, cues]) => cues.every(cue => Object.hasOwn(systems, cue.system))));
}

/** 14.24 converted event IDs/bones from out/README.md. Seconds and script-only impacts are P conventions, 2026-10-26. */
import type { TimelineCue } from './timeline';
import { CAST_BODY_SECONDS } from '../effect-budget';
const chest = 'C_BUFFBONE_GLB_CHEST_LOC', ground = 'BUFFBONE_GLB_GROUND_LOC';
const frame = (at: number) => at / 30; // Presentation fallback only; exporter does not supply the animation graph's clock.
/** Vi lands on the export's frame 17, where her landing systems start. */
export const VI_LANDING = frame(17);
/**
 * Vi's row shockwave (TFT13_Vi_Base_Q_Landing_Mis): a line missile the export lists as a spell of its own, cast at a
 * location with no animation, not her leap. It goes out from her landing along her target's row both ways, where her
 * slam's secondary damage lands. When it is cast and the location it aims at are not in the export: every value here is
 * a fitted value, not original data.
 */
export const VI_ROW_SHOCKWAVE = {
  /** Fitted value, not original data: seconds after the cast it leaves the landing point. */
  delay: VI_LANDING + 0.13,
  /** Fitted value, not original data: how many cells each side it runs. */
  cells: 3.4,
  /** Fitted value, not original data: seconds it takes to get there. */
  travel: 0.55,
  /** Fitted value, not original data: seconds its particles play out after it lands. */
  linger: 0.3,
} as const;
const viRowCue = (rowSide: -1 | 1): TimelineCue => ({ system: '84b969e0', event: 'projectile', delay: VI_ROW_SHOCKWAVE.delay,
  duration: VI_ROW_SHOCKWAVE.travel + VI_ROW_SHOCKWAVE.linger, travelSeconds: VI_ROW_SHOCKWAVE.travel, bone: ground, targetBone: ground,
  primary: true, rowSide, rowCells: VI_ROW_SHOCKWAVE.cells, together: 'row' });
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
    // Hand trail: it stops emitting at the landing and only fades after. Kept just under CAST_BODY_SECONDS so it ranks
    // decorative and a first cast's row shockwave (every system then reserves its first-play 250 slots) may take its slot.
    { system: 'c11e6814', event: 'cast-start', delay: 0, duration: CAST_BODY_SECONDS - frame(1), stopAfter: frame(17), fadeOut: true, bone: 'R_Buffbone_Glb_Hand_Loc' },
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

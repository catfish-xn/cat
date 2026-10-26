/** 14.24 converted event IDs/bones from out/README.md. Seconds and script-only impacts are P conventions, 2026-10-26. */
import type { TimelineCue } from './timeline';
const chest = 'C_BUFFBONE_GLB_CHEST_LOC', ground = 'BUFFBONE_GLB_GROUND_LOC';
const frame = (at: number) => at / 30; // Presentation fallback only; exporter does not supply the animation graph's clock.
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
    { system: 'c11e6814', event: 'cast-start', delay: 0, duration: 1.2, stopAfter: frame(17), bone: 'R_Buffbone_Glb_Hand_Loc' },
    { system: '0314626c', event: 'cast-start', delay: 0, duration: 1, bone: ground },
    { system: '25afa6a6', event: 'cast-start', delay: 0, duration: 1, bone: ground }, // Original empty event: explicit no-op.
    { system: '84b969e0', event: 'projectile', delay: frame(4.545000076293945), duration: 0.8, travelSeconds: frame(17 - 4.545000076293945), targetBone: ground },
    { system: '18e22631', event: 'cast-start', delay: frame(17), duration: 1.5, bone: ground },
    { system: 'd27b3044', event: 'hit', delay: frame(17), duration: 1.5, bone: ground, primary: true },
    { system: '66c600e8', event: 'hit', delay: frame(17), duration: 1, bone: chest },
    { system: '9614ffb4', event: 'cast-start', delay: 0, duration: 1.5, bone: chest, stopAfter: 0.6 },
  ],
};
/** Opt in only to the complete known export. An explicit caller timeline always wins. */
export function convertedTimelines(systems: Record<string, string>): Partial<typeof S13_TIMELINES> {
  return Object.fromEntries(Object.entries(S13_TIMELINES).filter(([, cues]) => cues.every(cue => Object.hasOwn(systems, cue.system))));
}

import type { TimelineCue } from '../timeline';
import { CHEST } from '../timeline';
// Attack: 14.24 TFT13_ViktorBasicAttack hits C_BUFFBONE_GLB_CHEST_LOC.
export const viktorSkills: Record<string, readonly TimelineCue[]> = {
  viktor: [
    { system: 'b5077b11', action: 'attack', event: 'projectile', stationary: true, bone: 'C_Backarm4', delay: 0, duration: .6, travelSeconds: .3, stopAfter: .3 },
    { system: '87913524', action: 'attack', event: 'projectile', bone: 'C_ClawMain', targetBone: CHEST, delay: 16.16 / 30, duration: .3, travelSeconds: .3 },
    { system: 'a7e3596a', action: 'attack', event: 'hit', bone: CHEST, delay: 16.16 / 30 + .3, duration: .6 },
    { system: '37d3ac23', event: 'cast-start', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0, duration: 1.5, stopAfter: 1, fadeOut: true },
    { system: '12ac9712', event: 'cast-start', location: 'board', delay: 0, duration: 1.5, stopAfter: 1 },
    { system: '26c2f2d9', event: 'hit', delay: 0, duration: 1.5, stopAfter: 1 },
  ],
  'viktor-slam': [
    // The original board darkening holds about 2.1 s, then cuts within 1–2 frames (11-08 frame strip): stop there, no fade.
    { system: 'c4ef93f3', event: 'cast-start', location: 'board', delay: 0, duration: 2.2, stopAfter: 2.1 },
    { system: '607d7b6b', event: 'hit', delay: 0, duration: 1, stopAfter: .3 },
  ],
};
// Three-star uses the original large board system, with the same cue and runtime caps.
viktorSkills['viktor-slam-3star'] = viktorSkills['viktor-slam'].map(c => c.system === 'c4ef93f3' ? { ...c, system: 'efdd9461' } : c);

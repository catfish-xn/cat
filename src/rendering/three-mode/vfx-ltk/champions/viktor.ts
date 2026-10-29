import type { TimelineCue } from '../timeline';
export const viktorSkills: Record<string, readonly TimelineCue[]> = {
  viktor: [
    { system: 'b5077b11', action: 'attack', event: 'projectile', stationary: true, bone: 'C_Backarm4', delay: 0, duration: .6, travelSeconds: .3, stopAfter: .3 },
    { system: '87913524', action: 'attack', event: 'projectile', bone: 'C_ClawMain', delay: 16.16 / 30, duration: .3, travelSeconds: .3 },
    { system: 'a7e3596a', action: 'attack', event: 'hit', delay: 16.16 / 30 + .3, duration: .6 },
    { system: '37d3ac23', event: 'cast-start', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0, duration: 1.5, stopAfter: 1 },
    { system: '12ac9712', event: 'cast-start', location: 'board', delay: 0, duration: 1.5, stopAfter: 1 },
    { system: '26c2f2d9', event: 'hit', delay: 0, duration: 1.5, stopAfter: 1 },
  ],
  'viktor-slam': [
    { system: 'c4ef93f3', event: 'cast-start', location: 'board', delay: 0, duration: 2, stopAfter: .5 },
    { system: '607d7b6b', event: 'hit', delay: 0, duration: 1, stopAfter: .3 },
  ],
};
// Three-star uses the original large board system, with the same cue and runtime caps.
viktorSkills['viktor-slam-3star'] = viktorSkills['viktor-slam'].map(c => c.system === 'c4ef93f3' ? { ...c, system: 'efdd9461' } : c);

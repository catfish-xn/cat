import type { TimelineCue } from '../timeline';
export const warwickSkills: Record<string, readonly TimelineCue[]> = {
  warwick: [
    { system: '6b46d17d', action: 'attack', event: 'cast-start', delay: 0, duration: .4 },
    { system: '9371a532', action: 'attack', event: 'hit', delay: .2, duration: .5 },
    { system: '8c054bed', event: 'cast-start', delay: 0, duration: 1, stopAfter: .3 },
    { system: 'f7e4f133', event: 'cast-start', delay: .1, duration: 1, stopAfter: .3 },
  ],
  // A devoured receipt follows death: the renderer snapshots its actual endpoint.
  'warwick-devour': [
    { system: '0e0f35d9', event: 'hit', delay: 0, duration: .6 },
    { system: '5b93d6b5', event: 'hit', delay: 0, duration: .8 },
    { system: 'ea9bd709', event: 'hit', delay: .1, duration: .8 },
  ],
  'warwick-permanent': [{ system: '27416beb', event: 'cast-start', location: 'board', delay: 0, duration: 1.5, stopAfter: .4 }],
};

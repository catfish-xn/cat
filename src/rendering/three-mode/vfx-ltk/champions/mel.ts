import type { TimelineCue } from '../timeline';
const attack: readonly TimelineCue[] = [
  { system: '539901e6', action: 'attack', event: 'projectile', bone: 'r_hand', delay: 9.5 / 30, duration: .3, travelSeconds: .3 },
  { system: '0f2af66b', action: 'attack', event: 'hit', delay: 9.5 / 30 + .3, duration: .5 },
];
export const melSkills: Record<string, readonly TimelineCue[]> = {
  mel: [...attack,
    { system: '9f8fe9f1', event: 'cast-start', delay: 0, duration: .5 },
    { system: 'e75b9fe8', event: 'cast-start', delay: 0, duration: .5, stopAfter: .2 },
    { system: 'fe407ac6', event: 'projectile', targetLimit: 3, bone: 'L_Buffbone_Engine', delay: .2, duration: .3, travelSeconds: .3 },
    { system: '801006a8', event: 'hit', targetLimit: 3, delay: .5, duration: .6 },
  ],
  'mel-third': [...attack,
    { system: 'e2f2798d', event: 'cast-start', delay: 0, duration: .4, stopAfter: .3 },
    { system: '4c885a29', event: 'cast-start', delay: 0, duration: .4, stopAfter: .3 },
    { system: '4f2eb343', event: 'projectile', targetLimit: 5, delay: .4, duration: .4, travelSeconds: .4 },
    { system: 'a9cc7bf3', event: 'hit', targetLimit: 5, delay: .8, duration: 1 },
    { system: '3857e78b', event: 'hit', primary: true, delay: 1.2, duration: 1 },
  ],
  'mel-energy': [{ system: '3eab3582', event: 'cast-start', delay: 0, duration: .6, stopAfter: .2 }],
  'mel-shield': [{ system: '71e871c8', event: 'hit', delay: 0, duration: .2, stopAfter: .1 }],
  'mel-save': [
    { system: 'a111b8d1', event: 'cast-start', location: 'board', delay: 0, duration: 1, stopAfter: .3 },
    { system: '56881fb1', event: 'cast-start', location: 'board', delay: .3, duration: 1.7, stopAfter: .6 },
  ],
};
export const melSkill = (castIndex: number) => castIndex % 3 === 2 ? 'mel-third' : 'mel';

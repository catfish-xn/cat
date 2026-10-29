import type { TimelineCue } from '../timeline';
/** Own-skin 14.24 fragments. Script-driven timings are presentation conventions. */
export const jayceSkills: Record<string, readonly TimelineCue[]> = {
  'jayce-front': [
    { system: 'a404455c', action: 'attack', event: 'cast-start', bone: 'C_Buffbone_Glb_Center_Loc', delay: 7 / 30, duration: .5, stopAfter: 8 / 30 },
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: .3, duration: .5 },
    { system: '2143d86a', event: 'cast-start', delay: 0, duration: .5 },
    { system: 'f7fa1af5', event: 'hit', primary: true, delay: .1, duration: 1, stopAfter: .3 },
    { system: '8d9d784b', event: 'cast-start', delay: .2, duration: 1, stopAfter: .3 },
    { system: 'e07c8088', event: 'hit', primary: true, delay: .3, duration: .6 },
    { system: 'b84b5c7b', event: 'hit', delay: .3, duration: .6 },
  ],
  'jayce-back': [
    { system: '53b93f82', action: 'attack', event: 'projectile', bone: 'BUFFBONE_CSTM_WEAPON_1', delay: 8 / 30, duration: .3, travelSeconds: .3 },
    { system: '0f2af66b', action: 'attack', event: 'hit', delay: 8 / 30 + .3, duration: .5 },
    { system: '508e8c05', event: 'cast-start', bone: 'Buffbone_Cstm_Weapon_1', delay: 0, duration: .6, stopAfter: .3 },
    { system: 'e5c0f9d8', event: 'cast-start', bone: 'Buffbone_Cstm_Weapon_1', delay: .3, duration: .5, stopAfter: .2 },
    { system: 'ee2e840c', event: 'projectile', targetLimit: 3, bone: 'BUFFBONE_CSTM_WEAPON_1', delay: .3, duration: .4, travelSeconds: .4 },
    { system: '1ae6ef1d', event: 'hit', targetLimit: 3, delay: .7, duration: 1 },
  ],
  'jayce-forge-front': [
    { system: 'e8cd793f', event: 'hit', delay: 0, duration: 1.5, stopAfter: .5 },
  ],
  'jayce-forge-back': [
    { system: 'afb2ec69', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5 },
    { system: '92d79254', event: 'projectile', targetLimit: 3, delay: 0, duration: .3, travelSeconds: .3 },
    { system: 'fb47ce66', event: 'hit', targetLimit: 3, delay: .3, duration: 1, stopAfter: .4 },
  ],
};
export const jayceSkill = (form: 'front' | 'back') => `jayce-${form}`;

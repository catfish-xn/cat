import type { TimelineCue } from '../timeline';
export const sevikaSkills: Record<string, readonly TimelineCue[]> = {
  sevika: [{ system: '0f2af66b', action: 'attack', event: 'hit', delay: .3, duration: .5 }],
  'sevika-flamethrower': [
    { system: '2ef508db', event: 'cast-start', bone: 'L_ClampB', delay: 0, duration: .4 },
    { system: '5d6a1033', event: 'cast-start', bone: 'L_ClampB', delay: 0, duration: 3, stopAfter: 2 },
    { system: 'e4e1dab4', event: 'hit', delay: .2, duration: 2, stopAfter: 1.5 },
  ],
  'sevika-blue-flamethrower': [
    { system: '83de8443', event: 'cast-start', bone: 'L_ClampB', delay: 0, duration: 3, stopAfter: 2 },
    { system: '892df721', event: 'hit', delay: .2, duration: 2, stopAfter: 1.5 },
  ],
  'sevika-punch': [
    { system: '42ceec5b', event: 'cast-start', bone: 'BoxingGlove', delay: 20 / 30, duration: .7, stopAfter: 20 / 30 },
    { system: '0badab98', event: 'cast-start', bone: 'BoxingGlove', delay: 22 / 30, duration: .6, stopAfter: .5 },
    { system: '8ccb497d', event: 'hit', primary: true, delay: .8, duration: .8 },
    { system: '95fb90ce', event: 'hit', primary: true, delay: .8, duration: .8 },
  ],
  'sevika-chomp': [
    { system: '7029bc3c', event: 'projectile', bone: 'BUFFBONE_GLB_WEAPON_1', delay: 11 / 30, duration: .3, travelSeconds: .3 },
    { system: '0fbf9f17', event: 'hit', primary: true, delay: 11 / 30 + .3, duration: .8 },
    { system: '38d5b37a', event: 'hit', primary: true, delay: 11 / 30 + .3, duration: .8 },
  ],
  'sevika-jackpot': [
    { system: '91985f5e', event: 'cast-start', delay: 0, duration: .8, stopAfter: .3 },
    { system: 'dcebd22f', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', delay: .1, duration: .3, travelSeconds: .3 },
    { system: 'd98fb49e', event: 'hit', primary: true, delay: .4, duration: 1 },
    { system: '518dee63', event: 'cast-start', delay: .4, duration: 1, stopAfter: .4 },
  ],
  'sevika-rocket': [
    { system: 'dcebd22f', event: 'projectile', delay: 0, duration: .3, travelSeconds: .3 },
    { system: '4e1283b2', event: 'hit', primary: true, delay: .3, duration: .6 },
  ],
  'sevika-shield': [{ system: '518dee63', event: 'cast-start', delay: 0, duration: 1, stopAfter: .4 }],
  'sevika-coin': [{ system: '91985f5e', event: 'cast-start', delay: 0, duration: .8, stopAfter: .3 }],
};
export function sevikaSkill(move: string, outcome: string): string | undefined {
  if (!['flamethrower', 'punch', 'chomp'].includes(move)) return;
  return outcome === 'blue-flamethrower' && move === 'flamethrower' ? 'sevika-blue-flamethrower' : `sevika-${move}`;
}

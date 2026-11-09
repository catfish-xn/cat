import type { TimelineCue } from '../timeline';
/** High Roller shield mod: 500 shield for 4 s (14.24b Bonus2ShieldDuration). */
const SHIELD_SECONDS = 4;
const SLOTS = '38346d53', SLOT_SECONDS = 2.3;
/** The rolled spell lands when the right reel stops: G23_POLICY.highRoller.slotTicks (25) × 0.05 s. */
export const SEVIKA_SLOT_SECONDS = 1.25;
const SLOT_LAYERS = { flamethrower: '5af26362', punch: 'a84ed286', thrash: 'd888f50e',
  rocket: 'fced783f', shield: 'ac849f16', coin: '264aee9a', jackpot: 'd2d33ba0' } as const;
export const sevikaSkills: Record<string, readonly TimelineCue[]> = {
  sevika: [{ system: '0f2af66b', action: 'attack', event: 'hit', delay: .3, duration: .5 }],
  'sevika-flamethrower': [
    { system: '2ef508db', event: 'cast-start', bone: 'L_ClampB', delay: 0, duration: .4 },
    { system: '5d6a1033', event: 'cast-start', bone: 'L_ClampB', delay: 0, duration: 3, stopAfter: 2, fadeOut: true },
    { system: 'e4e1dab4', event: 'hit', delay: .2, duration: 2, stopAfter: 1.5 },
  ],
  'sevika-blue-flamethrower': [
    { system: '83de8443', event: 'cast-start', bone: 'L_ClampB', delay: 0, duration: 3, stopAfter: 2 },
    { system: '892df721', event: 'hit', delay: .2, duration: 2, stopAfter: 1.5 },
  ],
  'sevika-punch': [
    { system: '42ceec5b', event: 'cast-start', bone: 'BoxingGlove', delay: 20 / 30, duration: .7, stopAfter: 20 / 30 },
    { system: '0badab98', event: 'cast-start', bone: 'BoxingGlove', delay: 22 / 30, duration: .6, stopAfter: .5, fadeOut: true },
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
  ],
  'sevika-rocket': [
    { system: 'dcebd22f', event: 'projectile', delay: 0, duration: .3, travelSeconds: .3 },
    { system: '4e1283b2', event: 'hit', primary: true, delay: .3, duration: .6 },
  ],
  // The original bubble stays up for the whole shield (11-08 gRcKEl213wk) and only the shared tail fade ends it.
  'sevika-shield': [{ system: '518dee63', event: 'cast-start', delay: 0, duration: SHIELD_SECONDS }],
  'sevika-coin': [{ system: '91985f5e', event: 'cast-start', delay: 0, duration: .8, stopAfter: .3 }],
  // High Roller slot machine (14.24 map22.bin Maps/Shipping/Map22/Particles/set13/TFT13_Lieutenant_Base_Slots*): the frame
  // 169 units over her, reels locking at 0.4/0.7/1.1 s and the result flash at ~1.2 s, all gone by 2.3 s. The result layers
  // repeat the frame's reel emitters with the rolled icons and carry no frame of their own, so they draw in the machine's.
  'sevika-slots': [{ system: SLOTS, event: 'cast-start', delay: 0, duration: SLOT_SECONDS }],
  ...Object.fromEntries(Object.entries(SLOT_LAYERS).map(([result, system]) =>
    [`sevika-slots-${result}`, [{ system, event: 'cast-start', delay: 0, duration: SLOT_SECONDS, frameOf: SLOTS }] as const])),
};
/**
 * The slot layers one cast shows: the rolled spell on the reels; a plain roll's mod replaces the right reel, a Triple is
 * three of the spell, and Jackpot is its own reel set. Mirrored twins of every system exist and are not used.
 */
export function sevikaSlotSkills(move: string, outcome: string): string[] {
  if (outcome === 'jackpot' || move === 'jackpot') return ['sevika-slots', 'sevika-slots-jackpot'];
  const spell = ({ flamethrower: 'flamethrower', punch: 'punch', chomp: 'thrash' } as Record<string, string>)[move];
  if (!spell) return [];
  return ['sevika-slots', `sevika-slots-${spell}`, ...(['rocket', 'shield', 'coin'].includes(outcome) ? [`sevika-slots-${outcome}`] : [])];
}
export function sevikaSkill(move: string, outcome: string): string | undefined {
  // 14.24b Jackpot is its own spell (coins), not one of the three moves plus a bonus.
  if (move === 'jackpot') return 'sevika-jackpot';
  if (!['flamethrower', 'punch', 'chomp'].includes(move)) return;
  return outcome === 'blue-flamethrower' && move === 'flamethrower' ? 'sevika-blue-flamethrower' : `sevika-${move}`;
}

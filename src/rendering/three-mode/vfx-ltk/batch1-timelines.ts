import type { TimelineCue } from './timeline';

/** Original TFT13 system IDs. Times are visual conventions, not damage scheduling.
 * Normal attack launch bones/frames come from the exported event-mapping.json.
 * Buff windows: 14.24b Lux ShieldDuration=4, Leona Duration=3, Nocturne Duration=6.
 * Self casts deliberately contain no outbound enemy missile or enemy hit. */
const chest = 'C_BUFFBONE_GLB_CHEST_LOC', ground = 'BUFFBONE_GLB_GROUND_LOC';
const normal = (missile: string, bone: string, delay: number): TimelineCue[] => [
  { action: 'attack', system: missile, event: 'projectile', delay, duration: .3, travelSeconds: .3, bone, targetBone: chest },
  { action: 'attack', system: '0f2af66b', event: 'hit', delay: delay + .3, duration: .45, bone: chest, stopAfter: .1 },
];
const empowered = (missile: string, impact: string, bone: string, delay: number): TimelineCue[] => [
  { action: 'attack', variant: 'empowered', system: missile, event: 'projectile', delay, duration: .3, travelSeconds: .3, bone, targetBone: chest },
  { action: 'attack', variant: 'empowered', system: impact, event: 'hit', delay: delay + .3, duration: .6, stopAfter: .1, bone: chest },
];
export const BATCH1_DIRECTORIES = {
  amumu: 'tft13_amumu', zeri: 'tft13_zeri', draven: 'tft13_draven', lux: 'tft13_lux',
  leona: 'tft13_leona', nocturne: 'tft13_nocturne', kogmaw: 'tft13_kogmaw', twitch: 'tft13_twitch',
} as const;
export const BATCH1_TIMELINES: Record<keyof typeof BATCH1_DIRECTORIES, readonly TimelineCue[]> = {
  amumu: [
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: 11 / 30, duration: .45, stopAfter: .1, bone: chest },
    { action: 'passive', system: '56e6971e', event: 'cast-start', delay: 0, duration: .9, stopAfter: .7, bone: ground },
    { action: 'passive', system: 'f2b3f090', event: 'projectile', delay: 0, duration: .15, travelSeconds: .15, bone: chest, targetBone: chest },
    { action: 'passive', system: '0b982f9a', event: 'hit', delay: .15, duration: .5, stopAfter: .1, bone: chest },
  ],
  zeri: [
    ...normal('215abe6e', 'Buffbone_Glb_Weapon_1', 8 / 30),
    ...empowered('d160dfa9', 'c4b3f285', 'Buffbone_Glb_Weapon_1', 8 / 30),
  ],
  draven: [
    ...normal('617e850e', 'R_hand', .24),
    { action: 'cast', system: '3381c8eb', event: 'cast-start', delay: 0, duration: .6, stopAfter: .2, bone: 'R_Weapon' },
    { action: 'cast', system: 'd86cc9bc', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: 'L_Weapon' },
    ...empowered('5d31debe', '5e3986cd', 'R_hand', .24),
  ],
  lux: [
    ...normal('4d0368dc', 'r_hand', .25),
    { action: 'cast', system: 'f2d605de', event: 'projectile', delay: 0, duration: .3, travelSeconds: .3, bone: 'R_hand', targetBone: chest },
    { action: 'cast', system: '44c9516a', event: 'hit', delay: .3, duration: 4, stopAfter: 3.7, bone: chest },
    { action: 'cast', variant: 'self', system: '44c9516a', event: 'cast-start', delay: 0, duration: 4, stopAfter: 3.7, bone: chest },
    ...empowered('4d0368dc', '106a5167', 'r_hand', .25),
    { action: 'attack', variant: 'empowered', system: '33f42cc3', event: 'cast-start', delay: 0, duration: .55, stopAfter: .25, bone: 'R_hand' },
  ],
  leona: [
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: 11 / 30, duration: .45, stopAfter: .1, bone: chest },
    { action: 'cast', system: '8d9a4ccc', event: 'cast-start', delay: 0, duration: 3, stopAfter: 2.8, bone: chest },
    // Driven by the observed damageReduction expiration; no explosion at cast start.
    { action: 'end', system: 'dda108d2', event: 'cast-start', delay: 0, duration: 1, stopAfter: .1, bone: ground },
    { action: 'passive', system: '6f29051a', event: 'hit', delay: 0, duration: .6, stopAfter: .1, bone: chest },
  ],
  nocturne: [
    { action: 'attack', system: '0f2af66b', event: 'hit', delay: .3, duration: .45, stopAfter: .1, bone: chest },
    { action: 'cast', system: '97366927', event: 'cast-start', delay: 0, duration: 6, stopAfter: 5.8, bone: chest },
    { action: 'attack', variant: 'empowered', system: '3e224f4a', event: 'cast-start', delay: .3, duration: .5, stopAfter: .1, bone: ground },
    { action: 'attack', variant: 'empowered', system: '6fb6c5e5', event: 'hit', delay: .3, duration: .6, stopAfter: .1, bone: chest },
  ],
  kogmaw: [
    ...normal('f16dfc56', 'Jaw', .25),
    { action: 'cast', system: '6889455c', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: 'BUFFBONE_GLB_WEAPON_LOC' },
    { action: 'cast', system: '9765f3d3', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: 'C_BUFFBONE_GLB_HEAD_LOC' },
    { action: 'cast', system: '9f805f6e', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: chest },
    // The on-attack magic packet exists from the opening attack, independently of cast.
    { action: 'attack', system: '633e1b82', event: 'hit', delay: .55, duration: .6, stopAfter: .1, bone: chest },
  ],
  twitch: [
    ...normal('ba5fe1c0', 'Winch', .25),
    { action: 'cast', system: '54af463f', event: 'cast-start', delay: 0, duration: .7, stopAfter: .2, bone: 'Buffbone_Glb_Weapon_1' },
    { action: 'cast', system: '2beb0657', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: chest },
    { action: 'cast', system: '900dd2d2', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5, bone: 'Buffbone_Glb_Weapon_1' },
    ...empowered('5938e29d', '4e7cc3b1', 'Winch', .25),
  ],
};

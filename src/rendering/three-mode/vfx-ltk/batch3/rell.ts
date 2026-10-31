import { attack, cast, hit, type HeroTimelines } from './cues';
export const rell: HeroTimelines = {
  rell: [attack('0f2af66b', .26), cast('6b3b977c', .1, .6, 'Lance'), hit('d3831a9d', .3, .6), hit('5fe3dc8a', .3, .6)],
  'rell-shield': [cast('b7f04e24', 0, 9, 'C_Buffbone_Glb_Center_Loc')],
};

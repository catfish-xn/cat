import { attack, cast, hit, type HeroTimelines } from './cues';
// 11-06 field review: 14.24 keeps a bright blue ring a few cells wide on Loris's ground for the whole shield, then the
// shockwave at its end. Q_AOE is that ring; it held only the 0.7 s retaliation before.
export const loris: HeroTimelines = {
  loris: [attack('0f2af66b', .36), cast('e22b48b0', 0, .8, 'Shield_Piece5'), cast('2f1f3b60', .3, 3, 'BUFFBONE_GLB_GROUND_LOC')],
  'loris-shield': [cast('c39ce57c', 0, 9, 'C_Buffbone_GLB_Layout_Loc')],
  'loris-retaliation': [cast('2f1f3b60', 0, .7), hit('18a22b8e', 0, .6)],
};

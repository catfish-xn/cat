import { attack, cast, hit, type HeroTimelines } from './cues';
export const loris: HeroTimelines = {
  loris: [attack('0f2af66b', .36), cast('e22b48b0', 0, .8, 'Shield_Piece5')],
  'loris-shield': [cast('c39ce57c', 0, 9, 'C_Buffbone_GLB_Layout_Loc')],
  'loris-retaliation': [cast('2f1f3b60', 0, .7), hit('18a22b8e', 0, .6)],
};

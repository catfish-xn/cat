import { attack, cast, hit, missile, type HeroTimelines } from './cues';
export const silco: HeroTimelines = {
  silco: [{ ...missile('a6bde11c', .3, .3, 'R_Weapon'), action: 'attack' }, attack('0f2af66b', .6),
    missile('2b0232bc', .2, .4, 'R_Weapon'), hit('2276fa35', .6)],
  'silco-minion': [cast('c7bb8557', 0, 9)],
};

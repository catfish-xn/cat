import { attack, cast, hit, missile, type HeroTimelines } from './cues';
export const elise: HeroTimelines = {
  elise: [{ ...missile('a0484f04', .3, .3), action: 'attack' }, attack('0f2af66b', .6)],
  'elise-front': [cast('cb30a8ce', 0, .6), missile('92ff3d2c', .15, .4), hit('6d6525e8', .55), cast('cd8de747', .1, .8)],
  'elise-back': [cast('9e530234', 0, .6), hit('4997b033', .6), hit('67146483', .6, .6)],
  'elise-spider': [cast('e4185048', 0, .6)],
};

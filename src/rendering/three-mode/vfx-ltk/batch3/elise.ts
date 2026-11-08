import { attack, cast, hit, missile, type HeroTimelines } from './cues';
export const elise: HeroTimelines = {
  elise: [{ ...missile('a0484f04', .3, .3), action: 'attack' }, attack('0f2af66b', .6)],
  'elise-front': [cast('cb30a8ce', 0, .6), missile('92ff3d2c', .15, .4), hit('6d6525e8', .55), cast('cd8de747', .1, .8)],
  // 9e530234 first shows at 0.35 s and peaks at 1.0 s; 0.6 s cut it while rising. It falls under 5% by 1.78 s (11-08 run).
  'elise-back': [cast('9e530234', 0, 1.8), hit('4997b033', .6), hit('67146483', .6, .6)],
  'elise-spider': [cast('e4185048', 0, .6)],
};

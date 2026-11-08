import { attack, cast, hit, missile, type HeroTimelines } from './cues';
export const swain: HeroTimelines = {
  swain: [{ ...missile('f4e3e1bc', .26, .3, 'L_Hand'), action: 'attack' }, attack('0f2af66b', .56)],
  'swain-front': [cast('796b6af2', 0, .8)],
  'swain-ascension': [cast('d47a5f3f', 0, 9)],
  // 2a51ddb9 first shows at 0.32 s and peaks at 0.82 s; 0.55 s cut it while rising. It falls under 5% by 1.73 s (11-08 run).
  'swain-back': [cast('2a51ddb9', 0, 1.8), missile('9ad716c2', .2, .4), hit('7d6cdec7', .6)],
  'swain-pulse': [hit('7acb599b', 0, .6)],
};

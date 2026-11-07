import { attack, cast, hit, type HeroTimelines } from './cues';
export const illaoi: HeroTimelines = {
  illaoi: [attack('0f2af66b', .4), cast('704b3ed3', 0, .6, 'Relic_Center'), cast('deeb59f2', .1, .6)],
  'illaoi-channel': [cast('eefae499', 0, 9)],
  // A beam is attached, never a missile from the caster to itself. The observed
  // true-damage packet supplies its real endpoint; magic packets mark the slam.
  'illaoi-drain': [{ ...cast('2c23a200', 0, .65, 'Relic_Center'), event: 'link' }, hit('3c9f74c4', 0, .6)],
  'illaoi-slam': [cast('aca297da', 0, .8), hit('e7b648e7', 0, .6)],
};

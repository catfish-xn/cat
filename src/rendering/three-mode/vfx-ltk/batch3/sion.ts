import { attack, cast, hit, type HeroTimelines } from './cues';
export const sion: HeroTimelines = {
  'g23-sion': [attack(), cast('2b8d0d85', 0, .55), hit('85f7cefe', .55), hit('be24ce10', .55, .6)],
  'g23-sion-bound': [cast('d53b3368', 0, 9)],
  'g23-sion-unbind': [cast('5afb9708', 0, .8), cast('9118f221', 0, .8)],
  'g23-sion-shield': [cast('026c8e3c', 0, 9, 'C_Buffbone_Glb_Center_Loc')],
  // The original unleashed smoke is reused on the authoritative revive event.
  'g23-sion-revive': [cast('55e1a8e0', 0, 1.5), cast('9118f221', 0, 1)],
};

import type { ActionOutput } from '../../../../rendering3d/animation-state';
/** Original model clips over the observed lifecycle; the unit action state stays authoritative. */
export class SionAnimation {
  private bound = true;
  private revived = false;
  private transitionUntil = 0;
  private revision = 0;
  bind(bound: boolean, now: number, current: boolean): void { this.bound = bound; this.transitionUntil = !bound && current ? now + .8 : 0; this.revision++; }
  revive(): void { this.revived = true; this.revision++; }
  map(output: ActionOutput, now: number): ActionOutput {
    if (output.state === 'death' && !this.revived) return output;
    const transition = now < this.transitionUntil;
    const clip = transition ? 'tft13_sion_unshackle_enter' : this.bound ? 'cabal_idle' : this.revived
      ? ({idle:'tft13_sion_spell4_idle',move:'tft13_sion_spell4_run',attack:'tft13_sion_spell4_attack1',death:'tft13_sion_spell4_death'} as Record<string,string>)[output.state] : undefined;
    if (!clip) return output;
    return { ...output, revision: output.revision + (transition ? 1_000_000 : this.bound ? 2_000_000 : 3_000_000) + this.revision * 1000,
      loop: transition ? false : this.bound ? true : output.loop,
      playback: {clips:[clip],durationSeconds: transition ? .8 : output.playback?.durationSeconds ?? 1} };
  }
}

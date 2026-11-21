import type { TimelineCue } from '../timeline';
import { CHEST } from '../timeline';
// Attack: 14.24 TFT13_WarwickBasicAttack hits C_BUFFBONE_GLB_CHEST_LOC.
export const warwickSkills: Record<string, readonly TimelineCue[]> = {
  warwick: [
    { system: '6b46d17d', action: 'attack', event: 'cast-start', delay: 0, duration: .4 },
    { system: '9371a532', action: 'attack', event: 'hit', bone: CHEST, delay: .2, duration: .5 },
    // The frenzy aura plays its own life and ends with the frenzy (cue-overrides.ts CUE_RULE_STOPS).
    { system: '8c054bed', event: 'cast-start', delay: 0, duration: 10 },
    { system: 'f7e4f133', event: 'cast-start', delay: .1, duration: 1, stopAfter: .3 },
    // His attacks while his frenzy runs (batch2-bridge.ts: from the rules' bloodFrenzyChanged): the same swipe and hit, plus a
    // frenzy claw strike on the hit. The asset gives no order between its two strikes, so they take turns (自定，非原版,
    // Fable 11-20): empowered, then empowered-alt. Body rank, not critical: one plays on every frenzied hit.
    { system: '6b46d17d', action: 'attack', variant: 'empowered', event: 'cast-start', delay: 0, duration: .4 },
    { system: '9371a532', action: 'attack', variant: 'empowered', event: 'hit', bone: CHEST, delay: .2, duration: .5 },
    { system: '0e816dad', action: 'attack', variant: 'empowered', event: 'hit', bone: CHEST, delay: .2, duration: 1, ownLife: true, rank: 'body' },
    { system: '6b46d17d', action: 'attack', variant: 'empowered-alt', event: 'cast-start', delay: 0, duration: .4 },
    { system: '9371a532', action: 'attack', variant: 'empowered-alt', event: 'hit', bone: CHEST, delay: .2, duration: .5 },
    { system: '5bc6c713', action: 'attack', variant: 'empowered-alt', event: 'hit', bone: CHEST, delay: .2, duration: 1, ownLife: true, rank: 'body' },
  ],
  // A devoured receipt follows death: the renderer snapshots its actual endpoint.
  'warwick-devour': [
    { system: '0e0f35d9', event: 'hit', delay: 0, duration: .6 },
    { system: '5b93d6b5', event: 'hit', delay: 0, duration: .8 },
    { system: 'ea9bd709', event: 'hit', delay: .1, duration: .8 },
  ],
  'warwick-permanent': [{ system: '27416beb', event: 'cast-start', location: 'board', delay: 0, duration: 1.5, stopAfter: .4 }],
};

import type { TimelineCue } from '../timeline';
import { CHEST } from '../timeline';
/**
 * The rules' MEL_BOLT_TICKS_PER_HEX (src/simulation/cast-windup.ts), mirrored like CAST_WINDUP_TICKS in cue-overrides.ts (importing
 * the rules module from the 3D code pulls it into the render3d chunk); tests/vfx-ltk-mel-barrage.test.ts checks they stay equal.
 */
export const MEL_BOLT_TICKS_PER_HEX = 2;
/** The rules' bolt flight (ability-projectile.ts mel-barrage): MEL_BOLT_TICKS_PER_HEX a cell, at least one tick. */
const MEL_BOLT_FLIGHT = { perCell: MEL_BOLT_TICKS_PER_HEX, min: 1 } as const;
// Attack: no 14.24 Mel record on hand; the chest, as every S13 basic attack we have data for (inferred).
const attack: readonly TimelineCue[] = [
  { system: '539901e6', action: 'attack', event: 'projectile', bone: 'r_hand', targetBone: CHEST, delay: 9.5 / 30, duration: .3, travelSeconds: .3 },
  { system: '0f2af66b', action: 'attack', event: 'hit', bone: CHEST, delay: 9.5 / 30 + .3, duration: .5 },
];
export const melSkills: Record<string, readonly TimelineCue[]> = {
  // Her cast (11-21, rules 'mel-barrage'): the cast itself plays only her (empty) cast effect; her dash, her bolts and their hits play
  // when the rules report them (batch2-bridge.ts): the dash when she lands (her movement), each bolt when it leaves
  // (abilityProjectileLaunched) and flies as long as the rules' flight, each hit when that bolt lands (abilityProjectileLanded).
  mel: [...attack,
    { system: 'e75b9fe8', event: 'cast-start', delay: 0, duration: .5, stopAfter: .2 },
  ],
  'mel-dash': [{ system: '9f8fe9f1', event: 'cast-start', delay: 0, duration: .5 }],
  // Her bolts leave her left hand's locator: her skeleton has no L_Buffbone_Engine, which fell back to her feet (11-18 bone scan).
  // The flight takes the rules' own time (MEL_BOLT_TICKS_PER_HEX a cell, at least one tick), from where she stands at release.
  // Each bolt's arc only gives way (Fable 11-21): with the board full it does not play, and it never ends another run's
  // place; any newcomer may end it.
  'mel-bolt': [{ system: 'fe407ac6', event: 'projectile', bone: 'L_Buffbone_Glb_Hand_Loc', delay: 0, duration: .3, travelSeconds: .3, flightTicks: MEL_BOLT_FLIGHT, giveWay: true }],
  'mel-bolt-hit': [{ system: '801006a8', event: 'hit', delay: 0, duration: .6 }],
  // Her third cast: its own cast effects on her (no rule event ends them: each plays to its system's own end, 11-15); its
  // beams leave and land with the rules' bolts as above, and its explosion plays on the main target when that bolt lands.
  'mel-third': [...attack,
    { system: 'e2f2798d', event: 'cast-start', delay: 0, duration: 2.3 },
    { system: '4c885a29', event: 'cast-start', delay: 0, duration: 1.2 },
  ],
  'mel-third-bolt': [{ system: '4f2eb343', event: 'projectile', delay: 0, duration: .4, travelSeconds: .4, flightTicks: MEL_BOLT_FLIGHT }],
  'mel-third-hit': [{ system: 'a9cc7bf3', event: 'hit', delay: 0, duration: 1 }],
  'mel-third-blast': [{ system: '3857e78b', event: 'hit', delay: 0, duration: 6.5 }],
  // Her shield's visual plays its own life and ends when that ally's shield from her ability ends (cue-overrides.ts CUE_RULE_STOPS
  // abilityShieldEndedOnHolder). The duration is a cap past the system's own end (fitted, not original data); the old 0.1 s stop
  // came before some of its layers began.
  'mel-shield': [{ system: '71e871c8', event: 'hit', delay: 0, duration: 4.2 }],
  'mel-save': [
    { system: 'a111b8d1', event: 'cast-start', location: 'board', delay: 0, duration: 1, stopAfter: .3 },
    { system: '56881fb1', event: 'cast-start', location: 'board', delay: .3, duration: 1.7, stopAfter: .6 },
  ],
};
/** The rule reports Mel's third cast as branch `third` (combat-six-cost.ts); any other cast, or none reported, is plain. */
export const melSkill = (branch: string | undefined) => branch === 'third' ? 'mel-third' : 'mel';
/** The display branches her bolts and dash play from (batch2-bridge.ts), all repository-built (cue-overrides.ts CUE_EXTRA_SKILLS). */
export const MEL_EVENT_SKILLS = ['mel-dash', 'mel-bolt', 'mel-bolt-hit', 'mel-third-bolt', 'mel-third-hit', 'mel-third-blast'] as const;

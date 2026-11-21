import type { TimelineCue } from '../timeline';
import { S13_TIMELINES } from '../s13-timelines';
import { CHEST } from '../timeline';
/**
 * The rules' JINX_ROCKET_FLIGHT_TICKS (src/simulation/cast-windup.ts), mirrored like CAST_WINDUP_TICKS in cue-overrides.ts
 * (importing the rules module from the 3D code pulls it into the render3d chunk); tests/vfx-ltk-jinx-events.test.ts keeps them equal.
 */
export const JINX_ROCKET_FLIGHT_TICKS = 10;
/** Her rocket's and chompers' cues that play when the rules report them (batch2-bridge.ts), not at fixed times after her cast. */
export const JINX_EVENT_SYSTEMS: readonly string[] = ['449d6617', '8b59c09d', '809da1b1', 'cd05488e'];
const exported = (system: string) => S13_TIMELINES.jinx.find(cue => cue.system === system)!;
const rocketFlight = JINX_ROCKET_FLIGHT_TICKS * 0.05;
// Attack: 14.24 TFT13_JinxBasicAttack starts at Buffbone_Glb_Weapon_1 and hits C_BUFFBONE_GLB_CHEST_LOC.
export const jinxSkills: Record<string, readonly TimelineCue[]> = {
  // Her cast plays what starts with it: the zap whole, the chompers' throw, the rocket's mouth glow. The rocket's flash, flight
  // and explosion and the chompers' explosion play from the rules' events (11-21, rules 'jinx-rocket' and the chompers' landing).
  jinx: [
    ...S13_TIMELINES.jinx.filter(c => !JINX_EVENT_SYSTEMS.includes(c.system)).map(c => c.branch === 'chompers' ? { ...c, targetLimit: 3 } : c),
    { branch: 'zap', system: '40140250', event: 'projectile', stationary: true, bone: 'Cstm_Buffbone_Pistol', delay: 7.53 / 30, duration: .3, travelSeconds: .3, stopAfter: .15 },
    { system: '6d9e0430', action: 'attack', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', targetBone: CHEST, delay: 8.5 / 30, duration: .3, travelSeconds: .3 },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: CHEST, delay: 8.5 / 30 + .3, duration: .5 },
  ],
  // The rocket leaves (abilityProjectileLaunched 'jinx-rocket'): its muzzle flash, and its flight to the board's centre over
  // the rules' flight; it explodes there when it lands (abilityProjectileLanded).
  'jinx-rocket-fire': [
    { ...exported('449d6617'), branch: undefined, delay: 0 },
    { ...exported('8b59c09d'), branch: undefined, delay: 0, travelSeconds: rocketFlight, duration: rocketFlight + .15, location: 'board' },
  ],
  'jinx-rocket-boom': [{ ...exported('809da1b1'), branch: undefined, delay: 0, location: 'board' }],
  // The chompers go off (her skill's damage from them, the rules' chompers landing): their explosion on each enemy struck.
  'jinx-chompers-boom': [{ ...exported('cd05488e'), branch: undefined, delay: 0, targetLimit: 3 }],
};
/** The display branches above that the bridge plays (CUE_EXTRA_SKILLS). */
export const JINX_EVENT_SKILLS = ['jinx-rocket-fire', 'jinx-rocket-boom', 'jinx-chompers-boom'] as const;

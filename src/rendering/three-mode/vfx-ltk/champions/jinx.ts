import type { TimelineCue } from '../timeline';
import { S13_TIMELINES } from '../s13-timelines';
import { CHEST } from '../timeline';
/**
 * The rules' JINX_ROCKET_FLIGHT_TICKS (src/simulation/cast-windup.ts), mirrored like CAST_WINDUP_TICKS in cue-overrides.ts
 * (importing the rules module from the 3D code pulls it into the render3d chunk); tests/vfx-ltk-jinx-events.test.ts keeps them equal.
 */
export const JINX_ROCKET_FLIGHT_TICKS = 10;
/** Her rocket's cues that play when the rules report them (batch2-bridge.ts), not at fixed times after her cast. */
export const JINX_EVENT_SYSTEMS: readonly string[] = ['449d6617', '8b59c09d', '809da1b1'];
const exported = (system: string) => S13_TIMELINES.jinx.find(cue => cue.system === system)!;
const rocketFlight = JINX_ROCKET_FLIGHT_TICKS * 0.05;
/**
 * Her rocket as drawn (display values, measured from official footage, not original data): it flies at this many cells a
 * second, between a floor and a ceiling, and leaves the barrel that long before the tick the rules land it on; the muzzle
 * flash comes JINX_ROCKET_FLASH_LEAD before it leaves. It flies at a point this far (board units) above the cell it lands on,
 * so its body does not sink into the floor in its last frames.
 */
export const JINX_ROCKET_DRAWN = { cellsPerSecond: 10, minSeconds: 0.1, maxSeconds: rocketFlight, flashLead: 0.25, aimLift: 50 } as const;
/** Seconds her rocket is drawn flying over `cells` cells (JINX_ROCKET_DRAWN). */
export const jinxRocketFlightSeconds = (cells: number): number =>
  Math.min(JINX_ROCKET_DRAWN.maxSeconds, Math.max(JINX_ROCKET_DRAWN.minSeconds, cells / JINX_ROCKET_DRAWN.cellsPerSecond));
// Attack: 14.24 TFT13_JinxBasicAttack starts at Buffbone_Glb_Weapon_1 and hits C_BUFFBONE_GLB_CHEST_LOC.
export const jinxSkills: Record<string, readonly TimelineCue[]> = {
  // Her cast plays the zap and the chompers whole, and the rocket's mouth glow. The rocket's flash, flight and explosion play
  // from the rules' events (11-21, rules 'jinx-rocket').
  jinx: [
    ...S13_TIMELINES.jinx.filter(c => !JINX_EVENT_SYSTEMS.includes(c.system)).map(c => c.branch === 'chompers' ? { ...c, targetLimit: 3 } : c),
    { branch: 'zap', system: '40140250', event: 'projectile', stationary: true, bone: 'Cstm_Buffbone_Pistol', delay: 7.53 / 30, duration: .3, travelSeconds: .3, stopAfter: .15 },
    { system: '6d9e0430', action: 'attack', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', targetBone: CHEST, delay: 8.5 / 30, duration: .3, travelSeconds: .3 },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: CHEST, delay: 8.5 / 30 + .3, duration: .5 },
  ],
  // The rocket (rules 'jinx-rocket', batch2-bridge.ts): its muzzle flash, then its flight to the cell it lands on, timed back
  // from the tick the rules land it (JINX_ROCKET_DRAWN); it explodes there when it lands (abilityProjectileLanded).
  'jinx-rocket-flash': [
    { ...exported('449d6617'), branch: undefined, delay: 0 },
  ],
  'jinx-rocket-flight': [
    { ...exported('8b59c09d'), branch: undefined, delay: 0, travelSeconds: rocketFlight, duration: rocketFlight + .15, location: 'board' },
  ],
  'jinx-rocket-boom': [{ ...exported('809da1b1'), branch: undefined, delay: 0, location: 'board' }],
};
/** The display branches above that the bridge plays (CUE_EXTRA_SKILLS). */
export const JINX_EVENT_SKILLS = ['jinx-rocket-flash', 'jinx-rocket-flight', 'jinx-rocket-boom'] as const;

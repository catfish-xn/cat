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
/** It flies at a point this far (board units) above the cell it lands on, so its body does not sink into the floor in its last frames. */
export const JINX_ROCKET_DRAWN = { aimLift: 50 } as const;
/**
 * Her rocket as the official game draws it (量自正式服画面，非原版数据): after its muzzle flash it leaves the barrel, flies
 * straight at a steady pace to where it lands, waits there a moment, and explodes. The time from the flash to leaving the
 * barrel is when the footage first shows the rocket less the rocket's own pop-in (the asset's scale curve grows it from
 * nothing to half its size in about 0.075 s): at once at three stars (single sample), and later below (two samples whose
 * live build is not verified). The pace and the wait are the three samples'. The landing tick is the rules': the flash is
 * timed back from it.
 */
export const JINX_ROCKET_FLOWN = { leaveAfterFlash: { threeStar: 0, belowThree: 0.13 }, cellsPerSecond: 7, wait: 0.23, leastFlying: 0.1 } as const;
/**
 * When, after the rules launch her rocket (`total` seconds before they land it), its muzzle flash plays and it leaves the
 * barrel, how long it is drawn flying in all, and the share of that it takes to reach where it lands (then it waits there):
 * flash, leave, `cells` at JINX_ROCKET_FLOWN's pace, the wait, the landing. Never before the launch: a landing too soon
 * puts the flash on the launch, then cuts the wait, then the time to leave the barrel (no shorter than the three-star's),
 * and only then flies faster to reach the landing point on the landing tick. It flies
 * at least `leastFlying` (our own floor, 自定): with her cell unknown (`cells` 0) it is not drawn already at the landing point.
 */
export function jinxRocketTimes(star: number, cells: number, total: number): { flashAt: number; leaves: number; flight: number; arriveShare: number } {
  const span = Math.max(0, total), { leaveAfterFlash, cellsPerSecond, wait } = JINX_ROCKET_FLOWN;
  const lead = star >= 3 ? leaveAfterFlash.threeStar : leaveAfterFlash.belowThree;
  const flying = Math.max(JINX_ROCKET_FLOWN.leastFlying, Math.max(0, cells) / cellsPerSecond);
  // Too far for the measured times (Fable 11-28: the wait goes first, then the time from the flash to leaving the barrel,
  // down to the three-star's, and only then does it fly faster): the flash is on the launch.
  if (span < lead + flying + wait) {
    const leaves = Math.min(span, Math.max(leaveAfterFlash.threeStar, Math.min(lead, span - flying))), flight = span - leaves;
    return { flashAt: 0, leaves, flight, arriveShare: flight > 0 ? Math.min(1, flying / flight) : 1 };
  }
  const flashAt = span - wait - flying - lead, leaves = flashAt + lead, flight = span - leaves;
  return { flashAt, leaves, flight, arriveShare: flight > 0 ? Math.min(1, flying / flight) : 1 };
}
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
  // from the tick the rules land it (JINX_ROCKET_FLOWN); it explodes there when it lands (abilityProjectileLanded).
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

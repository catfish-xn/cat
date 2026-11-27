import { describe, expect, it } from 'vitest';
import { BEAM_FLIGHT_SECONDS, MIN_FLIGHT_SECONDS, landingCues } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { attackKey, attackLandings, attackOutlivesSource } from '../src/rendering/three-mode/vfx-ltk/attack-landing';
import { DEFAULT_ATTACK_FLIGHT_SECONDS, withAttackFlight, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';

const shot: TimelineCue = { action: 'attack', system: 'missile', event: 'projectile', delay: 0.25, duration: 1.5, bone: 'hand', targetBone: 'chest' };
const hit: TimelineCue = { action: 'attack', system: 'hit', event: 'hit', delay: 0.55, duration: 0.45, bone: 'chest' };
const flash: TimelineCue = { action: 'attack', system: 'flash', event: 'cast-start', delay: 0.25, duration: 0.3, bone: 'hand' };
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('ranged attack landing (rules arrival tick)', () => {
  it('a far shot leaves at its release frame and lands with its hit on the arrival tick', () => {
    const [missile, impact, muzzle] = landingCues([shot, hit, flash], { seconds: 0.4 });
    near(missile.delay, 0.25); near(missile.travelSeconds!, 0.15); near(impact.delay, 0.4);
    // What the missile plays after landing is kept: 1.5 s written with the default flight leaves 1.2 s.
    near(missile.duration, 0.15 + 1.5 - DEFAULT_ATTACK_FLIGHT_SECONDS);
    expect(muzzle).toEqual(flash);
  });
  it('a near shot still flies MIN_FLIGHT_SECONDS, its hit after the arrival tick', () => {
    const [missile, impact] = landingCues([shot, hit], { seconds: 0.1 });
    near(missile.delay, 0.25); near(missile.travelSeconds!, MIN_FLIGHT_SECONDS); near(impact.delay, 0.25 + MIN_FLIGHT_SECONDS);
  });
  it('leaving on the attack event flies the rules ticks exactly', () => {
    const [missile, impact] = landingCues([shot, hit], { seconds: 0.4 }, 'event');
    near(missile.delay, 0); near(missile.travelSeconds!, 0.4); near(impact.delay, 0.4);
  });
  it('a beam and its hit go off on the attack event', () => {
    const [missile, impact] = landingCues([shot, hit], { seconds: 0, beam: true });
    near(missile.delay, 0); near(missile.travelSeconds!, BEAM_FLIGHT_SECONDS); near(impact.delay, 0);
    const beam = { ...shot, stationary: true, travelSeconds: 0.3 };
    const [still, struck] = landingCues([beam, hit], { seconds: 0, beam: true });
    expect(still).toEqual({ ...beam, delay: 0 }); near(struck.delay, 0);
  });
  it('a melee swing (no projectile) and a cast are left as they are', () => {
    expect(landingCues([hit, flash], { seconds: 0.4 })).toEqual([hit, flash]);
    const cast = { ...shot, action: 'cast' as const, travelSeconds: 0.3 };
    expect(landingCues([cast, { ...hit, action: 'cast' as const }], { seconds: 0.4 })).toEqual([cast, { ...hit, action: 'cast' }]);
  });
});

// #791 x #749 (Fable 11-27): a ranged attack the rules launched lands and hurts even if its attacker dies in flight, so its
// projectile is played with outlivesSource (it flies on, #863); the wind-up before the launch still goes with the attacker.
describe('a launched ranged attack outlives its attacker', () => {
  it('the launch play and a landing without a phase outlive the attacker; the wind-up play and a plain attack do not', () => {
    expect(attackOutlivesSource({ seconds: 0.4, phase: 'launch' })).toBe(true);
    expect(attackOutlivesSource({ seconds: 0.4 })).toBe(true);
    expect(attackOutlivesSource({ seconds: 0, phase: 'windup', windupSeconds: 0.3 })).toBe(false);
    expect(attackOutlivesSource(undefined)).toBe(false);
  });
});

describe('attackLandings', () => {
  const attack = (tick: number, targetId: string) => ({ type: 'attack', tick, attackerId: 'a', targetId }) as unknown as DisplayCombatEvent;
  const launch = (tick: number, targetId: string, arrivalTick: number, projectile: 'flight' | 'beam' = 'flight') =>
    ({ type: 'attackLaunched', tick, attackerId: 'a', targetId, arrivalTick, projectile }) as unknown as DisplayCombatEvent;
  it('reads seconds to the arrival tick, and beams', () => {
    const map = attackLandings([attack(10, 'x'), launch(10, 'x', 18), attack(30, 'y'), launch(30, 'y', 30, 'beam')]);
    expect(map.get(attackKey('a', 10))).toEqual({ seconds: 0.4 });
    expect(map.get(attackKey('a', 30))).toEqual({ seconds: 0, beam: true });
    expect(map.has(attackKey('a', 50))).toBe(false);
  });
  it('an attack launching at several targets lands as its own target does', () => {
    const map = attackLandings([attack(10, 'x'), launch(10, 'z', 20), launch(10, 'x', 14), launch(10, 'w', 22)]);
    expect(map.get(attackKey('a', 10))).toEqual({ seconds: 0.2 });
  });
});

describe('default attack flight', () => {
  it('fills only an attack projectile written without one', () => {
    expect(withAttackFlight(shot).travelSeconds).toBe(DEFAULT_ATTACK_FLIGHT_SECONDS);
    expect(withAttackFlight({ ...shot, travelSeconds: 0.5 }).travelSeconds).toBe(0.5);
    expect(withAttackFlight(hit)).toBe(hit);
    expect(withAttackFlight({ ...shot, stationary: true })).toEqual({ ...shot, stationary: true });
  });
  it('the reviewed attack projectiles write no flight: the landing event times it (the batch1 helpers keep theirs)', () => {
    const systems = ['85788d2c', 'ec6aaee6', 'ed157b4e', '4ddee85c', '9ad0dd7c', 'ba5fe1c0', '5938e29d', 'ffa688fa', '7f403068',
      '01873936', '5a18496c', '714bd6e8', '3c65ee71', 'bdceb760', 'cbd8e1cc', '06e90178', '4f6da7bc', '952026ec'];
    const written = Object.values(CUE_OVERRIDES).flat().filter(cue => cue.action === 'attack' && cue.event === 'projectile' && systems.includes(cue.system));
    expect(new Set(written.map(cue => cue.system)).size).toBe(18);
    expect(written.filter(cue => cue.travelSeconds !== undefined)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { landingPlan, type PlannedEffect } from '../src/rendering/three-mode/action-effect-plan';
import { TRACER_SECONDS, tracerDelay } from '../src/rendering/three-mode/skill-feel';
import { BEAM_FLIGHT_SECONDS, MIN_FLIGHT_SECONDS } from '../src/rendering/three-mode/vfx-ltk/runtime';

// The three paths outside the LTK timeline (reduced motion, champions without a timeline, the asset fallback) time a ranged
// attack's hit by the rules' arrival (attackLaunched), like landingCues does for the timeline.
const plan: PlannedEffect[] = [
  { id: 'muzzle', playback: { anchor: 'source', delay: 0.05, maxDuration: 0.3 } },
  { id: 'bullet', playback: { anchor: 'projectile', delay: 0.12, maxDuration: 0.3 } },
  { id: 'hit', playback: { anchor: 'target', delay: 0.42, maxDuration: 0.4 } },
];

describe('asset fallback: landingPlan', () => {
  it('flies the projectile from its own delay to the arrival and starts the hit on it', () => {
    const out = landingPlan(plan, { seconds: 0.4 }, MIN_FLIGHT_SECONDS, BEAM_FLIGHT_SECONDS);
    expect(out.find(e => e.id === 'muzzle')!.playback).toEqual(plan[0].playback);
    expect(out.find(e => e.id === 'bullet')!.playback).toMatchObject({ delay: 0.12, maxDuration: 0.4 - 0.12 });
    expect(out.find(e => e.id === 'hit')!.playback.delay).toBeCloseTo(0.4, 10);
  });
  it('a near target keeps the shortest flight, so its hit is late by at most that much', () => {
    const out = landingPlan(plan, { seconds: 0.1 }, MIN_FLIGHT_SECONDS, BEAM_FLIGHT_SECONDS);
    expect(out.find(e => e.id === 'bullet')!.playback.maxDuration).toBe(MIN_FLIGHT_SECONDS);
    expect(out.find(e => e.id === 'hit')!.playback.delay).toBeCloseTo(0.12 + MIN_FLIGHT_SECONDS, 10);
  });
  it('a beam plays its projectile and hit on the attack event', () => {
    const out = landingPlan(plan, { seconds: 0, beam: true }, MIN_FLIGHT_SECONDS, BEAM_FLIGHT_SECONDS);
    expect(out.find(e => e.id === 'bullet')!.playback).toMatchObject({ delay: 0, maxDuration: BEAM_FLIGHT_SECONDS });
    expect(out.find(e => e.id === 'hit')!.playback.delay).toBe(0);
  });
  it('an attack without a projectile (melee assets) is unchanged', () => {
    const melee = plan.filter(e => e.playback.anchor !== 'projectile');
    expect(landingPlan(melee, { seconds: 0.4 }, MIN_FLIGHT_SECONDS, BEAM_FLIGHT_SECONDS)).toEqual(melee);
  });
});

describe('skill-feel tracer: tracerDelay', () => {
  it('lands the spark on the arrival, never sooner than one tracer flight', () => {
    expect(tracerDelay({ seconds: 0.4 }) + TRACER_SECONDS).toBeCloseTo(0.4, 10);
    expect(tracerDelay({ seconds: 0.05 })).toBe(0);
  });
  it('keeps the old 0.1 s start without a landing (dummies, old replays)', () => {
    expect(tracerDelay(undefined)).toBe(0.1);
  });
});

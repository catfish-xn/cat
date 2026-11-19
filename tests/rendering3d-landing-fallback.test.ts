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
    expect(tracerDelay({ seconds: 0.4 })! + TRACER_SECONDS).toBeCloseTo(0.4, 10);
    expect(tracerDelay({ seconds: 0.05 })).toBe(0);
  });
  it('keeps the old 0.1 s start without a landing (dummies, old replays)', () => {
    expect(tracerDelay(undefined)).toBe(0.1);
  });
});

// ---- The rules' wind-up (attackWindup, 11-19): the swing on the attack start, the shot on the launch ----
import { landingCues } from '../src/rendering/three-mode/vfx-ltk/runtime';
describe('wind-up phases', () => {
  const cues = [
    { action: 'attack' as const, event: 'cast-start' as const, delay: 0.1, duration: 0.3, system: 'muzzle' },
    { action: 'attack' as const, event: 'projectile' as const, delay: 0.3, duration: 0.3, travelSeconds: 0.3, system: 'bullet' },
    { action: 'attack' as const, event: 'hit' as const, delay: 0.6, duration: 0.45, system: '0f2af66b' },
  ];
  it('the attack start plays the swing\'s own cues and none of the shot', () => {
    expect(landingCues(cues, { seconds: 0, phase: 'windup', windupSeconds: 0.3 }).map(c => [c.system, c.delay])).toEqual([['muzzle', 0.1]]);
  });
  it('a fire frame later than the launch is reached sooner: cues before it speed up', () => {
    const out = landingCues(cues, { seconds: 0, phase: 'windup', windupSeconds: 0.15 });
    expect(out.map(c => [c.system, c.delay])).toEqual([['muzzle', 0.05]]);
  });
  it('the launch plays only the shot: it leaves now and its hit lands on the arrival', () => {
    const out = landingCues(cues, { seconds: 0.4, phase: 'launch' });
    expect(out.map(c => [c.system, c.delay, c.event === 'projectile' ? c.travelSeconds : null])).toEqual([['bullet', 0, 0.4], ['0f2af66b', 0.4, null]]);
    // Farther is later.
    expect(landingCues(cues, { seconds: 0.2, phase: 'launch' }).find(c => c.event === 'hit')!.delay).toBe(0.2);
  });
  it('the fallbacks follow the same phases', () => {
    expect(tracerDelay({ seconds: 0, phase: 'windup' })).toBeUndefined();
    expect(tracerDelay({ seconds: 0.4, phase: 'launch' })! + TRACER_SECONDS).toBeCloseTo(0.4, 10);
    expect(landingPlan(plan, { seconds: 0, phase: 'windup' }, MIN_FLIGHT_SECONDS, BEAM_FLIGHT_SECONDS).map(e => e.id)).toEqual(['muzzle']);
    const launch = landingPlan(plan, { seconds: 0.4, phase: 'launch' }, MIN_FLIGHT_SECONDS, BEAM_FLIGHT_SECONDS);
    expect(launch.map(e => [e.id, e.playback.delay])).toEqual([['bullet', 0], ['hit', 0.4]]);
  });
});

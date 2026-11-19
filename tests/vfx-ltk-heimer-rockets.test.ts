import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES, HEIMER_ROCKETS, heimerRocketLandTick } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline, strikeCurve, strikeOffsetTicks, STRIKE_TICK_SECONDS } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Heimerdinger's cast: one rocket and one hit a rule strike (the cast's targets keep one entry a strike, repeats included),
// staggered and curving out before they turn in. All timings and curve sizes are designed, not original data.
const cast = CUE_OVERRIDES.heimerdinger!.filter(cue => (cue.action ?? 'cast') === 'cast');
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('Heimerdinger rockets (perStrike)', () => {
  it('lands the k-th of n rockets 14 ticks after the cast plus one tick a rocket, squeezed into 9 ticks', () => {
    expect([0, 1, 2, 3, 4].map(k => heimerRocketLandTick(k, 5))).toEqual([14, 15, 16, 17, 18]);
    expect(heimerRocketLandTick(9, 10)).toBe(23);
    const twelve = Array.from({ length: 12 }, (_, k) => heimerRocketLandTick(k, 12));
    expect(twelve[0]).toBe(14); expect(twelve[11]).toBe(14 + HEIMER_ROCKETS.spreadTicks);
    for (let k = 1; k < 12; k++) expect(twelve[k]!).toBeGreaterThanOrEqual(twelve[k - 1]!);
    expect(heimerRocketLandTick(0, 1)).toBe(14);
  });

  it('plays one rocket and one hit a strike, each on its own target, the hit when its rocket lands', () => {
    const targets = ['a', 'a', 'b', 'c', 'a'];
    const { spawns, unsupported } = mapSkillTimeline(cast, 'heimer', targets);
    expect(unsupported).toEqual([]);
    const rockets = spawns.filter(s => s.system === 'c8d6ee2e'), hits = spawns.filter(s => s.system === '07c9833a');
    expect(rockets.map(s => s.targetId)).toEqual(targets);
    expect(hits.map(s => s.targetId)).toEqual(targets);
    rockets.forEach((rocket, k) => {
      expect(rocket.strike).toBe(k);
      close(rocket.delay, (HEIMER_ROCKETS.launchTicks + strikeOffsetTicks(k, 5, 1, 9)) * STRIKE_TICK_SECONDS);
      close(rocket.delay + rocket.travelSeconds!, heimerRocketLandTick(k, 5) * STRIKE_TICK_SECONDS);
      close(hits[k]!.delay, heimerRocketLandTick(k, 5) * STRIKE_TICK_SECONDS);
      expect(hits[k]!.curve).toBeUndefined();
    });
    expect(spawns.filter(s => s.system === 'c44d51d0')).toHaveLength(1);
  });

  it('sends consecutive rockets out on opposite sides, each climbing, and brings them down onto the target', () => {
    const curves = [0, 1, 2, 3, 4].map(k => strikeCurve(k, 5, { side: 0.9, lift: 0.6 }));
    const sides = curves.map(c => c.control1[0]);
    expect(new Set(sides).size).toBe(5);
    for (let k = 1; k < 5; k++) expect(Math.sign(sides[k]!) * Math.sign(sides[k - 1]!)).toBeLessThanOrEqual(0);
    for (const c of curves) { expect(c.control1[1]).toBeGreaterThan(0); expect(c.control2[1]).toBeLessThan(0); expect(c.control2[2]).toBe(1); }
    expect(strikeCurve(0, 1, { side: 0.9, lift: 0.6 }).control1[0]).toBe(0);
  });

  it('draws at most HEIMER_ROCKETS.shown rockets a cast; the later strikes keep their hits on the same stagger', () => {
    const targets = ['a', 'b', 'a', 'c', 'a', 'b', 'c'];
    const { spawns } = mapSkillTimeline(cast, 'heimer', targets);
    const rockets = spawns.filter(s => s.system === 'c8d6ee2e'), hits = spawns.filter(s => s.system === '07c9833a');
    expect(rockets.map(s => s.strike)).toEqual([0, 1, 2, 3, 4]);
    expect(hits.map(s => s.targetId)).toEqual(targets);
    hits.forEach((hit, k) => close(hit.delay, heimerRocketLandTick(k, 7) * STRIKE_TICK_SECONDS));
    expect(new Set(hits.map(h => h.delay)).size).toBe(7);
    expect(rockets[0]!.perStrike?.tickCap).toBe(HEIMER_ROCKETS.tickCap);
  });

  it('leaves out strike entries that name the caster and keeps other cues per distinct target', () => {
    const { spawns } = mapSkillTimeline(cast, 'heimer', ['heimer', 'a', 'a']);
    expect(spawns.filter(s => s.system === 'c8d6ee2e').map(s => s.targetId)).toEqual(['a', 'a']);
    const plain = mapSkillTimeline([{ system: 'x', action: 'cast', event: 'hit', delay: 0, duration: 1 }], 'heimer', ['a', 'a', 'b']);
    expect(plain.spawns.map(s => s.targetId)).toEqual(['a', 'b']);
  });
});

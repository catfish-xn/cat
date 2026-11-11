import { describe, expect, it } from 'vitest';
import { projectileFlight } from '../src/rendering/three-mode/vfx-ltk/particles';
import { flightTrack, trackPositionAt } from '../src/rendering/three-mode/vfx-ltk/engine/model/missile';
import { FIRST_FLIGHT } from '../src/rendering/three-mode/vfx-ltk/engine/model/rig';

describe('cue projectile flight', () => {
  it('without an arc is the straight flight it always was', () => {
    expect(projectileFlight(300, 0.3)).toEqual({ ...FIRST_FLIGHT, movement: { kind: 'fixedSpeed', speed: 1000 } });
    const track = flightTrack({ flight: projectileFlight(300, 0.3), from: [0, 50, 0], to: [300, 50, 0], launchHeight: 0 });
    expect(track.arrival).toBeCloseTo(0.3, 2);
    for (const t of [0, 0.1, 0.2, 0.3]) expect(trackPositionAt(track, t)[1]).toBeCloseTo(50, 3); // no height change
  });
  it('with an arc starts at the launch point, lands on the lifted target after the travel time, and peaks between', () => {
    // Synthetic numbers: gravity 5000 units/s², target lifted 100, 0.4 s, hand at 60 high to a point 120 high, 200 away.
    const flight = projectileFlight(200, 0.4, { gravity: 5000, targetOffset: 100 });
    const track = flightTrack({ flight, from: [0, 60, 0], to: [200, 120, 0], launchHeight: 0 });
    expect(track.arrival).toBeCloseTo(0.4, 2);
    const start = trackPositionAt(track, 0), end = trackPositionAt(track, 0.4);
    expect(start[0]).toBeCloseTo(0, 3); expect(start[1]).toBeCloseTo(60, 1);
    expect(end[0]).toBeCloseTo(200, 0); expect(end[1]).toBeCloseTo(220, 0);
    let apex = -Infinity; for (let t = 0; t <= 0.4; t += 0.01) apex = Math.max(apex, trackPositionAt(track, t)[1]);
    // Ballistic: v0 = (Δy + g·T²/2) / T = 1400, apex = y0 + v0² / 2g = 256 at t = v0 / g = 0.28 s.
    expect(apex).toBeGreaterThan(220); expect(apex).toBeCloseTo(256, -1);
    expect(trackPositionAt(track, 0.28)[1]).toBeCloseTo(apex, 0);
  });
});

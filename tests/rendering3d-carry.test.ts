import { describe, expect, it } from 'vitest';
import { CARRY_3D, CARRY_HOLDS, CarryMotion } from '../src/rendering/three-mode/unit-control';

// A unit held up by another (presentation only; the rules keep it on its cell): it rises to the holder's grip, follows it
// while held, comes back down onto its own spot when let go, and drops at once if the holder or the held unit dies.
const run = (m: CarryMotion, seconds: number, toward: { x: number; y: number; z: number } | null, dt = 1 / 60) => {
  let last = { ...m.offset }; for (let t = 0; t < seconds - 1e-9; t += dt) last = { ...m.update(dt, toward) }; return last;
};

describe('3D: carried by another unit (CarryMotion)', () => {
  it('rises to the grip in riseSeconds and follows it while held', () => {
    const m = new CarryMotion();
    m.start();
    const half = run(m, CARRY_3D.riseSeconds / 2, { x: 30, y: 40, z: -10 });
    expect(half.x).toBeGreaterThan(0); expect(half.x).toBeLessThan(30);
    const up = run(m, CARRY_3D.riseSeconds, { x: 30, y: 40, z: -10 });
    expect(up).toEqual({ x: 30, y: 40, z: -10 });
    // The holder turns: the body goes with the grip, no lag once up.
    expect(run(m, 1 / 60, { x: -20, y: 35, z: 5 })).toEqual({ x: -20, y: 35, z: 5 });
    expect(m.held).toBe(true); expect(m.active).toBe(true);
  });

  it('comes back down onto its own spot in fallSeconds when let go', () => {
    const m = new CarryMotion();
    m.start(); run(m, 0.5, { x: 30, y: 40, z: 0 });
    m.release();
    const mid = run(m, CARRY_3D.fallSeconds / 2, null);
    expect(mid.y).toBeGreaterThan(0); expect(mid.y).toBeLessThan(40);
    expect(run(m, CARRY_3D.fallSeconds, null)).toEqual({ x: 0, y: 0, z: 0 });
    expect(m.active).toBe(false);
  });

  it('drops back at once when the holder or the held unit dies (no grip, or release with drop)', () => {
    const lost = new CarryMotion();
    lost.start(); run(lost, 0.5, { x: 30, y: 40, z: 0 });
    // Held but no grip this frame: the holder is gone.
    expect(lost.update(1 / 60, null)).toEqual({ x: 0, y: 0, z: 0 });
    expect(lost.active).toBe(false);
    const dead = new CarryMotion();
    dead.start(); run(dead, 0.5, { x: 30, y: 40, z: 0 });
    dead.release(true);
    expect(dead.offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(dead.update(1 / 60, null)).toEqual({ x: 0, y: 0, z: 0 });
    expect(dead.active).toBe(false);
  });

  it('once up it stays near the highest grip: another clip of the holder sways it but does not put it down', () => {
    const m = new CarryMotion();
    m.start(); run(m, 0.5, { x: 30, y: 40, z: 0 });
    // The holder's basic attack swings the grip down to the ground: the body keeps holdFloor of its highest grip.
    expect(run(m, 0.2, { x: 10, y: 2, z: 0 })).toEqual({ x: 10, y: 40 * CARRY_3D.holdFloor, z: 0 });
    // A higher grip raises it again; letting go still brings it all the way down.
    expect(run(m, 1 / 60, { x: 0, y: 50, z: 0 }).y).toBe(50);
    m.release(); expect(run(m, CARRY_3D.fallSeconds * 2, null)).toEqual({ x: 0, y: 0, z: 0 });
    // The next hold starts with no floor.
    m.start(); expect(run(m, 0.5, { x: 0, y: 10, z: 0 }).y).toBe(10);
  });

  it('a new hold after a drop starts from its own spot', () => {
    const m = new CarryMotion();
    m.start(); run(m, 0.5, { x: 30, y: 40, z: 0 }); m.release(true);
    m.start(); const first = m.update(1 / 60, { x: 10, y: 10, z: 10 });
    expect(first.x).toBeLessThan(10);
  });

  it('Renni holds the enemy upside down on the upper end of her chainsaw', () => {
    expect(CARRY_HOLDS.renni!.upsideDown).toBe(true);
    expect(CARRY_HOLDS.renni!.bones.some(bone => /chainsaw/i.test(bone))).toBe(true);
  });
});

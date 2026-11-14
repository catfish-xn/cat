import { describe, expect, it } from 'vitest';
import { CONTROL_3D, ControlMotion, GRAB_3D } from '../src/rendering/three-mode/unit-control';
import { VI_SLAM_TICKS } from '../src/simulation/combat-g2-2';

// Vi holds her target up until her slam and slams it down to land on the slam tick (rules: VI_SLAM_TICKS).
const SLAM = GRAB_3D.viSlamTicks / 20;
const frames = (m: ControlMotion, seconds: number, dt = 1 / 60) => { const out: number[] = []; for (let t = 0; t < seconds - 1e-9; t += dt) out.push(m.update(dt)); return out; };

describe('3D: Vi grab (held up, slammed down on the slam tick)', () => {
  it('the renderer and the rules time the slam on one constant', () => {
    expect(GRAB_3D.viSlamTicks).toBe(VI_SLAM_TICKS);
  });
  it('rises, holds at the peak and lands exactly as the slam tick comes', () => {
    const m = new ControlMotion(CONTROL_3D);
    m.set('airborne'); m.grab(SLAM);
    const lift = frames(m, SLAM);
    expect(Math.max(...lift)).toBeCloseTo(GRAB_3D.peakShare, 5);
    expect(lift[Math.round((GRAB_3D.riseSeconds + 0.05) * 60)]).toBeCloseTo(GRAB_3D.peakShare, 5);
    expect(lift.at(-2)!).toBeGreaterThan(0);
    expect(m.update(1 / 60)).toBe(0); // landed on the slam tick, and stays down
    expect(m.update(0.2)).toBe(0);
  });
  it('a knock-up shown with the grab starts no arc of its own, in either order', () => {
    const first = new ControlMotion(CONTROL_3D);
    first.set('airborne'); first.update(0.1); first.grab(SLAM);
    const after = frames(first, SLAM + 0.3);
    expect(after.findIndex(x => x === 0)).toBeGreaterThan(Math.round((SLAM - 0.1) * 60) - 2);
    const second = new ControlMotion(CONTROL_3D);
    second.grab(SLAM); second.set('airborne');
    frames(second, SLAM); expect(second.update(0.05)).toBe(0);
  });
  it('the lean never passes the knock-up lean while held higher', () => {
    const m = new ControlMotion(CONTROL_3D);
    m.grab(SLAM); frames(m, 0.3);
    expect(m.lift).toBeCloseTo(GRAB_3D.peakShare, 5);
    expect(m.lean).toBeCloseTo(CONTROL_3D.leanRadians, 5);
  });
});

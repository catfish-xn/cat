import { describe, expect, it } from 'vitest';
import { CARRY_3D, CARRY_HOLDS, CarryMotion, HOLD_LIFT_WAIT_SECONDS, HolderPose, carryRise, heldBarLift } from '../src/rendering/three-mode/unit-control';
import type { ActionOutput } from '../src/rendering3d/animation-state';

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

  // The holder's own body (Fable 11-17): lift, held pose looping until the rules let go (no attack swing), then the slam.
  const clips = { in: 'lift', loop: 'held', slam: 'slam' }, lengths: Record<string, number> = { lift: 1.4, held: 0.4, slam: 1.1 };
  const seconds = (name: string) => lengths[name];
  const out = (state: ActionOutput['state'], revision: number): ActionOutput => ({ state, previous: 'idle', blendSeconds: 0.12, loop: state === 'idle', revision });
  const clipOf = (o: ActionOutput) => o.playback?.clips[0];

  it('a holder lifts, holds its pose through an attack, and slams when the rules let go', () => {
    const pose = new HolderPose();
    pose.cast(10);
    const lifting = pose.map(out('cast', 1), 10.2, clips, seconds);
    expect(clipOf(lifting)).toBe('lift'); expect(lifting.loop).toBe(false);
    pose.lift(10.4);
    // The rules' attack mid-hold: the unit's state says attack, the body keeps the lift and then the looping pose.
    expect(pose.map(out('attack', 2), 11, clips, seconds).revision).toBe(lifting.revision);
    const held = pose.map(out('attack', 2), 11.5, clips, seconds);
    expect(clipOf(held)).toBe('held'); expect(held.loop).toBe(true);
    expect(pose.map(out('idle', 3), 12.2, clips, seconds).revision).toBe(held.revision);
    pose.release(12.3);
    const slam = pose.map(out('idle', 3), 12.3, clips, seconds);
    expect(clipOf(slam)).toBe('slam'); expect(slam.loop).toBe(false); expect(slam.revision).not.toBe(held.revision);
    // After the slam the unit's own action is back.
    expect(pose.map(out('idle', 3), 12.3 + 1.2, clips, seconds)).toEqual(out('idle', 3));
    expect(pose.active).toBe(false);
  });

  it('a holder cast that lifts nobody plays as a plain cast after the wait; a death ends the pose at once', () => {
    const none = new HolderPose();
    none.cast(0);
    expect(clipOf(none.map(out('cast', 1), 0.5, clips, seconds))).toBe('lift');
    expect(none.map(out('cast', 1), HOLD_LIFT_WAIT_SECONDS + 0.1, clips, seconds)).toEqual(out('cast', 1));
    const dying = new HolderPose();
    dying.cast(0); dying.lift(0.4);
    expect(dying.map(out('death', 5), 0.8, clips, seconds)).toEqual(out('death', 5));
    expect(dying.active).toBe(false);
  });

  it('Renni holds with her own stun clips', () => {
    expect(CARRY_HOLDS.renni!.pose).toEqual({ in: 'spell1_stun', loop: 'spell1_stun_loop', slam: 'spell1_throw' });
  });

  it('an impaled body hangs with its middle on the grip, not its head (gripShare)', () => {
    // Grip 100 above the held spot, body 40 tall, hung upside down: feet at 120, head at 80, middle on the grip.
    expect(carryRise(100, 40, { upsideDown: true, gripShare: 0.5 })).toBe(120);
    expect(carryRise(100, 40, { upsideDown: true })).toBe(140);
    expect(carryRise(100, 40, { upsideDown: false })).toBe(100);
    expect(carryRise(-10, 40, undefined)).toBe(0);
    expect(CARRY_HOLDS.renni!.gripShare).toBe(0.5);
  });

  it('bars over a held body follow it up and sit over its feet once it hangs (heldBarLift)', () => {
    // Upright (no turn): the bars take the whole lift, as a knock-up.
    expect(heldBarLift(120, 40, 0)).toBe(120);
    // Fully turned over: the body's top is its feet, so the bars sit one body height lower than over an upright body.
    expect(heldBarLift(120, 40, Math.PI)).toBeCloseTo(80);
    // Half way the top is still the feet (the body lies flat).
    expect(heldBarLift(120, 40, Math.PI / 2)).toBeCloseTo(80);
    // A quarter turn keeps part of the body above the feet.
    expect(heldBarLift(120, 40, Math.PI / 4)).toBeCloseTo(120 - 40 * (1 - Math.cos(Math.PI / 4)));
    // And they move with the carry sideways: the carry's offset is a world offset of the whole body.
    const m = new CarryMotion(); m.start(); const at = run(m, 0.5, { x: 30, y: 120, z: -10 });
    expect([at.x, at.z]).toEqual([30, -10]);
  });
});

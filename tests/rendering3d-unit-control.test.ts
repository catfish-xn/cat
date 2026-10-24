import { describe, expect, it } from 'vitest';
import { CONTROL_3D, ControlMotion, createStunHalo } from '../src/rendering/three-mode/unit-control';
import { UnitActionState } from '../src/rendering3d/animation-state';

describe('3D crowd control', () => {
  it('a knock-up rises over riseSeconds, holds while it lasts and falls back once it ends', () => {
    const motion = new ControlMotion({ riseSeconds: 0.2, fallSeconds: 0.2 });
    expect(motion.set('airborne')).toBe(true);
    expect(motion.update(0.1)).toBeCloseTo(0.875);
    expect(motion.update(0.5)).toBe(1);
    expect(motion.set('airborne')).toBe(false);
    expect(motion.set(null)).toBe(false);
    expect(motion.active).toBe(true); // still coming down
    expect(motion.update(0.1)).toBeCloseTo(0.75);
    expect(motion.update(0.2)).toBe(0);
    expect(motion.active).toBe(false);
  });

  it('a stun never lifts; turning a knock-up into a stun drops it', () => {
    const motion = new ControlMotion();
    expect(motion.set('stun')).toBe(true);
    expect(motion.update(1)).toBe(0);
    motion.set('airborne'); motion.update(1);
    expect(motion.set('stun')).toBe(false); // already controlled: the action was stopped at the start
    expect(motion.update(CONTROL_3D.fallSeconds)).toBe(0);
    motion.clear();
    expect(motion.control).toBeNull();
  });

  it('interrupt drops a swing to idle and leaves death alone', () => {
    const state = new UnitActionState('a');
    state.consume({ type: 'attack', attackerId: 'a' });
    expect(state.output.state).toBe('attack');
    const revision = state.output.revision;
    expect(state.interrupt().state).toBe('idle');
    expect(state.output.revision).toBe(revision + 1);
    state.consume({ type: 'death', unitId: 'a' });
    expect(state.interrupt().state).toBe('death');
  });

  it('the star ring circles over the head and disposes', () => {
    const halo = createStunHalo();
    expect(halo.object.children).toHaveLength(CONTROL_3D.stars);
    const before = halo.object.children[0]!.position.clone();
    halo.update(0.3);
    expect(halo.object.children[0]!.position.distanceTo(before)).toBeGreaterThan(1);
    for (const star of halo.object.children) expect(Math.hypot(star.position.x, star.position.z)).toBeCloseTo(CONTROL_3D.ringRadius);
    halo.dispose();
    expect(halo.object.children).toHaveLength(0);
  });
});

describe('3D forced moves', () => {
  it('pulls, grabs and knockbacks hop once along the slide; other moves do not', async () => {
    const { DISPLACEMENT_REASONS, displacementHop } = await import('../src/rendering/three-mode/unit-control');
    expect([...DISPLACEMENT_REASONS].sort()).toEqual(['mordekaiser-pull', 'sett-grab', 'sevika-knockback']);
    expect(DISPLACEMENT_REASONS.has('ambessa-chain')).toBe(false); // her own dash stays a run
    expect(displacementHop(0, 0.3)).toBe(0);
    expect(displacementHop(0.15, 0.3)).toBeCloseTo(1);
    expect(displacementHop(0.3, 0.3)).toBe(0);
  });
});

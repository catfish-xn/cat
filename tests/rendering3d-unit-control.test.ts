import { describe, expect, it } from 'vitest';
import { CONTROL_3D, ControlMotion, HIT_FLASH_3D, createHitFlash, createStunHalo } from '../src/rendering/three-mode/unit-control';
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

  it('a control is shown for at least minShownSeconds: a 0.25 s knock-up still reaches the top before it falls', () => {
    const motion = new ControlMotion({ riseSeconds: 0.18, fallSeconds: 0.22, minShownSeconds: 0.5 });
    motion.set('airborne'); motion.update(0.25);
    expect(motion.set(null)).toBe(false); // the rules ended it; the picture holds it
    expect(motion.control).toBe('airborne');
    motion.update(0.2); expect(motion.control).toBe('airborne'); expect(motion.lift).toBe(1);
    motion.update(0.05); expect(motion.control).toBeNull(); // 0.5 s shown: released, now falling
    expect(motion.active).toBe(true);
    motion.update(0.3); expect(motion.active).toBe(false);
    // A control that lasted long enough ends at once; a new control after a pending release starts afresh.
    motion.set('stun'); motion.update(0.6); expect(motion.set(null)).toBe(false); expect(motion.control).toBeNull();
    motion.set('airborne'); motion.set(null); expect(motion.control).toBe('airborne'); expect(motion.set('stun')).toBe(false); expect(motion.control).toBe('stun');
    motion.update(1); expect(motion.control).toBe('stun'); // the stun replaced the pending release
    expect(CONTROL_3D.minShownSeconds).toBe(0.5);
  });

  it('a knocked-up body leans back with its lift and straightens as it lands; a stun never leans', () => {
    const motion = new ControlMotion({ riseSeconds: 0.2, fallSeconds: 0.2, leanRadians: 0.3 });
    motion.set('airborne'); motion.update(1);
    expect(motion.lean).toBeCloseTo(0.3);
    motion.set(null); motion.update(0.1); expect(motion.lean).toBeCloseTo(0.225);
    motion.update(0.2); expect(motion.lean).toBe(0);
    const stun = new ControlMotion(); stun.set('stun'); stun.update(1); expect(stun.lean).toBe(0);
    expect(CONTROL_3D.liftShare).toBe(0.9);
  });

  it('a stun never lifts; turning a knock-up into a stun drops it', () => {
    const motion = new ControlMotion({ riseSeconds: 0.18, fallSeconds: 0.22 });
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

  it('a stun holds the flinch pose against every event until it is recovered; death still lands', () => {
    const state = new UnitActionState('a');
    state.consume({ type: 'attack', attackerId: 'a' });
    expect(state.stun().state).toBe('hit');
    expect(state.stunned).toBe(true);
    const revision = state.output.revision;
    state.update(5); // a hit normally lasts 0.15 s: the held one does not expire
    state.consume({ type: 'attack', attackerId: 'a' });
    state.consume({ type: 'movement', unitId: 'a' });
    state.consume({ type: 'packetDamage', sourceId: 'b', targetId: 'a', hit: true, hpDamage: 10, absorbed: 0 });
    expect(state.output.state).toBe('hit'); expect(state.output.revision).toBe(revision);
    expect(state.stun().revision).toBe(revision); // a second stun changes nothing
    expect(state.recover().state).toBe('idle'); expect(state.stunned).toBe(false);
    expect(state.recover().revision).toBe(state.output.revision); // nothing held: no change
    state.consume({ type: 'attack', attackerId: 'a' }); expect(state.output.state).toBe('attack'); // acting again
    state.stun(); state.consume({ type: 'death', unitId: 'a' });
    expect(state.output.state).toBe('death'); expect(state.stunned).toBe(false);
    expect(state.recover().state).toBe('death');
    expect(new UnitActionState('a').stun().state).toBe('hit'); // from rest too
  });

  it("an ability's packet cuts a swing or a run with a flinch; an attack's still waits for rest; a cast is never cut", () => {
    const state = new UnitActionState('a');
    state.consume({ type: 'attack', attackerId: 'a' });
    state.consume({ type: 'packetDamage', sourceId: 'b', targetId: 'a', hit: true, hpDamage: 10, absorbed: 0, sourceKind: 'attack', delivery: 'basic-attack' });
    expect(state.output.state).toBe('attack');
    state.consume({ type: 'packetDamage', sourceId: 'b', targetId: 'a', hit: true, hpDamage: 10, absorbed: 0, sourceKind: 'ability', delivery: 'ability-direct' });
    expect(state.output.state).toBe('hit');
    state.consume({ type: 'movement', unitId: 'a' });
    state.consume({ type: 'packetDamage', sourceId: 'b', targetId: 'a', hit: true, hpDamage: 0, absorbed: 5, delivery: 'ability-periodic' });
    expect(state.output.state).toBe('hit');
    state.consume({ type: 'cast', sourceId: 'a' });
    state.consume({ type: 'packetDamage', sourceId: 'b', targetId: 'a', hit: true, hpDamage: 10, absorbed: 0, sourceKind: 'ability' });
    expect(state.output.state).toBe('cast');
    // A miss or a zero packet never flinches, whatever its source.
    state.update(1); state.consume({ type: 'attack', attackerId: 'a' });
    state.consume({ type: 'packetDamage', sourceId: 'b', targetId: 'a', hit: false, hpDamage: 0, absorbed: 0, sourceKind: 'ability' });
    expect(state.output.state).toBe('attack');
  });

  it('the hit flash grows and fades out over its seconds, then rearms', () => {
    const flash = createHitFlash();
    const material = flash.object.material;
    expect(material.opacity).toBeCloseTo(0.85);
    expect(flash.update(HIT_FLASH_3D.seconds / 2)).toBe(true);
    expect(material.opacity).toBeCloseTo(0.425);
    expect(flash.object.scale.x).toBeGreaterThan(HIT_FLASH_3D.size);
    expect(flash.update(HIT_FLASH_3D.seconds)).toBe(false);
    expect(material.opacity).toBe(0);
    flash.reset(); expect(material.opacity).toBeCloseTo(0.85); expect(flash.object.scale.x).toBe(HIT_FLASH_3D.size);
    flash.dispose();
  });

  it('the star ring circles over the head and disposes', () => {
    const halo = createStunHalo();
    // The glow disc under the stars, then the stars.
    expect(halo.object.children).toHaveLength(CONTROL_3D.stars + 1);
    expect(halo.object.children[0]!.name).toBe('render3d-stun-glow');
    const stars = halo.object.children.slice(1);
    const before = stars[0]!.position.clone();
    halo.update(0.3);
    expect(stars[0]!.position.distanceTo(before)).toBeGreaterThan(1);
    for (const star of stars) expect(Math.hypot(star.position.x, star.position.z)).toBeCloseTo(CONTROL_3D.ringRadius);
    // Readable at board distance (11-09 field: 13-unit stars behind the health bar went unnoticed).
    expect(CONTROL_3D.starSize).toBeGreaterThanOrEqual(20);
    halo.dispose();
    expect(halo.object.children).toHaveLength(0);
  });
});

describe('3D forced moves', () => {
  it('pulls, grabs and knockbacks hop once along the slide; other moves do not', async () => {
    const { DISPLACEMENT_REASONS, displacementHop } = await import('../src/rendering/three-mode/unit-control');
    expect([...DISPLACEMENT_REASONS].sort()).toEqual(['mordekaiser-pull', 'sett-grab', 'sevika-knockback', 'vander-knockback']);
    expect(DISPLACEMENT_REASONS.has('ambessa-chain')).toBe(false); // her own dash stays a run
    expect(displacementHop(0, 0.3)).toBe(0);
    expect(displacementHop(0.15, 0.3)).toBeCloseTo(1);
    expect(displacementHop(0.3, 0.3)).toBe(0);
  });
});

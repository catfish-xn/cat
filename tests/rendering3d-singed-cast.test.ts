import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { ParticleEffect } from '../src/rendering3d/particles';
import { planActionEffects, type EffectPlayback } from '../src/rendering/three-mode/action-effect-plan';
import { simplifyCast } from '../src/rendering/three-mode/skill-feel';

const missile = 'singed_tft13_singed_base_w_mis';
const activation = 'singed_tft13_singed_base_w_ally_activate';
const directionalBuff = 'singed_tft13_singed_base_w_ally_buf';
const effects = [missile, activation, directionalBuff].map(id => ({ id }));
const playback: Record<string, EffectPlayback> = {
  [missile]: { anchor: 'projectile', bone: 'hand', delay: 0.3, maxDuration: 0.8 },
  [activation]: { anchor: 'target', delay: 0.9, maxDuration: 1 },
  [directionalBuff]: { anchor: 'target', delay: 1, maxDuration: 1.5 },
};
// Synthetic geometry only: these are deliberately not exported asset values.
const document = (emitter: Record<string, unknown>) => ({ schemaVersion: 2,
  limits: { maxParticles: 8, maxDuration: 5 }, emitters: [
    { emission: { mode: 'burst', count: 1 }, lifetime: 2, ...emitter },
  ] });
// Measure only indexed vertices in the draw range; unused trail buffer capacity is not rendered.
function drawnBounds(fx: ParticleEffect): Box3 {
  fx.object.updateWorldMatrix(true, true);
  const box = new Box3();
  for (const child of fx.object.children) {
    const mesh = child as Mesh, geometry = mesh.geometry, position = geometry.getAttribute('position');
    const count = Math.min(geometry.drawRange.count, geometry.index?.count ?? position.count);
    for (let i = 0; i < count; i++) box.expandByPoint(new Vector3()
      .fromBufferAttribute(position, geometry.index?.getX(i) ?? i).applyMatrix4(mesh.matrixWorld));
  }
  return box;
}

describe('Singed online 3D cast staging', () => {
  it('reproduces a long stationary ground ray without trail history or a missing-texture sentinel', () => {
    const fx = new ParticleEffect(document({ kind: 'ray', direction: [0, 1, 0], rotation0: [90, 0, 0],
      size0: [100, 600, 1], color: [{ time: 0, value: [0.9, 0.05, 0.9] }] }), { scale: 1 });
    const scene = new Group();
    // Same target staging as placeholder-renderer: world scale and a snapshot position, no unit rotation.
    fx.object.scale.setScalar(0.44); fx.object.position.set(120, 40, -80); scene.add(fx.object);
    for (let i = 0; i < 12; i++) {
      fx.update(1 / 60);
      const size = drawnBounds(fx).getSize(new Vector3());
      expect(size.x).toBeCloseTo(44); expect(size.y).toBeCloseTo(0); expect(size.z).toBeCloseTo(264);
    }
    fx.dispose();
  });

  it('keeps moving projectile trails near their launch point after attachment and scale changes', () => {
    const fx = new ParticleEffect(document({ kind: 'trail', size0: 1,
      trail: { width: [{ time: 0, value: 1 }], lifetime: 0.3, segments: 32, uvMode: 'stretch' } }), { scale: 1 });
    const scene = new Group(), unit = new Group(), bone = new Group();
    scene.add(unit); unit.add(bone); unit.position.set(800, 0, -600); unit.scale.setScalar(0.7); bone.position.y = 60;
    // Source/bone staging: normalize world scale only after constructing the effect.
    fx.object.scale.setScalar(0.44 / 0.7); bone.add(fx.object);
    const camera = new PerspectiveCamera(); camera.position.set(500, 800, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    fx.update(0, camera);
    expect(drawnBounds(fx).isEmpty()).toBe(true);
    // Projectile staging: move from bone to scene before the first advancing update.
    scene.attach(fx.object);
    for (let i = 0; i < 12; i++) {
      fx.object.position.x += 1;
      fx.update(1 / 60, camera);
      const box = drawnBounds(fx), size = box.getSize(new Vector3());
      expect(size.length()).toBeLessThan(14);
      expect(box.min.x).toBeGreaterThan(790); expect(box.max.z).toBeLessThan(-590);
    }
    fx.dispose();
  });

  it.each([false, true])('omits the directional buff with skill feel %s, retaining launch and activation', skillFeel => {
    const plan = planActionEffects('singed', 'cast', effects, playback);
    const selected = skillFeel ? simplifyCast('singed', plan) : plan;
    expect(selected.map(effect => effect.id)).toEqual([missile, activation]);
    expect(selected.map(effect => effect.playback)).toEqual([playback[missile], playback[activation]]);
    expect(effects).toHaveLength(3); expect(playback[directionalBuff].anchor).toBe('target');
  });

  it('leaves other champions and basic attacks unchanged', () => {
    for (const [unit, action] of [['singed', 'attack'], ['silco', 'cast'], ['renni', 'cast']] as const) {
      expect(planActionEffects(unit, action, effects, playback).map(effect => effect.id)).toEqual(effects.map(effect => effect.id));
    }
  });
});

import { BoxGeometry, Camera, Group, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, FX_SCALE, staticMeshGeometry, unitAnchor, unitJoints, ROOT_PARTICLES } from '../src/rendering/three-mode/vfx-ltk/particles';
import { drawnEmitters } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
import { syntheticIndex, syntheticSystem, num } from './vfx-ltk-synthetic';
import type { SystemModel } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';

async function prepared() {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem({ lifetime: num(5) }), readTexture: async () => new Texture() });
  return { library, prepared: await library.load('sample') };
}
describe('upstream simulation in the bare Three.js host', () => {
  it('supplies the original shader RGBA lane for a GLB mesh without vertex colours', () => {
    const source = new BoxGeometry(), geometry = staticMeshGeometry(source);
    expect(source.getAttribute('vertexColor')).toBeUndefined();
    expect([...geometry.getAttribute('vertexColor').array]).toEqual(Array(source.getAttribute('position').count * 4).fill(1));
    source.dispose(); geometry.dispose();
  });
  it('uses live skeleton poses and falls back to unit position, with one global board scale', () => {
    const root = new Group(), body = new Group(), bone = new Group(); bone.name = 'R_Hand';
    root.position.set(44, 11, 22); body.add(bone); root.add(body); bone.position.set(4.4, 8.8, 0);
    expect(unitAnchor(root, body, 'R_Hand').originAt(0)).toEqual([-110, 45, 50]);
    expect(unitAnchor(root, body, 'r_hand').originAt(0)).toEqual([-110, 45, 50]);
    expect(unitAnchor(root, body, 'missing').originAt(0)).toEqual([-100, 25, 50]);
    root.position.x += 4.4;
    expect(unitAnchor(root, body, 'R_Hand').originAt(0)[0]).toBeCloseTo(-120);
    const basis = unitAnchor(root, body).basisInto(0, new Float32Array(9)); expect([...basis].map(n => n || 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
  it('pools quad GPU buffers when the same system is played again after dispose', async () => {
    const { library, prepared: system } = await prepared(), root = new Group();
    const options = { anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 0.2, seed: 3 };
    const first = createLtkParticles(system, options);
    const geometry = first.draws[0].object.geometry;
    first.dispose();
    const second = createLtkParticles(system, options);
    expect(second.draws[0].object.geometry).toBe(geometry);
    second.dispose();
    library.dispose();
  });
  it('simulates seeded particles, writes original GPU rows, stops emission and disposes once', async () => {
    const { library, prepared: system } = await prepared(), root = new Group(), camera = new Camera();
    root.position.set(44, 0, 0);
    const options = { anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 2, seed: 17 };
    const a = createLtkParticles(system, options), b = createLtkParticles(system, options);
    for (let i = 0; i < 6; i++) { a.update(0.05, camera); b.update(0.05, camera); }
    expect(a.driver.pool.count).toBeGreaterThan(0); expect(a.driver.pool.count).toBeLessThanOrEqual(ROOT_PARTICLES);
    expect([...a.driver.pool.position]).toEqual([...b.driver.pool.position]);
    expect(a.object.scale.x).toBe(FX_SCALE);
    expect(a.draws[0].object.geometry.getAttribute('center').count).toBe(ROOT_PARTICLES);
    const before = a.driver.pool.born; a.stop();
    for (let i = 0; i < 20; i++) a.update(0.05, camera);
    expect(a.driver.pool.born).toBe(before); expect(a.driver.pool.count).toBe(0);
    const dispose = vi.spyOn(a.draws[0].material, 'dispose'); a.dispose(); a.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
    b.dispose(); library.dispose();
  });
  it('moves an authored projectile to its target at the declared visual travel time', async () => {
    const { library, prepared: system } = await prepared(), source = new Group(), target = new Group(), camera = new Camera(); target.position.x = 44;
    const effect = createLtkParticles(system, { anchor: unitAnchor(source, null), target: unitAnchor(target, null), joints: unitJoints(source, null), duration: 1, projectileSeconds: 0.5, seed: 1 });
    for (let i = 0; i < 5; i++) effect.update(0.05, camera);
    expect(effect.driver.origin[0]).toBeCloseTo(-200 * effect.driver.phase);
    expect(Math.abs(effect.driver.phase - 0.25)).toBeLessThan(1 / 30);
    for (let i = 0; i < 6; i++) effect.update(0.05, camera);
    expect(effect.driver.origin[0]).toBeCloseTo(-100);
    effect.dispose(); library.dispose();
  });
  it('retains upstream child simulation and source feeds under the board child budget', async () => {
    const { library, prepared: base } = await prepared();
    const child: SystemModel = { ...base.model, emitters: base.model.emitters.map(e => ({ ...e, childSet: null })) };
    const model: SystemModel = { ...base.model, emitters: base.model.emitters.map(e => ({ ...e, singleParticle: true, childSet: {
      children: [child], bones: [], probability: { constant: [0], keys: [], tables: [] }, onDeath: false, inheritance: null,
    } })) };
    const root = new Group(), camera = new Camera();
    const effect = createLtkParticles({ ...base, model, drawn: drawnEmitters(model), samplers: new Map([['0', base.samplers.get('0')!], ['0.0:0', base.samplers.get('0')!]]) }, {
      anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 1, seed: 1,
    });
    effect.update(0.05, camera); effect.update(0.05, camera);
    expect(effect.driver.liveChildren()).toBeGreaterThan(0);
    expect(effect.driver.liveChildren()).toBeLessThanOrEqual(8);
    expect(effect.driver.sources('0.0').length).toBeGreaterThan(0);
    effect.dispose(); library.dispose();
  });
});

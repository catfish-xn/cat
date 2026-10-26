import { Camera, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createVfxPasses } from '../src/rendering/three-mode/vfx-ltk/rendering/passes';
import { FLOOR_LAYER, GROUND_LAYER, SCENE_LAYER } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
import { syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';
import type { WebGLRenderer } from 'three';
describe('opt-in board ground pass', () => {
  it('accepts ground definitions only for a compatible host', async () => {
    const reader = { readJson: async (url: string) => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem({ isGroundLayer: { type: 'bool' as const, value: true } }),
      readTexture: async () => new Texture() };
    const normal = createVfxLibrary('/root/', reader), board = createVfxLibrary('/root/', reader, { groundPass: true });
    await expect(normal.load('sample')).rejects.toThrow('ground-layer');
    await expect(board.load('sample')).resolves.toMatchObject({ empty: false }); normal.dispose(); board.dispose();
  });
  it.each([false, true])('draws floor/grid then ground then characters; restores all state on failure=%s', fails => {
    const scene = new Scene(), camera = new Camera(); camera.layers.enable(2);
    const floor = new Group(), floorMesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ transparent: true, opacity: .22 })); floor.add(floorMesh);
    const ground = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ depthWrite: true })); ground.layers.set(GROUND_LAYER);
    const unit = new Mesh(new PlaneGeometry(), new MeshBasicMaterial()); scene.add(floor, ground, unit);
    const frames: { mask: number; floor: number; unit: number; depth: boolean; clear: boolean }[] = [];
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, render() {
      frames.push({ mask: camera.layers.mask, floor: floorMesh.layers.mask, unit: unit.layers.mask, depth: ground.material.depthTest, clear: this.autoClear });
      if (fails && camera.layers.isEnabled(GROUND_LAYER)) throw Error('context-lost');
    } };
    const passes = createVfxPasses(gl as unknown as WebGLRenderer, () => [floor]);
    if (fails) expect(() => passes.render(scene, camera, { early: false, late: false, soft: false })).toThrow('context-lost');
    else passes.render(scene, camera, { early: false, late: false, soft: false });
    expect(frames[0]).toMatchObject({ mask: 1 << FLOOR_LAYER, floor: 1 << FLOOR_LAYER, unit: 1 << SCENE_LAYER, clear: true });
    expect(frames[1]).toMatchObject({ mask: 1 << GROUND_LAYER, depth: true, clear: false });
    if (!fails) expect(frames[2].mask & (1 << SCENE_LAYER)).not.toBe(0);
    expect(floorMesh.layers.mask).toBe(1); expect(ground.material.depthTest).toBe(true); expect(ground.material.depthWrite).toBe(true);
    expect(ground.material.polygonOffset).toBe(false);
    expect(camera.layers.mask).toBe(5); expect(gl.autoClear).toBe(true);
    for (const mesh of [floorMesh,ground,unit]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });
});

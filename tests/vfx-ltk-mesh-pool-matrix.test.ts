import { Camera, DataTexture, Group, Texture, type InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { flushDrawBufferPool, resetDrawBufferPoolStats, drawBufferPoolStats } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/drawBufferPool';
import { syntheticIndex, syntheticSystem, struct, num } from './vfx-ltk-synthetic';
import { binaryFixture } from './vfx-ltk-binary-fixture';
import type { VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';

// 11-16 (Windows, GPU only): an effect drawn on pooled mesh buffers drew its mesh from the previous effect's matrices,
// held still. InstancedMesh.dispose has three's renderer delete the GPU buffer of the mesh's `instanceMatrix`; that was
// the pooled attribute the pooled geometry's vertex array still binds, so the next borrower's uploads went to a new
// buffer the vertex array never saw.
const asset = (path: string): VfxValue => ({ type: 'asset', path, asset: { kind: 'file', path: '/synthetic/' + path } });

describe('pooled mesh buffers keep their matrix attribute alive across effects', () => {
  it('a disposed mesh hands back its own matrix, never the pooled one, and a new mesh draws nothing before its first frame', async () => {
    const index = syntheticIndex(); Object.assign(index.assets, { 'shell.sco': 'meshes/static.ltkg' });
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json') ? index : syntheticSystem({
        primitive: struct('VfxPrimitiveMesh', { mMesh: struct('VfxMeshDefinitionData', { mSimpleMeshName: asset('shell.sco') }) }), lifetime: num(1) }),
      readTexture: async url => url.endsWith('cube.png') ? new DataTexture(new Uint8Array(24).fill(255), 1, 6) : new Texture(),
      readBinary: async url => binaryFixture(url.endsWith('.ltks') ? 'skeleton' : url.endsWith('.ltka') ? 'clip' : 'mesh', url.includes('skin'), url.includes('subset')),
    });
    const prepared = await library.load('sample');
    const root = new Group(), camera = new Camera();
    const create = (seed: number) => createLtkParticles(prepared, { anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 1, seed });
    flushDrawBufferPool(); resetDrawBufferPoolStats();
    try {
      // The renderer frees what `instanceMatrix` holds when the mesh is disposed (three WebGLObjects onInstancedMeshDispose).
      const freed: unknown[] = [];
      const watch = (mesh: InstancedMesh) => mesh.addEventListener('dispose', () => freed.push(mesh.instanceMatrix));
      const first = create(1), mesh1 = first.draws[0]!.object as InstancedMesh;
      expect(mesh1.isInstancedMesh).toBe(true);
      expect(mesh1.count).toBe(0);
      watch(mesh1);
      for (let f = 0; f < 5; f++) first.update(1 / 60, camera);
      expect(mesh1.count).toBeGreaterThan(0);
      const pooled = mesh1.geometry.getAttribute('instanceMatrix');
      expect(mesh1.instanceMatrix).toBe(pooled);
      first.dispose();
      expect(freed).toHaveLength(1);
      expect(freed[0]).not.toBe(pooled);
      // The next effect borrows the same buffers: same geometry, same live matrix attribute, nothing drawn until it writes.
      const second = create(2), mesh2 = second.draws[0]!.object as InstancedMesh;
      expect(drawBufferPoolStats.meshReuse).toBe(1);
      expect(mesh2.geometry.getAttribute('instanceMatrix')).toBe(pooled);
      expect(mesh2.count).toBe(0);
      watch(mesh2);
      second.update(1 / 60, camera);
      expect(mesh2.instanceMatrix).toBe(pooled);
      second.dispose();
      expect(freed).toHaveLength(2);
      expect(freed[1]).not.toBe(pooled);
    } finally { flushDrawBufferPool(); library.dispose(); }
  });
});

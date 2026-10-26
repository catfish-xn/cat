import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AnimationClip, Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial,
  Skeleton, SkinnedMesh, Uint16BufferAttribute, VectorKeyframeTrack } from 'three';
// @ts-expect-error Offline Node utility; no external model data.
import { audit, measureClip, measureTransitions, skinnedBounds } from '../scripts/assets3d/audit-skinned-bounds.mjs';
// @ts-expect-error Offline GLB writer.
import { writeGlb } from '../scripts/assets3d/glb.mjs';

function toy() {
  const root = new Group(), a = new Bone(), b = new Bone();
  a.name = 'body'; b.name = 'prop'; root.add(a, b);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0], 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setIndex([0, 1, 2]);
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()); root.add(mesh);
  root.updateMatrixWorld(true); mesh.bind(new Skeleton([a, b]));
  const idle = new AnimationClip('idle', 1, [new VectorKeyframeTrack('prop.position', [0, 1], [0, 0, 0, 0, 0, 0])]);
  // Synthetic broken curve: only one vertex of the triangle is pulled down.
  const cast = new AnimationClip('cast', 1, [new VectorKeyframeTrack('prop.position', [0, .5, 1], [0, 0, 0, 0, -100, 0, 0, 0, 0])]);
  return { root, a, b, mesh, idle, cast };
}

describe('read-only CPU skinning audit with synthetic geometry', () => {
  it('reads bone-transformed vertices and world transforms rather than the static geometry box', () => {
    const f = toy(); f.b.position.y = -100; f.root.position.y = 7; f.root.scale.setScalar(2);
    const box = skinnedBounds(f.root);
    expect(box.min.y).toBeCloseTo(-189); expect(box.max.y).toBeCloseTo(7);
    expect(f.mesh.geometry.attributes.position.getY(2)).toBe(2);
  });

  it('samples intermediate frames and the exact endpoint, restores the original pose, and detects stretched edges', () => {
    const f = toy(), idle = measureClip(f.root, f.idle, 30), cast = measureClip(f.root, f.cast, 30);
    expect(cast.frames).toBe(31); expect(cast.peakTime).toBeCloseTo(.5);
    expect(cast.min[1]).toBeCloseTo(-98); expect(cast.maxEdge / idle.maxEdge).toBeGreaterThan(40);
    expect(f.b.position.y).toBe(0);
    const end = new AnimationClip('end', .17, [new VectorKeyframeTrack('prop.position', [0, .17], [0, 0, 0, 0, -100, 0])]);
    expect(measureClip(f.root, end, 30).min[1]).toBeCloseTo(-98);
  });

  it('distinguishes a whole-model translation from a pulled triangle', () => {
    const f = toy(), idle = measureClip(f.root, f.idle);
    const travel = new AnimationClip('travel', 1, [new VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 0, -100, 0])]);
    const cast = measureClip(f.root, travel);
    expect(cast.min[1]).toBeCloseTo(-100);
    expect(cast.maxEdge).toBeCloseTo(idle.maxEdge);
    expect(f.root.position.y).toBe(0);
  });

  it('exercises the production mixer through repeated cast/attack/idle transitions', async () => {
    const f = toy();
    const report = await measureTransitions(f.root, [f.idle, f.cast], { animations: { idle: 'idle', attack: 'cast', cast: 'cast' } });
    expect(report.min[1]).toBeCloseTo(-98); expect(report.phases).toHaveLength(12);
    expect(f.b.position.y).toBe(0);
  });

  it('reports a failed model and continues to a generated GLB without decoding textures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skin-audit-'));
    try {
      // An unskinned triangle is valid too. A missing texture URI is deliberately never requested.
      const bytes = Buffer.alloc(52);
      [0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0].forEach((value, i) => bytes.writeFloatLE(value, i * 4));
      const doc = { asset: { version: '2.0' }, buffers: [{ byteLength: 52 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 4 }, { buffer: 0, byteOffset: 40, byteLength: 12 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0] },
          { bufferView: 1, componentType: 5126, count: 1, type: 'SCALAR', min: [0], max: [0] },
          { bufferView: 2, componentType: 5126, count: 1, type: 'VEC3' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
        images: [{ uri: 'must-not-load.png' }], textures: [{ source: 0 }], materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
        animations: [{ name: 'idle', samplers: [{ input: 1, output: 2 }], channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] }] };
      const glb = writeGlb(doc, bytes);
      await writeFile(join(root, 'toy.glb'), glb);
      await writeFile(join(root, 'manifest.json'), JSON.stringify({ models: {
        absent: { path: 'absent.glb', animations: { idle: 'idle' } }, toy: { path: 'toy.glb', animations: { idle: 'idle' } },
      } }));
      const result = await audit({ root });
      expect(result.errors).toHaveLength(1); expect(result.errors[0].id).toBe('absent');
      expect(result.models.map((m: { id: string }) => m.id)).toEqual(['toy']); expect(result.flagged).toEqual([]);
      expect(await import('node:fs/promises').then(fs => fs.readFile(join(root, 'toy.glb')))).toEqual(glb);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects non-finite skinned vertices rather than silently producing an empty report', () => {
    const f = toy(); f.b.position.y = NaN;
    expect(() => skinnedBounds(f.root)).toThrow('non-finite-skinned-vertex');
    expect(() => measureClip(f.root, f.idle, 0)).toThrow('invalid-sampling');
  });
});

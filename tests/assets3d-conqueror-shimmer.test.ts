import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
// @ts-expect-error Offline Node pipeline.
import { CONQUEROR_SHIMMER_IDS, propActionBindings, validatePropRoot, downloadChunks, resourceReferences } from '../scripts/assets3d/conqueror-shimmer.mjs';
// @ts-expect-error Synthetic GLB writer.
import { writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Offline precache helper.
import { createPrecache } from '../scripts/assets3d/merge-manifests.mjs';
import { assertManifest } from '../src/rendering3d/contracts';
import { Quaternion, Vector3 } from 'three';
// @ts-expect-error Offline Node export correction.
import { uprightShimmer } from '../scripts/assets3d/shimmer-upright.mjs';
// @ts-expect-error Synthetic GLB reader.
import { readGlb } from '../scripts/assets3d/glb.mjs';

function leaningProp(changing = false) {
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 6).toArray();
  const data = Buffer.alloc(76);
  [-1, 0, 0, 1, 0, 0, 0, 5, 0, 0, 1, ...rotation, ...(changing ? [0, 0, 0, 1] : rotation)].forEach((v, i) => data.writeFloatLE(v, i * 4));
  return writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: data.length }],
    bufferViews: [{ buffer: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 8 }, { buffer: 0, byteOffset: 44, byteLength: 32 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5126, count: 2, type: 'SCALAR' }, { bufferView: 2, componentType: 5126, count: 2, type: 'VEC4' }],
    nodes: [{ name: 'Main', children: [1] }, { mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], scene: 0, scenes: [{ nodes: [0] }],
    animations: [{ name: 'idle', channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }], samplers: [{ input: 1, output: 2 }] }] }, data);
}

describe('shimmer authored idle correction', () => {
  it('levels the base and makes the long axis vertical in default and animated poses without changing animation bytes', () => {
    const original = leaningProp(), result = uprightShimmer(original, 'idle');
    const before = readGlb(original), after = readGlb(result.glb), d = after.document;
    expect(after.binary.equals(before.binary)).toBe(true);
    expect(d.animations).toEqual(before.document.animations);
    const wrapper = d.nodes[d.scenes[0].nodes[0]];
    expect(wrapper.children).toEqual([0]);
    const rotation = new Quaternion(...wrapper.rotation).multiply(new Quaternion(...d.nodes[0].rotation));
    const transformed = [[-1, 0, 0], [1, 0, 0], [0, 5, 0]].map(p => new Vector3(...p).applyQuaternion(rotation).add(new Vector3(...wrapper.translation)));
    expect(transformed[0].y).toBeCloseTo(0, 6);
    expect(transformed[1].y).toBeCloseTo(0, 6);
    expect(transformed[2].y).toBeCloseTo(5, 6);
    expect(transformed[2].x).toBeCloseTo(0, 6);
    expect(transformed[2].z).toBeCloseTo(0, 6);
    expect(result.report.sourceTiltDegrees).toBeCloseTo(30, 4);
  });
  it('rejects changing lean instead of pretending one static transform fixes it', () => {
    expect(() => uprightShimmer(leaningProp(true), 'idle')).toThrow('shimmer-main-lean-is-not-constant');
    expect(() => uprightShimmer(leaningProp(), 'missing')).toThrow('missing-shimmer-main-rotation');
  });
});

function fixture() {
  const positions = Buffer.alloc(68);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => positions.writeFloatLE(v, i * 4));
  positions.writeFloatLE(1, 40); positions.writeFloatLE(1, 64);
  const glb = writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 68 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 8 }, { buffer: 0, byteOffset: 44, byteLength: 24 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] }, { bufferView: 2, componentType: 5126, count: 2, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    animations: ['rest', 'reveal'].map(name => ({ name, channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }], samplers: [{ input: 1, output: 2, interpolation: 'LINEAR' }] })) }, positions);
  const manifest = { schemaVersion: 1, models: Object.fromEntries(CONQUEROR_SHIMMER_IDS.slice(0, 2).map((id: string) => [id, { path: `models/${id}.glb`, animations: { idle: 'rest', ...(id === CONQUEROR_SHIMMER_IDS[0] ? { cast: 'reveal' } : {}) } }])),
    effects: Object.fromEntries(CONQUEROR_SHIMMER_IDS.slice(2).map((id: string) => [id, { path: `effects/${id}.json` }])) };
  const bindings = propActionBindings(manifest), files = new Map<string, Buffer>();
  for (const model of Object.values(manifest.models) as { path: string }[]) files.set(model.path, glb);
  for (const effect of Object.values(manifest.effects) as { path: string }[]) files.set(effect.path, Buffer.from(JSON.stringify({ schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [{ kind: 'quad', texture: 'textures/fake.png' }] })));
  files.set('textures/fake.png', Buffer.from('generated-placeholder'));
  files.set('action-bindings.json', Buffer.from(JSON.stringify(bindings)));
  const precache = createPrecache(new Map([...files].map(([p, b]) => [p, { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') }])));
  return { manifest, bindings, files, precache };
}
describe('prop runtime root with synthetic data', () => {
  it('has exactly the five required keys and complete checksummed closure', () => {
    const f = fixture(); assertManifest(f.manifest);
    expect(validatePropRoot(f.manifest, f.bindings, f.precache, f.files)).toBe(true);
  });
  it('maps open only when a real clip exists and leaves idle-only props honest', () => {
    const f = fixture();
    expect(f.bindings.models[CONQUEROR_SHIMMER_IDS[0]]).toEqual({ idle: 'rest', open: 'reveal' });
    expect(f.bindings.models[CONQUEROR_SHIMMER_IDS[1]]).toEqual({ idle: 'rest' });
    f.bindings.models[CONQUEROR_SHIMMER_IDS[0]].open = 'absent';
    expect(() => validatePropRoot(f.manifest, f.bindings, f.precache, f.files)).toThrow('missing-action-clip');
  });
  it('rejects missing textures, corrupt payloads, duplicates, and unindexed data', () => {
    for (const mutate of [
      (f: ReturnType<typeof fixture>) => f.files.delete('textures/fake.png'),
      (f: ReturnType<typeof fixture>) => f.files.set('textures/fake.png', Buffer.from('bad')),
      (f: ReturnType<typeof fixture>) => f.precache.files.push(f.precache.files[0]),
      (f: ReturnType<typeof fixture>) => f.files.set('extra.bin', Buffer.from('extra')),
    ]) { const f = fixture(); mutate(f); expect(() => validatePropRoot(f.manifest, f.bindings, f.precache, f.files)).toThrow(); }
  });
  it('rejects missing keys and references absent from a consistent precache', () => {
    const f = fixture(); delete f.manifest.effects[CONQUEROR_SHIMMER_IDS[2]];
    expect(() => validatePropRoot(f.manifest, f.bindings, f.precache, f.files)).toThrow('invalid-prop-keys');
    const g = fixture(); g.files.delete('textures/fake.png'); g.precache.files = g.precache.files.filter((x: { path: string }) => x.path !== 'textures/fake.png');
    expect(() => validatePropRoot(g.manifest, g.bindings, g.precache, g.files)).toThrow('missing-runtime-reference');
  });
  it('retains exact download coordinates, with no incidental cache metadata', () => {
    expect(downloadChunks(new Map([['B', { id: 'B', bundleId: 'PACK', offset: 100, size: 20, targetSize: 40, fileOffset: 200 }]])))
      .toEqual([{ id: 'B', bundleId: 'PACK', offset: 100, size: 20, targetSize: 40 }]);
    expect(resourceReferences([{ nested: ['fake/a.skn', 'fake/a.skn', 'fake/b.bin', 'noise'] }])).toEqual(['fake/a.skn', 'fake/b.bin']);
  });
});

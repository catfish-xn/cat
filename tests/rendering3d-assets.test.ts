import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, AnimationMixer, Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelCache, readGlb } from '../src/rendering3d/assets';
import { assetUrl, type AssetManifest } from '../src/rendering3d/contracts';

/** Generated entirely in memory: triangle, one bone, two translation keys. */
function tinyGlb(): ArrayBuffer {
  const chunks: Uint8Array[] = [], views: { buffer: number; byteOffset: number; byteLength: number }[] = [];
  let length = 0;
  const add = (array: Float32Array | Uint16Array) => {
    const bytes = new Uint8Array(array.buffer);
    views.push({ buffer: 0, byteOffset: length, byteLength: bytes.length });
    chunks.push(bytes); length += bytes.length;
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(new Uint8Array(padding)); length += padding; }
    return views.length - 1;
  };
  const positions = add(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]));
  const joints = add(new Uint16Array(12));
  const weights = add(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]));
  const bind = add(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const times = add(new Float32Array([0, 1]));
  const values = add(new Float32Array([0, 0, 0, 0, 1, 0]));
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'model', mesh: 0, skin: 0, children: [1] }, { name: 'joint' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    skins: [{ joints: [1], inverseBindMatrices: 3 }],
    animations: [{ name: 'idle', samplers: [{ input: 4, output: 5 }], channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }] }],
    buffers: [{ byteLength: length }], bufferViews: views,
    accessors: [
      { bufferView: positions, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: joints, componentType: 5123, count: 3, type: 'VEC4' },
      { bufferView: weights, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: bind, componentType: 5126, count: 1, type: 'MAT4' },
      { bufferView: times, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: values, componentType: 5126, count: 2, type: 'VEC3' },
    ] };
  const source = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(source.length / 4) * 4;
  const buffer = new ArrayBuffer(12 + 8 + jsonLength + 8 + length), header = new DataView(buffer), bytes = new Uint8Array(buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, buffer.byteLength, true);
  header.setUint32(12, jsonLength, true); header.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jsonLength); bytes.set(source, 20);
  header.setUint32(20 + jsonLength, length, true); header.setUint32(24 + jsonLength, 0x004e4942, true);
  let offset = 28 + jsonLength;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return buffer;
}
const manifest: AssetManifest = { schemaVersion: 1, models: { unit: { path: 'units/test.glb', animations: { idle: 'idle' } } } };
function skin(scene: import('three').Object3D): SkinnedMesh {
  let found: SkinnedMesh | undefined;
  scene.traverse(object => { if ((object as SkinnedMesh).isSkinnedMesh) found = object as SkinnedMesh; });
  return found!;
}
describe('3D assets (no real asset files)', () => {
  it('loads a generated GLB with skin and animation through the production reader', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(tinyGlb()));
    try {
      const model = await readGlb('assets3d-local/test.glb');
      expect(skin(model.scene).skeleton.bones).toHaveLength(1);
      expect(model.animations[0].name).toBe('idle');
      const mixer = new AnimationMixer(model.scene);
      mixer.clipAction(model.animations[0]).play(); mixer.update(0.5);
      expect((model.scene.getObjectByName('joint') as Bone).position.y).toBeCloseTo(0.5);
      mixer.stopAllAction(); mixer.uncacheRoot(model.scene);
      skin(model.scene).geometry.dispose(); (skin(model.scene).material as MeshStandardMaterial).dispose();
    } finally { fetchMock.mockRestore(); }
  });
  it('deduplicates concurrent loads and clones skeletons independently', async () => {
    const read = vi.fn(async () => { const gltf = await new GLTFLoader().parseAsync(tinyGlb(), ''); return gltf; });
    const cache = new ModelCache(manifest, '/cdn/', read);
    const [a, b] = await Promise.all([cache.load('unit'), cache.load('unit')]);
    expect(read).toHaveBeenCalledExactlyOnceWith('/cdn/units/test.glb');
    expect(a.scene).not.toBe(b.scene);
    expect(skin(a.scene).skeleton).not.toBe(skin(b.scene).skeleton);
    skin(a.scene).skeleton.bones[0].position.y = 9;
    expect(skin(b.scene).skeleton.bones[0].position.y).toBe(0);
    expect(a.animations[0]).toBe(b.animations[0]);
    a.release(); b.release(); cache.dispose();
  });
  it('uses cached placeholders for failed and missing model IDs', async () => {
    const read = vi.fn(async () => { throw new Error('synthetic failure'); });
    const cache = new ModelCache(manifest, undefined, read);
    const a = await cache.load('unit'), b = await cache.load('unit'), c = await cache.load('missing');
    expect(a.placeholder && b.placeholder && c.placeholder).toBe(true);
    expect(a.scene.children[0]).toBeInstanceOf(Mesh);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith('assets3d-local/units/test.glb');
    a.release(); b.release(); c.release(); cache.dispose();
  });
  it('retires cached GPU resources once, after the final lease', async () => {
    const geometry = new BoxGeometry(), texture = new Texture(), material = new MeshStandardMaterial({ map: texture });
    const geometryDispose = vi.spyOn(geometry, 'dispose'), materialDispose = vi.spyOn(material, 'dispose'), textureDispose = vi.spyOn(texture, 'dispose');
    const scene = new Group(); scene.add(new Mesh(geometry, material)); scene.add(new Mesh(geometry, material));
    const cache = new ModelCache(manifest, '', async () => ({ scene, animations: [] }));
    const a = await cache.load('unit'), b = await cache.load('unit');
    cache.evict('unit'); a.release(); a.release();
    expect(geometryDispose).not.toHaveBeenCalled();
    b.release(); cache.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1); expect(materialDispose).toHaveBeenCalledTimes(1); expect(textureDispose).toHaveBeenCalledTimes(1);
    await expect(cache.load('unit')).rejects.toThrow('model-cache-disposed');
  });
  it('safely retires an in-flight load and permits its lease to release', async () => {
    let resolve!: (value: { scene: Group; animations: AnimationClip[] }) => void;
    const pending = new Promise<{ scene: Group; animations: AnimationClip[] }>(r => { resolve = r; });
    const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), scene = new Group(); scene.add(new Mesh(geometry, material));
    const dispose = vi.spyOn(geometry, 'dispose');
    const cache = new ModelCache(manifest, '', () => pending), loading = cache.load('unit');
    cache.dispose(); resolve({ scene, animations: [] });
    const lease = await loading;
    expect(dispose).not.toHaveBeenCalled(); lease.release(); expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('rejects unsupported manifests and unsafe paths, and supports relative/CDN roots', () => {
    expect(() => new ModelCache({ ...manifest, schemaVersion: 2 })).toThrow('invalid-manifest');
    for (const path of ['../a.glb', '/a.glb', 'https://x/a.glb', '%2e%2e/a.glb', 'a\\b.glb', 'a.glb?x']) {
      expect(() => assetUrl('assets3d-local/', path)).toThrow('invalid-asset-path');
    }
    expect(assetUrl('https://cdn.example/3d', 'units/a.glb')).toBe('https://cdn.example/3d/units/a.glb');
    expect(() => new ModelCache({ ...manifest, effects: { bad: { path: '../x.json' } } })).toThrow();
  });
  it('loads a JSON manifest and reports manifest HTTP/schema errors explicitly', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(Response.json({ schemaVersion: 2 }));
    try {
      const cache = await ModelCache.fromUrl('/manifest.json'); expect(cache.manifest).toEqual(manifest); cache.dispose();
      await expect(ModelCache.fromUrl('/bad.json')).rejects.toThrow('manifest-http-404');
      await expect(ModelCache.fromUrl('/bad.json')).rejects.toThrow('invalid-manifest');
    } finally { fetchMock.mockRestore(); }
  });
  it('turns corrupt GLB and model HTTP failure into placeholders', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4])))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    try {
      const cache = new ModelCache(manifest);
      const a = await cache.load('unit'); expect(a.placeholder).toBe(true); a.release(); cache.evict('unit');
      const b = await cache.load('unit'); expect(b.placeholder).toBe(true); b.release(); cache.dispose();
    } finally { fetchMock.mockRestore(); }
  });
});

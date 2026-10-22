import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompressedTexture, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { createAssetReader, KTX2_IDLE_MS, KTX2_WORKERS } from '../src/rendering/three-mode/asset-reader';
import { createModelRetention, releaseAfterUpload } from '../src/rendering/three-mode/model-memory';
import { ModelCache } from '../src/rendering3d';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function fixture() {
  const bytes: ArrayBuffer[] = [];
  const read = vi.fn(async () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer; bytes.push(buffer);
    return { arrayBuffer: async () => buffer } as Blob;
  });
  const limits = vi.spyOn(KTX2Loader.prototype, 'setWorkerLimit');
  const detect = vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  const disposed = vi.spyOn(KTX2Loader.prototype, 'dispose');
  const parse = vi.spyOn(KTX2Loader.prototype, 'parse').mockImplementation((_buffer, resolve) => resolve!(new CompressedTexture([], 1, 1)));
  const reader = createAssetReader({} as WebGLRenderer, read);
  return { reader, read, bytes, limits, detect, disposed, parse };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('asset reader KTX2 worker trimming with mocked decoders', () => {
  it('starts lazily with two workers, trims at 20 idle seconds, and rebuilds a different loader for the next decode', async () => {
    expect(KTX2_WORKERS).toBe(2); expect(KTX2_IDLE_MS).toBe(20_000);
    const { reader, read, bytes, limits, detect, disposed, parse } = fixture();
    expect(limits).not.toHaveBeenCalled(); vi.advanceTimersByTime(60_000); expect(reader.trim()).toBe(false);
    const first = await reader.readTexture('/synthetic/texture.KTX2');
    expect(limits).toHaveBeenCalledExactlyOnceWith(2); expect(detect).toHaveBeenCalledTimes(1);
    const loader = parse.mock.instances[0];
    vi.advanceTimersByTime(19_999); expect(reader.trim()).toBe(false); expect(disposed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(reader.trim()).toBe(true); expect(disposed).toHaveBeenCalledTimes(1);
    expect(disposed.mock.instances[0]).toBe(loader); expect(reader.trim()).toBe(false);
    const second = await reader.readTexture('/synthetic/texture.KTX2');
    expect(second).not.toBe(first); expect(read).toHaveBeenCalledTimes(2); expect(bytes[1]).not.toBe(bytes[0]);
    expect(parse.mock.instances[1]).not.toBe(loader); expect(limits.mock.calls).toEqual([[2], [2]]); expect(detect).toHaveBeenCalledTimes(2);
    reader.dispose(); reader.dispose(); expect(disposed).toHaveBeenCalledTimes(2); expect(reader.trim()).toBe(false);
  });

  it('does not terminate concurrent texture/model decoding and measures idleness from the last completion', async () => {
    const { reader, parse, disposed } = fixture(), texture = deferred<CompressedTexture>();
    const gltf = deferred<Awaited<ReturnType<GLTFLoader['parseAsync']>>>();
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockReturnValue(gltf.promise);
    parse.mockImplementation((_bytes, resolve, reject) => { void texture.promise.then(resolve, reject); });
    const pendingTexture = reader.readTexture('/a.ktx2'), pendingModel = reader.readModel('/b.glb'); await flush();
    expect(parse).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000); expect(reader.trim()).toBe(false);
    texture.resolve(new CompressedTexture([], 1, 1)); await pendingTexture;
    vi.advanceTimersByTime(60_000); expect(reader.trim()).toBe(false);
    gltf.resolve({ scene: new Group(), animations: [] } as never); await pendingModel;
    vi.advanceTimersByTime(19_999); expect(reader.trim()).toBe(false);
    vi.advanceTimersByTime(1); expect(reader.trim()).toBe(true); expect(disposed).toHaveBeenCalledTimes(1); reader.dispose();
  });

  it.each(['texture', 'model'] as const)('returns the decoding reference on %s failure so trimming and retry still work', async kind => {
    const { reader, parse, disposed } = fixture();
    const gltf = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockRejectedValueOnce(new Error('bad model'))
      .mockResolvedValue({ scene: new Group(), animations: [] } as never);
    parse.mockImplementationOnce((_bytes, _resolve, reject) => reject!(new Error('bad texture')));
    const read = () => kind === 'texture' ? reader.readTexture('/a.ktx2') : reader.readModel('/a.glb');
    await expect(read()).rejects.toThrow(`bad ${kind}`);
    vi.advanceTimersByTime(19_999); expect(reader.trim()).toBe(false);
    vi.advanceTimersByTime(1); expect(reader.trim()).toBe(true); expect(disposed).toHaveBeenCalledTimes(1);
    await read(); expect(kind === 'texture' ? parse : gltf).toHaveBeenCalledTimes(2); reader.dispose();
  });

  it('rebinds the GLTF loader to the rebuilt KTX2 loader instead of a disposed one', async () => {
    const { reader, limits } = fixture();
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue({ scene: new Group(), animations: [] } as never);
    const bind = vi.spyOn(GLTFLoader.prototype, 'setKTX2Loader');
    await reader.readModel('/a.glb'); vi.advanceTimersByTime(20_000); expect(reader.trim()).toBe(true);
    await reader.readModel('/a.glb'); expect(bind).toHaveBeenCalledTimes(2);
    expect(bind.mock.calls[1][0]).not.toBe(bind.mock.calls[0][0]);
    expect(bind.mock.calls.map(([loader]) => loader)).toEqual(limits.mock.instances);
    reader.dispose();
  });
});

it('rereads model bytes and restores CPU arrays/mip data after upload stripping and idle cache eviction', async () => {
  const { reader, read } = fixture();
  const decoded: { scene: Group; geometry: import('three').BufferGeometry; texture: CompressedTexture }[] = [];
  const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => {
    const { BufferGeometry } = await import('three');
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
      .setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    const texture = new CompressedTexture([{ data: new Uint8Array([1, 2, 3, 4]), width: 1, height: 1 }], 1, 1), scene = new Group();
    scene.add(new Mesh(geometry, new MeshBasicMaterial({ map: texture }))); decoded.push({ scene, geometry, texture });
    return { scene, animations: [] } as never;
  });
  const cache = new ModelCache({ schemaVersion: 1, models: { toy: { path: 'toy.glb' } } }, '/synthetic/', async url => {
    const value = await reader.readModel(url); releaseAfterUpload(value.scene); return value;
  });
  const retention = createModelRetention(cache), first = await retention.load('toy');
  const normal = decoded[0].geometry.getAttribute('normal') as Float32BufferAttribute;
  expect(normal.array.length).toBe(9); normal.onUploadCallback(); decoded[0].texture.onUpdate!(decoded[0].texture);
  expect(normal.array.length).toBe(0); expect(decoded[0].texture.mipmaps[0].data.byteLength).toBe(0);
  first.release(); vi.advanceTimersByTime(120_000); expect(retention.sweep()).toBe(1); await flush();
  expect(reader.trim()).toBe(true);
  const fresh = await retention.load('toy'); expect(read).toHaveBeenCalledTimes(2); expect(parse).toHaveBeenCalledTimes(2);
  expect(decoded[1].geometry.getAttribute('normal').array.length).toBe(9); expect(decoded[1].texture.mipmaps[0].data.byteLength).toBe(4);
  expect((fresh.scene.children[0] as Mesh).geometry).toBe(decoded[1].geometry);
  fresh.release(); cache.dispose(); reader.dispose(); await flush();
});

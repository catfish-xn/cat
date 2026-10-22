import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, CompressedTexture, Float32BufferAttribute, Group, InterleavedBuffer, InterleavedBufferAttribute,
  Mesh, MeshBasicMaterial, Texture, Uint16BufferAttribute } from 'three';
import { ModelCache, type ModelTemplate } from '../src/rendering3d';
import { createModelRetention, MODEL_IDLE_MS, releaseAfterUpload } from '../src/rendering/three-mode/model-memory';
import { createModelWarmup } from '../src/rendering/three-mode/model-warmup';
import { isLegendModel } from '../src/rendering/three-mode/legend-load';

function template() {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const texture = new Texture(), material = new MeshBasicMaterial({ map: texture, alphaMap: texture }), scene = new Group();
  // Shared resources must be counted/disposed once, not once per mesh or material slot.
  scene.add(new Mesh(geometry, [material, material]), new Mesh(geometry, material));
  return { scene, animations: [], geometry, material, texture,
    disposed: [geometry, material, texture].map(resource => vi.spyOn(resource, 'dispose')) };
}
function fixture() {
  const models: ReturnType<typeof template>[] = [];
  const read = vi.fn(async () => { const model = template(); models.push(model); return model; });
  const cache = new ModelCache({ schemaVersion: 1, models: { toy: { path: 'toy.glb' }, 'little-legend-default': { path: 'legend.glb' } } }, '/synthetic/', read);
  const retention = createModelRetention(cache, { pinned: isLegendModel });
  return { cache, retention, models, read };
}
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('model retention with real cache and synthetic resources', () => {
  it('evicts at 120 seconds after the last release, disposes each resource once, and reloads fresh resources', async () => {
    expect(MODEL_IDLE_MS).toBe(120_000);
    const { cache, retention, models, read } = fixture();
    const first = await retention.load('toy');
    expect(retention.idle).toBe(0); first.release(); first.release(); expect(retention.idle).toBe(1);
    vi.advanceTimersByTime(119_999); expect(retention.sweep()).toBe(0);
    models[0].disposed.forEach(disposed => expect(disposed).not.toHaveBeenCalled());
    vi.advanceTimersByTime(1); expect(retention.sweep()).toBe(1); expect(retention.idle).toBe(0); await flush();
    models[0].disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1));
    expect(retention.sweep()).toBe(0);
    const second = await retention.load('toy'); expect(read).toHaveBeenCalledTimes(2);
    const mesh = second.scene.children[0] as Mesh;
    expect(mesh.geometry).toBe(models[1].geometry); expect(mesh.geometry).not.toBe(models[0].geometry);
    expect(mesh.material).toEqual([models[1].material, models[1].material]);
    expect(models[1].texture).not.toBe(models[0].texture);
    second.release(); cache.dispose(); await flush();
    models.forEach(model => model.disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1)));
  });

  it('keeps simultaneous board, bench, shop, scout and carousel leases until every consumer releases', async () => {
    // The retention boundary is a lease, regardless of which presentation consumer owns it.
    const { cache, retention, models, read } = fixture();
    const consumers = ['board', 'bench', 'shop', 'scout', 'carousel'];
    const leases = await Promise.all(consumers.map(() => retention.load('toy')));
    expect(read).toHaveBeenCalledTimes(1);
    for (const lease of leases) {
      vi.advanceTimersByTime(240_000); expect(retention.sweep()).toBe(0); expect(retention.idle).toBe(0);
      models[0].disposed.forEach(disposed => expect(disposed).not.toHaveBeenCalled());
      lease.release(); lease.release();
    }
    expect(retention.idle).toBe(1);
    vi.advanceTimersByTime(119_999); expect(retention.sweep()).toBe(0);
    vi.advanceTimersByTime(1); expect(retention.sweep()).toBe(1); await flush();
    models[0].disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1)); cache.dispose();
  });

  it('protects a pending load and starts its idle period when the delivered lease releases', async () => {
    const model = template(); let resolve!: (value: ModelTemplate) => void;
    const cache = new ModelCache({ schemaVersion: 1, models: { toy: { path: 'toy.glb' } } }, '',
      () => new Promise<ModelTemplate>(done => { resolve = done; }));
    const retention = createModelRetention(cache), pending = retention.load('toy'); await flush();
    vi.advanceTimersByTime(240_000); expect(retention.sweep()).toBe(0); expect(retention.idle).toBe(0);
    resolve(model); const lease = await pending;
    expect(retention.sweep()).toBe(0); lease.release();
    vi.advanceTimersByTime(120_000); expect(retention.sweep()).toBe(1); await flush();
    model.disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1)); cache.dispose();
  });

  it('protects real warm-up leases through deferred GPU upload and envelope preparation', async () => {
    const { cache, retention, models } = fixture(); let finishUpload!: (value: number) => void, finishPrepare!: (value: boolean) => void;
    const upload = vi.fn(() => new Promise<number>(done => { finishUpload = done; }));
    const prepare = vi.fn(() => new Promise<boolean>(done => { finishPrepare = done; }));
    const warmup = createModelWarmup({ load: id => retention.load(id), has: () => true, upload, prepare, busy: () => false, idle: step => step() });
    warmup.want(['toy']); await flush(); expect(upload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(240_000); expect(retention.sweep()).toBe(0);
    finishUpload(1); await flush(); expect(prepare).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(240_000); expect(retention.sweep()).toBe(0);
    finishPrepare(true); await flush(); expect(warmup.warmed('toy')).toBe(true); expect(retention.idle).toBe(1);
    vi.advanceTimersByTime(120_000); expect(retention.sweep()).toBe(1); await flush();
    models[0].disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1)); warmup.dispose(); cache.dispose();
  });

  it('retains pinned legends but evicts ordinary idle models, and restarts the timer on a later lease', async () => {
    const { cache, retention, models } = fixture();
    const legend = await retention.load('little-legend-default'), toy = await retention.load('toy'); legend.release(); toy.release();
    vi.advanceTimersByTime(119_999); const borrowed = await retention.load('toy'); borrowed.release();
    vi.advanceTimersByTime(119_999); expect(retention.sweep()).toBe(0); expect(retention.idle).toBe(2);
    vi.advanceTimersByTime(1); expect(retention.sweep()).toBe(1); expect(retention.idle).toBe(1); await flush();
    models[0].disposed.forEach(disposed => expect(disposed).not.toHaveBeenCalled());
    cache.dispose(); await flush(); models[0].disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1));
  });

  it('makes a rejected load idle rather than leaking a reference', async () => {
    const cache = { load: vi.fn(async () => { throw new Error('synthetic failure'); }), evict: vi.fn() };
    const retention = createModelRetention(cache);
    await expect(retention.load('toy')).rejects.toThrow('synthetic failure'); expect(retention.idle).toBe(1);
    vi.advanceTimersByTime(120_000); expect(retention.sweep()).toBe(1); expect(cache.evict).toHaveBeenCalledExactlyOnceWith('toy');
  });
});

describe('CPU copies after a synthetic GPU upload', () => {
  it('drops only uploaded expendable arrays; keeps positions, skin data and indices usable', () => {
    const model = template(), geometry = model.geometry;
    for (const name of ['normal', 'uv', 'tangent', 'color', 'skinWeight']) geometry.setAttribute(name, new Float32BufferAttribute([1, 2, 3], 3));
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 2], 3)); geometry.setIndex([0, 1, 2]);
    const kept = ['position', 'skinIndex', 'skinWeight'].map(name => geometry.getAttribute(name) as Float32BufferAttribute | Uint16BufferAttribute);
    const arrays = kept.map(attribute => attribute.array), index = geometry.index!.array;
    releaseAfterUpload(model.scene);
    for (const name of ['normal', 'uv', 'tangent', 'color']) {
      const attribute = geometry.getAttribute(name) as Float32BufferAttribute, before = attribute.array;
      expect(before.length).toBe(3); attribute.onUploadCallback();
      expect(attribute.array).toBeInstanceOf(Float32Array); expect(attribute.array.length).toBe(0);
    }
    kept.forEach((attribute, i) => { attribute.onUploadCallback(); expect(attribute.array).toBe(arrays[i]); });
    expect(geometry.index!.array).toBe(index); expect(geometry.index!.count).toBe(3);
    geometry.computeBoundingBox(); expect(geometry.boundingBox!.max.toArray()).toEqual([1, 1, 0]);
  });

  it('keeps interleaved positions and shared texture sources, but drops standalone interleaved UV/normal buffers', () => {
    const model = template(), geometry = model.geometry;
    const positions = new InterleavedBuffer(new Float32Array([1, 2, 3, 0, 1, 0]), 6);
    const expendable = new InterleavedBuffer(new Float32Array([0, 0, 0, 1, 0]), 5);
    geometry.setAttribute('position', new InterleavedBufferAttribute(positions, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(positions, 3, 3));
    geometry.setAttribute('uv', new InterleavedBufferAttribute(expendable, 2, 0));
    geometry.setAttribute('color', new InterleavedBufferAttribute(expendable, 3, 2));
    const close = vi.fn(); model.texture.image = { close };
    const shared = model.texture.clone(); model.material.alphaMap = shared;
    releaseAfterUpload(model.scene); positions.onUploadCallback(); expendable.onUploadCallback();
    expect(positions.array.length).toBe(6); expect(expendable.array.length).toBe(0);
    model.texture.onUpdate?.(model.texture); shared.onUpdate?.(shared); expect(close).not.toHaveBeenCalled();
  });

  it('empties compressed mip bytes and closes image bitmaps only on upload while preserving prior callbacks', () => {
    const model = template(), bytes = new Uint8Array([1, 2, 3, 4]);
    const texture = new CompressedTexture([{ data: bytes, width: 1, height: 1 }], 1, 1), previous = vi.fn(), close = vi.fn();
    texture.onUpdate = previous; model.material.map = texture; model.texture.image = { close };
    releaseAfterUpload(model.scene); expect(texture.mipmaps[0].data).toBe(bytes); expect(close).not.toHaveBeenCalled();
    texture.onUpdate!(texture); model.texture.onUpdate!(model.texture);
    expect(texture.mipmaps[0].data).toBeInstanceOf(Uint8Array); expect(texture.mipmaps[0].data.byteLength).toBe(0);
    expect(previous).toHaveBeenCalledExactlyOnceWith(texture); expect(close).toHaveBeenCalledTimes(1);
  });
});

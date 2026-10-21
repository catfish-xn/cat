import { afterEach, expect, it, vi } from 'vitest';
import { Group, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAssetReader } from '../src/rendering/three-mode/asset-reader';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
afterEach(() => vi.restoreAllMocks());

it('times bytes including arrayBuffer separately from parsing and attributes each completed model by URL', async () => {
  let now = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const bytes = new ArrayBuffer(8), blob = new Blob(), fetch = deferred<Blob>(), buffer = deferred<ArrayBuffer>();
  const decoded = deferred<Awaited<ReturnType<GLTFLoader['parseAsync']>>>(), scene = new Group();
  const arrayBuffer = vi.spyOn(blob, 'arrayBuffer').mockReturnValue(buffer.promise);
  const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockReturnValue(decoded.promise);
  const read = vi.fn(() => fetch.promise), timing = vi.fn();
  const reader = createAssetReader({} as WebGLRenderer, read, timing);
  try {
    const pending = reader.readModel('/synthetic/a/model.glb');
    expect(read).toHaveBeenCalledExactlyOnceWith('/synthetic/a/model.glb');
    now = 107; fetch.resolve(blob); await flush(); expect(arrayBuffer).toHaveBeenCalledTimes(1); expect(parse).not.toHaveBeenCalled();
    now = 112; buffer.resolve(bytes); await flush();
    expect(parse).toHaveBeenCalledExactlyOnceWith(bytes, '/synthetic/a/'); expect(timing).not.toHaveBeenCalled();
    now = 129; decoded.resolve({ scene, animations: [] } as never);
    await expect(pending).resolves.toEqual({ scene, animations: [] });
    expect(timing).toHaveBeenCalledExactlyOnceWith('/synthetic/a/model.glb', 12, 17);
    now = 200; await reader.readModel('/synthetic/b/model.glb');
    expect(timing.mock.calls).toEqual([['/synthetic/a/model.glb', 12, 17], ['/synthetic/b/model.glb', 0, 0]]);
  } finally { reader.dispose(); }
});

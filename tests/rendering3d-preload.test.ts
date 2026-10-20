import { describe, expect, it, vi } from 'vitest';
import { AssetPreloader, describePreload, memoryStore, readPrecacheList, type AssetStore } from '../src/rendering/three-mode/asset-preload';
import type { AssetManifest } from '../src/rendering3d';

/** Synthetic bytes only: no real assets, IndexedDB or network. */
const ROOT = 'https://assets.test/a3d/';
const manifest: AssetManifest = { schemaVersion: 1, models: { jinx: { path: 'models/jinx/model.glb' } }, effects: { fx: { path: 'effects/fx.json' } } };
const sha = (n: number) => n.toString(16).padStart(64, '0');
const list = (files: [string, number, number][]) => readPrecacheList({ schemaVersion: 1, files: files.map(([path, bytes, h]) => ({ path, bytes, sha256: sha(h) })) }, manifest);
/** Body of path P is P's size in bytes of 'x'; its "hash" is looked up from the table. */
function server(sizes: Record<string, number>, fail: Set<string> = new Set()) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).slice(ROOT.length); calls.push(path);
    if (fail.has(path) || !(path in sizes)) return new Response('no', { status: 404 });
    return new Response('x'.repeat(sizes[path]));
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const digestOf = (hashes: Record<number, number>) => async (blob: Blob) => sha(hashes[blob.size] ?? -1);

describe('3D asset preloader', () => {
  it('falls back to manifest paths, unversioned, when precache.json is missing or invalid', () => {
    for (const value of [null, { schemaVersion: 2, files: [] }, { schemaVersion: 1, files: [{ path: '../x', bytes: 1, sha256: sha(1) }] },
      { schemaVersion: 1, files: [{ path: 'a', bytes: 1, sha256: 'ABC' }] }]) {
      const result = readPrecacheList(value, manifest);
      expect(result.versioned).toBe(false);
      expect(result.files.map(file => file.path)).toEqual(['models/jinx/model.glb', 'effects/fx.json']);
    }
    expect(list([['a.png', 3, 1]]).versioned).toBe(true);
  });

  it('downloads everything once, reports progress, and serves later reads from the store', async () => {
    const store = memoryStore(), { fetch, calls } = server({ 'a.glb': 3, 'b.png': 5 });
    const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 5, 2]]), store, { fetch, digest: digestOf({ 3: 1, 5: 2 }) });
    const seen: string[] = [];
    preloader.onProgress(progress => seen.push(`${progress.state}:${progress.readyBytes}/${progress.totalBytes}`));
    const done = await preloader.start();
    expect(done).toMatchObject({ state: 'done', readyFiles: 2, failedFiles: 0, readyBytes: 8, totalBytes: 8 });
    expect(seen[0]).toBe('checking:0/8'); expect(seen.at(-1)).toBe('done:8/8');
    expect((await preloader.read('a.glb')).size).toBe(3);
    expect(calls.sort()).toEqual(['a.glb', 'b.png']);
    expect(describePreload(done)).toContain('2 个文件');
  });

  it('re-downloads only files whose hash changed and drops files no longer listed', async () => {
    const store = memoryStore();
    const first = server({ 'a.glb': 3, 'b.png': 5, 'old.png': 2 });
    await new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 5, 2], ['old.png', 2, 9]]), store,
      { fetch: first.fetch, digest: digestOf({ 3: 1, 5: 2, 2: 9 }) }).start();
    await store.put({ key: 'https://other.test/|keep.png', sha256: null, blob: new Blob(['k']) });
    const second = server({ 'a.glb': 3, 'b.png': 6 });
    const result = await new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 6, 7]]), store,
      { fetch: second.fetch, digest: digestOf({ 3: 1, 6: 7 }) }).start();
    expect(second.calls).toEqual(['b.png']);
    expect(result).toMatchObject({ state: 'done', readyFiles: 2 });
    expect((await store.keys()).sort()).toEqual([`${ROOT}|a.glb`, `${ROOT}|b.png`, 'https://other.test/|keep.png']);
  });

  it('rejects a body whose size or hash does not match, retries, then counts it failed', async () => {
    const { fetch, calls } = server({ 'a.glb': 4 });
    const result = await new AssetPreloader(ROOT, list([['a.glb', 3, 1]]), memoryStore(), { fetch, retries: 1, digest: digestOf({}) }).start();
    expect(result).toMatchObject({ state: 'partial', failedFiles: 1, readyFiles: 0 });
    expect(calls).toEqual(['a.glb', 'a.glb']);
    expect(describePreload(result)).toContain('1 个文件失败');
  });

  it('moves a file the board needs to the front of the queue', async () => {
    const { fetch, calls } = server({ 'a': 1, 'b': 1, 'c': 1, 'd': 1 });
    const preloader = new AssetPreloader(ROOT, list([['a', 1, 1], ['b', 1, 1], ['c', 1, 1], ['d', 1, 1]]), memoryStore(),
      { fetch, concurrency: 1, digest: digestOf({ 1: 1 }) });
    const started = preloader.start();
    const read = preloader.read('d');
    await started; await read;
    expect(calls[0]).toBe('d');
  });

  it('keeps working without persistence when the store refuses writes', async () => {
    const refusing: AssetStore = { ...memoryStore(), persistent: true, put: async () => { throw new Error('quota'); } };
    const { fetch } = server({ 'a.glb': 3 });
    const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1]]), refusing, { fetch, digest: digestOf({ 3: 1 }) });
    const result = await preloader.start();
    expect(result).toMatchObject({ state: 'done', persistent: false });
    expect((await preloader.read('a.glb')).size).toBe(3);
  });

  it('reads unlisted paths straight from the network', async () => {
    const { fetch, calls } = server({ 'extra.json': 2 });
    const preloader = new AssetPreloader(ROOT, list([]), memoryStore(), { fetch });
    await preloader.start();
    expect((await preloader.read('extra.json')).size).toBe(2);
    expect(calls).toEqual(['extra.json']);
  });
});

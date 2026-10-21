import { describe, expect, it, vi } from 'vitest';
import { AssetPreloader, PRELOAD_CONCURRENCY, describePreload, memoryStore, openAssetStore, readPrecacheList, type AssetStore } from '../src/rendering/three-mode/asset-preload';
import type { AssetManifest } from '../src/rendering3d';

/** Synthetic bytes only: no real assets, IndexedDB or network. */
const ROOT = 'https://assets.test/a3d/';
const manifest: AssetManifest = { schemaVersion: 1, models: { sample: { path: 'models/sample/model.glb' } }, effects: { fx: { path: 'effects/fx.json' } } };
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
/** Serves explicit bodies, so two versions of a file can share a size. */
function bodies(files: Record<string, string>) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).slice(ROOT.length); calls.push(path);
    return path in files ? new Response(files[path]) : new Response('no', { status: 404 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const textDigest = (hashes: Record<string, number>) => async (blob: Blob) => sha(hashes[await blob.text()] ?? -1);
const digestOf = (hashes: Record<number, number>) => async (blob: Blob) => sha(hashes[blob.size] ?? -1);

describe('3D asset preloader', () => {
  it('falls back to manifest paths, unversioned, when precache.json is missing or invalid', () => {
    for (const value of [null, { schemaVersion: 2, files: [] }, { schemaVersion: 1, files: [{ path: '../x', bytes: 1, sha256: sha(1) }] },
      { schemaVersion: 1, files: [{ path: 'a', bytes: 1, sha256: 'ABC' }] }]) {
      const result = readPrecacheList(value, manifest);
      expect(result.versioned).toBe(false);
      expect(result.files.map(file => file.path)).toEqual(['models/sample/model.glb', 'effects/fx.json']);
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

  it('reports this visit\'s download size and time, and says so when everything came from the store', async () => {
    const store: AssetStore = { ...memoryStore(), persistent: true }, { fetch } = server({ 'a.glb': 3, 'b.png': 5 });
    const clock = (times: number[]) => () => times.shift() ?? 0;
    const files = list([['a.glb', 3, 1], ['b.png', 5, 2]]), digest = digestOf({ 3: 1, 5: 2 });
    const first = new AssetPreloader(ROOT, files, store, { fetch, digest, now: clock([1000, 13345]) });
    const seen: (number | null)[] = [];
    first.onProgress(progress => seen.push(progress.elapsedMs));
    const done = await first.start();
    expect(done).toMatchObject({ downloadedFiles: 2, downloadedBytes: 8, elapsedMs: 12345 });
    expect(seen.slice(0, -1).every(value => value === null)).toBe(true);
    expect(describePreload(done)).toBe('素材已全部缓存到本地（2 个文件，本次下载 0.0 MB 用时 12.3 秒）');
    const again = await new AssetPreloader(ROOT, files, store, { fetch, digest, now: clock([0, 40]) }).start();
    expect(again).toMatchObject({ state: 'done', downloadedFiles: 0, elapsedMs: 40 });
    expect(describePreload(again)).toBe('素材已全部缓存到本地（2 个文件，全部来自本地）');
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

  it('re-downloads a file whose content and hash changed at the same size, and replaces the stored copy', async () => {
    const store = memoryStore();
    const first = bodies({ 'a.glb': 'aaa', 'b.png': 'bbb' });
    await new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 3, 2]]), store,
      { fetch: first.fetch, digest: textDigest({ aaa: 1, bbb: 2 }) }).start();
    const second = bodies({ 'a.glb': 'aaa', 'b.png': 'BBB' });
    const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 3, 3]]), store,
      { fetch: second.fetch, digest: textDigest({ aaa: 1, BBB: 3 }) });
    expect(await preloader.start()).toMatchObject({ state: 'done', readyFiles: 2, failedFiles: 0 });
    expect(second.calls).toEqual(['b.png']);
    const stored = await store.get(`${ROOT}|b.png`);
    expect(stored?.sha256).toBe(sha(3)); expect(await stored?.blob.text()).toBe('BBB');
  });

  it('rejects a body of the right size whose hash does not match, retries, and stores nothing', async () => {
    const store = memoryStore(), { fetch, calls } = bodies({ 'a.glb': 'xyz' });
    const result = await new AssetPreloader(ROOT, list([['a.glb', 3, 1]]), store, { fetch, retries: 1, digest: textDigest({ xyz: 9 }) }).start();
    expect(result).toMatchObject({ state: 'partial', failedFiles: 1, readyFiles: 0 });
    expect(calls).toEqual(['a.glb', 'a.glb']);
    expect(await store.keys()).toEqual([]);
  });

  it('checks real SHA-256 by default', async () => {
    const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const good = bodies({ 'a.txt': 'abc' });
    const ok = await new AssetPreloader(ROOT, readPrecacheList({ schemaVersion: 1, files: [{ path: 'a.txt', bytes: 3, sha256: abc }] }, manifest),
      memoryStore(), { fetch: good.fetch }).start();
    expect(ok).toMatchObject({ state: 'done', readyFiles: 1 });
    const bad = bodies({ 'a.txt': 'abd' });
    const failed = await new AssetPreloader(ROOT, readPrecacheList({ schemaVersion: 1, files: [{ path: 'a.txt', bytes: 3, sha256: abc }] }, manifest),
      memoryStore(), { fetch: bad.fetch, retries: 0 }).start();
    expect(failed).toMatchObject({ state: 'partial', failedFiles: 1 });
  });

  it('rejects a body whose size does not match, retries, then counts it failed', async () => {
    const { fetch, calls } = server({ 'a.glb': 4 });
    const result = await new AssetPreloader(ROOT, list([['a.glb', 3, 1]]), memoryStore(), { fetch, retries: 1, digest: digestOf({}) }).start();
    expect(result).toMatchObject({ state: 'partial', failedFiles: 1, readyFiles: 0 });
    expect(calls).toEqual(['a.glb', 'a.glb']);
    expect(describePreload(result)).toContain('1 个文件失败');
  });

  it('downloads twelve files at a time by default', async () => {
    let inFlight = 0, peak = 0;
    const fetch = vi.fn(async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(done => setTimeout(done, 5));
      inFlight--; return new Response('x');
    }) as unknown as typeof globalThis.fetch;
    const files = Array.from({ length: 30 }, (_, i): [string, number, number] => [`f${i}`, 1, 1]);
    const result = await new AssetPreloader(ROOT, list(files), memoryStore(), { fetch, digest: digestOf({ 1: 1 }) }).start();
    expect(PRELOAD_CONCURRENCY).toBe(12);
    expect(peak).toBe(12);
    expect(result).toMatchObject({ state: 'done', readyFiles: 30, retriedRequests: 0 });
  });

  it('retries a dropped request after a pause, shows the retries while downloading, and still completes', async () => {
    let first = true;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).slice(ROOT.length);
      if (path === 'a.glb' && first) { first = false; throw new TypeError('synthetic-network-drop'); }
      return new Response('x'.repeat(path === 'a.glb' ? 3 : 1));
    }) as unknown as typeof globalThis.fetch;
    const delays: number[] = [], texts: string[] = [];
    const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b', 1, 2]]), memoryStore(),
      { fetch, concurrency: 1, digest: digestOf({ 3: 1, 1: 2 }), retryDelayMs: n => { delays.push(n); return 0; } });
    preloader.onProgress(progress => texts.push(describePreload(progress)));
    const result = await preloader.start();
    expect(delays).toEqual([1]);
    expect(result).toMatchObject({ state: 'done', readyFiles: 2, failedFiles: 0, retriedRequests: 1 });
    expect(texts.some(text => text.startsWith('素材预下载') && text.includes('已重试 1 次'))).toBe(true);
    expect(describePreload(result)).toContain('其间重试 1 次');
  });

  it('gives up after the retry budget and says so, counting every retry', async () => {
    const { fetch, calls } = server({}, new Set(['a.glb']));
    const result = await new AssetPreloader(ROOT, list([['a.glb', 3, 1]]), memoryStore(), { fetch, retryDelayMs: () => 0 }).start();
    expect(calls).toHaveLength(4);
    expect(result).toMatchObject({ state: 'partial', failedFiles: 1, retriedRequests: 3 });
    expect(describePreload(result)).toContain('1 个文件失败（重试 3 次后仍失败');
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
    expect(result).toMatchObject({ state: 'done', persistent: false, readyFiles: 1, failedFiles: 0 });
    expect((await preloader.read('a.glb')).size).toBe(3);
    expect((await preloader.read('a.glb')).size).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to a non-persistent store when IndexedDB is missing or fails to open, and still serves files', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const missing = await openAssetStore();
    vi.stubGlobal('indexedDB', { open: () => {
      const request: Record<string, unknown> = { error: new Error('denied') };
      queueMicrotask(() => (request.onerror as () => void)());
      return request;
    } });
    const failing = await openAssetStore();
    vi.unstubAllGlobals();
    for (const store of [missing, failing]) {
      expect(store.persistent).toBe(false);
      const { fetch } = server({ 'a.glb': 3 });
      const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1]]), store, { fetch, digest: digestOf({ 3: 1 }) });
      expect(await preloader.start()).toMatchObject({ state: 'done', persistent: false, readyFiles: 1 });
      expect((await preloader.read('a.glb')).size).toBe(3);
    }
  });

  it('reads unlisted paths straight from the network', async () => {
    const { fetch, calls } = server({ 'extra.json': 2 });
    const preloader = new AssetPreloader(ROOT, list([]), memoryStore(), { fetch });
    await preloader.start();
    expect((await preloader.read('extra.json')).size).toBe(2);
    expect(calls).toEqual(['extra.json']);
  });
});

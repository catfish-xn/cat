import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetPreloader, CACHE_CHECK_BATCH_SIZE, memoryStore, openIndexedDbStore,
  type PrecacheList, type StoredAsset } from '../src/rendering/three-mode/asset-preload';

const ROOT = 'https://assets.test/';
const key = (path: string) => `${ROOT}|${path}`;
const hash = '1'.repeat(64);
const record = (path: string, sha256: string | null = hash): StoredAsset => ({ key: key(path), sha256, blob: new Blob(['old']) });
const list = (count: number): PrecacheList => ({ versioned: true,
  files: Array.from({ length: count }, (_, i) => ({ path: `f${i}`, bytes: 1, sha256: hash })) });

/** Minimal async IDB seam: requests run after handlers attach; complete follows all queued requests.
 * Real Chromium transaction counts and cold startup are also measured by the local C-group runner. */
function indexedStore(records: StoredAsset[] = []) {
  const data = new Map(records.map(value => [value.key, value]));
  const modes: IDBTransactionMode[] = [];
  let abortNext = false;
  const db = { transaction: vi.fn((_name: string, mode: IDBTransactionMode) => {
    modes.push(mode);
    const aborted = abortNext; abortNext = false;
    const tx = { error: new Error('synthetic-abort'), oncomplete: () => {}, onerror: () => {}, onabort: () => {},
      objectStore: () => ({
        get: (key: string) => request(() => data.get(key)),
        getAllKeys: () => request(() => [...data.keys()]),
        put: (value: StoredAsset) => request(() => { data.set(value.key, value); return value.key; }),
        delete: (key: string) => request(() => { data.delete(key); }),
      }) };
    function request<T>(read: () => T) {
      const call = { result: undefined as T | undefined, onsuccess: () => {} };
      queueMicrotask(() => { if (!aborted) { call.result = read(); call.onsuccess(); } });
      return call;
    }
    queueMicrotask(() => queueMicrotask(() => { if (aborted) tx.onabort(); else tx.oncomplete(); }));
    return tx;
  }) };
  const open = vi.fn(() => {
    const request = { result: db, onsuccess: () => {}, onupgradeneeded: vi.fn() };
    queueMicrotask(() => request.onsuccess()); // Existing v1 database: no migration.
    return request;
  });
  vi.stubGlobal('indexedDB', { open });
  return { data, modes, open, abort: () => { abortNext = true; } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('batched 3D cache checks', () => {
  it('matches per-file reads for existing, changed, unversioned and missing entries in an old v1 store', async () => {
    const fixture = indexedStore([record('hit'), record('changed', '2'.repeat(64)), record('unversioned', null), record('stale'),
      { key: 'https://other.test/|keep', sha256: hash, blob: new Blob(['other']) }]);
    const store = await openIndexedDbStore();
    const paths = ['hit', 'changed', 'unversioned', 'missing'];
    const reference = new Map<string, string | null>();
    for (const path of paths) { const value = await store.get(key(path)); if (value) reference.set(key(path), value.sha256); }
    const before = fixture.modes.length;
    expect(await store.hashes(paths.map(key))).toEqual(reference);
    expect(fixture.modes.length - before).toBe(1);
    expect(await store.hashes([])).toEqual(new Map());
    expect(fixture.modes.length - before).toBe(1);
    const fetch = vi.fn(async () => new Response('x'));
    const preloader = new AssetPreloader(ROOT, { versioned: true, files: paths.map(path => ({ path, bytes: 1,
      sha256: path === 'unversioned' ? null : hash })) }, store, { fetch, digest: async () => hash });
    expect(await preloader.start()).toMatchObject({ readyFiles: 4, downloadedFiles: 2, failedFiles: 0 });
    expect(fetch.mock.calls.map(args => String((args as unknown[])[0]))).toEqual([ROOT + 'changed', ROOT + 'missing']);
    // Same-hash old bytes still hit even when the manifest's size differs: validity semantics are unchanged.
    expect(await (await preloader.read('hit')).text()).toBe('old');
    expect(await (await preloader.read('unversioned')).text()).toBe('old');
    expect(fixture.data.has(key('stale'))).toBe(false);
    expect(fixture.data.has('https://other.test/|keep')).toBe(true);
    expect(fixture.open).toHaveBeenCalledWith('cat-assets3d', 1);
  });

  it.each([false, true])('uses one inventory transaction plus bounded existing-record batches (warm=%s, 2835 files)', async warm => {
    const count = 2835, files = list(count);
    const fixture = indexedStore(warm ? files.files.map(file => record(file.path)) : []);
    const store = await openIndexedDbStore();
    const get = vi.spyOn(store, 'get');
    const fetch = vi.fn(async () => new Response('x'));
    const preloader = new AssetPreloader(ROOT, files, store, { fetch, digest: async () => hash });
    expect(await preloader.start()).toMatchObject({ state: 'done', readyFiles: count, downloadedFiles: warm ? 0 : count });
    expect(fixture.modes.filter(mode => mode === 'readonly')).toHaveLength(1 + (warm ? Math.ceil(count / CACHE_CHECK_BATCH_SIZE) : 0));
    expect(get).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(warm ? 0 : count);
  });

  it('falls back to batched lookups when inventory fails, preserving old cache hits', async () => {
    const fixture = indexedStore([record('f0')]), store = await openIndexedDbStore();
    fixture.abort();
    const fetch = vi.fn();
    expect(await new AssetPreloader(ROOT, list(1), store, { fetch }).start()).toMatchObject({ readyFiles: 1, downloadedFiles: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(fixture.modes).toEqual(['readonly', 'readonly']);
  });

  it('rejects an aborted batch and downloads its entries without trusting a partial result', async () => {
    const fixture = indexedStore([record('f0')]), store = await openIndexedDbStore();
    const hashes = store.hashes;
    vi.spyOn(store, 'hashes').mockImplementation(keys => { fixture.abort(); return hashes(keys); });
    const fetch = vi.fn(async () => new Response('x'));
    expect(await new AssetPreloader(ROOT, list(1), store, { fetch, digest: async () => hash }).start())
      .toMatchObject({ readyFiles: 1, downloadedFiles: 1, failedFiles: 0 });
  });

  it.each(['keys', 'hashes'] as const)('serves a foreground file before a stalled %s check finishes, without downloading it twice', async method => {
    const store = memoryStore();
    await store.put(record('f0'));
    let release!: () => void;
    const gate = new Promise<void>(done => { release = done; });
    if (method === 'keys') {
      const original = store.keys;
      vi.spyOn(store, 'keys').mockImplementation(async () => { await gate; return original(); });
    } else {
      const original = store.hashes;
      vi.spyOn(store, 'hashes').mockImplementation(async keys => { await gate; return original(keys); });
    }
    const fetch = vi.fn(async () => new Response('x'));
    const preloader = new AssetPreloader(ROOT, list(2), store, { fetch, digest: async () => hash });
    const started = preloader.start();
    expect(await (await preloader.read('f1')).text()).toBe('x');
    expect(preloader.progress.state).toBe('checking');
    expect(await (await preloader.read('f0')).text()).toBe('old');
    release();
    expect(await started).toMatchObject({ state: 'done', readyFiles: 2, downloadedFiles: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('waits for a foreground download already in flight before reporting done', async () => {
    const store = memoryStore();
    let releaseCheck!: () => void, releaseDownload!: () => void, downloading!: () => void;
    const checking = new Promise<string[]>(done => { releaseCheck = () => done([]); });
    const download = new Promise<void>(done => { releaseDownload = done; });
    const requested = new Promise<void>(done => { downloading = done; });
    vi.spyOn(store, 'keys').mockReturnValue(checking);
    const fetch = vi.fn(async () => { downloading(); await download; return new Response('x'); });
    const preloader = new AssetPreloader(ROOT, list(1), store, { fetch, digest: async () => hash });
    const seen: string[] = [];
    preloader.onProgress(progress => seen.push(progress.state));
    const started = preloader.start(), read = preloader.read('f0');
    await requested;
    releaseCheck();
    await vi.waitFor(() => expect(preloader.progress.state).toBe('downloading'));
    expect(seen).not.toContain('done');
    releaseDownload();
    expect(await started).toMatchObject({ state: 'done', readyFiles: 1, downloadedFiles: 1 });
    expect(await (await read).text()).toBe('x');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not start downloads after disposal during inventory checking', async () => {
    const store = memoryStore();
    let release!: () => void;
    vi.spyOn(store, 'keys').mockReturnValue(new Promise(done => { release = () => done([]); }));
    const fetch = vi.fn();
    const preloader = new AssetPreloader(ROOT, list(1), store, { fetch });
    const started = preloader.start();
    preloader.dispose(); release(); await started;
    expect(fetch).not.toHaveBeenCalled();
  });
});

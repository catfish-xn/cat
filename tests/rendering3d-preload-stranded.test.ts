import { describe, expect, it, vi } from 'vitest';
import { AssetPreloader, memoryStore, readPrecacheList } from '../src/rendering/three-mode/asset-preload';
import type { AssetManifest } from '../src/rendering3d';

// A foreground read must never wait on a queue nobody drains (11-19, Windows after a restart: LTK warm-ups stuck for good on
// a cold cache). Synthetic bytes only: no real assets, IndexedDB or network.
const ROOT = 'https://assets.test/a3d/';
const manifest: AssetManifest = { schemaVersion: 1, models: {} };
const sha = (n: number) => n.toString(16).padStart(64, '0');
const list = (files: [string, number, number][]) => readPrecacheList({ schemaVersion: 1, files: files.map(([path, bytes, h]) => ({ path, bytes, sha256: sha(h) })) }, manifest);
const digest = async (blob: Blob) => sha({ 3: 1, 5: 2 }[blob.size] ?? -1);
const timeout = (ms: number) => new Promise<'timeout'>(done => setTimeout(() => done('timeout'), ms));

/**
 * A server where b.png hangs until released, and a.glb fails `failA` times before it serves. Counts every request.
 */
function server(failA: number) {
  const calls: string[] = [];
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  let failsLeft = failA;
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).slice(ROOT.length); calls.push(path);
    if (path === 'b.png') { await held; return new Response('x'.repeat(5)); }
    if (path === 'a.glb') { if (failsLeft-- > 0) return new Response('no', { status: 503 }); return new Response('x'.repeat(3)); }
    return new Response('no', { status: 404 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls, release };
}

describe('3D asset preloader: no stranded foreground read', () => {
  it('a read after every worker has left, while the state is still downloading, still downloads its file', async () => {
    const { fetch, calls, release } = server(1);
    const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 5, 2]]), memoryStore(), { fetch, digest, retries: 0, concurrency: 1 });
    // b.png starts as a foreground read while the inventory is checked, and hangs: start() keeps waiting on it after its
    // workers are gone, so the state stays 'downloading'.
    const b = preloader.read('b.png');
    const started = preloader.start();
    // The worker takes a.glb, whose one try fails: it is dropped from the jobs and the worker leaves (queue empty).
    await vi.waitFor(() => expect(preloader.progress).toMatchObject({ state: 'downloading', failedFiles: 1 }));
    // Now a.glb is read again: a new job, and no worker left to run it.
    const a = await Promise.race([preloader.read('a.glb').then(blob => blob.size), timeout(500)]);
    expect(a).toBe(3);
    expect(calls.filter(path => path === 'a.glb')).toHaveLength(2);
    release(); expect((await b).size).toBe(5);
    expect(await started).toMatchObject({ state: 'done', failedFiles: 0 });
  });

  it('reads of one file at once download it once', async () => {
    const { fetch, calls, release } = server(0);
    const preloader = new AssetPreloader(ROOT, list([['a.glb', 3, 1], ['b.png', 5, 2]]), memoryStore(), { fetch, digest, retries: 0, concurrency: 1 });
    const b = preloader.read('b.png');
    const started = preloader.start();
    const reads = await Promise.all([preloader.read('a.glb'), preloader.read('a.glb'), preloader.read('a.glb')]);
    expect(reads.map(blob => blob.size)).toEqual([3, 3, 3]);
    release(); await b; await started;
    expect(calls.filter(path => path === 'a.glb')).toHaveLength(1);
    expect(calls.filter(path => path === 'b.png')).toHaveLength(1);
  });
});

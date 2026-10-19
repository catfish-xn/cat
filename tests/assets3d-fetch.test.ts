import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { zstdCompressSync } from 'node:zlib';
// @ts-expect-error Pure Node utility.
import { assertCdnUrl, bundleUrl, fetchChunks, fetchFromFiles, mergeRanges } from '../scripts/assets3d/fetch-chunks.mjs';
// @ts-expect-error Pure Node utility.
import { riotChunkId } from '../scripts/assets3d/chunk-hash.mjs';
// @ts-expect-error Pure Node utility.
import { safeOutputPath, withinRoot, writeOutputFileAtomic } from '../scripts/assets3d/safe-path.mjs';

const roots: string[] = [];
async function temporary() {
  await mkdir('assets3d-local', { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/fetch-test-'));
  roots.push(root); return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    withinRoot(resolve('assets3d-local'), root);
    expect(root).not.toBe(resolve('assets3d-local'));
    await rm(root, { recursive: true, force: true });
  }
});
function fixture(raw = [Buffer.from('first synthetic chunk'), Buffer.from('second synthetic chunk')]) {
  const packed = raw.map(b => zstdCompressSync(b));
  const chunks = raw.map((b, i) => ({ id: riotChunkId(b), bundleId: '0000000000000001',
    offset: i ? packed[0].length : 0, size: packed[i].length, targetSize: b.length }));
  const plan = { chunks, wads: [{ name: 'toy.wad.client', chunkIds: chunks.map(c => c.id) }],
    units: { toy: { entries: [{ chunkIds: chunks.map(c => c.id) }] } } };
  return { packed, chunks, plan, manifest: { files: [{ chunks }] }, bundle: Buffer.concat(packed) };
}
function response(bytes: Buffer, start: number, end: number, status = 206) {
  return new Response(new Uint8Array(bytes), { status, headers: { 'content-range': `bytes ${start}-${end - 1}/${end}` } });
}
async function options() {
  const root = await temporary();
  return { cache: join(root, 'chunks'), out: join(root, 'out'), retries: 0, backoffMs: 0 };
}

describe('targeted RMAN downloader with synthetic chunks and injected fetch', () => {
  it('matches an independent PBKDF2 implementation for the Riot ID', () => {
    const bytes = Buffer.from('independent synthetic vector');
    const expected = pbkdf2Sync(createHash('sha256').update(bytes).digest(), Buffer.alloc(0), 32, 8, 'sha256');
    expect(riotChunkId(bytes)).toBe(expected.readBigUInt64LE().toString(16).padStart(16, '0').toUpperCase());
  });
  it('rejects other hosts, HTTP, credentials, ports and hostile bundle IDs', async () => {
    const good = bundleUrl('0000000000000001');
    for (const url of [good.replace('https:', 'http:'), good.replace('riotcdn.net', 'riotcdn.net.evil.test'),
      good.replace('https://', 'https://user@'), good.replace('.net/', '.net:444/'), good + '?redirect=evil', 'https://example.test/x'])
      expect(() => assertCdnUrl(url)).toThrow('cdn-url-rejected');
    const f = fixture(), fetchFn = vi.fn();
    f.chunks[0].bundleId = 'https://evil.test';
    await expect(fetchChunks({ ...f, ...await options(), fetchFn })).rejects.toThrow('unknown-plan-chunk');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('merges exactly adjacent blocks within a bundle without fetching gaps or other bundles', () => {
    const f = fixture();
    expect(mergeRanges(f.chunks)).toHaveLength(1);
    expect(mergeRanges([{ ...f.chunks[0] }, { ...f.chunks[1], offset: f.chunks[1].offset + 1 }])).toHaveLength(2);
    expect(mergeRanges([{ ...f.chunks[0] }, { ...f.chunks[1], bundleId: '0000000000000002' }])).toHaveLength(2);
    expect(mergeRanges(f.chunks, f.chunks[0].size)).toHaveLength(2);
  });
  it('downloads a merged Range, atomically writes compressed cache, and resumes without requests', async () => {
    const f = fixture(), opts = await options();
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(bundleUrl(f.chunks[0].bundleId));
      expect(init.redirect).toBe('error');
      expect(init.headers).toMatchObject({ Range: `bytes=0-${f.bundle.length - 1}` });
      return response(f.bundle, 0, f.bundle.length);
    });
    const first = await fetchChunks({ ...f, ...opts, fetchFn });
    expect(first).toMatchObject({ status: 'complete', requests: 1, downloadBytes: f.bundle.length, failed: [] });
    expect(first.summary.byWad[0]).toMatchObject({ chunks: 2, bytes: f.bundle.length });
    for (let i = 0; i < f.chunks.length; i++)
      expect(await readFile(join(opts.cache, `${f.chunks[i].id}.zst`))).toEqual(f.packed[i]);
    expect((await readdir(opts.cache)).every(n => n.endsWith('.zst'))).toBe(true);
    const second = await fetchChunks({ ...f, ...opts, fetchFn });
    expect(second).toMatchObject({ status: 'complete', requests: 0, downloadBytes: 0 });
    expect(second.skipped).toHaveLength(2); expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(join(opts.out, 'fetch-report.json'), 'utf8')).skipped).toHaveLength(2);
  });
  it('preflights missing compressed bytes before any request, including an exact boundary', async () => {
    const f = fixture(), opts = await options(), fetchFn = vi.fn();
    const result = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length - 1, fetchFn });
    expect(result).toMatchObject({ status: 'failed', reason: 'preflight-byte-limit', requests: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    const exact = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length, dryRun: true, fetchFn });
    expect(exact.status).toBe('planned');
  });
  it('accepts a verified 206 response that exactly exhausts the byte budget', async () => {
    const f = fixture(), opts = await options();
    const fetchFn = vi.fn(async () => response(f.bundle, 0, f.bundle.length));
    const result = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length, fetchFn });
    expect(result).toMatchObject({ status: 'complete', requests: 1, downloadBytes: f.bundle.length, failed: [] });
    expect(result.downloaded).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    for (let i = 0; i < f.chunks.length; i++)
      expect(await readFile(join(opts.cache, `${f.chunks[i].id}.zst`))).toEqual(f.packed[i]);
  });
  it.each([0, 1])('does not retry a 503 when only %i budget bytes remain', async remaining => {
    const f = fixture(), opts = await options(), wait = vi.fn(async () => {});
    const spent = f.bundle.length - remaining;
    const fetchFn = vi.fn(async () => response(f.bundle.subarray(0, spent), 0, f.bundle.length, 503));
    const result = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length, retries: 2, fetchFn, wait });
    expect(result).toMatchObject({ status: 'failed', requests: 1, downloadBytes: spent, downloaded: [] });
    expect(result.failed).toEqual(f.chunks.map(c => ({ id: c.id, reason: 'runtime-byte-limit' })));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    for (const c of f.chunks)
      await expect(readFile(join(opts.cache, `${c.id}.zst`))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('reserves in-flight bytes before retrying a concurrent 503 at the exact budget', async () => {
    const f = fixture([Buffer.from('a'), Buffer.from('b')]), opts = await options();
    expect(f.packed.map(bytes => bytes.length)).toEqual([10, 10]);
    f.chunks[1].offset++; // Keep the two 10-byte ranges separate.
    let secondStarted!: () => void, firstFinished!: () => void, releaseSecond!: (value: Response) => void;
    const started = new Promise<void>(resolve => { secondStarted = resolve; });
    const finished = new Promise<void>(resolve => { firstFinished = resolve; });
    const second = new Promise<Response>(resolve => { releaseSecond = resolve; });
    const wait = vi.fn(async () => {});
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      if ((init.headers as Record<string, string>).Range !== 'bytes=0-9') {
        secondStarted(); return second;
      }
      if (fetchFn.mock.calls.length === 1) {
        await started;
        init.signal!.addEventListener('abort', firstFinished, { once: true });
        return response(f.packed[0], 0, 10, 503);
      }
      return response(f.packed[0], 0, 10);
    });
    const pending = fetchChunks({ ...f, ...opts, maxBytes: 20, concurrency: 2, retries: 1, fetchFn, wait });
    await finished;
    // Drain the first attempt's cleanup/retry microtasks while the second response is held.
    await new Promise<void>(resolve => setImmediate(resolve));
    const requestsBeforeRelease = fetchFn.mock.calls.length;
    releaseSecond(response(f.packed[1], f.chunks[1].offset, f.chunks[1].offset + 10));
    const result = await pending;
    expect(requestsBeforeRelease).toBe(2);
    expect(result).toMatchObject({ status: 'failed', requests: 2, downloadBytes: 20,
      failed: [{ id: f.chunks[0].id, reason: 'runtime-byte-limit' }] });
    expect(result.downloaded.map((c: { id: string }) => c.id)).toEqual([f.chunks[1].id]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(wait).not.toHaveBeenCalled();
  });
  it.each([0, 1])('settles a %i-byte failed response and releases unused reservation for retry', async spent => {
    const f = fixture(), opts = await options(), wait = vi.fn(async () => {});
    const fetchFn = vi.fn().mockResolvedValueOnce(response(Buffer.alloc(spent), 0, f.bundle.length, 503))
      .mockResolvedValueOnce(response(f.bundle, 0, f.bundle.length));
    const result = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length + spent, retries: 1, fetchFn, wait });
    expect(result).toMatchObject({ status: 'complete', requests: 2, downloadBytes: f.bundle.length + spent, failed: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
  it.each([0, 1])('does not dispatch another range when only %i budget bytes remain', async remaining => {
    const f = fixture(), opts = await options();
    f.chunks[1].offset++;
    const spent = f.bundle.length - remaining;
    const fetchFn = vi.fn(async () => response(Buffer.alloc(spent), 0, f.chunks[0].size));
    const result = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length, concurrency: 1, fetchFn });
    expect(result).toMatchObject({ status: 'failed', requests: 1, downloadBytes: spent, downloaded: [] });
    expect(result.failed).toEqual([
      { id: f.chunks[0].id, reason: 'range-body-too-large' },
      { id: f.chunks[1].id, reason: 'runtime-byte-limit' }
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('counts actual streamed bytes, aborts all requests at the runtime cap and starts no further range', async () => {
    const f = fixture(), opts = await options();
    f.chunks[1].offset++; // Two ranges, first returns too many actual bytes.
    const fetchFn = vi.fn(async () => response(Buffer.alloc(f.bundle.length + 1), 0, f.chunks[0].size));
    const result = await fetchChunks({ ...f, ...opts, maxBytes: f.bundle.length, concurrency: 1, fetchFn });
    expect(result.downloadBytes).toBe(f.bundle.length + 1);
    expect(result.failed).toHaveLength(2);
    expect(result.failed.every((f: { reason: string }) => f.reason === 'runtime-byte-limit')).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await expect(readFile(join(opts.cache, `${f.chunks[0].id}.zst`))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each(['id', 'targetSize'])('discards a block failing %s verification but retains other good blocks', async field => {
    const f = fixture(), opts = await options();
    if (field === 'id') f.chunks[0].id = '0000000000000000';
    else f.chunks[0].targetSize++;
    const fetchFn = vi.fn(async () => response(f.bundle, 0, f.bundle.length));
    const result = await fetchChunks({ ...f, ...opts, fetchFn });
    expect(result.failed).toEqual([{ id: f.chunks[0].id, reason: field === 'id' ? 'chunk-id-mismatch' : 'chunk-size-mismatch' }]);
    expect(result.downloaded).toHaveLength(1);
    await expect(readFile(join(opts.cache, `${f.chunks[0].id}.zst`))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(opts.cache)).toEqual([`${f.chunks[1].id}.zst`]);
  });
  it('aborts another active Range when a parallel stream crosses the byte cap', async () => {
    const f = fixture(), opts = await options(), signals: AbortSignal[] = [];
    f.chunks[1].offset++;
    const result = await fetchChunks({ ...f, ...opts, concurrency: 2, maxBytes: f.bundle.length,
      fetchFn: async (_url: string, init: RequestInit) => {
        const signal = init.signal!; signals.push(signal);
        if (signals.length === 1) return response(Buffer.alloc(f.bundle.length + 1), 0, f.chunks[0].size);
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      } });
    expect(signals).toHaveLength(2); expect(signals.every(s => s.aborted)).toBe(true);
    expect(result.failed).toHaveLength(2);
    expect(result.failed.every((f: { reason: string }) => f.reason === 'runtime-byte-limit')).toBe(true);
  });
  it('revalidates corrupt cache and replaces it rather than skipping by filename', async () => {
    const f = fixture(), opts = await options();
    await writeOutputFileAtomic(join(opts.cache, `${f.chunks[0].id}.zst`), Buffer.alloc(f.chunks[0].size));
    const fetchFn = vi.fn(async () => response(f.bundle, 0, f.bundle.length));
    const result = await fetchChunks({ ...f, ...opts, fetchFn });
    expect(result.invalidCache).toHaveLength(1); expect(result.skipped).toHaveLength(0);
    expect(result.status).toBe('complete');
  });
  it('dry run makes no network or output writes', async () => {
    const f = fixture(), opts = await options(), fetchFn = vi.fn();
    const result = await fetchChunks({ ...f, ...opts, dryRun: true, fetchFn });
    expect(result.summary).toMatchObject({ chunks: 2, bytes: f.bundle.length });
    expect(result.requests).toBe(0); expect(fetchFn).not.toHaveBeenCalled();
    await expect(readFile(join(opts.out, 'fetch-report.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects escaped output paths through safe-path before fetching', async () => {
    const fetchFn = vi.fn(), f = fixture(), opts = await options();
    await expect(fetchChunks({ ...f, ...opts, cache: 'assets3d-local/../src', fetchFn })).rejects.toThrow('unsafe-output-path');
    await expect(writeOutputFileAtomic('scripts/assets3d/escape.tmp', 'bad')).rejects.toThrow('unsafe-output-path');
    await expect(safeOutputPath('assets3d-local/../escape')).rejects.toThrow('unsafe-output-path');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('refuses redirects and mismatched Range headers without caching', async () => {
    const f = fixture(), opts = await options();
    const redirect = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/' } }));
    const first = await fetchChunks({ ...f, ...opts, fetchFn: redirect });
    expect(first.failed[0].reason).toBe('cdn-redirect-rejected');
    const second = await fetchChunks({ ...f, ...opts, fetchFn: async () => response(f.bundle, 1, f.bundle.length + 1) });
    expect(second.failed[0].reason).toBe('content-range-mismatch');
  });
  it('counts retries and backoff, caps concurrency, and times out a stalled request', async () => {
    const f = fixture(), opts = await options(), wait = vi.fn(async (_ms: number) => {});
    const fetchFn = vi.fn().mockResolvedValueOnce(response(f.bundle, 0, f.bundle.length, 503))
      .mockResolvedValueOnce(response(f.bundle, 0, f.bundle.length, 503))
      .mockResolvedValueOnce(response(f.bundle, 0, f.bundle.length));
    const result = await fetchChunks({ ...f, ...opts, fetchFn, retries: 2, backoffMs: 10, wait });
    expect(result).toMatchObject({ status: 'complete', requests: 3, downloadBytes: f.bundle.length * 3 });
    expect(wait.mock.calls.map(c => c[0])).toEqual([10, 20]);
    const other = await options();
    const stalled = await fetchChunks({ ...f, ...other, timeoutMs: 10, fetchFn: () => new Promise(() => {}) });
    expect(stalled.failed[0].reason).toBe('request-timeout');
    let active = 0, maximum = 0;
    f.chunks[1].offset++;
    const parallel = await fetchChunks({ ...f, ...await options(), concurrency: 1, fetchFn: async (_url: string, init: RequestInit) => {
      maximum = Math.max(maximum, ++active);
      await new Promise(resolve => setTimeout(resolve, 5)); active--;
      const range = /bytes=(\d+)-(\d+)/.exec((init.headers as Record<string, string>).Range)!;
      const start = Number(range[1]), end = Number(range[2]) + 1;
      return response(f.packed[start === 0 ? 0 : 1], start, end);
    } });
    expect(parallel.status).toBe('complete'); expect(maximum).toBe(1);
  });
  it('pins plan and manifest bytes before parsing or fetching', async () => {
    const opts = await options(), fetchFn = vi.fn();
    const manifestPath = join(opts.out, 'synthetic.manifest'), planPath = join(opts.out, 'plan.json');
    await writeOutputFileAtomic(manifestPath, 'not a manifest');
    await writeOutputFileAtomic(planPath, JSON.stringify({ sourceManifest: { sha256: 'wrong' } }));
    await expect(fetchFromFiles({ planPath, manifestPath, fetchFn })).rejects.toThrow('plan-manifest-sha256-mismatch');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

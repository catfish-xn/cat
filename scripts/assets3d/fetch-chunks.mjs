import { readFile, unlink, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { readRman } from './rman.mjs';
import { verifyChunk } from './chunk-hash.mjs';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

export const CDN_HOST = 'lol.secure.dyn.riotcdn.net';
export const DEFAULT_MAX_BYTES = 125829120;
const hex = value => typeof value === 'string' && /^[A-F\d]{16}$/.test(value);
export function assertCdnUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== CDN_HOST || url.port || url.username || url.password
    || url.search || url.hash || !/^\/channels\/public\/bundles\/[A-F\d]{16}\.bundle$/.test(url.pathname))
    throw new Error('cdn-url-rejected');
  return url.href;
}
export function bundleUrl(bundleId) {
  if (!hex(bundleId)) throw new Error('invalid-bundle-id');
  return assertCdnUrl(`https://${CDN_HOST}/channels/public/bundles/${bundleId}.bundle`);
}
/** Use authoritative manifest offsets, never arbitrary URLs/ranges from a plan. */
export function selectChunks(plan, manifest) {
  const known = new Map(manifest.files.flatMap(f => f.chunks.map(c => [c.id, c])));
  const selected = new Map();
  for (const requested of plan.chunks) {
    const c = known.get(requested.id);
    if (!c || !hex(c.id) || !hex(c.bundleId)) throw new Error(`unknown-plan-chunk:${requested.id}`);
    if (['bundleId', 'offset', 'size', 'targetSize'].some(key => requested[key] !== c[key]))
      throw new Error(`plan-manifest-mismatch:${c.id}`);
    if (![c.offset, c.size, c.targetSize, c.offset + c.size].every(Number.isSafeInteger)
      || c.offset < 0 || c.size < 1 || c.size > 16 * 1024 * 1024 || c.targetSize < 1 || c.targetSize > 16 * 1024 * 1024)
      throw new Error('invalid-chunk-range');
    if (selected.has(c.id)) throw new Error('duplicate-plan-chunk');
    selected.set(c.id, c);
  }
  return [...selected.values()];
}
/** Only exactly adjacent selected blocks are merged: no gap bytes are fetched. */
export function mergeRanges(chunks, maxRangeBytes = 16 * 1024 * 1024) {
  const ranges = [];
  for (const c of [...chunks].sort((a, b) => a.bundleId.localeCompare(b.bundleId) || a.offset - b.offset)) {
    const last = ranges.at(-1);
    if (last?.bundleId === c.bundleId && last.end === c.offset && c.offset + c.size - last.start <= maxRangeBytes) {
      last.end += c.size; last.chunks.push(c);
    } else ranges.push({ bundleId: c.bundleId, start: c.offset, end: c.offset + c.size, chunks: [c] });
  }
  return ranges;
}
export function summarizeMissing(plan, missing) {
  const sizes = new Map(missing.map(c => [c.id, c.size]));
  const summary = ids => {
    const selected = [...new Set(ids)].filter(id => sizes.has(id));
    return { chunks: selected.length, bytes: selected.reduce((sum, id) => sum + sizes.get(id), 0) };
  };
  return {
    ...summary(missing.map(c => c.id)),
    byWad: (plan.wads ?? []).map(w => ({ name: w.name, ...summary([...(w.chunkIds ?? []), ...(w.indexChunks ?? [])]) })),
    byUnit: Object.fromEntries(Object.entries(plan.units ?? {}).map(([id, unit]) => [id,
      summary(unit.entries.flatMap(e => e.chunkIds ?? []))])),
    note: 'WAD/unit summaries deduplicate internally and may overlap; global bytes are deduplicated.'
  };
}

/** Injectable WHATWG fetch. All response bodies, including failed attempts, count.
 * Operational failures return a report (CLI exits 1); invalid input/configuration throws.
 */
export async function fetchChunks({ plan, manifest, cache = 'assets3d-local/trial/local/chunks',
  out = 'assets3d-local/out', maxBytes = DEFAULT_MAX_BYTES, concurrency = 4,
  timeoutMs = 45000, retries = 2, backoffMs = 500, dryRun = false,
  fetchFn = globalThis.fetch, wait = sleep } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(retries) || retries < 0 || retries > 5
    || !Number.isSafeInteger(backoffMs) || backoffMs < 0 || backoffMs > 10000) throw new Error('invalid-fetch-options');
  const started = Date.now(), directory = await safeOutputPath(cache, { directory: true });
  const reportPath = join(await safeOutputPath(out, { directory: true }), 'fetch-report.json');
  await safeOutputPath(reportPath, { force: true });
  const chunks = selectChunks(plan, manifest), missing = [], invalidCache = [], skipped = [];
  for (const c of chunks) {
    const path = await safeOutputPath(join(directory, `${c.id}.zst`), { force: true });
    try {
      const info = await stat(path);
      if (info.size !== c.size) throw new Error('chunk-compressed-size-mismatch');
      verifyChunk(await readFile(path), c); skipped.push(c.id);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (!error.message.startsWith('chunk-')) throw error;
        invalidCache.push({ id: c.id, reason: error.message });
        if (!dryRun) await unlink(await safeOutputPath(path, { force: true }));
      }
      missing.push(c);
    }
  }
  const summary = summarizeMissing(plan, missing);
  const report = { schemaVersion: 1, dryRun, status: 'planned', maxBytes, summary, requests: 0, downloadBytes: 0,
    skipped, invalidCache, downloaded: [], failed: [], elapsedMs: 0 };
  const finish = async () => {
    report.elapsedMs = Date.now() - started;
    if (!dryRun) await writeOutputFileAtomic(reportPath, `${JSON.stringify(report, null, 2)}\n`, { force: true });
    return report;
  };
  if (summary.bytes > maxBytes) {
    report.status = 'failed'; report.reason = 'preflight-byte-limit';
    report.failed = missing.map(c => ({ id: c.id, reason: report.reason }));
    return finish();
  }
  if (dryRun) return finish();
  const ranges = mergeRanges(missing), abort = new AbortController();
  let next = 0;
  const completed = new Set();
  const count = size => {
    report.downloadBytes += size;
    if (report.downloadBytes > maxBytes) {
      abort.abort(new Error('runtime-byte-limit'));
      throw abort.signal.reason;
    }
  };
  async function request(range) {
    const url = bundleUrl(range.bundleId), controller = new AbortController();
    let response, reader, timer;
    const cancel = () => controller.abort(abort.signal.reason);
    abort.signal.addEventListener('abort', cancel, { once: true });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { const error = new Error('request-timeout'); controller.abort(error); reject(error); }, timeoutMs);
    });
    const task = (async () => {
      report.requests++;
      response = await fetchFn(assertCdnUrl(url), { headers: { Range: `bytes=${range.start}-${range.end - 1}`, 'Accept-Encoding': 'identity' },
        redirect: 'error', signal: controller.signal });
      if (controller.signal.aborted) throw controller.signal.reason;
      // Native fetch cannot follow redirects; check injected implementations as well.
      if (response.url) assertCdnUrl(response.url);
      if (response.redirected || (response.url && response.url !== url) || response.status >= 300 && response.status < 400)
        throw new Error('cdn-redirect-rejected');
      if (!response.body && response.status !== 206) throw new Error(`http-status:${response.status}`);
      if (!response.body?.getReader) throw new Error('streaming-response-required');
      reader = response.body.getReader();
      const parts = []; let size = 0;
      while (true) {
        const item = await reader.read();
        if (controller.signal.aborted) throw controller.signal.reason;
        if (item.done) break;
        count(item.value.byteLength); size += item.value.byteLength;
        if (size > range.end - range.start) throw new Error('range-body-too-large');
        parts.push(Buffer.from(item.value));
      }
      if (response.status !== 206) throw new Error(`http-status:${response.status}`);
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
      if (!match || Number(match[1]) !== range.start || Number(match[2]) !== range.end - 1 || Number(match[3]) < range.end)
        throw new Error('content-range-mismatch');
      if (size !== range.end - range.start) throw new Error('range-size-mismatch');
      return Buffer.concat(parts);
    })();
    try { return await Promise.race([task, timeout]); }
    finally {
      clearTimeout(timer); abort.signal.removeEventListener('abort', cancel);
      controller.abort();
      if (reader) await reader.cancel().catch(() => {});
      else if (response?.body) await response.body.cancel().catch(() => {});
    }
  }
  async function worker() {
    while (!abort.signal.aborted) {
      const range = ranges[next++]; if (!range) return;
      try {
        let bytes;
        for (let attempt = 0; ; attempt++) {
          if (abort.signal.aborted) throw abort.signal.reason;
          try { bytes = await request(range); break; }
          catch (error) {
            const retryable = /^(request-timeout|fetch failed|http-status:(429|5\d\d)|range-size-mismatch)$/.test(error.message)
              || error instanceof TypeError;
            if (abort.signal.aborted || !retryable || attempt === retries) throw error;
            await wait(backoffMs * 2 ** attempt, undefined, { signal: abort.signal });
          }
        }
        for (const c of range.chunks) {
          if (abort.signal.aborted) throw abort.signal.reason;
          try {
            const packed = bytes.subarray(c.offset - range.start, c.offset - range.start + c.size);
            const hash = verifyChunk(packed, c);
            await writeOutputFileAtomic(join(directory, `${c.id}.zst`), packed, { force: true });
            report.downloaded.push({ id: c.id, bytes: c.size, hash }); completed.add(c.id);
          } catch (error) { report.failed.push({ id: c.id, reason: error.message }); completed.add(c.id); }
        }
      } catch (error) {
        for (const c of range.chunks) if (!completed.has(c.id)) {
          report.failed.push({ id: c.id, reason: abort.signal.aborted ? abort.signal.reason.message : error.message }); completed.add(c.id);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ranges.length) }, worker));
  for (const c of missing) if (!completed.has(c.id)) report.failed.push({ id: c.id, reason: abort.signal.reason?.message ?? 'not-requested' });
  report.status = report.failed.length ? 'failed' : 'complete';
  return finish();
}

export function fetchArguments(argv) {
  const options = {}, names = { '--max-bytes': 'maxBytes', '--concurrency': 'concurrency', '--timeout-ms': 'timeoutMs',
    '--retries': 'retries', '--backoff-ms': 'backoffMs', '--plan': 'planPath', '--manifest': 'manifestPath', '--cache': 'cache', '--out': 'out' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i], key = arg === '--dry-run' ? 'dryRun' : names[arg];
    if (!key || Object.hasOwn(options, key)) throw new Error(`invalid-argument:${arg}`);
    if (key === 'dryRun') options[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`invalid-argument:${arg}`);
      options[key] = ['maxBytes', 'concurrency', 'timeoutMs', 'retries', 'backoffMs'].includes(key) ? (/^\d+$/.test(value) ? Number(value) : NaN) : value;
    }
  }
  return options;
}
export async function fetchFromFiles({ planPath = 'assets3d-local/out/fetch-plan.json',
  manifestPath = 'assets3d-local/trial/local/14.24.manifest', ...options } = {}) {
  const plan = JSON.parse(await readFile(planPath, 'utf8')), bytes = await readFile(manifestPath);
  if (!plan.sourceManifest?.sha256 || createHash('sha256').update(bytes).digest('hex') !== plan.sourceManifest.sha256)
    throw new Error('plan-manifest-sha256-mismatch');
  return fetchChunks({ plan, manifest: readRman(bytes), ...options });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await fetchFromFiles(fetchArguments(process.argv.slice(2)));
    console.log(JSON.stringify({ status: report.status, dryRun: report.dryRun, maxBytes: report.maxBytes,
      summary: report.summary, requests: report.requests, downloadBytes: report.downloadBytes,
      skipped: report.skipped.length, downloaded: report.downloaded.length, failed: report.failed,
      elapsedMs: report.elapsedMs }, null, 2));
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

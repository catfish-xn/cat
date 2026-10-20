import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman, readCachedRange, chunksForRange, MAX_CACHED_CHUNK_BYTES } from './rman.mjs';
import { verifyChunk } from './chunk-hash.mjs';
import { readWadIndex, extractWadEntry } from './wad.mjs';
import { selectUnits } from './build-all.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';

const VERSION = '14.24.6442327', sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const fields = ['offset', 'compressedSize', 'size', 'type', 'subchunkCount', 'firstSubchunk'];
export function assertEntryPath(path) {
  if (typeof path !== 'string' || !path || path.split('/').some(p => !p || p === '.' || p === '..'
    || /[<>:"\\|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
    throw new Error('unsafe-entry-path');
  return path;
}
const metrics = () => ({ entries: 0, success: 0, written: 0, skipped: 0, failed: 0, bytes: 0, writtenBytes: 0, files: [] });

/** Offline only. The parsed RMAN and plan are injectable for synthetic tests.
 * CLI file entry below additionally pins the manifest SHA-256.
 * Existing records are immutable hash baselines; successful new records are merged.
 */
export async function extractFromChunks({ plan, manifest, source = 'assets3d-local/trial/local',
  out = 'assets3d-local/out', units = 'all', cost, verifyExisting = false } = {}) {
  const selected = selectUnits(plan.units, units, cost);
  const root = await safeOutputPath(source, { directory: true });
  const rawRoot = withinRoot(root, await safeOutputPath(join(root, 'extracted'), { directory: true }), 'unsafe-source-path');
  const recordPath = withinRoot(root, await safeOutputPath(join(root, 'extraction.json'), { force: true }), 'unsafe-source-path');
  const reportPath = await safeOutputPath(join(out, 'extract-report.json'), { force: true });
  if (reportPath === recordPath || reportPath.startsWith(`${rawRoot}/`) || reportPath.startsWith(`${rawRoot}\\`))
    throw new Error('report-overlaps-source');
  let records;
  try { records = JSON.parse(await readFile(await safeInputPath(root, recordPath), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  records ??= { version: VERSION, manifest: '14.24.manifest', source: 'Offline RMAN chunk cache', files: [] };
  if (records.version !== VERSION || !Array.isArray(records.files)) throw new Error('source-version-mismatch');
  const baseline = new Map();
  for (const record of records.files) {
    assertEntryPath(record.path);
    if (baseline.has(record.path) || !Number.isSafeInteger(record.bytes) || record.bytes < 0 || !/^[a-f\d]{64}$/.test(record.sha256))
      throw new Error('invalid-source-record');
    baseline.set(record.path, record);
  }
  const merged = new Map(baseline), missing = new Map(), archives = new Map(), results = new Map();
  const report = { schemaVersion: 1, version: VERSION, status: 'extracting', verifyExisting,
    policy: 'Unit entries include planned direct dependencies. Unfiltered all also extracts shared candidates; unknown paths fail explicitly. Missing chunks cover attempted ranges including WAD indexes and subchunk TOCs, not an unselected dependency closure. No download or redirect resolution.',
    units: Object.fromEntries(selected.map(id => [id, { cost: plan.units[id].cost, ...metrics() }])),
    shared: metrics(), totals: metrics(), missingChunks: [] };
  delete report.totals.files;

  async function readRange(file, start, size, role) {
    const chunks = chunksForRange(file, start, size), absent = [];
    for (const c of chunks) {
      if (!/^[A-F\d]{16}$/.test(c.id)) throw new Error('invalid-chunk-id');
      try { await stat(await safeInputPath(root, join(root, 'chunks', `${c.id}.zst`))); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        absent.push(c.id);
        if (!missing.has(c.id)) missing.set(c.id, { id: c.id, bundleId: c.bundleId, offset: c.offset,
          size: c.size, targetSize: c.targetSize, requiredBy: [] });
        const refs = missing.get(c.id).requiredBy;
        if (!refs.some(r => r.wad === file.name && r.role === role)) refs.push({ wad: file.name, role });
      }
    }
    if (absent.length) throw new Error(`missing-cached-chunks:${absent.join(',')}`);
    const byId = new Map(chunks.map(c => [c.id, c]));
    return readCachedRange(file, start, size, async id => {
      const c = byId.get(id), path = await safeInputPath(root, join(root, 'chunks', `${id}.zst`));
      // Bound packed allocations too; readCachedRange preflights all inflated blocks.
      if (c.size > MAX_CACHED_CHUNK_BYTES || (await stat(path)).size !== c.size) throw new Error('cached-chunk-size-mismatch');
      const packed = await readFile(path); verifyChunk(packed, c); return packed;
    });
  }
  async function archive(name) {
    if (!archives.has(name)) archives.set(name, (async () => {
      const file = manifest.files.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (!file) throw new Error(`missing-rman-wad:${name}`);
      const header = await readRange(file, 0, 272, 'index');
      const indexSize = 272 + header.readUInt32LE(268) * 32;
      const index = readWadIndex(await readRange(file, 0, indexSize, 'index'), file.size);
      return { file, index: new Map(index.map(e => [e.hash, e])), toc: null };
    })());
    return archives.get(name);
  }
  function authoritative(a, requested) {
    const e = a.index.get(requested.hash);
    if (!e || fields.some(key => requested[key] !== e[key])) throw new Error('plan-wad-entry-mismatch');
    return e;
  }
  async function tocFor(a, wad) {
    if (!a.toc) a.toc = (async () => {
      const candidates = (plan.wads ?? []).find(w => w.name === wad)?.entries.filter(e => e.path?.endsWith('.subchunktoc')) ?? [];
      if (candidates.length !== 1) throw new Error('wad-subchunk-toc-required');
      const entry = authoritative(a, candidates[0]);
      if (entry.type === 4) throw new Error('recursive-wad-subchunk-toc');
      const bytes = await readRange(a.file, entry.offset, entry.compressedSize, 'subchunk-toc');
      return extractWadEntry(bytes, { ...entry, offset: 0 });
    })();
    return a.toc;
  }
  async function extract(requested) {
    const result = { wad: requested.wad, hash: requested.hash, path: requested.path ?? null,
      status: 'failed', reason: null, bytes: 0, sha256: null };
    try {
      assertEntryPath(requested.path);
      const dest = withinRoot(rawRoot, await safeOutputPath(join(rawRoot, requested.path), { force: true }), 'unsafe-source-path');
      const a = await archive(requested.wad), entry = authoritative(a, requested);
      const expected = merged.get(requested.path);
      if (expected && (expected.bytes !== entry.size || requested.sha256 && expected.sha256 !== requested.sha256))
        throw new Error('source-record-mismatch');
      let existing;
      try {
        const input = await safeInputPath(rawRoot, dest);
        if ((await stat(input)).size !== entry.size) throw new Error('existing-file-hash-mismatch');
        if (entry.size > 64 * 1024 * 1024) throw new Error('wad-output-budget');
        existing = await readFile(input);
      }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const existingHash = existing && sha256(existing);
      if (expected && existing && (existing.length !== expected.bytes || existingHash !== expected.sha256))
        throw new Error('existing-file-hash-mismatch');
      if (expected && existing && !verifyExisting) {
        result.status = 'skipped'; result.bytes = existing.length; result.sha256 = existingHash; return result;
      }
      const subchunkToc = entry.type === 4 ? await tocFor(a, requested.wad) : undefined;
      const packed = await readRange(a.file, entry.offset, entry.compressedSize, requested.path);
      const bytes = extractWadEntry(packed, { ...entry, offset: 0 }, { subchunkToc }), hash = sha256(bytes);
      if ((expected && expected.sha256 !== hash) || (requested.sha256 && requested.sha256 !== hash)) throw new Error('source-hash-mismatch');
      if (existing && (existing.length !== bytes.length || existingHash !== hash)) throw new Error('existing-file-hash-mismatch');
      if (!existing) {
        await writeOutputFileAtomic(dest, bytes);
        result.status = 'written';
      } else result.status = 'skipped';
      // Preserve all fields of an existing verified record, including provenance.
      if (!expected) merged.set(requested.path, { wad: requested.wad, path: requested.path, bytes: bytes.length, sha256: hash });
      result.bytes = bytes.length; result.sha256 = hash;
    } catch (error) { result.reason = error.message; }
    return result;
  }
  async function run(entries, group) {
    for (const entry of entries) {
      const key = JSON.stringify([entry.wad, entry.hash, entry.path, ...fields.map(k => entry[k]), entry.sha256]);
      if (!results.has(key)) results.set(key, await extract(entry));
      const result = results.get(key); group.files.push(result); group.entries++;
      if (result.status === 'failed') group.failed++;
      else {
        group.success++; group[result.status]++; group.bytes += result.bytes;
        if (result.status === 'written') group.writtenBytes += result.bytes;
      }
    }
  }
  for (const id of selected) await run(plan.units[id].entries, report.units[id]);
  // Include conservative shared/unknown candidates only on the unfiltered full run.
  if (units === 'all' && cost === undefined) {
    const owned = new Set(selected.flatMap(id => plan.units[id].entries.map(e => `${e.wad}:${e.hash}`)));
    await run((plan.wads ?? []).flatMap(w => w.entries.filter(e => !owned.has(`${w.name}:${e.hash}`)).map(e => ({ ...e, wad: w.name }))), report.shared);
  }
  // Global counts/bytes deduplicate entries shared by units; per-unit totals may overlap.
  for (const result of results.values()) {
    report.totals.entries++;
    if (result.status === 'failed') report.totals.failed++;
    else {
      report.totals.success++; report.totals[result.status]++; report.totals.bytes += result.bytes;
      if (result.status === 'written') report.totals.writtenBytes += result.bytes;
    }
  }
  report.missingChunks = [...missing.values()].sort((a, b) => a.id.localeCompare(b.id));
  report.status = report.totals.failed ? 'failed' : 'complete';
  await writeOutputFileAtomic(recordPath, json({ ...records, files: [...merged.values()] }), { force: true });
  await writeOutputFileAtomic(reportPath, json(report), { force: true });
  return report;
}

export function extractArguments(argv) {
  const options = {}, names = { '--source': 'source', '--out': 'out', '--units': 'units', '--cost': 'cost', '--plan': 'planPath' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i], key = arg === '--verify-existing' ? 'verifyExisting' : names[arg];
    if (!key || Object.hasOwn(options, key)) throw new Error(`invalid-argument:${arg}`);
    if (key === 'verifyExisting') options[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`invalid-argument:${arg}`);
      options[key] = value;
    }
  }
  return options;
}
export async function extractFromFiles({ source = 'assets3d-local/trial/local', planPath = 'assets3d-local/out/fetch-plan.json', ...options } = {}) {
  const root = resolve(source), planRoot = resolve(planPath, '..');
  const plan = JSON.parse(await readFile(await safeInputPath(planRoot, resolve(planPath)), 'utf8'));
  const bytes = await readFile(await safeInputPath(root, join(root, '14.24.manifest')));
  if (!plan.sourceManifest?.sha256 || sha256(bytes) !== plan.sourceManifest.sha256) throw new Error('plan-manifest-sha256-mismatch');
  return extractFromChunks({ plan, manifest: readRman(bytes), source, ...options });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await extractFromFiles(extractArguments(process.argv.slice(2)));
    console.log(JSON.stringify({ status: report.status, totals: report.totals, missingChunks: report.missingChunks.length }));
    if (report.status !== 'complete') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

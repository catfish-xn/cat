import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readRman, chunksForRange, readCachedRange, MAX_CACHED_CHUNK_BYTES } from './rman.mjs';
import { readWadIndex, extractWadEntry } from './wad.mjs';
import { verifyChunk } from './chunk-hash.mjs';
import { parseBin, binField, binIs, fnv1a } from './bin.mjs';
import { particleSourcesFromBins } from './particle-bin.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';
import { assertEntryPath } from './extract-from-chunks.mjs';
import { argumentsFor } from './plan-fetch.mjs';

const json = v => `${JSON.stringify(v, null, 2)}\n`;
const sha = b => createHash('sha256').update(b).digest('hex');
export const GLOBAL_KEYS = ['TFT_Global_BA_Hit', 'TFT_Global_BA_Crit'];
const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');

export function findGlobalSystems(documents) {
  const all = particleSourcesFromBins(documents), targets = new Map(), byHash = new Map();
  for (const doc of documents) for (const entry of doc.entries) {
    if (binIs(entry, 'VfxSystemDefinitionData')) {
      const values = particleSourcesFromBins([{ ...doc, entries: [entry] }]);
      byHash.set(entry.hash, Object.entries(values)[0]);
    }
    if (binIs(entry, 'ResourceResolver')) for (const [key, value] of binField(entry, 'resourceMap')?.entries ?? []) {
      for (const name of GLOBAL_KEYS) if ((typeof key === 'string' ? fnv1a(key) : key?.hash) === fnv1a(name)) targets.set(name, value?.hash);
    }
  }
  const systems = {}, resolvedKeys = {};
  for (const key of GLOBAL_KEYS) {
    const hit = byHash.get(targets.get(key)) ?? Object.entries(all).find(([p, v]) => `${p} ${v.particleName}`.toLowerCase().includes(key.toLowerCase()));
    if (hit) { systems[`ResolvedGlobals/${key}`] = hit[1]; resolvedKeys[key] = { sourcePath: hit[0], resolverTargetHash: targets.get(key) ?? null }; }
  }
  return { systems, resolvedKeys };
}

/** Read-only cache adapter. Missing ranges are actionable CDN bundle slices;
 * this module has no network client and never updates the extraction cache. */
export function offlineArchiveReader({ manifest, plan, readChunk, readExtracted, write }) {
  const missing = new Map(), archives = new Map(), files = [];
  async function range(file, start, size, role) {
    const chunks = chunksForRange(file, start, size), packed = new Map();
    for (const c of chunks) {
      let b;
      try { b = await readChunk(c.id); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!b) {
        const row = missing.get(c.id) ?? { ...c, requiredBy: [] };
        if (!row.requiredBy.some(r => r.wad === file.name && r.role === role)) row.requiredBy.push({ wad: file.name, role });
        missing.set(c.id, row);
      } else {
        if (c.size > MAX_CACHED_CHUNK_BYTES || b.length !== c.size) throw new Error('cached-chunk-size-mismatch');
        verifyChunk(b, c); packed.set(c.id, b);
      }
    }
    if (packed.size !== chunks.length) throw new Error('missing-cached-chunks');
    return readCachedRange(file, start, size, async id => packed.get(id));
  }
  async function archive(name) {
    if (!archives.has(name)) archives.set(name, (async () => {
      const file = manifest.files.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (!file) throw new Error(`missing-rman-wad:${name}`);
      const header = await range(file, 0, 272, 'wad-index');
      const index = readWadIndex(await range(file, 0, 272 + header.readUInt32LE(268) * 32, 'wad-index'), file.size);
      return { file, index };
    })());
    return archives.get(name);
  }
  async function entryBytes(a, entry, path) {
    let subchunkToc;
    if (entry.type === 4) {
      const planned = plan.wads.find(w => w.name.toLowerCase() === a.file.name.toLowerCase())?.entries ?? [];
      const tocCandidates = planned.filter(e => e.path?.endsWith('.subchunktoc'));
      if (tocCandidates.length !== 1) throw new Error('wad-subchunk-toc-required');
      const t = a.index.find(e => e.hash === tocCandidates[0].hash);
      if (!t || t.type === 4) throw new Error('invalid-wad-subchunk-toc');
      subchunkToc = extractWadEntry(await range(a.file, t.offset, t.compressedSize, 'subchunk-toc'), { ...t, offset: 0 });
    }
    return extractWadEntry(await range(a.file, entry.offset, entry.compressedSize, path), { ...entry, offset: 0 }, { subchunkToc });
  }
  async function extract(request) {
    assertEntryPath(request.path);
    const existing = await readExtracted?.(request.path);
    let bytes = existing?.bytes;
    if (bytes) {
      if (bytes.length !== existing.size || sha(bytes) !== existing.sha256) throw new Error('source-hash-mismatch');
    } else {
      const a = await archive(request.wad), entry = a.index.find(e => e.hash === request.hash);
      if (!entry) throw new Error('missing-wad-entry');
      // Planned offsets are hints; the actual WAD index is authoritative.
      bytes = await entryBytes(a, entry, request.path);
    }
    await write(`extracted/${request.path}`, bytes);
    files.push({ path: request.path, wad: request.wad, bytes: bytes.length, sha256: sha(bytes), source: existing ? 'extracted-cache' : 'chunk-cache' });
    return bytes;
  }
  return { archive, extract, missing, files };
}

/** Offline discovery: existing extracted PROP files, then shared/map WAD
 * candidate BINs. Texture requests are derived from systems that actually match. */
export async function globalVfx({ source = 'assets3d-local/trial/local', out = 'assets3d-local/global-vfx', force = false } = {}) {
  const output = await safeOutputPath(out, { directory: true });
  withinRoot(await safeOutputPath('assets3d-local/global-vfx', { directory: true }), output, 'global-vfx-output-only');
  const root = resolve(source), read = async p => readFile(await safeInputPath(root, join(root, p)));
  const records = JSON.parse(await read('extraction.json'));
  if (records.version !== '14.24.6442327' || !Array.isArray(records.files)) throw new Error('source-version-mismatch');
  const rawManifest = await read('14.24.manifest'), manifest = readRman(rawManifest);
  const plan = JSON.parse(await readFile(await safeInputPath(resolve('assets3d-local/out'), resolve('assets3d-local/out/fetch-plan.json')), 'utf8'));
  if (sha(rawManifest) !== plan.sourceManifest.sha256) throw new Error('plan-manifest-sha256-mismatch');
  const byPath = new Map(records.files.map(r => [canonical(r.path), r]));
  const reader = offlineArchiveReader({ manifest, plan, readChunk: id => read(`chunks/${id}.zst`),
    readExtracted: async p => {
      const r = byPath.get(canonical(p)); if (!r) return undefined;
      try { return { bytes: await read(`extracted/${r.path}`), size: r.bytes, sha256: r.sha256 }; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }, write: (p, b) => writeOutputFileAtomic(join(output, p), b, { force }) });
  const inspected = [], failures = [], documents = [], cachedCandidates = [];
  function inspect(bytes, path) {
    const doc = parseBin(bytes), found = particleSourcesFromBins([doc]);
    inspected.push({ path, systems: Object.keys(found).length }); documents.push(doc);
    return doc;
  }
  // These are verified cached records, including extensionless PROP files.
  for (const r of records.files.filter(r => r.path.endsWith('.bin') || r.path.startsWith('characters/'))) {
    const bytes = await read(`extracted/${r.path}`);
    if (bytes.length !== r.bytes || sha(bytes) !== r.sha256) throw new Error('source-hash-mismatch');
    const parsed = parseBin(bytes), found = findGlobalSystems([parsed]);
    const relevant = parsed.entries.filter(e => binIs(e, 'ResourceResolver') || binIs(e, 'VfxSystemDefinitionData'));
    if (relevant.length) cachedCandidates.push({ record: r, document: { ...parsed, entries: relevant } });
    const hasResolver = parsed.entries.some(e => binIs(e, 'ResourceResolver') && (binField(e, 'resourceMap')?.entries ?? []).some(([key]) => GLOBAL_KEYS.some(name => (typeof key === 'string' ? fnv1a(key) : key?.hash) === fnv1a(name))));
    if (Object.keys(found.systems).length || hasResolver) {
      await reader.extract({ path: r.path, wad: r.wad }); inspect(bytes, r.path);
    }
  }
  // The two TFT plans contain no shared VFX BIN. The shipping map may contain
  // the global resolver and its linked particle BINs; derive its index offline.
  const mapWad = 'DATA/FINAL/Maps/Shipping/Map22.wad.client';
  let a;
  try { a = await reader.archive(mapWad); }
  catch (error) { failures.push({ wad: mapWad, stage: 'index', reason: error.message }); }
  if (a) {
    const wanted = new Map(a.index.map(e => [e.hash, e]));
    const named = [];
    for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
      const hash = line.slice(0, 16), path = line.slice(17);
      if (wanted.has(hash)) named.push({ ...wanted.get(hash), path, wad: mapWad });
    }
    plan.wads.push({ name: mapWad, entries: named });
    const bins = named.filter(e => /\.bin$/i.test(e.path) && /particle|shared|shipping\/map22\/map22\.bin/i.test(e.path));
    for (const e of bins) {
      try { inspect(await reader.extract(e), e.path); }
      catch (error) { failures.push({ path: e.path, stage: 'candidate-bin', reason: error.message }); }
    }
    const requests = [...documents.flatMap(d => d.linked)];
    const seen = new Set(inspected.map(i => canonical(i.path)));
    while (requests.length && seen.size < 512) {
      const path = requests.shift(), key = canonical(path); if (seen.has(key)) continue; seen.add(key);
      const e = named.find(e => canonical(e.path) === key) ?? plan.wads.flatMap(w => w.entries.map(e => ({ ...e, wad: w.name }))).find(e => e.path && canonical(e.path) === key);
      if (!e) { failures.push({ path, stage: 'linked-bin', reason: 'outside-indexed-wads' }); continue; }
      try { const d = inspect(await reader.extract(e), e.path); requests.push(...d.linked); }
      catch (error) { failures.push({ path, stage: 'linked-bin', reason: error.message }); }
    }
  }
  const { systems, resolvedKeys } = findGlobalSystems([...cachedCandidates.map(c => c.document), ...documents]);
  const selectedPaths = new Set(Object.values(resolvedKeys).map(r => r.sourcePath));
  for (const c of cachedCandidates) {
    const found = particleSourcesFromBins([c.document]);
    if (Object.keys(found).some(p => selectedPaths.has(p)) && !reader.files.some(f => f.path === c.record.path)) await reader.extract(c.record);
  }
  const references = new Set(), stack = [...Object.values(systems)];
  while (stack.length) {
    const v = stack.pop(); if (typeof v === 'string' && /\.(tex|dds)$/i.test(v)) references.add(v);
    else if (v && typeof v === 'object') stack.push(...Object.values(v));
  }
  for (const ref of references) {
    const cached = byPath.get(canonical(ref));
    const e = cached ?? plan.wads.flatMap(w => w.entries.map(e => ({ ...e, wad: w.name }))).find(e => e.path && canonical(e.path) === canonical(ref));
    if (!e) { failures.push({ path: ref, stage: 'texture', reason: 'outside-indexed-wads' }); continue; }
    try { await reader.extract(e); } catch (error) { failures.push({ path: ref, stage: 'texture', reason: error.message }); }
  }
  const missingChunks = [...reader.missing.values()].sort((a, b) => a.id.localeCompare(b.id));
  const report = { policy: 'offline-only-read-cache-write-new-root; index requests precede exact BIN/texture dependency discovery',
    requested: GLOBAL_KEYS, found: Object.keys(systems), resolvedKeys, files: reader.files, inspected, failures, missingChunks,
    downloadBytes: missingChunks.reduce((s, c) => s + c.size, 0),
    dependencyClosureKnown: failures.length === 0 && GLOBAL_KEYS.every(k => Object.keys(systems).some(p => p.toLowerCase().includes(k.toLowerCase()))) };
  await writeOutputFileAtomic(join(output, 'systems.json'), json(systems), { force });
  await writeOutputFileAtomic(join(output, 'report.json'), json(report), { force });
  return { systems, report };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { report } = await globalVfx(argumentsFor(process.argv.slice(2), ['--source', '--out']));
  console.log(JSON.stringify(report));
}

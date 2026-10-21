import { readFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman, chunksForRange, readCachedRange } from './rman.mjs';
import { readWadIndex } from './wad.mjs';
import { verifyChunk } from './chunk-hash.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { offlineArchiveReader } from './global-vfx.mjs';
import { parseBin, binIs, binField } from './bin.mjs';

/** Match the model converter's scope: skin bindings, materials and animation
 * graphs. Character-wide VFX/resource catalogues contain unrelated variants. */
export function defaultModelReferences(doc) {
  const references = new Set(doc.linked.filter(p => /\/animations\/.*\.bin$/i.test(p) || /^characters\/[^/]+$/i.test(p)));
  const stack = doc.entries.flatMap(e => [binField(e, 'skinMeshProperties'),
    binField(e, 'mClipDataMap'), binField(e, 'animationGraphData'),
    ...(binIs(e, 'StaticMaterialDef') ? [e] : [])]).filter(Boolean);
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === 'string' && /\.(tex|dds|skn|skl|anm)$/i.test(value)) references.add(value);
    else if (value && typeof value === 'object') stack.push(...Object.values(value));
  }
  return [...references];
}

const fields = ['id', 'bundleId', 'offset', 'size', 'targetSize'];
const compact = c => Object.fromEntries(fields.map(k => [k, c[k]]));
const json = v => JSON.stringify(v, null, 2) + '\n';
export function selectedEntryChunkIds(file, entries, indexChunkIds = []) {
  return [...new Set([...indexChunkIds, ...entries.flatMap(e => chunksForRange(file, e.offset, e.compressedSize).map(c => c.id))])];
}
/** Identical path copies may be present in several archives. Prefer a verified
 * local copy so a missing duplicate never becomes an unnecessary download. */
export function cachedEntryChoice(entries = [], files, cached) {
  return entries.find(e => chunksForRange(files.find(f => f.name === e.wad), e.offset, e.compressedSize)
    .every(c => cached.has(c.id))) ?? entries[0];
}
/** Explicit references only: an unavailable BIN is a frontier, never a reason
 * to silently include its entire character directory or containing archive. */
export async function traceDefaultDependencies({ seeds, resolveEntry, readReferences, limit = 512 }) {
  const queue = [...seeds], seen = new Set(), entries = [], readBins = [], unavailableBins = [], unresolvedReferences = [];
  while (queue.length && seen.size < limit) {
    const path = queue.shift().toLowerCase().replaceAll('\\', '/');
    if (seen.has(path)) continue;
    seen.add(path);
    const e = resolveEntry(path);
    if (!e) { unresolvedReferences.push(path); continue; }
    entries.push(e);
    if (!path.endsWith('.bin') && !/^characters\/[^/]+$/.test(path)) continue;
    try { queue.push(...await readReferences(e)); readBins.push(path); }
    catch (error) { unavailableBins.push({ path, reason: error.message }); }
  }
  return { entries, scan: { readBins, unavailableBins, unresolvedReferences: unresolvedReferences.sort(),
    boundedAt: limit, pendingAfterBound: [...new Set(queue)] } };
}
export const LEGEND_CANDIDATES = [
  ['pengu', '羽翼骑士企鹅', 'petpenguknight'],
  ['silverwing', '银翼', 'petgriffin'],
  ['choncc', '丘可', 'petchoncc'],
  ['hauntling', '幽魂', 'petghosty'],
  ['molediver', '钻地鼹鼠', 'petminer'],
  ['aoshin', '敖申', 'petaoshin'],
].map(([name, label, sourceName]) => ({ id: `little-legend-${name}`, label, sourceName }));
export const LEGEND_SUPPLEMENT = { id: 'little-legend-default', label: '河灵', sourceName: 'pettftavatar', outputRoot: 'river-sprite-supplement' };

export function legendBindingSeeds(candidates = [...LEGEND_CANDIDATES, LEGEND_SUPPLEMENT]) {
  return candidates.flatMap(c => ['themes/base/tier1.bin', 'themes/base/root.bin', 'animations/base.bin']
    .map(suffix => `data/characters/${c.sourceName}/${suffix}`));
}
export function defaultSkinCandidates(candidates, hasPath) {
  return candidates.map(c => {
    const prefix = `data/characters/${c.sourceName}/skins/`;
    const skin = ['skin0.bin', 'skin1.bin'].map(s => prefix + s).find(hasPath);
    return { id: c.id, skin: skin ?? null, status: 'candidate-binding-needs-verification' };
  });
}

/** Complete conservative envelope. Missing headers never truncate later WADs.
 * Duplicate occurrences retain their authoritative bundle slice, not fileOffset.
 * readChunk is read-only; absent and corrupt cache blocks are both replaceable. */
export async function missingWadChunks(files, readChunk, verify = verifyChunk) {
  const known = new Map(), cached = new Set(), invalidCache = [];
  for (const file of files) {
    let offset = 0;
    for (const c of file.chunks) {
      if (c.fileOffset !== offset || !Number.isSafeInteger(c.targetSize) || c.targetSize < 1)
        throw new Error('noncontiguous-wad-chunks');
      offset += c.targetSize;
      const previous = known.get(c.id);
      if (previous && fields.some(k => previous[k] !== c[k])) throw new Error('conflicting-chunk-metadata');
      known.set(c.id, compact(c));
    }
    if (offset !== file.size) throw new Error('incomplete-wad-chunk-coverage');
  }
  for (const c of known.values()) {
    let bytes;
    try { bytes = await readChunk(c.id); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!bytes) continue;
    try { verify(bytes, c); cached.add(c.id); }
    catch (error) { invalidCache.push({ id: c.id, reason: error.message }); }
  }
  const chunks = [...known.values()].filter(c => !cached.has(c.id)).sort((a, b) => a.id.localeCompare(b.id));
  return { chunks, cached, invalidCache, uniqueChunks: known.size,
    downloadBytes: chunks.reduce((n, c) => n + c.size, 0) };
}

/** No downloader and no converter: metadata/cache preflight writes only plans. */
export async function planLittleLegends({ source = 'assets3d-local/trial/local', out = 'assets3d-local/little-legends', force = false } = {}) {
  const output = await safeOutputPath(out, { directory: true });
  withinRoot(resolve('assets3d-local/little-legends'), output, 'little-legends-output-only');
  const root = resolve(source), read = async p => readFile(await safeInputPath(root, join(root, p)));
  const raw = await read('14.24.manifest'), digest = createHash('sha256').update(raw).digest('hex');
  const baseline = JSON.parse(await readFile('assets3d-local/out/extra-plan.json', 'utf8'));
  if (baseline.version !== '14.24.6442327' || digest !== baseline.sourceManifest.sha256) throw new Error('source-manifest-mismatch');
  const manifest = readRman(raw);
  const names = ['DATA/FINAL/Companions.wad.client', 'DATA/FINAL/CompanionsDefault.wad.client', 'DATA/FINAL/Maps/Shipping/Map22.wad.client'];
  const files = names.map(name => {
    const file = manifest.files.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (!file) throw new Error('required-wad-absent');
    return file;
  });
  const cacheNames = new Set(await readdir(await safeInputPath(root, join(root, 'chunks'))));
  const readChunk = id => cacheNames.has(`${id}.zst`) ? read(`chunks/${id}.zst`) : undefined;
  const envelope = await missingWadChunks(files, readChunk);
  const missingIds = new Set(envelope.chunks.map(c => c.id)), indexes = new Map(), frontier = new Map();
  const wads = [];
  for (const file of files) {
    let indexBytes = null, indexStatus = 'header-unavailable', index = [];
    let indexChunks = chunksForRange(file, 0, 272);
    if (indexChunks.every(c => envelope.cached.has(c.id))) {
      const header = await readCachedRange(file, 0, 272, readChunk);
      indexBytes = 272 + header.readUInt32LE(268) * 32;
      indexChunks = chunksForRange(file, 0, indexBytes);
      indexStatus = 'index-chunks-unavailable';
      if (indexChunks.every(c => envelope.cached.has(c.id))) {
        index = readWadIndex(await readCachedRange(file, 0, indexBytes, readChunk), file.size);
        indexes.set(file.name, new Map(index.map(e => [e.hash, e]))); indexStatus = 'verified-index';
      }
    }
    for (const c of indexChunks) if (missingIds.has(c.id)) frontier.set(c.id, compact(c));
    const chunkIds = [...new Set(indexChunks.map(c => c.id))];
    wads.push({ name: file.name, archiveBytes: file.size, scope: 'default-binding-dependency-frontier', chunkIds,
      missingChunks: chunkIds.filter(id => missingIds.has(id)).length, indexBytes, indexStatus,
      indexChunks: [...new Set(indexChunks.map(c => c.id))], entries: [] });
  }
  const candidates = LEGEND_CANDIDATES.map(c => ({ ...c, requestedTheme: 'base/tier1', suggestedHeight: 46,
    championHeight: 92, manifestModelKey: c.id, evidence: [], defaultBindingsVerified: false }));
  const dictionary = await safeInputPath(root, join(root, 'hashes/hashes.game.txt'));
  const mapWad = wads.at(-1), mapIndex = indexes.get(mapWad.name);
  if (!mapIndex) throw new Error('map-index-required-for-bounded-plan');
  const namedEntries = new Map();
  for await (const line of createInterface({ input: createReadStream(dictionary), crlfDelay: Infinity })) {
    if (line[16] !== ' ') continue;
    const hash = line.slice(0, 16).toLowerCase(), path = line.slice(17).toLowerCase();
    const matches = [...indexes].filter(([, index]) => index.has(hash))
      .map(([wad, index]) => ({ ...index.get(hash), path, wad }));
    if (matches.length) namedEntries.set(path, matches);
    const candidate = candidates.find(c => path.startsWith(`data/characters/${c.sourceName}/`) &&
      /\/(themes\/base\/(tier1|root)|animations\/base)\.bin$/.test(path));
    if (!candidate) continue;
    const verifiedWads = [...indexes].filter(([, index]) => index.has(hash)).map(([name]) => name);
    candidate.evidence.push({ hash, path, verifiedWads, status: verifiedWads.length ? 'in-verified-wad-index' : 'dictionary-only' });
  }
  // Read only already verified BIN ranges, in memory. Never write extracted bytes.
  // Missing binding BINs are recorded, not bypassed by guessed model filenames.
  const readerPlan = { wads: wads.map(w => ({ name: w.name, entries: [] })) };
  for (const matches of namedEntries.values()) for (const e of matches)
    if (e.path.endsWith('.subchunktoc')) readerPlan.wads.find(w => w.name === e.wad).entries.push(e);
  const reader = offlineArchiveReader({ manifest, plan: readerPlan, readChunk, write: async () => {} });
  const selected = new Map(wads.map(w => [w.name, new Map()]));
  const seeds = legendBindingSeeds();
  // Theme BINs can describe only geometry. Concrete default skins carry the
  // diffuse/material overrides; prefer skin0 where present, otherwise skin1.
  const defaultSkins = defaultSkinCandidates([...candidates, LEGEND_SUPPLEMENT], p => namedEntries.has(p));
  seeds.push(...defaultSkins.map(c => c.skin).filter(Boolean));
  const traced = await traceDefaultDependencies({ seeds,
    resolveEntry: path => cachedEntryChoice(namedEntries.get(path), files, envelope.cached),
    readReferences: async e => {
      if (e.type === 4) for (const t of readerPlan.wads.find(w => w.name === e.wad).entries)
        selected.get(e.wad).set(t.hash, t);
      const bytes = await reader.extract(e);
      return defaultModelReferences(parseBin(bytes));
    } });
  const dependencyScan = traced.scan;
  for (const e of traced.entries) selected.get(e.wad).set(e.hash, e);
  for (const w of wads) {
    w.entries = [...selected.get(w.name).values()];
    if (w.entries.some(e => e.type === 4)) {
      for (const t of readerPlan.wads.find(r => r.name === w.name).entries) selected.get(w.name).set(t.hash, t);
      w.entries = [...selected.get(w.name).values()];
    }
    w.chunkIds = selectedEntryChunkIds(files.find(f => f.name === w.name), w.entries, w.indexChunks);
    w.missingChunks = w.chunkIds.filter(id => missingIds.has(id)).length;
  }
  const closureKnown = indexes.size === files.length && dependencyScan.unavailableBins.length === 0 &&
    dependencyScan.unresolvedReferences.length === 0 && dependencyScan.pendingAfterBound.length === 0;
  const requiredIds = new Set(wads.flatMap(w => w.chunkIds));
  const missingChunks = envelope.chunks.filter(c => requiredIds.has(c.id));
  const common = { schemaVersion: 1, version: baseline.version, sourceManifest: { path: '14.24.manifest', sha256: digest },
    candidates, supplements: [LEGEND_SUPPLEMENT], defaultSkins, dependencyClosureKnown: closureKnown, converted: false,
    requiredActions: ['idle', 'move', 'hit', 'celebrate'], optionalActions: ['attack', 'cast'],
    requestedSourceActions: ['run', 'grab'], dependencyScan };
  const plan = { ...common, scope: closureKnown ? 'six-default-explicit-dependency-closure' : 'six-default-dependency-frontier',
    policy: 'Offline only. Missing chunks for WAD indexes and six default binding seeds plus explicit references from readable BINs. No whole-WAD or directory supersets.',
    limitations: closureKnown ? [] : ['Exact missing-block list for the currently known frontier, NOT the final six-model dependency set. Complete listed chunks and rerun offline to discover remaining dependencies.'],
    wads, chunks: missingChunks, invalidCache: envelope.invalidCache.filter(c => requiredIds.has(c.id)),
    totals: { uniqueChunks: requiredIds.size, verifiedCachedChunks: [...requiredIds].filter(id => envelope.cached.has(id)).length,
      missingCachedChunks: missingChunks.length, downloadBytes: missingChunks.reduce((n, c) => n + c.size, 0) },
    verification: { contiguousCompanionWadCoverage: true, selectedEntryRangesCovered: true, deduplicated: true, cachedChunksContentVerified: true,
      allChunkMetadataFromManifest: true, fullDefaultDependencyClosureVerified: closureKnown } };
  const indexChunks = [...frontier.values()].sort((a, b) => a.id.localeCompare(b.id));
  const indexPlan = { ...common, scope: 'index-frontier-only',
    policy: 'Small staged alternative, NOT the complete dependency plan. Unknown index lengths require another offline pass after manual header completion.',
    wads: wads.map(w => ({ name: w.name, indexStatus: w.indexStatus, indexBytes: w.indexBytes, indexChunks: w.indexChunks })),
    chunks: indexChunks, totals: { chunks: indexChunks.length, downloadBytes: indexChunks.reduce((n, c) => n + c.size, 0) } };
  await writeOutputFileAtomic(join(output, 'legends-plan.json'), json(plan), { force });
  await writeOutputFileAtomic(join(output, 'legends-index-plan.json'), json(indexPlan), { force });
  return { ready: false, scope: plan.scope, ...plan.totals, indexFrontier: indexPlan.totals,
    candidates: candidates.map(c => ({ id: c.id, verifiedBaseEvidence: c.evidence.filter(e => e.verifiedWads.length).length })) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await planLittleLegends(argumentsFor(process.argv.slice(2), ['--source', '--out']))));
}

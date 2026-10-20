import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman, chunksForRange } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { binIs, binField } from './bin.mjs';

export const CAROUSEL_NAME = /carousel|shared[ _/-]*draft/i;
export function currentCarouselResource(path) {
  const seasons = [...path.toLowerCase().matchAll(/(?:set|tft)[_-]?(\d+(?:_\d+)?)/g)].map(m => m[1]);
  return seasons.every(s => s === '13');
}
export function carouselSceneCandidate(path) {
  return CAROUSEL_NAME.test(path) && currentCarouselResource(path)
    && /\.(mapgeo|bin|scb|sco|tex|dds)$/i.test(path)
    && /^(assets\/shared\/particles\/|assets\/maps\/kitpieces\/tft\/set13_carousel\/|assets\/maps\/particles\/tft\/(set13_carousel\/|tft_(carousel|shareddraft))|data\/maps\/mapgeometry\/map22\/carousel_)/i.test(path);
}
export function stringsIn(value) {
  const result = [], stack = [value];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') result.push(v);
    else if (v && typeof v === 'object') stack.push(...Object.values(v));
  }
  return result;
}
/** MAPG strings are length-prefixed UTF-8; discover baked texture dependencies
 * without interpreting vertex data as paths. Geometry conversion is separate. */
export function mapGeometryReferences(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'OEGM') throw new Error('unsupported-mapgeo-magic');
  const refs = new Set();
  for (const match of bytes.toString('latin1').matchAll(/(?:assets|data)\/[\x20-\x7e]+?\.(?:tex|dds|bin)/gi)) {
    const offset = match.index, path = match[0];
    if (offset >= 4 && bytes.readUInt32LE(offset - 4) === path.length) refs.add(path);
  }
  return [...refs];
}
export function missingPlanChunks(entries, files, available) {
  const missing = new Map();
  for (const e of entries) {
    const file = files.find(f => f.name === e.wad);
    if (!file) throw new Error('missing-carousel-wad');
    for (const c of chunksForRange(file, e.offset, e.compressedSize)) if (!available.has(c.id)) {
      const { id, bundleId, offset, size, targetSize } = c;
      missing.set(id, { id, bundleId, offset, size, targetSize });
    }
  }
  return [...missing.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Read-only source cache; all artifacts remain under the real carousel directory.
 * No downloads, source cache writes, Git operations, or placeholder geometry. */
export async function planCarousel({ source = 'assets3d-local/trial/local', planName = 'carousel-plan.json' } = {}) {
  if (!/^carousel-plan(?:-\d+)?\.json$/.test(planName)) throw new Error('invalid-carousel-plan-name');
  const root = resolve(source), out = await safeOutputPath('assets3d-local/carousel', { directory: true });
  const input = p => safeInputPath(root, join(root, p)).then(readFile);
  const write = (p, value) => writeOutputFileAtomic(join(out, p), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString(16) : v, 2) + '\n', { force: true });
  const raw = await input('14.24.manifest'), digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14') throw new Error('carousel-manifest-mismatch');
  const manifest = readRman(raw), plan = { schemaVersion: 1, version: '14.24.6442327', sourceManifest: { path: '14.24.manifest', sha256: digest }, wads: [] };
  console.log('carousel: manifest parsed');
  const reader = offlineArchiveReader({ manifest, plan, readChunk: async id => {
    return input(`chunks/${id}.zst`);
  }, write: async () => {} });
  const archives = [], failures = [];
  const wadNames = manifest.files.filter(f => /(?:\/Map22|\/TFTCommon)\.wad\.client$/i.test(f.name)).map(f => f.name);
  if (wadNames.length !== 2) throw new Error('expected-map22-and-tftcommon');
  for (const name of wadNames) {
    try { archives.push({ name, ...await reader.archive(name) }); }
    catch (e) { failures.push({ wad: name, reason: e.message }); }
  }
  console.log('carousel: indexes read', archives.map(a => [a.name, a.index.length]));
  const byHash = new Map();
  for (const a of archives) for (const e of a.index) {
    const rows = byHash.get(e.hash) ?? []; rows.push({ ...e, wad: a.name }); byHash.set(e.hash, rows);
  }
  const named = [];
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
    for (const e of byHash.get(line.slice(0, 16)) ?? []) named.push({ ...e, path: line.slice(17).toLowerCase() });
  }
  for (const a of archives) plan.wads.push({ name: a.name, entries: named.filter(e => e.wad === a.name) });
  console.log('carousel: named entries', named.length);
  const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');
  const byPath = new Map();
  for (const e of named) { const k = canonical(e.path), rows = byPath.get(k) ?? []; rows.push(e); byPath.set(k, rows); }
  const candidates = new Map(), documents = [], queue = [], seen = new Set();
  function request(e) { const key = `${e.wad}:${e.hash}`; if (!candidates.has(key)) { candidates.set(key, e); if (/\.(bin|mapgeo)$/.test(e.path)) queue.push(e); } }
  const historical = named.filter(e => CAROUSEL_NAME.test(e.path) && !currentCarouselResource(e.path));
  for (const e of named) if (carouselSceneCandidate(e.path) || e.path === 'data/maps/shipping/map22/map22.bin') request(e);
  while (queue.length) {
    const e = queue.shift(), key = `${e.wad}:${e.hash}`; if (seen.has(key)) continue; seen.add(key);
    console.log('carousel: dependencies', e.path);
    try {
      const bytes = await reader.extract(e), geometry = e.path.endsWith('.mapgeo');
      const doc = geometry ? { entries: [], linked: mapGeometryReferences(bytes) } : parseGlobalVfxBin(bytes);
      const relevant = e.path.endsWith('/map22.bin') ? doc.entries.filter(v => binIs(v, 'VfxSystemDefinitionData')
        ? [binField(v, 'particleName'), binField(v, 'particlePath')].some(s => typeof s === 'string' && CAROUSEL_NAME.test(s) && currentCarouselResource(s))
        : !binIs(v, 'ResourceResolver') && stringsIn(v).some(carouselSceneCandidate)) : doc.entries;
      documents.push({ path: e.path, linked: doc.linked, entries: relevant });
      const links = e.path.endsWith('/map22.bin') ? doc.linked.filter(s => CAROUSEL_NAME.test(s)) : doc.linked;
      const refs = [...links, ...stringsIn(relevant).filter(s => /\.(bin|scb|sco|skn|skl|tex|dds|anm)$/i.test(s))];
      for (const ref of new Set(refs)) {
        // Only scene seeds are season-filtered. A current S13 system can reuse
        // textures bearing an older season suffix; those remain dependencies.
        const hits = byPath.get(canonical(ref)) ?? [];
        if (!hits.length) failures.push({ path: ref, from: e.path, reason: 'outside-named-wad-index' });
        for (const hit of hits) request(hit);
      }
    } catch (error) { failures.push({ path: e.path, reason: error.message }); }
  }
  // Attempt every candidate independently; a missing mesh never hides later textures.
  const inventory = [];
  console.log('carousel: candidates', candidates.size);
  for (const e of candidates.values()) {
    let cached = true, reason;
    try { await reader.extract(e); } catch (error) { cached = false; reason = error.message; }
    inventory.push({ ...e, cached, ...(reason ? { reason } : {}), chunkIds: chunksForRange(manifest.files.find(f => f.name === e.wad), e.offset, e.compressedSize).map(c => c.id) });
  }
  // Reader records missing index and subchunk TOC ranges as well as entry ranges.
  const present = new Set();
  for (const e of candidates.values()) for (const c of chunksForRange(manifest.files.find(f => f.name === e.wad), e.offset, e.compressedSize)) {
    if (present.has(c.id)) continue;
    try {
      const info = await stat(await safeInputPath(root, join(root, `chunks/${c.id}.zst`)));
      if (info.size !== c.size) throw new Error('cached-chunk-size-mismatch');
      present.add(c.id);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const missingRows = new Map(missingPlanChunks([...candidates.values()], manifest.files, present).map(c => [c.id, c]));
  for (const { id, bundleId, offset, size, targetSize } of reader.missing.values()) missingRows.set(id, { id, bundleId, offset, size, targetSize });
  const chunks = [...missingRows.values()].sort((a, b) => a.id.localeCompare(b.id));
  const selectedWads = plan.wads.map(w => ({ name: w.name, entries: w.entries.filter(e => candidates.has(`${e.wad}:${e.hash}`) || e.path.endsWith('.subchunktoc')) }));
  const report = { ...plan, wads: selectedWads, policy: 'Offline only. Named carousel candidates and references from cached BINs; unavailable BINs are a discovery frontier, not a proven complete dependency closure.',
    chunks, totals: { chunks: chunks.length, downloadBytes: chunks.reduce((n, c) => n + c.size, 0) }, limitations: failures };
  await write(planName, report);
  await write('inventory.json', { version: plan.version, entries: inventory, excludedHistoricalEntries: historical, failures, missingChunks: chunks.length });
  await write('scene-objects.json', documents);
  return { entries: inventory.length, cached: inventory.filter(e => e.cached).length, documents: documents.length, ...report.totals, failures };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await planCarousel()));

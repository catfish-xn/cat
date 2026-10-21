import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman, chunksForRange } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { stringsIn, mapGeometryReferences } from './carousel.mjs';
import { binField, binIs } from './bin.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

// Names are editorial picks, not a measured popularity ranking. Availability is
// established by the pinned client's WAD index, never the newer hash dictionary.
export const BOARD_PICKS = [
  { key: 'board-default', name: '通用默认棋盘', stems: ['base'], selection: 'pinned-client-base-arena' },
  { key: 'board-dragon-bathhouse', name: '神龙温泉', stems: ['dragonbathhouse'] },
  { key: 'board-club-two', name: '二号俱乐部', stems: ['lunarrevel_club2'] },
  { key: 'board-kda', name: 'K/DA 演出舞台', stems: ['set10_kda'] },
  { key: 'board-spirit-blossom', name: '灵魂莲华·神明', stems: ['spiritblossom_kami'] },
];
export function boardRoot(key) {
  if (!/^board-[a-z]+(?:-[a-z]+)*$/.test(key)) throw new Error('invalid-board-key');
  return key === 'board-default' ? 'default' : `extra/${key}`;
}
export function compactChunks(chunks) {
  return [...new Map(chunks.map(({ id, bundleId, offset, size, targetSize }) =>
    [id, { id, bundleId, offset, size, targetSize }])).values()].sort((a, b) => a.id.localeCompare(b.id));
}
// PROP documents can contain uint64 values. Keep their exact decimal spelling
// in the local discovery record rather than losing precision through Number.
export const boardPlanJson = value => JSON.stringify(value, (_, v) =>
  typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
const canonical = p => p.toLowerCase().replace(/\.tft_[^.]+(?=\.[^.]+$)/, '');
export function stemMatches(path, stems) {
  const tokens = path.toLowerCase().split(/[/.]/);
  return stems.some(s => tokens.includes(s));
}

/** Placed props refer to a character and a skin ID, not an asset filename. */
export function placedPropReferences(entries) {
  const refs = new Set(), stack = [...entries];
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== 'object') continue;
    if (binIs(v, 'MapAnimatedProp')) {
      const name = binField(v, 'PropName'), skin = binField(v, 'SkinID') ?? 0;
      if (typeof name !== 'string' || !/^[a-z0-9_]+$/i.test(name) || !Number.isSafeInteger(skin) || skin < 0)
        throw new Error('invalid-placed-prop');
      refs.add(`data/characters/${name.toLowerCase()}/skins/skin${skin}.bin`);
    }
    stack.push(...Object.values(v));
  }
  return [...refs].sort();
}

/** Some shipped PROP files combine several skin documents in one WAD entry. */
export function resolveBoardReference(ref, byPath, named) {
  const key = canonical(ref), exact = byPath.get(key);
  if (exact?.length) return exact;
  const m = /^data\/characters\/([a-z0-9_]+)\/(skins|animations)\/(skin\d+|root)\.bin$/.exec(key);
  if (!m) return [];
  const token = `${m[2]}_${m[3]}`;
  return named.filter(e => (e.path.startsWith(`data/${m[1]}_`) || e.path.startsWith(`data/characters/${m[1]}/`))
    && e.path.endsWith('.bin') && new RegExp(`(?:^|_)${token}(?:_|\\.bin$)`).test(e.path));
}

/** Seed by BIN identity, then traverse typed links. A texture's generic
 * Materials/Default directory must never select every arena on the map. */
export function sceneEntryClosure(entries, entryNames, stems, prefixes = stems.flatMap(s =>
  [`maps/mapgeometry/map22/${s}`, `maps/shipping/map22/mapskins/${s}`])) {
  const byHash = new Map(entries.map(e => [e.hash, e]));
  const selected = new Map(), queue = entries.filter(e => {
    const name = entryNames.get(e.hash)?.toLowerCase() ?? '';
    return prefixes.some(prefix => name === prefix || name.startsWith(`${prefix}/`));
  });
  while (queue.length) {
    const e = queue.shift(); if (selected.has(e.hash)) continue;
    selected.set(e.hash, e);
    const stack = [e];
    while (stack.length) {
      const v = stack.pop();
      if (!v || typeof v !== 'object') continue;
      if (v.kind === 'link' && byHash.has(v.hash) && !selected.has(v.hash)) queue.push(byHash.get(v.hash));
      else stack.push(...Object.values(v));
    }
  }
  return [...selected.values()];
}

/** Offline discovery only. Missing documents are explicit dependency frontiers;
 * rerun after replenishing chunks. No manifest or placeholder output is emitted. */
export async function planBoards({ source = 'assets3d-local/trial/local' } = {}) {
  const root = resolve(source), out = await safeOutputPath('assets3d-local/boards', { directory: true });
  const input = async p => readFile(await safeInputPath(root, join(root, p)));
  const write = (p, v) => writeOutputFileAtomic(join(out, p), boardPlanJson(v), { force: true });
  const raw = await input('14.24.manifest'), sha256 = createHash('sha256').update(raw).digest('hex');
  if (sha256 !== 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14') throw new Error('boards-manifest-mismatch');
  const manifest = readRman(raw), plan = { schemaVersion: 1, version: '14.24.6442327', sourceManifest: { path: '14.24.manifest', sha256 }, wads: [] };
  const entryNames = new Map();
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.binentries.txt'))), crlfDelay: Infinity }))
    entryNames.set(parseInt(line.slice(0, 8), 16), line.slice(9));
  const reader = offlineArchiveReader({ manifest, plan, readChunk: id => input(`chunks/${id}.zst`), write: async () => {} });
  const archives = [], failures = [];
  const files = manifest.files.filter(f => /(?:\/Map22|\/TFTCommon)\.wad\.client$/i.test(f.name));
  if (files.length !== 2) throw new Error('expected-map-and-common-archives');
  for (const f of files) {
    try { archives.push({ name: f.name, ...await reader.archive(f.name) }); }
    catch (error) { failures.push({ wad: f.name, stage: 'index', reason: error.message }); }
  }
  if (failures.length) {
    const chunks = compactChunks([...reader.missing.values()]);
    await write('boards-index-plan.json', { ...plan, wads: files.map(f => ({ name: f.name, entries: [] })), chunks, failures });
    return { ready: false, stage: 'index', chunks: chunks.length };
  }
  const hashes = new Map();
  for (const a of archives) for (const e of a.index) {
    const rows = hashes.get(e.hash) ?? []; rows.push({ ...e, wad: a.name }); hashes.set(e.hash, rows);
  }
  const named = [];
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
    for (const e of hashes.get(line.slice(0, 16)) ?? []) named.push({ ...e, path: line.slice(17).toLowerCase() });
  }
  for (const a of archives) plan.wads.push({ name: a.name, entries: named.filter(e => e.wad === a.name) });
  const byPath = new Map();
  for (const e of named) { const k = canonical(e.path), rows = byPath.get(k) ?? []; rows.push(e); byPath.set(k, rows); }
  const picks = BOARD_PICKS.map(p => ({ ...p, root: boardRoot(p.key),
    confirmedGeometry: named.filter(e => e.path.endsWith('.mapgeo') && stemMatches(e.path, p.stems)).map(e => e.path) }));
  if (picks.some(p => !p.confirmedGeometry.length)) throw new Error('selected-board-absent-in-client');
  const stems = picks.flatMap(p => p.stems), candidates = new Map(), queue = [], documents = [], frontier = [];
  const request = e => {
    const key = `${e.wad}:${e.hash}`;
    if (candidates.has(key)) return;
    candidates.set(key, e);
    if (/\.(bin|mapgeo)$/.test(e.path)) queue.push(e);
  };
  const shipping = 'data/maps/shipping/map22/map22.bin';
  for (const e of named) if (e.path === shipping || (stemMatches(e.path, stems) && /^(assets\/maps\/|data\/maps\/)/.test(e.path))) request(e);
  while (queue.length) {
    const e = queue.shift();
    console.log('boards: dependencies', e.path);
    try {
      const bytes = await reader.extract(e), geo = e.path.endsWith('.mapgeo');
      const doc = geo ? { entries: [], linked: mapGeometryReferences(bytes) } : parseGlobalVfxBin(bytes);
      // The shipping map is shared with all arenas. Keep only selected scene
      // records; ResourceResolver is not itself an arena dependency list.
      const entries = e.path === shipping ? sceneEntryClosure(doc.entries, entryNames, stems) : doc.entries;
      const links = e.path === shipping ? doc.linked.filter(p => stemMatches(p, stems)) : doc.linked;
      documents.push({ path: e.path, entries, linked: links });
      for (const ref of new Set([...links, ...placedPropReferences(entries), ...stringsIn(entries).filter(p => /\.(bin|scb|sco|skn|skl|tex|dds|anm|dat)$/i.test(p))])) {
        const hits = resolveBoardReference(ref, byPath, named);
        if (!hits.length) failures.push({ path: ref, from: e.path, reason: 'outside-named-wad-index' });
        for (const hit of hits) request(hit);
      }
    } catch (error) { frontier.push({ path: e.path, reason: error.message }); }
  }
  // Check every selected range independently even when another dependency is
  // missing. Include type-4 TOCs up front, without requiring entry extraction.
  for (const w of plan.wads) if ([...candidates.values()].some(e => e.wad === w.name && e.type === 4))
    for (const e of w.entries.filter(e => e.path.endsWith('.subchunktoc'))) request(e);
  const allChunks = compactChunks([...candidates.values()].flatMap(e => chunksForRange(files.find(f => f.name === e.wad), e.offset, e.compressedSize)));
  const missing = [];
  for (const c of allChunks) {
    try {
      const info = await stat(await safeInputPath(root, join(root, `chunks/${c.id}.zst`)));
      if (info.size !== c.size) throw new Error('cached-chunk-size-mismatch');
    } catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(c); }
  }
  const chunks = compactChunks([...missing, ...reader.missing.values()]);
  const wads = plan.wads.map(w => ({ name: w.name, entries: w.entries.filter(e => candidates.has(`${w.name}:${e.hash}`)) }));
  const report = { ...plan, wads, picks, chunks, dependencyClosureComplete: frontier.length === 0 && failures.length === 0,
    frontier, failures, totals: { entries: candidates.size, chunks: chunks.length, downloadBytes: chunks.reduce((n, c) => n + c.size, 0) } };
  await write('boards-plan.json', report);
  await write('scene-objects.json', documents);
  await write('inventory.json', { picks, entries: [...candidates.values()], frontier, failures });
  return { ready: chunks.length === 0 && report.dependencyClosureComplete, ...report.totals, frontier: frontier.length, failures: failures.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await planBoards()));

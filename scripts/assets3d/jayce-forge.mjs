// Offline Hextech Forge (TFT13_JayceSummon) model. Copyrighted payloads/reports stay in assets3d-local.
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRman, chunksForRange } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { canonicalAsset } from './bin-bindings.mjs';
import { resourceReferences, downloadChunks } from './conqueror-shimmer.mjs';
import { extrasExtractPath } from './tft-extras.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { buildNonChampionModel } from './neutrals.mjs';
import { contracts } from './runtime.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { extractUnitScaleBin, applyUnitScales } from './unit-scale.mjs';

const ROOT = 'assets3d-local/jayce-forge';
const VERSION = '14.24.6442327';
const SHA = 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14';
const WADS = ['DATA/FINAL/TFTSet13.wad.client', 'DATA/FINAL/TFTCommon.wad.client'];
const SOURCE_NAME = 'tft13_jaycesummon';
export const JAYCE_FORGE_ID = 'g23-forge';
/** The forge never moves or attacks; its graph has idle1/spawn/cast/death only. */
export const JAYCE_FORGE_RULES = {
  idle: { aliases: ['Idle', 'Idle1'], tokens: ['idle1', 'idle'] },
  cast: { aliases: ['Spell', 'Spell1', 'Cast'], tokens: ['cast', 'spell'] },
  death: { aliases: ['Death', 'Death1'], tokens: ['death'] },
  spawn: { aliases: ['Spawn'], tokens: ['spawn'] },
};

/** Plan, then build once every source chunk is cached. Never downloads; `plan.json` feeds fetch-chunks. */
export async function buildJayceForge({ source = 'assets3d-local/trial/local' } = {}) {
  const output = await safeOutputPath(ROOT, { directory: true });
  const src = resolve(source);
  const input = p => safeInputPath(src, join(src, p)).then(readFile);
  const write = (p, v) => writeOutputFileAtomic(join(output, p), typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2) + '\n', { force: true });
  const raw = await input('14.24.manifest');
  if (createHash('sha256').update(raw).digest('hex') !== SHA) throw Error('source-version-mismatch');
  const plan = { version: VERSION, sourceManifest: { path: '14.24.manifest', sha256: SHA }, wads: [] };
  const reader = offlineArchiveReader({ manifest: readRman(raw), plan, readChunk: id => input(`chunks/${id}.zst`), write: (p, b) => write(extrasExtractPath(p), b) });
  const archives = [], failures = [];
  for (const name of WADS) {
    try { archives.push({ name, ...await reader.archive(name) }); }
    catch (e) { failures.push({ stage: 'index', path: name, reason: e.message }); }
  }
  if (archives.length !== WADS.length) {
    const chunks = downloadChunks(reader.missing);
    await write('plan.json', { ...plan, wads: WADS.map(name => ({ name, entries: [] })), chunks });
    await write('report.json', { ready: false, phase: 'index', failures, missingChunks: chunks });
    return { ready: false, phase: 'index', chunks };
  }
  const byHash = new Map();
  for (const a of archives) {
    plan.wads.push({ name: a.name, entries: [] });
    for (const e of a.index) { const rows = byHash.get(e.hash) ?? []; rows.push(a); byHash.set(e.hash, rows); }
  }
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(src, join(src, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
    for (const a of byHash.get(line.slice(0, 16)) ?? []) plan.wads.find(w => w.name === a.name).entries.push({ hash: line.slice(0, 16), path: line.slice(17).toLowerCase(), wad: a.name });
  }
  const entries = plan.wads.flatMap(w => w.entries), paths = new Map();
  for (const e of [...entries].reverse()) paths.set(canonicalAsset(e.path), e);
  const requested = new Map(), loaded = new Map(), attempted = new Set();
  const request = p => {
    const key = canonicalAsset(p), e = paths.get(key);
    if (e) requested.set(key, e);
    else if (!failures.some(f => f.path === p)) failures.push({ stage: 'reference', path: p, reason: 'outside-admitted-index' });
  };
  const prefix = `data/characters/${SOURCE_NAME}`;
  for (const p of [`${prefix}/skins/skin0.bin`, `${prefix}/skins/root.bin`, `${prefix}/animations/skin0.bin`, `characters/${SOURCE_NAME}`]) request(p);
  while ([...requested.keys()].some(k => !attempted.has(k))) {
    for (const [key, e] of [...requested]) {
      if (attempted.has(key)) continue;
      attempted.add(key);
      try {
        const bytes = await reader.extract(e); loaded.set(key, bytes);
        if (!/\.bin$/i.test(e.path) && !e.path.startsWith('characters/')) continue;
        const doc = parseGlobalVfxBin(bytes);
        // Model, skeleton, clips and textures only; particle systems are not converted here.
        for (const ref of [...doc.linked, ...resourceReferences(doc.entries)]) {
          if (/\/particles\//i.test(ref)) continue;
          if (/\.(bin|skn|skl|anm|tex|dds)$/i.test(ref) && ref.toLowerCase().includes(SOURCE_NAME)) request(ref);
        }
      } catch (e2) { if (e2.message !== 'missing-cached-chunks') failures.push({ stage: 'source', path: e.path, reason: e2.message }); }
    }
  }
  for (const e of requested.values()) {
    const a = archives.find(a => a.name === e.wad), row = a.index.find(r => r.hash === e.hash);
    const toc = plan.wads.find(w => w.name === e.wad).entries.filter(r => r.path.endsWith('.subchunktoc'));
    for (const r of [row, ...(row.type === 4 ? toc.map(t => a.index.find(r => r.hash === t.hash)) : [])]) {
      for (const c of chunksForRange(a.file, r.offset, r.compressedSize)) {
        try { await input(`chunks/${c.id}.zst`); }
        catch (err) { if (err.code !== 'ENOENT') throw err; reader.missing.set(c.id, c); }
      }
    }
  }
  const chunks = downloadChunks(reader.missing);
  const wads = plan.wads.map(w => ({ name: w.name, entries: w.entries.filter(e => requested.get(canonicalAsset(e.path)) === e || e.path.endsWith('.subchunktoc')) }));
  await write('plan.json', { ...plan, wads, chunks });
  const report = { ready: false, phase: chunks.length ? 'missing-source-chunks' : 'source-inspected', version: VERSION, sourceManifestSha256: SHA,
    failures, requestedFiles: [...requested.values()].map(e => e.path).sort(), missingChunks: chunks, downloadBytes: chunks.reduce((s, c) => s + c.size, 0) };
  await write('report.json', report);
  if (chunks.length || failures.length) return report;

  const load = async p => {
    const key = canonicalAsset(p);
    if (!loaded.has(key)) throw Error('unpreflighted-resource:' + p);
    return loaded.get(key);
  };
  const { assertManifest } = await contracts();
  const m = await buildNonChampionModel({ ids: [JAYCE_FORGE_ID], sourceName: SOURCE_NAME }, { load, assertManifest, rules: JAYCE_FORGE_RULES,
    requiredActions: ['idle'], initial: [`${prefix}/skins/skin0.bin`, `${prefix}/skins/root.bin`, `characters/${SOURCE_NAME}`] });
  // Official size from the skin's skinScale, like the champions' roots.
  const scale = extractUnitScaleBin(await load(`${prefix}/skins/skin0.bin`), { meshPath: m.binding.mesh });
  const manifest = applyUnitScales({ schemaVersion: 1, models: m.manifest.models, effects: {} }, [{ ids: [JAYCE_FORGE_ID], ...scale }], assertManifest);
  const payload = new Map(), model = manifest.models[JAYCE_FORGE_ID];
  await write('root/' + model.path, m.result.glb);
  payload.set(model.path, { bytes: m.result.glb.length, sha256: createHash('sha256').update(m.result.glb).digest('hex') });
  await write('root/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  await write('root/precache.json', JSON.stringify(createPrecache(payload), null, 2) + '\n');
  Object.assign(report, { ready: true, phase: 'converted', model: { ...m.result.report, structure: m.structure, actionMapping: m.animation.mapped,
    decisions: m.animation.decisions, scale, clips: Object.keys(m.files), textures: m.textureReports, bytes: m.result.glb.length } });
  await write('report.json', report);
  return report;
}

/**
 * Delta over a deployed asset root (`--base`): the forge model plus that root's manifest.json / precache.json with the
 * forge added, written to `<ROOT>/delta/`. Unpacking it over a copy of the base root gives the new root; packs.json
 * stays valid (the new file is simply not in a pack and downloads on its own).
 */
export async function forgeDelta(base) {
  const output = await safeOutputPath(ROOT, { directory: true }), root = join(output, 'root'), baseRoot = resolve(base);
  const read = async (dir, p) => readFile(await safeInputPath(dir, join(dir, p)));
  const forge = JSON.parse(await read(root, 'manifest.json')), model = forge.models[JAYCE_FORGE_ID], glb = await read(root, model.path);
  const manifest = JSON.parse(await read(baseRoot, 'manifest.json')), precache = JSON.parse(await read(baseRoot, 'precache.json'));
  const { assertManifest } = await contracts();
  if (Object.hasOwn(manifest.models, JAYCE_FORGE_ID) || precache.files.some(f => f.path === model.path)) throw Error('base-root-has-forge');
  manifest.models[JAYCE_FORGE_ID] = model; assertManifest(manifest);
  precache.files.push({ path: model.path, bytes: glb.length, sha256: createHash('sha256').update(glb).digest('hex') });
  const write = (p, v) => writeOutputFileAtomic(join(output, 'delta', p), Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2) + '\n', { force: true });
  await write(model.path, glb); await write('manifest.json', manifest); await write('precache.json', precache);
  return { files: [model.path, 'manifest.json', 'precache.json'], bytes: glb.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv.indexOf('--base');
  if (base > 0) { console.log(JSON.stringify(await forgeDelta(process.argv[base + 1]))); process.exit(0); }
  const report = await buildJayceForge();
  console.log(JSON.stringify({ ready: report.ready, phase: report.phase, failures: report.failures, missingChunks: report.missingChunks.length, downloadBytes: report.downloadBytes, actions: report.model?.actionMapping, clips: report.model?.clips }));
  if (!report.ready) process.exitCode = 1;
}

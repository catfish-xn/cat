import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRman, chunksForRange } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { canonicalAsset, skinBindings, animationClips, selectAnimations } from './bin-bindings.mjs';
import { particleSourcesFromBins } from './particle-bin.mjs';
import { specialOrbClosure } from './special-orbs.mjs';
import { extrasExtractPath } from './tft-extras.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { buildNonChampionModel } from './neutrals.mjs';
import { contracts } from './runtime.mjs';
import { convertParticles } from './particles.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor, makeModel, validateModel } from './model.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { uprightShimmer } from './shimmer-upright.mjs';

const ROOT = 'assets3d-local/conqueror-shimmer';
const VERSION = '14.24.6442327';
const SHA = 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14';
const WADS = ['DATA/FINAL/Maps/Shipping/Map22.wad.client', 'DATA/FINAL/TFTSet13.wad.client', 'DATA/FINAL/TFTCommon.wad.client'];
export const CONQUEROR_SHIMMER_IDS = ['conqueror-chest', 'shimmer-flask', 'conqueror-chest-open', 'shimmer-flask-offer', 'shimmer-flask-take'];
export function resourceReferences(values) {
  const found = new Set(), stack = [...values];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string' && /\.(bin|skn|skl|anm|tex|dds|scb|sco)$/i.test(v)) found.add(v);
    else if (v && typeof v === 'object') stack.push(...Object.values(v));
  }
  return [...found].sort();
}
export function downloadChunks(missing) {
  return [...missing.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, bundleId, offset, size, targetSize }) => ({ id, bundleId, offset, size, targetSize }));
}
export function propActionBindings(manifest) {
  const models = {};
  for (const [id, m] of Object.entries(manifest.models)) models[id] = {
    idle: m.animations?.idle, ...(m.animations?.cast ? { open: m.animations.cast } : {}),
  };
  return { schemaVersion: 1, models, playback: {
    'conqueror-chest-open': { phase: 'impact', anchor: 'target', role: 'open', maxDuration: 6 },
    'shimmer-flask-offer': { phase: 'start', anchor: 'source', role: 'offer', maxDuration: 6 },
    'shimmer-flask-take': { phase: 'impact', anchor: 'target', role: 'take', maxDuration: 6 },
  } };
}
async function buildConqueror(load) {
  const paths = ['data/characters/tft13_conquerorprop/skins/skin0.bin', 'data/characters/tft13_conquerorprop/skins/root.bin', 'characters/tft13_conquerorprop', 'data/characters/tft13_conquerorprop/animations/skin0.bin'];
  const docs = await Promise.all(paths.map(async p => parseGlobalVfxBin(await load(p))));
  const mesh = await load(skinBindings(docs, []).mesh), binding = skinBindings(docs, inspectSkn(mesh).submeshes.map(s => s.name));
  const animation = selectAnimations(animationClips(docs.filter(d => d.entries.some(e => e.hash === binding.animationGraphHash))),
    { idle: { aliases: [], tokens: ['idle'] } }, { idle: 'idle' });
  if (!animation.mapped.idle) throw Error('missing-conqueror-idle');
  const textures = {};
  for (const [material, p] of Object.entries(binding.textures)) textures[material] = encodePng(decodeTexture(await load(p)));
  const animations = await Promise.all(Object.entries(animation.files).map(async ([name, p]) => ({ name, bytes: await load(p) })));
  const result = makeModel(mesh, await load(binding.skeleton), animations, textures, { hiddenSubmeshes: binding.hidden, solidMaterials: binding.solidMaterials });
  const structure = validateModel(result.glb);
  if (!structure.passed) throw Error('invalid-conqueror-model');
  return { result, animation, structure, manifest: { models: { 'conqueror-chest': { path: 'models/conqueror-chest/model.glb', animations: animation.mapped } } } };
}
/** Validate runtime closure and action targets without needing any client data. */
export function validatePropRoot(manifest, bindings, precache, files) {
  const expectedModels = CONQUEROR_SHIMMER_IDS.slice(0, 2), expectedEffects = CONQUEROR_SHIMMER_IDS.slice(2);
  if (Object.keys(manifest.models).sort().join() !== [...expectedModels].sort().join()
    || Object.keys(manifest.effects).sort().join() !== [...expectedEffects].sort().join()) throw Error('invalid-prop-keys');
  const indexed = new Set();
  for (const row of precache.files) {
    const bytes = files.get(row.path);
    if (indexed.has(row.path) || !bytes || bytes.length !== row.bytes || createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw Error('invalid-precache-file');
    indexed.add(row.path);
  }
  if (files.size !== indexed.size) throw Error('unindexed-payload');
  const requireFile = p => { if (!indexed.has(p)) throw Error('missing-runtime-reference'); return files.get(p); };
  requireFile('action-bindings.json');
  for (const id of expectedModels) {
    const model = manifest.models[id], bytes = requireFile(model.path);
    // Only inspect clip metadata here. Compressed accessors are validated by the
    // compressor's NodeIO decoder; the source-only readGlb rejects extensions.
    if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
      || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a
      || 20 + bytes.readUInt32LE(12) > bytes.length) throw Error('invalid-model-container');
    const document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const names = new Set((document.animations ?? []).map(a => a.name));
    if (!bindings.models[id]?.idle) throw Error('missing-idle-binding');
    for (const clip of [...Object.values(model.animations ?? {}), ...Object.values(bindings.models[id])]) if (!names.has(clip)) throw Error('missing-action-clip');
  }
  for (const id of expectedEffects) {
    if (!bindings.playback[id]) throw Error('missing-effect-binding');
    const doc = JSON.parse(requireFile(manifest.effects[id].path));
    for (const e of doc.emitters) for (const p of [e.texture, e.mesh, e.distortion?.normalMap]) if (p) requireFile(p);
  }
  return true;
}

/** Offline discovery only. Do not publish a runtime root until every source is available. */
export async function planConquerorShimmer() {
  const output = await safeOutputPath(ROOT, { directory: true });
  const source = resolve('assets3d-local/trial/local');
  const input = p => safeInputPath(source, join(source, p)).then(readFile);
  const write = (p, v) => writeOutputFileAtomic(join(output, p), typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2) + '\n', { force: true });
  const raw = await input('14.24.manifest');
  if (createHash('sha256').update(raw).digest('hex') !== SHA) throw Error('source-version-mismatch');
  const plan = { version: VERSION, sourceManifest: { path: '14.24.manifest', sha256: SHA }, wads: [] };
  const reader = offlineArchiveReader({ manifest: readRman(raw), plan, readChunk: id => input(`chunks/${id}.zst`), write: (p, b) => write(extrasExtractPath(p), b) });
  const archives = [], failures = [], documents = [], candidates = [];
  for (const name of WADS) {
    try { archives.push({ name, ...await reader.archive(name) }); }
    catch (e) { failures.push({ stage: 'index', path: name, reason: e.message }); }
  }
  if (archives.length !== WADS.length) {
    await write('index-plan.json', { ...plan, wads: WADS.map(name => ({ name, entries: [] })), chunks: downloadChunks(reader.missing) });
    await write('report.json', { ready: false, phase: 'index', failures });
    return { ready: false, phase: 'index', chunks: downloadChunks(reader.missing) };
  }
  const byHash = new Map();
  for (const a of archives) {
    plan.wads.push({ name: a.name, entries: [] });
    for (const e of a.index) { const rows = byHash.get(e.hash) ?? []; rows.push(a); byHash.set(e.hash, rows); }
  }
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(source, join(source, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
    for (const a of byHash.get(line.slice(0, 16)) ?? []) plan.wads.find(w => w.name === a.name).entries.push({ hash: line.slice(0, 16), path: line.slice(17).toLowerCase(), wad: a.name });
  }
  const entries = plan.wads.flatMap(w => w.entries), paths = new Map();
  // Prefer the shipping map's admitted resources.
  for (const e of [...entries].reverse()) paths.set(canonicalAsset(e.path), e);
  const requested = new Map(), loaded = new Map(), attempted = new Set();
  function request(p) {
    const key = canonicalAsset(p), e = paths.get(key);
    if (e) requested.set(key, e);
    else if (!failures.some(f => f.path === p)) failures.push({ stage: 'reference', path: p, reason: 'outside-admitted-index' });
  }
  for (const e of entries) if (/tft13_(warband|conqueror|chembaron)prop\//i.test(e.path) && /\.(bin|skn|skl|anm|tex|dds)$/i.test(e.path)) request(e.path);
  request('data/maps/shipping/map22/map22.bin');
  // Inspect every obtainable candidate and link even if a sibling is missing.
  while ([...requested.keys()].some(k => !attempted.has(k))) {
    for (const [key, e] of [...requested]) {
      if (attempted.has(key)) continue;
      attempted.add(key);
      try {
        const bytes = await reader.extract(e); loaded.set(key, bytes);
        if (!/\.bin$/i.test(e.path) && !e.path.startsWith('characters/')) continue;
        const doc = parseGlobalVfxBin(bytes); documents.push(doc);
        if (!/\/map22\.bin$/i.test(e.path)) for (const ref of [...doc.linked, ...resourceReferences(doc.entries)]) request(ref);
        else {
          const all = particleSourcesFromBins([doc]);
          for (const [path] of Object.entries(all)) if (/TFT13_(Warband|Crime)_/i.test(path)) candidates.push(path);
          const systems = ['TFT13_Warband_CashoutCeremony', 'TFT13_Crime_Prop_Spawn', 'TFT13_Crime_Prop_CashoutTrigger'];
          const closure = specialOrbClosure([doc], systems.map(system => ({ system })));
          for (const ref of closure.references) request(ref);
          if (closure.unresolved.length) failures.push({ stage: 'vfx-closure', reason: 'unresolved-child', details: closure.unresolved });
        }
      } catch (e2) { failures.push({ stage: 'source', path: e.path, reason: e2.message }); }
    }
  }
  // Include all known payload ranges even when missing subchunk metadata prevents extraction.
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
  // Keep download plans focused on requested entries and their subchunk tables.
  const wads = plan.wads.map(w => ({ name: w.name, entries: w.entries.filter(e => requested.get(canonicalAsset(e.path)) === e || e.path.endsWith('.subchunktoc')) }));
  await write('plan.json', { ...plan, wads, chunks });
  const report = { ready: false, phase: chunks.length ? 'missing-source-chunks' : 'source-inspected', version: VERSION,
    sourceManifestSha256: SHA, requestedIds: CONQUEROR_SHIMMER_IDS, candidates, failures, sourceFiles: reader.files,
    modelCandidates: entries.filter(e => /chest|treasure|cashout|lootbox|warband|chembaron|conqueror/i.test(e.path) && /\.(skn|scb|bin)$/i.test(e.path)),
    requestedFiles: requested.size, missingChunks: chunks, downloadBytes: chunks.reduce((s, c) => s + c.size, 0),
    dependencyClosureKnown: !failures.length, note: 'Model identity and action bindings require inspecting all missing source BINs; runtime root not published.' };
  await write('report.json', report);
  if (!chunks.length && !failures.length) {
    const load = async p => {
      const key = canonicalAsset(p);
      if (!loaded.has(key)) throw Error('unpreflighted-resource:' + p);
      return loaded.get(key);
    };
    const { assertManifest, parseParticleDocument } = await contracts();
    const manifest = { schemaVersion: 1, models: {}, effects: {} }, payload = new Map(), models = [];
    const put = async (path, b) => {
      const bytes = Buffer.isBuffer(b) ? b : Buffer.from(JSON.stringify(b, null, 2) + '\n');
      await write('root/' + path, bytes);
      payload.set(path, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    };
    for (const [id, name] of [['conqueror-chest', 'conqueror'], ['shimmer-flask', 'chembaron']]) {
      const rules = { idle: { aliases: ['Idle', 'Idle1'], tokens: ['idle1', 'idle'] } };
      const m = name === 'conqueror' ? await buildConqueror(load) : await buildNonChampionModel({ ids: [id], sourceName: name }, { load, assertManifest, rules, requiredActions: Object.keys(rules),
        initial: [`data/characters/tft13_${name}prop/skins/skin0.bin`, `data/characters/tft13_${name}prop/skins/root.bin`, `characters/tft13_${name}prop`] });
      Object.assign(manifest.models, m.manifest.models);
      if (id === 'shimmer-flask') {
        const upright = uprightShimmer(m.result.glb, m.animation.mapped.idle);
        m.result.glb = upright.glb;
        m.result.report.uprightExport = upright.report;
        m.structure = validateModel(m.result.glb);
      }
      await put(manifest.models[id].path, m.result.glb);
      models.push({ id, sourceName: name, ...m.result.report, actionMapping: m.animation.mapped, decisions: m.animation.decisions, structure: m.structure });
    }
    const specs = [
      { id: 'conqueror-chest-open', system: 'TFT13_Warband_CashoutCeremony' },
      { id: 'shimmer-flask-offer', system: 'TFT13_Crime_Prop_Spawn' },
      { id: 'shimmer-flask-take', system: 'TFT13_Crime_Prop_CashoutTrigger' },
    ];
    const closure = specialOrbClosure(documents, specs), textures = new Map(), alpha = new Map(), meshes = new Map(), bounds = new Map();
    for (const ref of closure.references) {
      const key = canonicalAsset(ref), bytes = await load(ref), hash = createHash('sha256').update(key).digest('hex').slice(0, 20);
      if (/\.(tex|dds)$/i.test(ref)) {
        const path = `textures/${hash}.png`, png = encodePng(decodeTexture(bytes));
        await put(path, png); textures.set(key, path); alpha.set(key, pngHasEffectiveAlpha(png));
      } else if (/\.(scb|sco)$/i.test(ref)) {
        const path = `meshes/${hash}.glb`, mesh = convertParticleMesh(bytes, ref.slice(ref.lastIndexOf('.')));
        const glb = readGlb(mesh.glb), positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
        bounds.set(key, [0, 1, 2].map(i => Math.max(...positions.map(p => p[i])) - Math.min(...positions.map(p => p[i]))));
        await put(path, mesh.glb); meshes.set(key, path);
      } else throw Error('unsupported-fx-resource:' + ref);
    }
    const converted = convertParticles(closure.systems, p => textures.get(canonicalAsset(p)), parseParticleDocument,
      { particleMode: 'approximate', approximateLinger: true, textureAlpha: p => alpha.get(canonicalAsset(p)), meshPath: p => meshes.get(canonicalAsset(p)), meshBounds: p => bounds.get(canonicalAsset(p)) });
    for (const spec of specs) {
      const system = converted.systems.find(s => s.sourcePath.endsWith('/' + spec.system));
      if (!system?.document) throw Error('missing-converted-effect:' + spec.id);
      parseParticleDocument(system.document);
      const path = `effects/${spec.id}.json`; await put(path, system.document); manifest.effects[spec.id] = { path };
    }
    assertManifest(manifest);
    await put('action-bindings.json', propActionBindings(manifest));
    await write('root/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    await write('root/precache.json', JSON.stringify(createPrecache(payload), null, 2) + '\n');
    Object.assign(report, { ready: true, phase: 'converted', models, systems: converted.systems, counts: converted.counts,
      engineEquivalent: false, runtimeBytes: [...payload.values()].reduce((s, p) => s + p.bytes, 0),
      sourcePolicy: 'conqueror prop model; warband cashout ceremony / crime prop spawn and cashout; host triggers are UI mappings, not recovered client timing',
      substitutions: { 'conqueror-chest': 'No dedicated S13 conqueror chest found among the named admitted candidates. The dedicated conqueror prop is a red banner; provided as the closest trait-specific substitute. The animated warband prop is also a banner.' },
      modelOpenPolicy: 'Both selected props have idle only; no bound chest-open clip. Conqueror idle plus cashout ceremony is an explicit visual fallback. Unrelated template clips are not included.' });
    await write('report.json', report);
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await planConquerorShimmer();
  console.log(JSON.stringify({ ready: r.ready, phase: r.phase, missingChunks: (r.missingChunks ?? r.chunks).length, downloadBytes: r.downloadBytes, requestedFiles: r.requestedFiles }));
  if (!r.ready) process.exitCode = 2;
}

import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { particleSourcesFromBins, nameParticleValue } from './particle-bin.mjs';
import { binField, binIs, fnv1a } from './bin.mjs';
import { canonicalAsset } from './bin-bindings.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';
import { SPECIAL_ORB_EFFECTS, extrasBindings, extrasExtractPath, sustainPrismaticIdle } from './tft-extras.mjs';
import { convertParticles } from './particles.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
import { contracts } from './runtime.mjs';
import { mergeManifests } from './merge-manifests.mjs';
import { argumentsFor } from './plan-fetch.mjs';
const json = v => JSON.stringify(v, null, 2) + '\n';
const sha = b => createHash('sha256').update(b).digest('hex');

/** Resolve actual child keys transitively, without inventing spawn timing. */
export function specialOrbClosure(documents, specs = SPECIAL_ORB_EFFECTS) {
  const all = particleSourcesFromBins(documents), systems = {}, byHash = new Map(), resolver = new Map(), edges = [], unresolved = [];
  for (const doc of documents) for (const e of doc.entries) {
    if (binIs(e, 'VfxSystemDefinitionData')) {
      const path = binField(e, 'particlePath'); byHash.set(e.hash, path);
      byHash.set(fnv1a(binField(e, 'particleName') ?? ''), path);
    }
    if (binIs(e, 'ResourceResolver')) for (const [k, v] of binField(e, 'resourceMap')?.entries ?? []) {
      const h = typeof k === 'string' ? fnv1a(k) : k.hash, targets = resolver.get(h) ?? new Set();
      targets.add(v.hash); resolver.set(h, targets);
    }
  }
  for (const s of specs) {
    const hits = Object.entries(all).filter(([p]) => p.split('/').at(-1) === s.system);
    if (hits.length !== 1) throw Error('missing-or-ambiguous-special-system:' + s.system);
    systems[hits[0][0]] = hits[0][1];
  }
  const pending = Object.entries(systems);
  while (pending.length) {
    const [path, value] = pending.shift(), stack = [value];
    while (stack.length) {
      const v = stack.pop(); if (!v || typeof v !== 'object') continue;
      if (v.effectKey?.hash !== undefined) {
        const key = v.effectKey.hash, targets = resolver.get(key);
        const target = targets?.size === 1 ? byHash.get([...targets][0]) : !targets ? byHash.get(key) : undefined;
        if (target && all[target]) {
          edges.push({ source: path, key, target });
          if (!systems[target]) { systems[target] = all[target]; pending.push([target, all[target]]); }
        } else unresolved.push({ source: path, key, reason: targets?.size > 1 ? 'ambiguous-child' : 'missing-child' });
      }
      stack.push(...Object.values(v));
    }
  }
  const refs = new Set(), stack = Object.values(systems);
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string' && /\.(tex|dds|scb|sco|bin)$/i.test(v)) refs.add(v);
    else if (v && typeof v === 'object') stack.push(...Object.values(v));
  }
  return { systems, references: [...refs].sort(), edges, unresolved };
}

/** Offline preflight first: every known missing range goes into plan-3 before
 * any runtime manifest is replaced. Source junctions are never write targets. */
export async function buildSpecialOrbs({ source = 'assets3d-local/trial/local', out = 'assets3d-local/tft-extras' } = {}) {
  const root = resolve(source), output = await safeOutputPath(out, { directory: true });
  withinRoot(resolve('assets3d-local/tft-extras'), output, 'tft-extras-output-only');
  const write = (p, b) => writeOutputFileAtomic(join(output, p), b, { force: true });
  const input = async p => readFile(await safeInputPath(root, join(root, p)));
  const raw = await input('14.24.manifest');
  const previousPlan = JSON.parse(await readFile(await safeInputPath(output, join(output, 'special-orbs-plan.json')), 'utf8'));
  const baselineRoot = resolve('assets3d-local/out');
  const baseline = JSON.parse(await readFile(await safeInputPath(baselineRoot, join(baselineRoot, 'extra-plan.json')), 'utf8'));
  if (sha(raw) !== baseline.sourceManifest.sha256) throw Error('plan-manifest-sha256-mismatch');
  const plan = { version: baseline.version, sourceManifest: baseline.sourceManifest, wads: [] }, failures = [];
  const reader = offlineArchiveReader({ manifest: readRman(raw), plan, readChunk: id => input(`chunks/${id}.zst`), write: (p, b) => write(extrasExtractPath(p), b) });
  const archives = [];
  for (const name of ['DATA/FINAL/Maps/Shipping/Map22.wad.client', 'DATA/FINAL/TFTSet13.wad.client', 'DATA/FINAL/TFTCommon.wad.client']) {
    try { archives.push({ name, ...await reader.archive(name) }); }
    catch (e) { failures.push({ path: name, reason: e.message }); }
  }
  const wanted = new Map();
  for (const a of archives) for (const e of a.index) { const names = wanted.get(e.hash) ?? []; names.push(a.name); wanted.set(e.hash, names); }
  for (const a of archives) plan.wads.push({ name: a.name, entries: [] });
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
    const hash = line.slice(0, 16);
    for (const wad of wanted.get(hash) ?? []) plan.wads.find(w => w.name === wad).entries.push({ hash, path: line.slice(17).toLowerCase(), wad });
  }
  const entries = plan.wads.flatMap(w => w.entries), byPath = new Map(), loaded = new Map();
  // Map22 takes precedence: this is the map's actual admitted VFX resource set.
  for (const e of [...entries].reverse()) byPath.set(canonicalAsset(e.path), e);
  async function load(p) {
    const key = canonicalAsset(p); if (loaded.has(key)) return loaded.get(key);
    const e = byPath.get(key); if (!e) throw Error('outside-index:' + p);
    const b = await reader.extract(e); loaded.set(key, b); return b;
  }
  const documents = [];
  try { documents.push(parseGlobalVfxBin(await load('data/maps/shipping/map22/map22.bin'))); }
  catch (e) { failures.push({ path: 'data/maps/shipping/map22/map22.bin', reason: e.message }); }
  const closure = documents.length ? specialOrbClosure(documents) : { systems: {}, references: [], edges: [], unresolved: [] };
  // Read the entire earlier request too; don't silently lose dependencies from round 1.
  const earlierRefs = previousPlan.wads.flatMap(w => w.entries ?? []).map(e => e.path).filter(p => /\.(tex|dds|scb|sco)$/i.test(p));
  for (const path of new Set([...closure.references, ...earlierRefs])) try { await load(path); }
  catch (e) { failures.push({ path, reason: e.message }); }
  const report = { ready: false, sourceVersion: baseline.version, sourceManifestSha256: sha(raw), failures,
    namedCandidates: entries.filter(e => /warband|crime|loot.?orb|rewardbox/i.test(e.path) && /\.bin$/i.test(e.path)),
    systemNames: Object.keys(particleSourcesFromBins(documents)), selectedSystems: Object.keys(closure.systems),
    dependencyEdges: closure.edges, unresolved: closure.unresolved, references: closure.references, resources: [], systems: [],
    openPolicy: SPECIAL_ORB_EFFECTS.filter(s => s.approximation),
    flightPolicy: 'RewardQueued is an optional moving-host approximation; no dedicated Warband/Crime LootOrb missile system found. Ceremonies are separate, never automatic orb-open children.',
    sourceFiles: reader.files, missingChunks: [...reader.missing.values()] };
  if (reader.missing.size) {
    await write('special-orbs-plan-3.json', json({ ...plan, chunks: [...reader.missing.values()], systems: report.selectedSystems }));
    await write('special-orbs-report.json', json(report)); return report;
  }
  if (failures.length || closure.unresolved.length) { await write('special-orbs-report.json', json(report)); return report; }
  const { assertManifest, parseParticleDocument } = await contracts();
  const build = 'build/units/extras', textures = new Map(), alpha = new Map(), meshes = new Map(), bounds = new Map();
  for (const ref of closure.references) {
    const bytes = await load(ref), key = canonicalAsset(ref), id = sha(Buffer.from(key)).slice(0, 20);
    try {
      if (/\.(tex|dds)$/i.test(ref)) {
        const path = `textures/extras/${id}.png`, png = encodePng(decodeTexture(bytes));
        await write(`${build}/${path}`, png); textures.set(key, path); alpha.set(key, pngHasEffectiveAlpha(png));
        report.resources.push({ source: ref, path, bytes: png.length, type: 'texture' });
      } else if (/\.(scb|sco)$/i.test(ref)) {
        const path = `meshes/extras/${id}.glb`, mesh = convertParticleMesh(bytes, ref.slice(ref.lastIndexOf('.')));
        const glb = readGlb(mesh.glb), positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
        bounds.set(key, [0, 1, 2].map(i => Math.max(...positions.map(p => p[i])) - Math.min(...positions.map(p => p[i]))));
        await write(`${build}/${path}`, mesh.glb); meshes.set(key, path);
        report.resources.push({ source: ref, path, type: 'mesh', ...mesh.report });
      } else throw Error('unhandled-special-resource');
    } catch (e) { failures.push({ path: ref, reason: e.message }); }
  }
  if (failures.length) { await write('special-orbs-report.json', json(report)); return report; }
  const converted = convertParticles(closure.systems, p => textures.get(canonicalAsset(p)), parseParticleDocument,
    { particleMode: 'approximate', approximateLinger: true, textureAlpha: p => alpha.get(canonicalAsset(p)), meshPath: p => meshes.get(canonicalAsset(p)), meshBounds: p => bounds.get(canonicalAsset(p)) });
  for (const s of converted.systems.filter(s => /\/TFT13_(Warband|Crime)_LootOrb$/.test(s.sourcePath))) sustainPrismaticIdle(s);
  const manifest = JSON.parse(await readFile(await safeInputPath(output, join(output, build, 'manifest.json')), 'utf8'));
  for (const spec of SPECIAL_ORB_EFFECTS) {
    const system = converted.systems.find(s => s.sourcePath.endsWith('/' + spec.system));
    if (!system?.document) { failures.push({ path: spec.system, reason: 'no-converted-document' }); continue; }
    parseParticleDocument(system.document);
    const path = `effects/extras/${spec.id}.json`; await write(`${build}/${path}`, json(system.document)); manifest.effects[spec.id] = { path };
    report.systems.push({ id: spec.id, ...system, ...(spec.approximation ? { approximation: spec.approximation } : {}) });
  }
  if (failures.length) { await write('special-orbs-report.json', json(report)); return report; }
  assertManifest(manifest); await write(`${build}/manifest.json`, json(manifest));
  const bindings = JSON.parse(await readFile(await safeInputPath(output, join(output, 'action-bindings.json')), 'utf8'));
  Object.assign(bindings.playback, extrasBindings(manifest, SPECIAL_ORB_EFFECTS).playback); await write('action-bindings.json', json(bindings));
  const runtime = join(output, 'runtime', 'special-' + sha(Buffer.from(json(manifest) + json(converted.systems))).slice(0, 16));
  const merge = await mergeManifests({ from: [join(output, 'build')], out: runtime });
  if (!merge.ready) throw Error('special-orbs-merge-not-ready');
  const precache = JSON.parse(await readFile(join(runtime, 'precache.json'), 'utf8'));
  for (const path of [...precache.files.map(f => f.path), 'manifest.json', 'precache.json', 'merge-report.json']) await write(path, await readFile(await safeInputPath(runtime, join(runtime, path))));
  Object.assign(report, { ready: true, resourceClosureComplete: true, engineEquivalent: false, merge, counts: converted.counts, sourceFiles: reader.files });
  await write('special-orbs-report.json', json(report)); return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await buildSpecialOrbs(argumentsFor(process.argv.slice(2), ['--source', '--out']));
  console.log(json({ ready: r.ready, resources: r.resources.length, effects: r.systems.length, failures: r.failures, missingChunks: r.missingChunks.map(c => c.id) }));
  if (!r.ready) process.exitCode = r.missingChunks.length ? 2 : 1;
}

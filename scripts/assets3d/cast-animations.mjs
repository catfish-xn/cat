import { loadUnitMap } from './local-config.mjs';
// Offline rebuild: inputs are read-only; generated files remain in ignored local roots.
import { readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readGlb } from './glb.mjs';
import { makeModel, validateModel } from './model.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { appendCastClip } from './cast-picks.mjs';
import { compareAnimationRebuild } from './verify-animation-rebuild.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { contains } from './merge-root-output.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { contracts } from './runtime.mjs';
import { readRman, chunksForRange } from './rman.mjs';
import { planFetch } from './plan-fetch.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
const VERSION = '14.24.6442327';
export function castClipNames(config) {
  const names = new Set(config.castExtraClips ?? []);
  function visit(v) {
    if (typeof v === 'string') names.add(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  }
  visit(config.castSequence); visit(config.castVariants);
  return [...names].sort();
}

/** No extraction/cache mutations and no network. A missing source produces only plan.json. */
export async function buildCastAnimations({ from, source = 'assets3d-local/trial/local', out = 'assets3d-local/cast-anim', units } = {}) {
  if (!from) throw new Error('usage: --from <read-only-complete-root>');
  const root = resolve(from), cache = resolve(source), raw = join(cache, 'extracted');
  const target = await safeOutputPath(out, { directory: true });
  for (const input of [await realpath(root), await realpath(cache)]) {
    if (contains(input, target) || contains(target, input)) throw new Error('cast-output-overlaps-input');
  }
  const read = async (r, p) => readFile(await safeInputPath(r, resolve(r, p)));
  const manifest = JSON.parse(await read(root, 'manifest.json'));
  const map = await loadUnitMap();
  const records = JSON.parse(await read(cache, 'extraction.json'));
  if (records.version !== VERSION) throw new Error('source-version-mismatch');
  const baseline = new Map(records.files.map(r => [r.path, r]));
  const ids = units ?? Object.keys(manifest.models).filter(id => map[id]);
  const selected = ids.filter(id => map[id]?.castSequence || map[id]?.castExtraClips || map[id]?.animations?.cast === null);
  const missing = [], verified = new Map();
  for (const id of selected) {
    const c = map[id], paths = [c.mesh, c.skeleton, ...castClipNames(c).map(n => {
      if (!c.animationFiles[n]) throw new Error(`missing-animation-mapping:${id}`);
      return c.animationFiles[n];
    })].map(p => `${c.base}/${p}`);
    for (const path of paths) {
      try {
        const bytes = await read(raw, path), record = baseline.get(path);
        if (!record || record.sha256 !== hash(bytes) || record.bytes !== bytes.length) throw new Error(`source-hash-mismatch:${path}`);
        verified.set(path, bytes);
      } catch (e) { if (e.code !== 'ENOENT') throw e; missing.push({ unitId: id, path }); }
    }
  }
  if (missing.length) {
    const plan = await planFetch({ source, out, write: false }), bytes = await read(cache, '14.24.manifest');
    const rman = readRman(bytes), chunks = new Map(), frontier = [];
    for (const item of missing) {
      const entries = plan.wads.flatMap(w => w.entries.filter(e => e.path === item.path).map(e => ({ ...e, wad: w.name })));
      if (!entries.length) frontier.push(item);
      for (const e of entries) {
        const file = rman.files.find(f => f.name === e.wad);
        for (const c of chunksForRange(file, e.offset, e.compressedSize)) {
          try { await stat(await safeInputPath(cache, join(cache, 'chunks', `${c.id}.zst`))); }
          catch (error) { if (error.code !== 'ENOENT') throw error; chunks.set(c.id, c); }
        }
      }
    }
    const result = { schemaVersion: 1, version: VERSION, sourceManifest: plan.sourceManifest, ready: false,
      wads: plan.wads.map(w => ({ name: w.name, entries: w.entries.filter(e => missing.some(m => m.path === e.path) || e.path?.endsWith('.subchunktoc')) })),
      chunks: [...chunks.values()].sort((a, b) => a.id.localeCompare(b.id)), frontier, missing,
      totals: { entries: missing.length, chunks: chunks.size, downloadBytes: [...chunks.values()].reduce((n, c) => n + c.size, 0) } };
    await writeOutputFileAtomic(join(out, 'plan.json'), json(result), { force: true });
    return result;
  }
  const output = structuredClone(manifest), rebuilt = {}, payloads = new Map();
  const precache = JSON.parse(await read(root, 'precache.json'));
  // Copy only referenced runtime payloads, never source diagnostics, archives or review images.
  for (const p of precache.files) {
    const bytes = await read(root, p.path);
    if (bytes.length !== p.bytes || hash(bytes) !== p.sha256) throw new Error('input-precache-mismatch');
    payloads.set(p.path, bytes);
  }
  for (const id of selected) {
    const config = map[id], base = manifest.models[id], before = await read(root, base.path);
    const original = readGlb(before), skn = verified.get(`${config.base}/${config.mesh}`);
    const textures = {}, solidMaterials = {}, hiddenSubmeshes = [];
    for (const sub of inspectSkn(skn).submeshes) {
      const material = original.document.materials.find(m => m.name === sub.name);
      if (!material) { hiddenSubmeshes.push(sub.name); continue; }
      const index = material.pbrMetallicRoughness?.baseColorTexture?.index;
      if (index === undefined) { solidMaterials[sub.name] = { factor: material.pbrMetallicRoughness.baseColorFactor }; continue; }
      const image = original.document.images[original.document.textures[index].source], v = original.document.bufferViews[image.bufferView];
      textures[sub.name] = original.binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    }
    const names = castClipNames(config), prior = new Set(original.document.animations.map(a => a.name));
    const added = names.filter(n => !prior.has(n));
    let after = before;
    if (added.length) {
      const donor = makeModel(skn, verified.get(`${config.base}/${config.skeleton}`), added.map(name => ({ name, bytes: verified.get(`${config.base}/${config.animationFiles[name]}`) })), textures, { solidMaterials, hiddenSubmeshes });
      for (const name of added) after = appendCastClip(after, donor.glb, name);
    }
    validateModel(after);
    const preservation = compareAnimationRebuild(before, after, false);
    if (!preservation.nonAnimationEqual || !preservation.priorAnimationsEqual) throw new Error(`cast-preservation-failed:${id}`);
    output.models[id] = { ...base, animations: { ...base.animations,
      ...(Object.hasOwn(config.animations, 'cast') ? { cast: config.animations.cast } : {}) },
      ...(config.castSequence ? { castSequence: config.castSequence } : {}),
      ...(config.castVariants ? { castVariants: config.castVariants } : {}) };
    delete output.models[id].approximated; delete output.models[id].basis; delete output.models[id].confidence;
    payloads.set(base.path, after);
    rebuilt[id] = { addedClips: added.length, selectedClips: names.length, preservation };
  }
  const { assertManifest } = await contracts(); assertManifest(output);
  for (const [path, bytes] of payloads) await writeOutputFileAtomic(join(out, path), bytes, { force: true });
  const index = new Map([...payloads].map(([p, b]) => [p, { bytes: b.length, sha256: hash(b) }]));
  await writeOutputFileAtomic(join(out, 'manifest.json'), json(output), { force: true });
  await writeOutputFileAtomic(join(out, 'precache.json'), json(createPrecache(index)), { force: true });
  try { await writeOutputFileAtomic(join(out, 'action-bindings.json'), await read(root, 'action-bindings.json'), { force: true }); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const report = { schemaVersion: 1, ready: true, missingChunks: [], models: ids.length, rebuilt, addedClips: Object.values(rebuilt).reduce((n, r) => n + r.addedClips, 0) };
  await writeOutputFileAtomic(join(out, 'build-report.json'), json(report), { force: true });
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--from', '--source', '--out'].includes(args[i]) || !args[i + 1]) throw new Error('invalid-argument');
    options[args[i].slice(2)] = args[i + 1];
  }
  const report = await buildCastAnimations(options);
  console.log(json(report)); if (!report.ready) process.exitCode = 1;
}

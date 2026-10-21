import { createReadStream } from 'node:fs';
import { readFile as read } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman } from './rman.mjs';
import { offlineArchiveReader } from './global-vfx.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';
import { parseBin } from './bin.mjs';
import { canonicalAsset, skinBindings, animationClips, selectAnimations } from './bin-bindings.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { makeModel, validateModel } from './model.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { contracts } from './runtime.mjs';
import { NEUTRAL_CONFIG, NEUTRAL_ACTION_RULES, parseNeutralConfig } from './neutral-config.mjs';
import { mergeManifests } from './merge-manifests.mjs';
import { argumentsFor } from './plan-fetch.mjs';
const json = v => JSON.stringify(v, null, 2) + '\n';
const sha = b => createHash('sha256').update(b).digest('hex');
const WAD = 'DATA/FINAL/TFTCommon.wad.client';

/** Follow linked animation graphs to closure, rather than one level of skin links. */
export async function animationGraphClosure(initial, load, limit = 128) {
  const documents = [], seen = new Set(), queue = [...initial];
  while (queue.length) {
    const path = canonicalAsset(queue.shift());
    if (seen.has(path)) continue;
    if (seen.size >= limit) throw new Error('animation-graph-closure-budget');
    seen.add(path);
    const doc = await load(path);
    if (doc.patches.length) throw new Error('unsupported-binding-bin-patches');
    documents.push(doc);
    queue.push(...doc.linked.filter(p => /\/animations\/.*\.bin$/i.test(p)));
  }
  return documents;
}
export function neutralManifest(rows, validate) {
  const models = {};
  for (const { config, animations } of rows) for (const id of config.ids) {
    if (Object.hasOwn(models, id)) throw new Error('duplicate-neutral-id');
    models[id] = { path: `models/${id}/model.glb`, animations };
  }
  const manifest = { schemaVersion: 1, models, effects: {} };
  validate(manifest); return manifest;
}

/** Shared BIN-bound model conversion for non-champions; unavailable actions stay absent. */
export async function buildNonChampionModel(config, { load, assertManifest, initial,
  rules = NEUTRAL_ACTION_RULES, requiredActions = Object.keys(rules), keepAllClips = true }) {
  const docs = await animationGraphClosure(initial, async p => parseBin(await load(p)));
  const preliminary = skinBindings(docs, []), mesh = await load(preliminary.mesh);
  const binding = skinBindings(docs, inspectSkn(mesh).submeshes.map(s => s.name));
  const graphs = docs.flatMap(d => d.entries).filter(e => e.hash === binding.animationGraphHash);
  if (graphs.length !== 1) throw new Error('missing-or-ambiguous-animation-graph');
  const clips = animationClips([{ entries: graphs, patches: [] }]);
  const animation = selectAnimations(clips, rules, config.animations);
  for (const action of requiredActions) if (!animation.mapped[action]) throw new Error(`missing-neutral-action:${config.sourceName}:${action}`);
  // Keep all atomic graph clips, including spawn/secondary attack/shared dragon clips.
  const files = { ...animation.files };
  for (const clip of clips.filter(c => keepAllClips && c.atomic && c.path)) {
    const name = canonicalAsset(clip.path).split('/').at(-1).replace(/\.anm$/, '');
    if (files[name] && canonicalAsset(files[name]) !== canonicalAsset(clip.path)) throw new Error('animation-name-collision');
    files[name] = clip.path;
  }
  const materialTextures = {}, textureReports = [];
  for (const [material, path] of Object.entries(binding.textures)) {
    if (binding.hidden.includes(material)) continue;
    const decoded = decodeTexture(await load(path));
    materialTextures[material] = encodePng(decoded);
    textureReports.push({ material, path, width: decoded.width, height: decoded.height, format: decoded.format });
  }
  const animations = [];
  for (const [name, path] of Object.entries(files)) animations.push({ name, bytes: await load(path) });
  const result = makeModel(mesh, await load(binding.skeleton), animations, materialTextures,
    { hiddenSubmeshes: binding.hidden, solidMaterials: binding.solidMaterials });
  const structure = validateModel(result.glb);
  if (!structure.passed) throw new Error('invalid-neutral-glb');
  const manifest = neutralManifest([{ config, animations: animation.mapped }], assertManifest);
  return { result, structure, binding, textureReports, animation, files, manifest };
}

/** Offline only. Read linked cache roots; every write is below the real neutrals root. */
export async function buildNeutrals({ source = 'assets3d-local/trial/local', out = 'assets3d-local/neutrals', force = false } = {}) {
  const root = resolve(source), output = await safeOutputPath(out, { directory: true });
  withinRoot(await safeOutputPath('assets3d-local/neutrals', { directory: true }), output, 'neutrals-output-only');
  const write = (p, bytes) => writeOutputFileAtomic(join(output, p), bytes, { force });
  const input = p => safeInputPath(root, join(root, p)).then(read);
  const rawManifest = await input('14.24.manifest');
  const planRoot = resolve('assets3d-local/out');
  const baseline = JSON.parse(await read(await safeInputPath(planRoot, join(planRoot, 'fetch-plan.json')), 'utf8'));
  if (sha(rawManifest) !== baseline.sourceManifest.sha256) throw new Error('plan-manifest-sha256-mismatch');
  const plan = { wads: [] };
  const reader = offlineArchiveReader({ manifest: readRman(rawManifest), plan, readChunk: id => input(`chunks/${id}.zst`), write });
  await write('build-report.json', json({ ready: false, phase: 'building' }));
  const archive = await reader.archive(WAD), hashes = new Set(archive.index.map(e => e.hash)), named = [];
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.game.txt'))), crlfDelay: Infinity })) {
    if (hashes.has(line.slice(0, 16))) named.push({ hash: line.slice(0, 16), path: line.slice(17).toLowerCase(), wad: WAD });
  }
  plan.wads.push({ name: WAD, entries: named });
  const paths = new Map(named.map(e => [canonicalAsset(e.path), e])), loaded = new Map();
  async function load(path) {
    const key = canonicalAsset(path);
    if (!loaded.has(key)) {
      const entry = paths.get(key); if (!entry) throw new Error(`missing-neutral-resource:${path}`);
      loaded.set(key, await reader.extract(entry));
    }
    return loaded.get(key);
  }
  const { assertManifest } = await contracts(), rows = [], reports = [];
  for (const config of parseNeutralConfig(NEUTRAL_CONFIG)) {
    const prefix = `data/characters/${config.sourceName}`;
    const { result, structure, binding, textureReports, animation, files, manifest } = await buildNonChampionModel(config,
      { load, assertManifest, initial: [`${prefix}/skins/skin0.bin`, `${prefix}/skins/root.bin`] });
    const unitRoot = `build/units/${config.ids[0]}`;
    for (const model of Object.values(manifest.models)) await write(`${unitRoot}/${model.path}`, result.glb);
    await write(`${unitRoot}/manifest.json`, json(manifest));
    rows.push({ config, animations: animation.mapped });
    reports.push({ sourceName: config.sourceName, ids: config.ids, ...result.report, structure, bytes: result.glb.length,
      sha256: sha(result.glb), bindings: binding, textures: textureReports, actionMapping: animation.mapped,
      actionDecisions: animation.decisions, suggestedHeight: config.height, suggestedScale: config.height / result.report.bbox.height });
    console.log(config.sourceName, result.glb.length, Object.keys(files).length);
  }
  // Merge requires disjoint roots. Publish its validated result at the requested root.
  const runtime = join(output, 'runtime', sha(Buffer.from(json({ manifest: neutralManifest(rows, assertManifest),
    hashes: reports.map(r => r.sha256) }))).slice(0, 16));
  const merge = await mergeManifests({ from: [join(output, 'build')], out: runtime });
  if (!merge.ready) throw new Error('neutral-merge-not-ready');
  const precache = JSON.parse(await read(join(runtime, 'precache.json'), 'utf8'));
  for (const path of [...precache.files.map(f => f.path), 'manifest.json', 'precache.json', 'merge-report.json'])
    await write(path, await read(await safeInputPath(runtime, join(runtime, path))));
  const report = { schemaVersion: 1, ready: merge.ready, sourceVersion: '14.24.6442327', sourceManifestSha256: sha(rawManifest),
    models: reports, uniqueGlbBytes: reports.reduce((s, r) => s + r.bytes, 0), merge, sourceFiles: reader.files, missingChunks: [...reader.missing.values()] };
  await writeOutputFileAtomic(join(output, 'build-report.json'), json(report), { force: true });
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildNeutrals(argumentsFor(process.argv.slice(2), ['--source', '--out']));
  console.log(JSON.stringify({ ready: report.ready, models: report.models.length, uniqueGlbBytes: report.uniqueGlbBytes, runtimeBytes: report.merge.bytes }));
  if (!report.ready) process.exitCode = 1;
}

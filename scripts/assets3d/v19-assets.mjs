// Offline v19 additions. Copyrighted payloads/reports belong only in assets3d-local.
import { readFile, mkdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { safeInputPath, safeOutputPath, writeOutputFile } from './safe-path.mjs';
import { contracts } from './runtime.mjs';
import { readGlb } from './glb.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { makeModel, validateModel } from './model.mjs';
import { appendCastClip } from './cast-picks.mjs';
import { compareAnimationRebuild } from './verify-animation-rebuild.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { buildAssetRoot, runtimeModelJson } from './build-asset-root.mjs';
import { compressAssets } from './compress.mjs';
import { packRoot } from './pack-root.mjs';

const json = x => Buffer.from(JSON.stringify(x, null, 2) + '\n');
const hash = x => createHash('sha256').update(x).digest('hex');
const input = async (root, path) => readFile(await safeInputPath(resolve(root), resolve(root, path)));
const read = async (root, path) => JSON.parse(await input(root, path));
export const FAMILY_IDS = ['violet', 'vander', 'powder', 'warwick', 'jinx', 'vi'];
export const PORTRAITS = { warwick: 'tft13_warwick', viktor: 'tft13_viktor', mel: 'tft13_missmage' };
const PORTRAIT_API = { warwick: 'TFT13_Warwick', viktor: 'TFT13_Viktor', mel: 'TFT13_MissMage' };
// Source paths cross-checked against the local 14.24 en_us archive, never inferred from ids.
export const TRAIT_ICONS = {
  sisters: { apiName: 'TFT13_Teamup_Sisters', source: 'assets/ux/traiticons/teamup_trait_sisters.tft_set13.tex' },
  'blood-hunter': { apiName: 'TFT13_BloodHunter', source: 'assets/ux/traiticons/trait_icon_13_bloodhunter.tft_set13.tex' },
  'machine-herald': { apiName: 'TFT13_MachineHerald', source: 'assets/ux/traiticons/trait_icon_13_machineherald.tft_set13.tex' },
  'banished-mage': { apiName: 'TFT13_MissMageTrait', source: 'assets/ux/traiticons/trait_icon_13_banishedmage.tft_set13.tex' },
};

/** Prefer an explicitly named dance_loop, then dance. Ambiguity is a fallback, not a guess. */
export function selectDance(animationFiles) {
  const names = Object.keys(animationFiles ?? {});
  const loop = names.filter(n => /(?:^|_)dance_loop(?:\.|$)/i.test(n));
  const dance = names.filter(n => /(?:^|_)dance(?:\.|$)/i.test(n) || /^regulardance$/i.test(n));
  const candidates = loop.length ? loop : dance;
  return candidates.length === 1 ? { clip: candidates[0], path: animationFiles[candidates[0]] }
    : { clip: null, reason: candidates.length ? 'ambiguous-dance' : 'no-dance-in-source-index', candidates };
}

export function celebrateEntry(base, clip, names) {
  if (!clip || !names.includes(clip)) throw new Error('missing-celebrate-clip');
  return { ...structuredClone(base), animations: { ...base.animations, celebrate: clip } };
}

/** Patch metadata only; never replace rebuilt meshes with the scale root's older models. */
export function applyScales(manifest, scaleManifest) {
  const result = structuredClone(manifest);
  for (const [id, model] of Object.entries(scaleManifest.models)) if (model.unitScale !== undefined) {
    if (!result.models[id]) throw new Error(`missing-scaled-model:${id}`);
    if (!Number.isFinite(model.unitScale) || model.unitScale <= 0) throw new Error(`invalid-unit-scale:${id}`);
    result.models[id].unitScale = model.unitScale;
  }
  return result;
}

/** The requested unsuffixed PNG and the locally available Evolved TEX are not
 * asserted identical. Selecting the alternate source is an explicit caller choice. */
export function checkPortraitSource(ui, portraitSource = 'requested') {
  if (!['requested', 'evolved'].includes(portraitSource)) throw new Error('invalid-portrait-source');
  if (portraitSource !== 'evolved' && ui.assets.some(a => a.kind === 'champion' && /_evolved\.tex$/i.test(a.source))) {
    throw new Error('requested-portrait-source-unavailable:select-portraitSource-evolved-or-supply-requested-source');
  }
}

async function newDirectory(path) {
  const target = await safeOutputPath(path, { directory: true });
  try { await lstat(target); throw new Error('output-exists-use-new-directory'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(target, { recursive: true });
}
async function writeFiles(root, files) {
  for (const [path, data] of files) await writeOutputFile(join(root, path), data);
}
function precache(files) {
  return createPrecache(new Map([...files].map(([p, b]) => [p, { bytes: b.length, sha256: hash(b) }])));
}

/** Every extracted source is checked against the immutable extraction receipt. */
export async function verifiedSource(caches, path) {
  for (const cache of caches) {
    const records = await read(cache, 'extraction.json');
    if (records.version !== '14.24.6442327') throw new Error('source-version-mismatch');
    const record = records.files.find(f => f.path === path);
    if (!record) continue;
    const bytes = await input(join(cache, 'extracted'), path);
    if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw new Error(`source-hash-mismatch:${path}`);
    return { bytes, source: path, cache, sha256: hash(bytes) };
  }
  return null;
}

/** Reuse the raw model's exact visible materials to produce a rig-compatible animation donor. */
export function appendDance(before, skn, skl, animation, name) {
  const original = readGlb(before), textures = {}, solidMaterials = {}, hiddenSubmeshes = [];
  for (const sub of inspectSkn(skn).submeshes) {
    const material = original.document.materials.find(m => m.name === sub.name);
    if (!material) { hiddenSubmeshes.push(sub.name); continue; }
    const pbr = material.pbrMetallicRoughness, index = pbr?.baseColorTexture?.index;
    if (index === undefined) { solidMaterials[sub.name] = { factor: pbr.baseColorFactor }; continue; }
    const image = original.document.images[original.document.textures[index].source];
    const v = original.document.bufferViews[image.bufferView];
    textures[sub.name] = original.binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  }
  const donor = makeModel(skn, skl, [{ name, bytes: animation }], textures, { solidMaterials, hiddenSubmeshes });
  const after = appendCastClip(before, donor.glb, name);
  validateModel(after);
  const preservation = compareAnimationRebuild(before, after, false);
  if (!preservation.nonAnimationEqual || !preservation.priorAnimationsEqual) throw new Error('celebrate-preservation-failed');
  return { bytes: after, preservation };
}

export async function prepareV19({ out = 'assets3d-local/v19-additions', source = 'assets3d-local/trial/local',
  sixSource = 'assets3d-local/six-cost/source', base = 'assets3d-local/cast-anim',
  rebuilt = 'assets3d-local/six-cost/rebuilt-v2/converted', scales = 'assets3d-local/model-scale/root',
  board = 'assets3d-local/row-align/asset-root-v2' } = {}) {
  await newDirectory(out);
  const caches = [source, sixSource], map = JSON.parse(await readFile(new URL('./unit-map.json', import.meta.url)));
  const { assertManifest } = await contracts();
  const normal = await read(base, 'manifest.json'), six = await read(rebuilt, 'manifest.json');
  assertManifest(normal); assertManifest(six);
  const scaleManifest = await read(scales, 'manifest.json');
  const models = {}, payloads = new Map(), dances = [], fallbacks = [];
  // Include all three rebuilt models so final composition cannot reintroduce stale hit/death aliases.
  for (const id of new Set([...FAMILY_IDS, ...Object.keys(PORTRAITS)])) {
    const root = six.models[id] ? rebuilt : base, entry = structuredClone((six.models[id] ? six : normal).models[id]);
    let bytes = await input(root, entry.path);
    if (FAMILY_IDS.includes(id)) {
      const pick = selectDance(map[id].animationFiles);
      if (!pick.clip) fallbacks.push({ id, ...pick, fallback: 'consumer idle/text fallback; no celebrate mapping' });
      else {
        const c = map[id], paths = [c.mesh, c.skeleton, pick.path].map(p => `${c.base}/${p}`);
        const sources = await Promise.all(paths.map(p => verifiedSource(caches, p)));
        if (sources.some(s => !s)) fallbacks.push({ id, reason: 'missing-local-source', paths: paths.filter((_, i) => !sources[i]) });
        else {
          const names = readGlb(bytes).document.animations.map(a => a.name);
          const built = names.includes(pick.clip) ? { bytes, preservation: compareAnimationRebuild(bytes, bytes, true) }
            : appendDance(bytes, sources[0].bytes, sources[1].bytes, sources[2].bytes, pick.clip);
          bytes = built.bytes;
          Object.assign(entry, celebrateEntry(entry, pick.clip, readGlb(bytes).document.animations.map(a => a.name)));
          dances.push({ id, clip: pick.clip, sources: sources.map(({ bytes: _, ...s }) => s), preservation: built.preservation });
        }
      }
    }
    entry.path = `models/${id}/model.glb`;
    if (scaleManifest.models[id]?.unitScale !== undefined) entry.unitScale = scaleManifest.models[id].unitScale;
    models[id] = entry; payloads.set(entry.path, bytes);
  }
  const manifest = { schemaVersion: 1, models, effects: {} }; assertManifest(manifest);
  const modelFiles = new Map(payloads); modelFiles.set('manifest.json', json(manifest));
  modelFiles.set('precache.json', json(precache(payloads)));
  await writeFiles(join(out, 'models'), modelFiles);

  const assets = [], missingIcons = [], iconFiles = new Map();
  const specs = [
    ...Object.entries(PORTRAITS).map(([id, key]) => ({ id, kind: 'champion', apiName: PORTRAIT_API[id],
      requestedSource: `characters/${key}/hud/${key}_square.tft_set13.png`,
      candidates: [`assets/characters/${key}/hud/${key}_square.tft_set13.tex`, `assets/characters/${key}/hud/${key}_square.tft_set13_evolved.tex`] })),
    ...Object.entries(TRAIT_ICONS).map(([id, c]) => ({ id, kind: 'trait', apiName: c.apiName, candidates: [c.source] })),
  ];
  for (const spec of specs) {
    let found;
    for (const path of spec.candidates) { found = await verifiedSource(caches, path); if (found) break; }
    if (!found) { missingIcons.push({ ...spec, reason: 'source-not-in-local-extraction-cache' }); continue; }
    const png = encodePng(decodeTexture(found.bytes));
    const path = `assets/s13/${spec.kind === 'champion' ? 'champions' : 'traits'}/${spec.id}.png`;
    assets.push({ kind: spec.kind, id: spec.id, apiName: spec.apiName, path, source: found.source,
      ...(spec.requestedSource ? { requestedSource: spec.requestedSource } : {}), bytes: png.length, sha256: hash(png), sourceSha256: found.sha256 });
    iconFiles.set(path, png);
  }
  const ui = { schemaVersion: 1, patch: '14.24', assets, unavailable: missingIcons };
  iconFiles.set('ui-assets.json', json(ui)); await writeFiles(join(out, 'ui'), iconFiles);

  // Restrict the alignment overlay to the board; never roll champion/effect updates back.
  const boardManifest = await read(board, 'manifest.json'); assertManifest(boardManifest);
  const onlyBoard = { schemaVersion: 1, models: Object.fromEntries(Object.entries(boardManifest.models).filter(([id]) => id.startsWith('board-default'))),
    effects: Object.fromEntries(Object.entries(boardManifest.effects).filter(([id]) => id.startsWith('board-default'))), boards: boardManifest.boards };
  assertManifest(onlyBoard);
  const boardFiles = new Map();
  const add = async p => { if (!boardFiles.has(p)) boardFiles.set(p, await input(board, p)); };
  for (const m of Object.values(onlyBoard.models)) await add(m.path);
  for (const e of Object.values(onlyBoard.effects)) {
    await add(e.path); const doc = JSON.parse(boardFiles.get(e.path));
    for (const emitter of doc.emitters) for (const p of [emitter.texture, emitter.mesh, emitter.distortion?.normalMap].filter(Boolean)) await add(p);
  }
  boardFiles.set('precache.json', json(precache(boardFiles))); boardFiles.set('manifest.json', json(onlyBoard));
  await writeFiles(join(out, 'board'), boardFiles);
  const report = { ready: true, dances, fallbacks, ui, rebuilt, scales, board, out };
  await writeOutputFile(join(out, 'report.json'), json(report)); return report;
}

/** Verify every indexed byte plus packed slices; hash checks do not depend on copyrighted test inputs. */
export async function verifyRoot(root, { packed = false } = {}) {
  const { assertManifest, parseParticleDocument } = await contracts();
  const manifest = await read(root, 'manifest.json'); assertManifest(manifest);
  const index = await read(root, 'precache.json'), files = new Map();
  for (const f of index.files) {
    if (files.has(f.path)) throw new Error('duplicate-payload');
    const bytes = await input(root, f.path);
    if (bytes.length !== f.bytes || hash(bytes) !== f.sha256) throw new Error(`payload-hash-mismatch:${f.path}`);
    files.set(f.path, bytes);
  }
  for (const model of Object.values(manifest.models)) {
    if (!files.has(model.path)) throw new Error('unindexed-model');
    const names = (await runtimeModelJson(files.get(model.path))).animations?.map(a => a.name) ?? [];
    for (const name of Object.values(model.animations ?? {}).filter(Boolean)) if (!names.includes(name)) throw new Error(`missing-model-clip:${name}`);
  }
  for (const effect of Object.values(manifest.effects ?? {})) {
    if (!files.has(effect.path)) throw new Error('unindexed-effect');
    const doc = parseParticleDocument(JSON.parse(files.get(effect.path)));
    for (const emitter of doc.emitters) for (const p of [emitter.texture, emitter.mesh, emitter.distortion?.normalMap].filter(Boolean)) if (!files.has(p)) throw new Error('unindexed-effect-resource');
  }
  if (files.has('ui-assets.json')) {
    for (const a of JSON.parse(files.get('ui-assets.json')).assets) {
      const bytes = files.get(a.path);
      if (!bytes || bytes.length !== a.bytes || hash(bytes) !== a.sha256) throw new Error('ui-hash-mismatch');
    }
  }
  let packs = 0;
  if (packed) {
    const seen = new Set();
    for (const p of (await read(root, 'packs.json')).packs) {
      const bytes = await input(root, p.path); packs++;
      if (bytes.length !== p.bytes || hash(bytes) !== p.sha256) throw new Error('pack-hash-mismatch');
      let offset = 0;
      for (const f of p.files) {
        const slice = bytes.subarray(f.offset, f.offset + f.bytes), original = files.get(f.path);
        if (f.offset !== offset || seen.has(f.path) || !original || !original.equals(slice) || hash(slice) !== f.sha256) throw new Error('pack-slice-mismatch');
        seen.add(f.path); offset += f.bytes;
      }
      if (offset !== bytes.length) throw new Error('pack-trailing-bytes');
    }
    if (seen.size !== files.size) throw new Error('pack-coverage-mismatch');
  }
  return { ready: true, files: files.size, bytes: [...files.values()].reduce((s, b) => s + b.length, 0), packs };
}

export async function finalizeV19({ additions = 'assets3d-local/v19-additions',
  base = '../boardwire/assets3d-local/game-v6', fx = 'assets3d-local/fx-batch7',
  scales = 'assets3d-local/model-scale/root', out = 'assets3d-local/test-server-v7', portraitSource = 'requested' } = {}) {
  const ui = await read(join(additions, 'ui'), 'ui-assets.json');
  checkPortraitSource(ui, portraitSource);
  // Standard merger/compressor/packer retain all their existing path and ignore checks.
  const raw = `${out}-uncompressed`;
  await buildAssetRoot({ roots: [base, join(additions, 'board'), fx, join(additions, 'models')], out: raw });
  const manifest = applyScales(await read(raw, 'manifest.json'), await read(scales, 'manifest.json'));
  const { assertManifest } = await contracts(); assertManifest(manifest);
  await writeOutputFile(join(raw, 'manifest.json'), json(manifest), { force: true });
  await verifyRoot(raw);
  await compressAssets({ from: raw, out });
  // The 3D compressor indexes model/effect payloads. Add separate 2D registration after it,
  // then refresh the shared payload index before packing so offline precache includes the UI.
  const uiFiles = new Map([['ui-assets.json', json(ui)]]);
  for (const a of ui.assets) uiFiles.set(a.path, await input(join(additions, 'ui'), a.path));
  await writeFiles(out, uiFiles);
  const index = await read(out, 'precache.json');
  const combined = new Map(index.files.map(f => [f.path, f]));
  for (const [path, bytes] of uiFiles) combined.set(path, { bytes: bytes.length, sha256: hash(bytes) });
  await writeOutputFile(join(out, 'precache.json'), json(createPrecache(combined)), { force: true });
  await packRoot({ root: out });
  const verification = await verifyRoot(out, { packed: true });
  await writeOutputFile(join(additions, 'delivery.json'), json({ out, verification }));
  return verification;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!['out', 'source', 'sixSource', 'base', 'rebuilt', 'scales', 'board', 'additions', 'fx', 'portraitSource'].includes(key) || !args[i + 1] || Object.hasOwn(options, key)) throw new Error('invalid-argument');
    options[key] = args[i + 1];
  }
  try {
    const result = command === 'prepare' ? await prepareV19(options) : command === 'finalize' ? await finalizeV19(options) : null;
    if (!result) throw new Error('usage: v19-assets.mjs prepare|finalize [--option value]');
    console.log(JSON.stringify(result));
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
}

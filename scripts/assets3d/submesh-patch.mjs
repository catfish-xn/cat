// Submesh patch: initially hidden submeshes that an exported clip shows, appended to a built model as extra primitives,
// and every exported clip's submesh show/hide events, for the renderer to switch visibility frame by frame.
// The source data lists such submeshes in initialSubmeshToHide and shows them with SubmeshVisibilityEventData in clips.
// The model build leaves hidden submeshes out; this step can add back only the ones an exported clip shows (a switch,
// off by default: a renderer that does not hide them would draw them all the time). A model with nothing to append, or
// with the switch off, is returned byte for byte as it came in.
import { readGlb, writeGlb } from './glb.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { binField as field, binIs, fnv1a } from './bin.mjs';

/**
 * Initially hidden submeshes that no clip shows but a renderer timed form does (rendering3d/submesh-visibility.ts
 * TIMED_FORMS), by unit id: the patch appends them like clip-shown ones, so the timed form has geometry to switch on.
 */
export const TIMED_FORM_SUBMESHES = Object.freeze({ swain: Object.freeze(['wings']) });

const clipName = path => path.split('/').at(-1).replace(/(?:\.tft_set13)?\.anm$/i, '').toLowerCase();
const hashOf = value => (typeof value === 'object' && value !== null ? value.hash : value) >>> 0;

/**
 * Every clip's submesh visibility events, by clip source name (as model clips are named), in event-map order sorted by
 * frame. Each event lists submesh names it shows and hides; a hash that names no submesh of this mesh is kept in
 * `unresolved` rather than guessed.
 */
export function submeshVisibilityEvents(graphEntries, submeshes) {
  const byHash = new Map(submeshes.map(name => [fnv1a(name), name]));
  const events = {}, unresolved = {};
  for (const graph of graphEntries) {
    for (const [, clip] of field(graph, 'mClipDataMap')?.entries ?? []) {
      const path = field(field(clip, 'mAnimationResourceData'), 'mAnimationFilePath');
      if (typeof path !== 'string') continue;
      const name = clipName(path);
      for (const [, event] of field(clip, 'mEventDataMap')?.entries ?? []) {
        if (!binIs(event, 'SubmeshVisibilityEventData')) continue;
        const resolve = list => (list ?? []).map(hashOf).flatMap(h => {
          if (byHash.has(h)) return [byHash.get(h)];
          (unresolved[name] ??= new Set()).add(h.toString(16).padStart(8, '0'));
          return [];
        });
        const show = resolve(field(event, 'mShowSubmeshList')), hide = resolve(field(event, 'mHideSubmeshList'));
        if (!show.length && !hide.length) continue;
        const entry = { frame: field(event, 'mStartFrame') ?? 0, show, hide }, list = (events[name] ??= []);
        // A clip listed twice in the graph (two keys on one .anm) repeats its events: keep one of each.
        if (!list.some(e => e.frame === entry.frame && e.show.join() === show.join() && e.hide.join() === hide.join())) list.push(entry);
      }
    }
  }
  for (const list of Object.values(events)) list.sort((a, b) => a.frame - b.frame);
  return { events, unresolved: Object.fromEntries(Object.entries(unresolved).map(([k, v]) => [k, [...v].sort()])) };
}

/**
 * Which initially hidden submeshes to append: those in the mesh that an exported clip shows, and those `timedForm` names
 * (shown by a renderer timed form rather than a clip). The rest are listed with why they are left out (not in the mesh,
 * shown only by clips the model does not carry, or shown by no clip).
 */
export function submeshPatchPlan({ hidden, submeshes, events, exportedClips, timedForm = [] }) {
  const timed = new Set(timedForm.map(n => n.toLowerCase()));
  const exported = new Set(exportedClips.map(c => c.toLowerCase())), append = [], skipped = [];
  const lower = new Map(submeshes.map(name => [name.toLowerCase(), name]));
  for (const wanted of hidden) {
    const name = lower.get(wanted.toLowerCase());
    if (!name) { skipped.push({ name: wanted, reason: 'not-in-mesh' }); continue; }
    const shownIn = Object.entries(events).filter(([, list]) => list.some(e => e.show.includes(name))).map(([clip]) => clip).sort();
    const carried = shownIn.filter(clip => exported.has(clip));
    if (carried.length) append.push({ name, shownIn: carried, ...(shownIn.length > carried.length ? { alsoShownInMissing: shownIn.filter(c => !exported.has(c)) } : {}) });
    else if (timed.has(name.toLowerCase())) append.push({ name, shownBy: 'timed-form', ...(shownIn.length ? { alsoShownInMissing: shownIn } : {}) });
    else skipped.push({ name, reason: shownIn.length ? 'shown-only-in-missing-clips' : 'never-shown', ...(shownIn.length ? { clips: shownIn } : {}) });
  }
  const order = new Map(submeshes.map((name, i) => [name, i]));
  append.sort((a, b) => order.get(a.name) - order.get(b.name));
  return { append, skipped };
}

/**
 * Appends `names` (submeshes of `skn`) to a built model as primitives on its existing vertex attributes, each with its own
 * material named after the submesh. The model's vertex buffers already hold every submesh's vertices (the build writes
 * them all and leaves only hidden primitives out); a count mismatch is refused. Nothing to append returns `glb` itself.
 */
export function appendSubmeshes(glb, skn, names, textures = {}, solidMaterials = {}) {
  if (!names.length) return glb;
  const mesh = inspectSkn(skn), { document: d, binary } = readGlb(glb);
  if (d.meshes?.length !== 1 || !d.meshes[0].primitives.length) throw new Error('submesh-patch-unsupported-mesh');
  const attributes = structuredClone(d.meshes[0].primitives[0].attributes);
  if (d.accessors[attributes.POSITION].count !== mesh.vertices) throw new Error('submesh-patch-vertex-mismatch');
  for (const name of names) if (d.materials.some(m => m.name === name)) throw new Error(`submesh-patch-already-present:${name}`);
  const parts = [binary, Buffer.alloc((4 - binary.length % 4) % 4)];
  let length = parts.reduce((n, p) => n + p.length, 0);
  const view = (bytes, target) => {
    d.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, ...(target ? { target } : {}) });
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4); parts.push(bytes, padding); length += bytes.length + padding.length;
    return d.bufferViews.length - 1;
  };
  for (const name of names) {
    const s = mesh.submeshes.find(sub => sub.name === name);
    if (!s) throw new Error(`submesh-patch-missing-submesh:${name}`);
    const png = textures[name];
    if (!png && !solidMaterials[name]) throw new Error(`missing-material-texture:${name}`);
    let texture;
    if (png) {
      d.images ??= []; d.textures ??= [];
      d.images.push({ mimeType: 'image/png', bufferView: view(png) });
      d.textures.push({ source: d.images.length - 1, sampler: 0 });
      texture = d.textures.length - 1;
    }
    d.materials.push({ name, pbrMetallicRoughness: { ...(png ? { baseColorTexture: { index: texture } } : { baseColorFactor: solidMaterials[name].factor }), metallicFactor: 0, roughnessFactor: 1 } });
    // Same winding as makeModel: the mirrored X flips handedness.
    const idx = new Uint16Array(s.indexCount);
    for (let i = 0, k = s.startIndex; k < s.startIndex + s.indexCount; i += 3, k += 3) {
      idx[i] = skn.readUInt16LE(mesh.indexOffset + k * 2); idx[i + 1] = skn.readUInt16LE(mesh.indexOffset + (k + 2) * 2); idx[i + 2] = skn.readUInt16LE(mesh.indexOffset + (k + 1) * 2);
    }
    // Same accessor shape as makeModel's index accessors (no min/max).
    d.accessors.push({ bufferView: view(Buffer.from(idx.buffer), 34963), componentType: 5123, count: idx.length, type: 'SCALAR' });
    d.meshes[0].primitives.push({ attributes: structuredClone(attributes), indices: d.accessors.length - 1, material: d.materials.length - 1 });
  }
  d.buffers[0].byteLength = length;
  return writeGlb(d, Buffer.concat(parts));
}

/**
 * One model's patch from its parsed sources: the exported clips' visibility events into the manifest entry, and with
 * `appendGeometry` the hidden submeshes an exported clip or the unit's timed form shows appended to the model. `texture(path)` gives a hidden
 * submesh's diffuse as PNG. With the switch off, `data` is `before` itself.
 */
export async function patchModel({ before, entry, skn, docs, graphEntries, appendGeometry = false, texture, id = '', timedForm = Object.hasOwn(TIMED_FORM_SUBMESHES, id) ? TIMED_FORM_SUBMESHES[id] : [] }) {
  const { createHash } = await import('node:crypto');
  const { skinBindings } = await import('./bin-bindings.mjs');
  const { validateModel } = await import('./model.mjs');
  const hash = b => createHash('sha256').update(b).digest('hex');
  const submeshes = inspectSkn(skn).submeshes.map(s => s.name), binding = skinBindings(docs, submeshes);
  const { events, unresolved } = submeshVisibilityEvents(graphEntries, submeshes);
  const clips = readGlb(before).document.animations.map(a => a.name.toLowerCase());
  const carried = Object.fromEntries(Object.entries(events).filter(([clip]) => clips.includes(clip)).sort(([a], [b]) => a < b ? -1 : 1));
  const plan = submeshPatchPlan({ hidden: binding.hidden, submeshes, events, exportedClips: clips, timedForm });
  const textures = {}, solid = {}, appending = appendGeometry ? plan.append : [];
  for (const { name } of appending) {
    if (binding.hiddenSolidMaterials[name]) { solid[name] = binding.hiddenSolidMaterials[name]; continue; }
    const path = binding.hiddenTextures[name];
    if (!path) throw new Error(`submesh-patch-missing-texture:${id}:${name}:${binding.hiddenTextureErrors[name] ?? 'none'}`);
    textures[name] = await texture(path);
  }
  const after = appendSubmeshes(before, skn, appending.map(a => a.name), textures, solid);
  if (after !== before) validateModel(after);
  const visibility = { ...(appending.length ? { initiallyHidden: appending.map(a => a.name) } : {}), ...(Object.keys(carried).length ? { events: carried } : {}) };
  return { data: after, entry: Object.keys(visibility).length ? { ...entry, submeshVisibility: visibility } : entry,
    report: { before: hash(before), after: hash(after), changed: after !== before, appended: appending, ...(appendGeometry ? {} : { wouldAppend: plan.append }),
      skipped: plan.skipped, events: carried, ...(Object.keys(unresolved).length ? { unresolved } : {}) } };
}

/**
 * The patch over a root's models: for each unit the unit map names, reads its sources from the extraction cache (verified
 * against extraction.json), appends the hidden submeshes an exported clip shows and collects the exported clips'
 * visibility events. `models` maps id → { entry, data }; returns per id the new data (the same Buffer when untouched), the
 * manifest entry to use, and the report row. A unit whose sources this extraction does not carry stays untouched and is
 * reported; a source that is present but changed stops the patch. A compressed model (meshopt) is never patched: the
 * patch runs before compression, so a compressed root has been patched already or is a different pipeline.
 */
export async function patchModels({ models, source, map, appendGeometry = false }) {
  const { readFile } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { parseBin } = await import('./bin.mjs');
  const { skinBindings, canonicalAsset } = await import('./bin-bindings.mjs');
  const { decodeTexture, encodePng } = await import('./texture.mjs');
  const { safeInputPath } = await import('./safe-path.mjs');
  const hash = b => createHash('sha256').update(b).digest('hex');
  const cache = resolve(source), raw = join(cache, 'extracted');
  const read = async (r, p) => readFile(await safeInputPath(r, resolve(r, p)));
  const records = JSON.parse(await read(cache, 'extraction.json'));
  const baseline = new Map(records.files.map(r => [r.path, r])), byCanonical = new Map(records.files.map(r => [canonicalAsset(r.path), r.path]));
  const present = path => baseline.has(path) || byCanonical.has(canonicalAsset(path));
  const verified = async path => {
    const record = baseline.get(path) ?? baseline.get(byCanonical.get(canonicalAsset(path)));
    if (!record) throw new Error(`submesh-patch-missing-source:${path}`);
    const bytes = await read(raw, record.path);
    if (record.sha256 !== hash(bytes) || record.bytes !== bytes.length) throw new Error(`source-hash-mismatch:${record.path}`);
    return bytes;
  };
  const results = {};
  for (const id of [...models.keys()].sort()) {
    const { entry, data: before } = models.get(id), config = map[id];
    if (!config?.sourceName || !config?.mesh) continue;
    const used = readGlb(before).document.extensionsUsed ?? [];
    if (used.includes('EXT_meshopt_compression')) { results[id] = { data: before, entry, report: { before: hash(before), after: hash(before), changed: false, skipped: 'compressed-model' } }; continue; }
    const sknPath = `${config.base}/${config.mesh}`, skinPath = `data/characters/${config.sourceName}/skins/skin0.bin`;
    if (!present(sknPath) || !present(skinPath)) {
      results[id] = { data: before, entry, report: { before: hash(before), after: hash(before), changed: false, sourceUnavailable: [sknPath, skinPath].filter(p => !present(p)) } };
      continue;
    }
    const docs = [];
    for (const path of [skinPath, `data/characters/${config.sourceName}/skins/root.bin`, `characters/${config.sourceName}`])
      if (baseline.has(path)) docs.push(parseBin(await verified(path)));
    const skn = await verified(sknPath), submeshes = inspectSkn(skn).submeshes.map(s => s.name);
    const binding = skinBindings(docs, [...submeshes]);
    const graphDocs = [...docs];
    for (const path of [...new Set(docs.flatMap(d => d.linked).filter(p => /\/animations\/.*\.bin$/i.test(p)))]) graphDocs.push(parseBin(await verified(path.toLowerCase())));
    const graphEntries = graphDocs.flatMap(d => d.entries).filter(e => e.hash === binding.animationGraphHash);
    results[id] = await patchModel({ before, entry, skn, docs, graphEntries, appendGeometry, texture: async path => encodePng(decodeTexture(await verified(path.toLowerCase()))), id });
  }
  return results;
}

/**
 * The pipeline step: reads a complete uncompressed root (after cast-animations, before compression), appends the shown
 * hidden submeshes to the models that have any, and writes every model's exported clips' visibility events into the
 * manifest (`submeshVisibility`). Source files are verified against extraction.json; a missing or changed one stops the
 * step. Payloads it does not patch are copied byte for byte; the report lists each model's sha256 before and after.
 */
export async function buildSubmeshPatch({ from, source = 'assets3d-local/trial/local', out = 'assets3d-local/submesh-patch', units, appendGeometry = false } = {}) {
  const { readFile, realpath } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { loadUnitMap } = await import('./local-config.mjs');
  const { safeInputPath, safeOutputPath, writeOutputFileAtomic } = await import('./safe-path.mjs');
  const { contains } = await import('./merge-root-output.mjs');
  const { createPrecache } = await import('./merge-manifests.mjs');
  const { contracts } = await import('./runtime.mjs');
  if (!from) throw new Error('usage: --from <read-only-complete-root>');
  const hash = b => createHash('sha256').update(b).digest('hex'), json = v => JSON.stringify(v, null, 2) + '\n';
  const root = resolve(from), cache = resolve(source);
  const target = await safeOutputPath(out, { directory: true });
  for (const input of [await realpath(root), await realpath(cache)])
    if (contains(input, target) || contains(target, input)) throw new Error('submesh-patch-output-overlaps-input');
  const read = async (r, p) => readFile(await safeInputPath(r, resolve(r, p)));
  const manifest = JSON.parse(await read(root, 'manifest.json')), precache = JSON.parse(await read(root, 'precache.json'));
  const map = await loadUnitMap(), output = structuredClone(manifest), payloads = new Map(), report = { schemaVersion: 1, models: {} };
  for (const p of precache.files) {
    const bytes = await read(root, p.path);
    if (bytes.length !== p.bytes || hash(bytes) !== p.sha256) throw new Error('input-precache-mismatch');
    payloads.set(p.path, bytes);
  }
  const ids = (units ?? Object.keys(manifest.models)).filter(id => manifest.models[id]);
  const models = new Map(ids.map(id => {
    const entry = manifest.models[id], data = payloads.get(entry.path);
    if (!data) throw new Error(`submesh-patch-model-not-in-precache:${id}`);
    return [id, { entry, data }];
  }));
  for (const [id, result] of Object.entries(await patchModels({ models, source, map, appendGeometry }))) {
    payloads.set(manifest.models[id].path, result.data); output.models[id] = result.entry; report.models[id] = result.report;
  }
  const { assertManifest } = await contracts(); assertManifest(output);
  for (const [path, bytes] of payloads) await writeOutputFileAtomic(join(out, path), bytes, { force: true });
  const index = new Map([...payloads].map(([p, b]) => [p, { bytes: b.length, sha256: hash(b) }]));
  await writeOutputFileAtomic(join(out, 'manifest.json'), json(output), { force: true });
  await writeOutputFileAtomic(join(out, 'precache.json'), json(createPrecache(index)), { force: true });
  for (const file of ['action-bindings.json']) {
    try { await writeOutputFileAtomic(join(out, file), await read(root, file), { force: true }); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  await writeOutputFileAtomic(join(out, 'submesh-patch-report.json'), json(report), { force: true });
  return report;
}

if (process.argv[1] && (await import('node:path')).resolve(process.argv[1]) === (await import('node:url')).fileURLToPath(import.meta.url)) {
  const { argumentsFor } = await import('./plan-fetch.mjs');
  const argv = process.argv.slice(2), appendGeometry = argv.includes('--submesh-geometry');
  const args = argumentsFor(argv.filter(a => a !== '--submesh-geometry'), ['--from', '--source', '--out', '--units']);
  const report = await buildSubmeshPatch({ ...args, units: args.units ? args.units.split(',') : undefined, appendGeometry });
  const changed = Object.entries(report.models).filter(([, m]) => m.changed).map(([id, m]) => `${id}:${m.appended.map(a => a.name).join('+')}`);
  console.log(JSON.stringify({ models: Object.keys(report.models).length, changed }));
}

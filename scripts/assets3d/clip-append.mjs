// Clip append: a unit's timed-form entry and exit clips added to an already compressed model, the model kept byte for byte.
// A timed form (the renderer's TIMED_FORMS) shows its submeshes over every clip; the unit's animation graph also carries a
// clip for entering the form and one for leaving it, which the base export never took (no action names them). This step
// converts those two clips from source, with the same conversion the model build uses, and appends them to the base
// model: every JSON entry and every binary byte of the base is kept, the new keys are stored as plain float views after
// the base's data, and each channel targets the base's joint of the same name. Before appending, a clip the base already
// carries is converted the same way and compared with the base's keys, so the two conversions are known to agree.
// The manifest entry gets `timedFormClips` ({ enter, exit }: the appended clips' names). The output holds only the files
// that change: the models, manifest.json, precache.json and packs.json (the changed models out of their packs).
// Usage: node scripts/assets3d/clip-append.mjs --from <root> --units <id,...> [--source <cache>] [--out <dir>]
//   [--form-source <raw extraction root> --form-character <form character name>]: also the form's own actions
//   (TIMED_FORM_ACTION_KEYS), recorded as the manifest entry's `timedFormAnimations`.

/**
 * Per unit, the animation graph keys (as hashes) of its timed form's entry and exit clips, picked by what the clips do:
 * swain: the clip that grows his wings from nothing to fully spread enters the form; the one that shrinks them to nothing
 * leaves it (Fable 2026-11-21).
 */
export const TIMED_FORM_GRAPH_KEYS = Object.freeze({ swain: Object.freeze({ enter: '0x70eb0dad', exit: '0xe1ad931b' }) });

/**
 * Per unit, the graph keys (as hashes) of the actions its timed form plays instead of the unit's own, in the graph of the
 * form's own character (--form-character, read from --form-source). The form character draws the unit's own mesh and
 * skeleton (checked); its clips are appended to the unit's model like the entry and exit clips.
 * swain: idle, move, attack and the second attack of his ascended form (Fable 2026-11-24), and `enter`, the form's own
 * whole-body entry, which unfolds his wings from folded to spread (Fable 2026-11-24).
 */
export const TIMED_FORM_ACTION_KEYS = Object.freeze({
  swain: Object.freeze({ idle: '0x9dd9dc06', move: '0x2acd4eca', attack: '0x56b1e924', attackAlt: '0x59b1eddd', enter: '0xfd5939c8' }),
});

import { binField, binIs as binIsType } from './bin.mjs';
import { canonicalAsset as canonical } from './bin-bindings.mjs';

const GLB_MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
const pad4 = n => (4 - n % 4) % 4;

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== GLB_MAGIC || bytes.readUInt32LE(16) !== JSON_CHUNK) throw new Error('clip-append-not-glb');
  const jl = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), o = 20 + jl;
  if (bytes.readUInt32LE(o + 4) !== BIN_CHUNK) throw new Error('clip-append-no-bin');
  return { json, bin: bytes.subarray(o + 8, o + 8 + bytes.readUInt32LE(o)) };
}
function writeGlbRaw(json, bin) {
  const text = Buffer.from(JSON.stringify(json)), jsonChunk = Buffer.concat([text, Buffer.alloc(pad4(text.length), 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc(pad4(bin.length))]), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(GLB_MAGIC, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(JSON_CHUNK, 4); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([head, jh, jsonChunk, bh, binChunk]);
}

/** A float accessor of an uncompressed GLB (the donor), as numbers. */
function floats(glb, index) {
  const a = glb.document.accessors[index], v = glb.document.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  if (a.componentType !== 5126 || !n) throw new Error('clip-append-unsupported-donor-accessor');
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? n * 4, out = new Float32Array(a.count * n);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = glb.binary.readFloatLE(start + i * stride + c * 4);
  return { values: out, size: n, accessor: a };
}

/**
 * Appends `clips` (names of the donor's animations) to `base` (a GLB, compressed or not, whose buffer 0 is its BIN
 * chunk). Channels are retargeted by node name. Returns the new GLB; `verify` (assertBaseKept) refuses one that does not
 * keep the base's JSON entries and BIN bytes.
 */
export async function appendClips(base, donorGlb, clips, { verify = assertBaseKept } = {}) {
  const { readGlb } = await import('./glb.mjs');
  const donor = readGlb(donorGlb), b = parseGlb(base), json = structuredClone(b.json);
  if (json.buffers?.[0]?.uri !== undefined || json.buffers[0].byteLength > b.bin.length) throw new Error('clip-append-unsupported-base');
  const nodeByName = new Map(json.nodes.map((n, i) => [n.name, i]));
  if (nodeByName.size !== json.nodes.length) throw new Error('clip-append-duplicate-node-name');
  const parts = [Buffer.from(b.bin.subarray(0, json.buffers[0].byteLength))];
  let length = parts[0].length;
  const view = bytes => {
    const p = pad4(length); if (p) { parts.push(Buffer.alloc(p)); length += p; }
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }); parts.push(bytes); length += bytes.length;
    return json.bufferViews.length - 1;
  };
  const accessor = ({ values, size, accessor: a }, input) => {
    json.accessors.push({ bufferView: view(Buffer.from(values.buffer, values.byteOffset, values.byteLength)), componentType: 5126, count: a.count,
      type: { 1: 'SCALAR', 3: 'VEC3', 4: 'VEC4' }[size], ...(input ? { min: [Math.min(...values)], max: [Math.max(...values)] } : {}) });
    return json.accessors.length - 1;
  };
  json.animations ??= [];
  for (const name of clips) {
    if (json.animations.some(a => a.name === name)) throw new Error(`clip-append-already-present:${name}`);
    const clip = donor.document.animations.find(a => a.name === name);
    if (!clip) throw new Error(`clip-append-missing-donor-clip:${name}`);
    const samplers = [], channels = [];
    for (const channel of clip.channels) {
      const target = nodeByName.get(donor.document.nodes[channel.target.node].name);
      if (target === undefined) throw new Error(`clip-append-missing-node:${donor.document.nodes[channel.target.node].name}`);
      const s = clip.samplers[channel.sampler];
      samplers.push({ input: accessor(floats(donor, s.input), true), output: accessor(floats(donor, s.output), false), interpolation: s.interpolation ?? 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: target, path: channel.target.path } });
    }
    json.animations.push({ name, channels, samplers });
  }
  json.buffers[0] = { ...json.buffers[0], byteLength: length };
  const out = writeGlbRaw(json, Buffer.concat(parts));
  verify(base, out);
  return out;
}

/**
 * Throws unless `out` keeps `base` as it was: every prior JSON entry equal (buffer 0's length is the one field that may
 * grow) and every prior byte of buffer 0 in place.
 */
export function assertBaseKept(base, out) {
  const b = parseGlb(base), check = parseGlb(out);
  for (const key of Object.keys(b.json)) {
    // Buffer 0 grows by the appended views: its length is the one field allowed to change.
    const strip = list => key === 'buffers' ? list.map((x, i) => i ? x : { ...x, byteLength: 0 }) : list;
    const before = Array.isArray(b.json[key]) ? strip(b.json[key]) : b.json[key], after = Array.isArray(check.json[key]) ? strip(check.json[key]) : check.json[key];
    if (Array.isArray(before) ? !Array.isArray(after) || JSON.stringify(after.slice(0, before.length)) !== JSON.stringify(before) : JSON.stringify(after) !== JSON.stringify(before))
      throw new Error(`clip-append-base-changed:${key}`);
  }
  const length = b.json.buffers[0].byteLength;
  if (check.bin.length < length || !check.bin.subarray(0, length).equals(b.bin.subarray(0, length))) throw new Error('clip-append-base-bin-changed');
}

/**
 * Largest difference between a base clip's keys and the same clip converted from source (sampled at the base's key
 * times, rotations compared as quaternions up to sign). The base may be compressed: it is read through glTF-Transform.
 */
export async function clipAgreement(base, donorGlb, name) {
  const { compressionIO } = await import('./compress.mjs');
  const io = await compressionIO();
  const [b, d] = await Promise.all([io.readBinary(new Uint8Array(base)), io.readBinary(new Uint8Array(donorGlb))]);
  const clip = doc => doc.getRoot().listAnimations().find(a => a.getName() === name);
  const bc = clip(b), dc = clip(d);
  if (!bc || !dc) throw new Error(`clip-append-check-clip-missing:${name}`);
  const sample = (sampler, t, n) => {
    const input = sampler.getInput().getArray(), output = sampler.getOutput().getArray();
    let i = 0; while (i < input.length - 1 && input[i + 1] <= t) i++;
    const j = Math.min(i + 1, input.length - 1), f = j === i ? 0 : (t - input[i]) / (input[j] - input[i]);
    return Array.from({ length: n }, (_, k) => output[i * n + k] + (output[j * n + k] - output[i * n + k]) * f);
  };
  const worst = { rotation: 0, translation: 0, scale: 0 };
  let reach = 1;
  for (const ch of bc.listChannels()) {
    const node = ch.getTargetNode().getName(), path = ch.getTargetPath(), n = path === 'rotation' ? 4 : 3;
    const other = dc.listChannels().find(c => c.getTargetNode().getName() === node && c.getTargetPath() === path);
    if (!other) continue;
    const times = ch.getSampler().getInput().getArray();
    for (const t of times) {
      const x = sample(ch.getSampler(), t, n), y = sample(other.getSampler(), t, n);
      const diff = path === 'rotation' ? Math.min(Math.max(...x.map((v, k) => Math.abs(v - y[k]))), Math.max(...x.map((v, k) => Math.abs(v + y[k]))))
        : Math.max(...x.map((v, k) => Math.abs(v - y[k])));
      if (path === 'translation') reach = Math.max(reach, ...x.map(Math.abs));
      worst[path] = Math.max(worst[path], diff);
    }
  }
  // Translations compared against the clip's own reach (its largest joint offset), the others as they are.
  return { ...worst, translationShare: worst.translation / reach, reach };
}

/** The names in `names` that `base` (a GLB) does not carry yet, in order. */
export function clipsToAppend(base, names) {
  const present = new Set((parseGlb(base).json.animations ?? []).map(a => a.name));
  return names.filter(n => !present.has(n));
}

/**
 * The form character's clip for each of `actionKeys` (action → graph key hash), as source paths: parsed `unitSkin` and
 * `formSkin` (skin bins) must name the same skeleton and mesh, and every key must name an atomic clip of `formGraph`.
 */
export function resolveFormActions({ unitSkin, formSkin, formGraph, actionKeys, id = '' }) {
  const meshOf = doc => {
    const props = doc?.entries?.map(e => binField(e, 'skinMeshProperties')).find(Boolean);
    const paths = props && [binField(props, 'skeleton'), binField(props, 'simpleSkin')];
    return paths?.every(p => typeof p === 'string') ? paths.map(p => canonical(p)) : null;
  };
  const own = meshOf(unitSkin), form = meshOf(formSkin);
  if (!own || !form || own[0] !== form[0] || own[1] !== form[1]) throw new Error(`clip-append-form-rig-differs:${id}`);
  const clips = binField(formGraph, 'mClipDataMap'), out = {};
  for (const [action, key] of Object.entries(actionKeys)) {
    const wanted = Number.parseInt(key, 16) >>> 0;
    const found = clips?.entries?.find(([k]) => ((k?.hash ?? k) >>> 0) === wanted)?.[1];
    const path = found && binIsType(found, 'AtomicClipData') ? binField(binField(found, 'mAnimationResourceData'), 'mAnimationFilePath') : undefined;
    if (typeof path !== 'string') throw new Error(`clip-append-form-graph-key:${id}:${key}`);
    out[action] = path;
  }
  return out;
}

/**
 * The step: per unit with TIMED_FORM_GRAPH_KEYS, resolves the graph keys to source clips, converts them (with one clip
 * the base already has, as the agreement check), appends them to the base root's model and records `timedFormClips`.
 */
export async function buildClipAppend({ from, source = 'assets3d-local/trial/local', units, out = 'assets3d-local/clip-append', tolerance = 1e-3, formSource, formCharacter } = {}) {
  const { readFile } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { parseBin, binField: field, binIs } = await import('./bin.mjs');
  const { skinBindings, canonicalAsset } = await import('./bin-bindings.mjs');
  const { inspectSkn } = await import('./inspect-source.mjs');
  const { makeModel } = await import('./model.mjs');
  const { loadUnitMap } = await import('./local-config.mjs');
  const { safeInputPath, writeOutputFileAtomic } = await import('./safe-path.mjs');
  const { contracts } = await import('./runtime.mjs');
  if (!from || !units?.length) throw new Error('usage: --from <root> --units <id,...> [--source <cache>] [--out <dir>]');
  if (!formSource !== !formCharacter) throw new Error('usage: --form-source and --form-character go together');
  const hash = b => createHash('sha256').update(b).digest('hex'), json = v => `${JSON.stringify(v, null, 2)}\n`;
  const root = resolve(from), cache = resolve(source), raw = join(cache, 'extracted');
  const read = async (r, p) => readFile(await safeInputPath(r, resolve(r, p)));
  const manifest = JSON.parse(await read(root, 'manifest.json')), precache = JSON.parse(await read(root, 'precache.json'));
  const packs = await read(root, 'packs.json').then(b => JSON.parse(b), e => { if (e.code === 'ENOENT') return null; throw e; });
  const records = JSON.parse(await read(cache, 'extraction.json'));
  const byPath = new Map(records.files.map(r => [canonicalAsset(r.path), r]));
  const verified = async path => {
    const record = byPath.get(canonicalAsset(path));
    if (!record) throw new Error(`clip-append-missing-source:${path}`);
    const bytes = await read(raw, record.path);
    if (record.sha256 !== hash(bytes) || record.bytes !== bytes.length) throw new Error(`source-hash-mismatch:${record.path}`);
    return bytes;
  };
  const map = await loadUnitMap(), report = { schemaVersion: 1, from: root, units: {} }, changed = new Map();
  for (const id of units) {
    const keys = Object.hasOwn(TIMED_FORM_GRAPH_KEYS, id) ? TIMED_FORM_GRAPH_KEYS[id] : null, config = map[id], entry = manifest.models[id];
    if (!keys || !config || !entry) throw new Error(`clip-append-unknown-unit:${id}`);
    const docs = [];
    for (const path of [`data/characters/${config.sourceName}/skins/skin0.bin`, `data/characters/${config.sourceName}/skins/root.bin`, `characters/${config.sourceName}`])
      if (byPath.has(canonicalAsset(path))) docs.push(parseBin(await verified(path)));
    const skn = await verified(`${config.base}/${config.mesh}`), skl = await verified(`${config.base}/${config.skeleton}`);
    const submeshes = inspectSkn(skn).submeshes.map(s => s.name), binding = skinBindings(docs, [...submeshes]);
    const graphDocs = [...docs];
    for (const path of [...new Set(docs.flatMap(d => d.linked).filter(p => /\/animations\/.*\.bin$/i.test(p)))]) graphDocs.push(parseBin(await verified(path.toLowerCase())));
    const graph = graphDocs.flatMap(d => d.entries).find(e => e.hash === binding.animationGraphHash);
    const clipMap = field(graph, 'mClipDataMap');
    const clipPath = key => {
      const wanted = Number.parseInt(key, 16) >>> 0;
      const found = clipMap?.entries.find(([k]) => ((k?.hash ?? k) >>> 0) === wanted)?.[1];
      if (!found || !binIs(found, 'AtomicClipData')) throw new Error(`clip-append-graph-key:${id}:${key}`);
      return field(field(found, 'mAnimationResourceData'), 'mAnimationFilePath');
    };
    const name = path => path.split('/').at(-1).replace(/(?:\.tft_set13)?\.anm$/i, '').toLowerCase();
    const enterPath = clipPath(keys.enter), exitPath = clipPath(keys.exit);
    // One clip the base already carries, converted the same way, for the agreement check.
    const checkName = entry.animations.idle, checkFile = config.animationFiles?.[checkName];
    if (!checkFile) throw new Error(`clip-append-no-check-clip:${id}`);
    const sources = [{ name: name(enterPath), bytes: await verified(enterPath.toLowerCase()) }, { name: name(exitPath), bytes: await verified(exitPath.toLowerCase()) },
      { name: checkName, bytes: await verified(`${config.base}/${checkFile}`) }];
    // The form's own actions, from its character's graph (a raw extraction: each file's sha256 goes in the report).
    const actionKeys = Object.hasOwn(TIMED_FORM_ACTION_KEYS, id) ? TIMED_FORM_ACTION_KEYS[id] : null, formActions = {}, formFiles = {};
    if (actionKeys && formSource) {
      const formRoot = resolve(formSource), formRead = async path => {
        const bytes = await read(formRoot, path.toLowerCase()); formFiles[path.toLowerCase()] = hash(bytes); return bytes; };
      const paths = resolveFormActions({ unitSkin: docs[0], formSkin: parseBin(await formRead(`data/characters/${formCharacter}/skins/skin0.bin`)),
        formGraph: parseBin(await formRead(`data/characters/${formCharacter}/animations/skin0.bin`)).entries.find(e => field(e, 'mClipDataMap')), actionKeys, id });
      for (const [action, path] of Object.entries(paths)) {
        formActions[action] = name(path);
        if (!sources.some(s => s.name === formActions[action])) sources.push({ name: formActions[action], bytes: await formRead(path) });
      }
    }
    const solid = Object.fromEntries(submeshes.filter(s => !binding.hidden.includes(s)).map(s => [s, { factor: [1, 1, 1, 1] }]));
    const donor = makeModel(skn, skl, sources, {}, { hiddenSubmeshes: binding.hidden, solidMaterials: solid }).glb;
    const before = await read(root, entry.path);
    const agreement = await clipAgreement(before, donor, checkName);
    if (!(agreement.rotation <= tolerance && agreement.scale <= tolerance && agreement.translationShare <= tolerance))
      throw new Error(`clip-append-conversion-disagrees:${id}:${JSON.stringify(agreement)}`);
    // Clips the base already carries (an earlier run's entry and exit) stay as they are.
    const wanted = sources.filter(s => s.name !== checkName).map(s => s.name), appended = clipsToAppend(before, wanted);
    const after = appended.length ? await appendClips(before, donor, appended) : before;
    changed.set(entry.path, after);
    manifest.models[id] = { ...entry, timedFormClips: { enter: sources[0].name, exit: sources[1].name },
      ...(Object.keys(formActions).length ? { timedFormAnimations: formActions } : {}) };
    report.units[id] = { appended, checkClip: checkName, agreement, before: hash(before), after: hash(after), path: entry.path,
      ...(Object.keys(formFiles).length ? { formFiles } : {}) };
    report.units[id].kept = wanted.filter(n => !appended.includes(n));
  }
  const { assertManifest } = await contracts(); assertManifest(manifest);
  const overlay = join(out, 'overlay');
  for (const [path, data] of changed) await writeOutputFileAtomic(join(overlay, path), data, { force: true });
  for (const file of precache.files) if (changed.has(file.path)) { const data = changed.get(file.path); file.bytes = data.length; file.sha256 = hash(data); }
  await writeOutputFileAtomic(join(overlay, 'manifest.json'), json(manifest), { force: true });
  await writeOutputFileAtomic(join(overlay, 'precache.json'), json(precache), { force: true });
  if (packs) {
    for (const pack of packs.packs) pack.files = pack.files.filter(f => !changed.has(f.path));
    await writeOutputFileAtomic(join(overlay, 'packs.json'), JSON.stringify(packs), { force: true });
  }
  await writeOutputFileAtomic(join(out, 'clip-append-report.json'), json(report), { force: true });
  return report;
}

if (process.argv[1] && (await import('node:path')).resolve(process.argv[1]) === (await import('node:url')).fileURLToPath(import.meta.url)) {
  const { argumentsFor } = await import('./plan-fetch.mjs');
  const args = argumentsFor(process.argv.slice(2), ['--from', '--source', '--out', '--units', '--form-source', '--form-character']);
  const report = await buildClipAppend({ ...args, formSource: args['form-source'] ?? args.formSource, formCharacter: args['form-character'] ?? args.formCharacter, units: args.units?.split(',') });
  console.log(JSON.stringify(Object.fromEntries(Object.entries(report.units).map(([id, u]) => [id, { appended: u.appended, agreement: u.agreement, after: u.after.slice(0, 12) }]))));
}

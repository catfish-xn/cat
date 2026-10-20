// Offline full-root merger. Input roots (including already merged roots) are read-only.
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from './runtime.mjs';
import { safeInputPath } from './safe-path.mjs';
import { readGlb } from './glb.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { mergeFxManifestEntries } from './merge-fx-roots.mjs';
import { contains, realOutput, publishRoot, ROOT_GENERATOR } from './merge-root-output.mjs';

const json = v => Buffer.from(JSON.stringify(v, null, 2) + '\n');
const hash = v => createHash('sha256').update(v).digest('hex');
const equal = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a).sort();
  return JSON.stringify(keys) === JSON.stringify(Object.keys(b).sort()) && keys.every(k => equal(a[k], b[k]));
};
function pathKey(path) {
  if (typeof path !== 'string' || !path || /[\\:%?#\x00-\x1f]/.test(path) || path.startsWith('/') ||
    path.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')) throw new Error('unsafe-merge-path');
  return path;
}
function checkKeys(value, kind) {
  const folded = new Map();
  for (const id of Object.keys(value ?? {})) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error(`invalid-${kind}-id:${id}`);
    const lower = id.toLowerCase();
    if (folded.has(lower)) throw new Error(`merge-key-case-conflict:${kind}:${id}`);
    folded.set(lower, id);
  }
}

export async function buildAssetRoot({ roots, out, force = false } = {}) {
  const selected = Array.isArray(roots) ? roots : (roots ?? '').split(',');
  if (!selected.length || selected.some(p => !p) || !out) throw new Error('usage: --roots <root> [<root> ...] --out <root> [--force]');
  const output = await realOutput(out), inputs = [], sources = [];
  const { assertManifest, parseParticleDocument } = await contracts();
  for (const path of selected) {
    const root = await realpath(resolve(path));
    if (contains(root, output) || contains(output, root)) throw new Error('merge-output-overlaps-source');
    if (sources.includes(root)) throw new Error('duplicate-merge-root');
    sources.push(root);
  }
  const bytes = async (index, path) => readFile(await safeInputPath(sources[index], join(sources[index], pathKey(path))));
  for (const [i] of sources.entries()) {
    const manifest = JSON.parse(await bytes(i, 'manifest.json')); assertManifest(manifest);
    for (const kind of ['models', 'effects', 'actionEffects']) checkKeys(manifest[kind], kind);
    let bindings = {};
    try { bindings = JSON.parse(await bytes(i, 'action-bindings.json')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error('invalid-action-bindings');
    if (bindings.actionEffects && !equal(bindings.actionEffects, manifest.actionEffects ?? {})) throw new Error('conflicting-action-bindings');
    for (const kind of ['playback', 'notes', 'variants']) checkKeys(bindings[kind], kind);
    for (const id of Object.keys(bindings.playback ?? {})) if (!Object.hasOwn(manifest.effects ?? {}, id)) throw new Error(`invalid-playback-reference:${id}`);
    for (const actions of Object.values(bindings.variants ?? {})) {
      checkKeys(actions, 'variant-unit');
      assertManifest({ ...manifest, actionEffects: actions });
    }
    inputs.push({ manifest, bindings });
  }
  const merged = mergeFxManifestEntries(inputs);
  assertManifest(merged.manifest);
  for (const kind of ['models', 'effects', 'actionEffects']) checkKeys(merged.manifest[kind], kind);
  for (const actions of Object.values(merged.bindings.variants)) assertManifest({ ...merged.manifest, actionEffects: actions });
  for (const id of Object.keys(merged.bindings.playback)) if (!Object.hasOwn(merged.manifest.effects, id)) throw new Error(`invalid-playback-reference:${id}`);
  const payloads = new Map(), folded = new Map(), provenance = { models: {}, effects: {}, actionEffects: {}, playback: {}, variants: {}, notes: {}, unavailable: [], payloads: {} };
  const plan = (path, data, index) => {
    pathKey(path);
    const lower = path.toLowerCase();
    for (const [key, original] of folded) {
      if ((key === lower && original !== path) || key.startsWith(lower + '/') || lower.startsWith(key + '/')) throw new Error(`merge-path-case-conflict:${path}`);
    }
    folded.set(lower, path);
    const previous = payloads.get(path), sha256 = hash(data);
    if (previous && previous.sha256 !== sha256) throw new Error(`merge-path-conflict:${path}`);
    payloads.set(path, { data, bytes: data.length, sha256 });
    provenance.payloads[path] = sources[index];
  };
  const resource = async (i, path) => {
    pathKey(path);
    const target = `roots/${i}/${path}`;
    plan(target, await bytes(i, path), i);
    return target;
  };
  for (const [id, i] of Object.entries(merged.owners.models)) {
    const path = inputs[i].manifest.models[id].path, data = await bytes(i, path);
    const doc = readGlb(data).document;
    if ([...(doc.buffers ?? []), ...(doc.images ?? [])].some(e => e.uri && !e.uri.startsWith('data:'))) throw new Error('merge-requires-self-contained-glb');
    plan(merged.manifest.models[id].path, data, i);
    provenance.models[id] = sources[i];
  }
  for (const [id, i] of Object.entries(merged.owners.effects)) {
    const doc = structuredClone(parseParticleDocument(JSON.parse(await bytes(i, inputs[i].manifest.effects[id].path))));
    for (const emitter of doc.emitters) {
      for (const field of ['texture', 'mesh']) if (emitter[field]) emitter[field] = await resource(i, emitter[field]);
      if (emitter.distortion?.normalMap) emitter.distortion.normalMap = await resource(i, emitter.distortion.normalMap);
    }
    parseParticleDocument(doc);
    plan(merged.manifest.effects[id].path, json(doc), i);
    provenance.effects[id] = sources[i];
  }
  for (const [i, { manifest, bindings }] of inputs.entries()) {
    for (const unit of Object.keys(manifest.actionEffects ?? {})) {
      provenance.actionEffects[unit] = sources[i];
      for (const actions of Object.values(provenance.variants)) delete actions[unit];
    }
    for (const id of Object.keys(manifest.effects ?? {})) {
      delete provenance.playback[id];
      if (bindings.playback?.[id]) provenance.playback[id] = sources[i];
    }
    for (const [variant, actions] of Object.entries(bindings.variants ?? {})) {
      for (const unit of Object.keys(actions)) (provenance.variants[variant] ??= {})[unit] = sources[i];
    }
    for (const unit of Object.keys(bindings.notes ?? {})) provenance.notes[unit] = sources[i];
    for (const row of bindings.unavailable ?? []) {
      if (!inputs.slice(i + 1).some(({ manifest: later }) => Object.hasOwn(later.actionEffects ?? {}, row.unit))) provenance.unavailable.push(sources[i]);
    }
  }
  for (const [variant, actions] of Object.entries(provenance.variants)) if (!Object.keys(actions).length) delete provenance.variants[variant];
  const report = { schemaVersion: 1, generator: ROOT_GENERATOR, ready: true, roots: sources, convention: 'later-input-root-wins',
    models: Object.keys(merged.manifest.models).length, effects: Object.keys(merged.manifest.effects).length,
    files: payloads.size, bytes: [...payloads.values()].reduce((n, p) => n + p.bytes, 0), sources: provenance };
  const files = new Map([...payloads].map(([path, p]) => [path, p.data]));
  files.set('manifest.json', json(merged.manifest));
  files.set('action-bindings.json', json(merged.bindings));
  files.set('precache.json', json(createPrecache(payloads)));
  files.set('merge-report.json', json(report));
  await publishRoot(output, files, force);
  return report;
}

export function buildArguments(args) {
  const result = { roots: [], force: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--roots') {
      const start = result.roots.length;
      while (args[i + 1] && !args[i + 1].startsWith('--')) result.roots.push(...args[++i].split(','));
      if (result.roots.length === start) throw new Error('missing-merge-roots');
    } else if (args[i] === '--out' && args[i + 1] && !args[i + 1].startsWith('--') && !result.out) result.out = args[++i];
    else if (args[i] === '--force' && !result.force) result.force = true;
    else throw new Error(`invalid-merge-argument:${args[i]}`);
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { sources, ...summary } = await buildAssetRoot(buildArguments(process.argv.slice(2)));
    console.log(JSON.stringify(summary));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}

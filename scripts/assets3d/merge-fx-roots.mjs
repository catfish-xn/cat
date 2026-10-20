// Offline, self-contained shell root. Inputs are read-only; later roots win.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumentsFor } from './plan-fetch.mjs';
import { contracts } from './runtime.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';
import { readGlb } from './glb.mjs';

export function mergeManifestEntries(inputs) {
  const manifest = { schemaVersion: 1, models: {}, effects: {}, actionEffects: {} };
  const owners = { models: {}, effects: {} }, playback = {}, variants = {}, notes = {};
  for (const [index, { manifest: input, bindings = {} }] of inputs.entries()) {
    for (const type of ['models', 'effects']) for (const [id, entry] of Object.entries(input[type] ?? {})) {
      manifest[type][id] = { ...entry, path: `roots/${index}/${entry.path}` };
      owners[type][id] = index;
      if (type === 'effects') {
        delete playback[id];
        if (bindings.playback?.[id]) playback[id] = bindings.playback[id];
      }
    }
    Object.assign(manifest.actionEffects, input.actionEffects ?? {});
    Object.assign(notes, bindings.notes ?? {});
    // A newer action plan owns all alternatives for that unit, including removal.
    for (const unit of Object.keys(input.actionEffects ?? {})) for (const actions of Object.values(variants)) delete actions[unit];
    for (const [variant, actions] of Object.entries(bindings.variants ?? {})) Object.assign(variants[variant] ??= {}, actions);
  }
  for (const [variant, actions] of Object.entries(variants)) if (!Object.keys(actions).length) delete variants[variant];
  return { manifest, owners, bindings: { schemaVersion: 1, status: 'approximated', convention: 'later-input-root-wins',
    actionEffects: manifest.actionEffects, playback, variants, notes,
    unavailable: inputs.flatMap(({ bindings = {} }, i) => (bindings.unavailable ?? []).filter(r =>
      !inputs.slice(i + 1).some(({ manifest: m }) => Object.hasOwn(m.actionEffects ?? {}, r.unit)))) } };
}

export async function mergeManifests({ roots = '', out = 'assets3d-local/fx-pilot/merged', force = false } = {}) {
  const local = resolve('assets3d-local'), pilot = resolve(local, 'fx-pilot');
  const output = withinRoot(pilot, resolve(out), 'pilot-merge-output-only');
  if (output === pilot) throw new Error('pilot-merge-output-only');
  await safeOutputPath(output, { directory: true });
  const selected = roots.split(',').map(p => withinRoot(local, resolve(p), 'merge-input-outside-local'));
  if (!roots || new Set(selected).size !== selected.length || selected.some(p => p === output || p.startsWith(output + '/') || p.startsWith(output + '\\'))) throw new Error('invalid-merge-roots');
  const { assertManifest, parseParticleDocument, assetUrl } = await contracts();
  const bytes = (root, path) => safeInputPath(root, resolve(root, path)).then(p => readFile(p));
  const inputs = [];
  for (const root of selected) {
    const manifest = JSON.parse(await bytes(root, 'manifest.json')); assertManifest(manifest);
    let bindings;
    try { bindings = JSON.parse(await bytes(root, 'action-bindings.json')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    inputs.push({ manifest, bindings });
  }
  const merged = mergeManifestEntries(inputs);
  assertManifest(merged.manifest);
  for (const actions of Object.values(merged.bindings.variants)) assertManifest({ ...merged.manifest, actionEffects: actions });
  const write = (path, data) => writeOutputFile(join(output, path), data, { force });
  const copied = new Set();
  const resource = async (index, path) => {
    assetUrl('', path);
    const target = `roots/${index}/${path}`;
    if (!copied.has(target)) { await write(target, await bytes(selected[index], path)); copied.add(target); }
    return target;
  };
  for (const [id, index] of Object.entries(merged.owners.models)) {
    const path = inputs[index].manifest.models[id].path;
    const doc = readGlb(await bytes(selected[index], path)).document;
    if ([...(doc.buffers ?? []), ...(doc.images ?? [])].some(e => e.uri && !e.uri.startsWith('data:'))) throw new Error('merge-requires-self-contained-glb');
    await resource(index, path);
  }
  for (const [id, index] of Object.entries(merged.owners.effects)) {
    const path = inputs[index].manifest.effects[id].path;
    const doc = structuredClone(parseParticleDocument(JSON.parse(await bytes(selected[index], path))));
    for (const emitter of doc.emitters) {
      for (const field of ['texture', 'mesh']) if (emitter[field]) emitter[field] = await resource(index, emitter[field]);
      if (emitter.distortion?.normalMap) emitter.distortion.normalMap = await resource(index, emitter.distortion.normalMap);
    }
    parseParticleDocument(doc);
    await write(merged.manifest.effects[id].path, JSON.stringify(doc, null, 2) + '\n');
  }
  await write('action-bindings.json', JSON.stringify(merged.bindings, null, 2) + '\n');
  await write('manifest.json', JSON.stringify(merged.manifest, null, 2) + '\n');
  return { models: Object.keys(merged.manifest.models).length, effects: Object.keys(merged.manifest.effects).length, resources: copied.size };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await mergeManifests(argumentsFor(process.argv.slice(2), ['--roots', '--out']))));

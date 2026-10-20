// Offline, self-contained shell root. Inputs are read-only; later roots win.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumentsFor } from './plan-fetch.mjs';

export function mergeFxManifestEntries(inputs) {
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

export async function mergeFxRoots(options = {}) {
  const { buildAssetRoot } = await import('./build-asset-root.mjs');
  return buildAssetRoot(options);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await mergeFxRoots(argumentsFor(process.argv.slice(2), ['--roots', '--out']))));

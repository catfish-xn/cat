// Compare existing local outputs; never writes into the legacy linked root.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Euler, Quaternion } from 'three';
import { batchOutputRoot } from './fx-batch.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';

export async function comparePilot() {
  const root = await batchOutputRoot('assets3d-local/fx-pilot'), old = resolve('assets3d-local/fx-trial');
  const read = async (base, path) => JSON.parse(await readFile(await safeInputPath(base, join(base, path)), 'utf8'));
  const before = await read(old, 'action-bindings.json'), after = await read(root, 'action-bindings.json');
  for (const field of ['actionEffects', 'variants'])
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) throw new Error('pilot-binding-semantics-changed:' + field);
  const placement = spec => Object.fromEntries(['phase', 'anchor', 'bone', 'delay', 'maxDuration'].filter(k => spec[k] !== undefined).map(k => [k, spec[k]]));
  for (const [id, spec] of Object.entries(before.playback))
    if (JSON.stringify(placement(spec)) !== JSON.stringify(placement(after.playback[id] ?? {}))) throw new Error('pilot-playback-semantics-changed');
  const sizes = await read(root, 'size-report.json'), previous = await read(root, 'old-size-report.json');
  const rows = sizes.results.map(r => {
    const prior = previous.results.find(p => p.effectId === r.effectId);
    if (!prior) throw new Error('missing-legacy-size-sample');
    return { unit: r.unit, action: r.action, effectId: r.effectId, beforeCells: prior.cells, afterCells: r.cells,
      ratio: prior.cells ? r.cells / prior.cells : null,
      opacityVisibleCells: Math.max(0, ...r.emitters.map(e => e.opacityVisibleCells)),
      reviewCells: Math.max(0, ...r.emitters.map(e => e.reviewCells)) };
  });
  const a = await read(old, 'manifest.json'), b = await read(root, 'manifest.json');
  let matched = 0, rotationChanged = 0, rotationUncompared = 0, blendChanged = 0, removed = 0, added = 0;
  const rotation = value => {
    const xyz = value === undefined ? [0, 0, 0] : typeof value === 'number' ? [0, 0, value] : value;
    return Array.isArray(xyz) && xyz.length === 3 ? new Quaternion().setFromEuler(new Euler(...xyz.map(v => v * Math.PI / 180), 'XYZ')) : null;
  };
  const inventory = async (base, entry, id) => {
    const doc = await read(base, entry.path);
    const accepted = id.startsWith('global_') ? doc.emitters.map((_, i) => ({ originalFields: { emitterName: `shared-${i}` } }))
      : (await read(base, entry.path.replace(/\.json$/, '.report.json'))).emitters.filter(e => ['mapped', 'approximated'].includes(e.status));
    const seen = new Map();
    return new Map(doc.emitters.map((e, i) => {
      const name = accepted[i].originalFields.emitterName, occurrence = seen.get(name) ?? 0;
      seen.set(name, occurrence + 1);
      return [`${name}:${occurrence}`, e];
    }));
  };
  for (const [id, entry] of Object.entries(b.effects)) {
    if (!a.effects[id]) continue;
    const prior = await inventory(old, a.effects[id], id), next = await inventory(root, entry, id);
    for (const [key, e] of next) {
      const p = prior.get(key);
      if (!p) { added++; continue; }
      matched++;
      const q = rotation(e.rotation0), oldQ = rotation(p.rotation0);
      if (q && oldQ) rotationChanged += q.angleTo(oldQ) > 1e-6 ? 1 : 0;
      else rotationUncompared++;
      blendChanged += (e.blend ?? 'normal') !== (p.blend ?? 'normal') ? 1 : 0;
    }
    removed += [...prior.keys()].filter(k => !next.has(k)).length;
  }
  const summary = { bindingsPreserved: true, commonScale: sizes.fxScale, rows,
    emitterComparison: { matched, rotationChanged, rotationUncompared, blendChanged, removed, added } };
  await writeOutputFile(join(root, 'comparison-report.json'), JSON.stringify(summary, null, 2) + '\n', { force: true });
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await comparePilot()));

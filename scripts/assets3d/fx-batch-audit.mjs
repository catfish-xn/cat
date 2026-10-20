// Offline artifact verification. Original fields stay in the selected local batch root.
import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Euler, Quaternion, Vector3, Matrix3, Matrix4 } from 'three';
import { batchOutputRoot, batchActionBindings, loadBindingTables } from './fx-batch.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';
import { contracts } from './runtime.mjs';
import { approximateEmitter } from './particle-approximate.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { readGlb } from './glb.mjs';
import { argumentsFor } from './plan-fetch.mjs';

export async function auditBatch({ out = 'assets3d-local/fx-batch3' } = {}) {
  const root = await batchOutputRoot(out);
  const bytes = p => safeInputPath(root, join(root, p)).then(p => readFile(p));
  const read = async p => JSON.parse(await bytes(p));
  const manifest = await read('manifest.json'), bindings = await read('action-bindings.json');
  const rows = await read('systems.json'), bones = await read('bones.json'), tables = await loadBindingTables();
  const { assertManifest, parseParticleDocument } = await contracts();
  assertManifest(manifest);
  const rebuilt = batchActionBindings(manifest, rows, bones, Object.fromEntries(Object.keys(manifest.models).map(u => [u, tables[u]])));
  if (JSON.stringify(rebuilt) !== JSON.stringify(bindings)) throw new Error('binding-mismatch');
  let references = 0;
  for (const [unit, model] of Object.entries(manifest.models)) {
    const b = await bytes(model.path), original = await readFile(await safeInputPath(resolve('assets3d-local/all-anim'), resolve('assets3d-local/all-anim', model.path)));
    if (!b.equals(original)) throw new Error('model-byte-mismatch');
    const g = readGlb(b).document;
    const actual = [...new Set(g.skins.flatMap(s => s.joints.map(i => g.nodes[i].name)))];
    if (JSON.stringify(actual) !== JSON.stringify(bones[unit])) throw new Error('bone-list-mismatch');
  }
  const orientations = [], blends = [], modes = {};
  for (const [id, effect] of Object.entries(manifest.effects)) {
    const doc = parseParticleDocument(await read(effect.path));
    for (const e of doc.emitters) for (const p of [e.texture, e.mesh].filter(Boolean)) { await bytes(p); references++; }
    if (id.startsWith('global_')) continue;
    const report = await read(effect.path.replace(/\.json$/, '.report.json'));
    const accepted = report.emitters.filter(e => ['mapped', 'approximated'].includes(e.status));
    for (const [index, e] of doc.emitters.entries()) {
      const source = accepted[index].originalFields;
      const alpha = e.texture ? pngHasEffectiveAlpha(await bytes(e.texture)) : undefined;
      const mode = source.blendMode;
      const expected = ['normal', 'additive', 'multiply'].includes(mode) ? mode
        : ({ 1: 'normal', 2: 'additive', 3: 'normal', 4: 'additive' })[mode] ?? (alpha === false ? 'additive' : 'normal');
      if ((e.blend ?? 'normal') !== expected) throw new Error('blend-mismatch:' + id + ':' + index);
      const group = modes[String(mode ?? 'missing')] ??= { count: 0, opaque: 0, alpha: 0 };
      group.count++; group[alpha === false ? 'opaque' : 'alpha']++;
      blends.push({ effectId: id, index, mode, alpha, mapped: expected });
      if (!['arbitraryQuad', 'mesh'].includes(e.kind)) continue;
      const adapted = approximateEmitter(source, {}, {});
      const rotation = adapted.source?.birthRotation0?.constantValue ?? [0, 0, 0];
      const q = new Quaternion().setFromEuler(new Euler(rotation[0] * Math.PI / 180, -rotation[1] * Math.PI / 180, -rotation[2] * Math.PI / 180, 'YXZ'));
      const actual = new Quaternion().setFromEuler(new Euler(...(e.rotation0 ?? [0, 0, 0]).map(v => v * Math.PI / 180), 'XYZ'));
      if (q.angleTo(actual) > 1e-6) throw new Error('fixed-orientation-mismatch');
      let thinAxis = 2, dimensions;
      if (e.kind === 'mesh') {
        const g = readGlb(await bytes(e.mesh)).document;
        const a = g.accessors[g.meshes[0].primitives[0].attributes.POSITION];
        dimensions = a.max.map((v, i) => v - a.min[i]);
        thinAxis = dimensions.indexOf(Math.min(...dimensions));
      }
      const normal = new Vector3(...[0, 1, 2].map(i => i === thinAxis ? 1 : 0)).applyQuaternion(actual);
      if (e.localTransform) normal.applyMatrix3(new Matrix3().getNormalMatrix(new Matrix4().fromArray(e.localTransform))).normalize();
      orientations.push({ effectId: id, index, kind: e.kind, ground: !!source.isGroundLayer, dimensions, thinAxis, normal: normal.toArray(), horizontal: Math.abs(normal.y) > .999 });
    }
  }
  const sizes = await read('size-report.json');
  const oversized = sizes.results.flatMap(r => r.emitters.filter(e => e.nonzeroSurface && e.cells > 3).map(e => ({
    effectId: r.effectId, index: e.index, cells: e.cells, kind: e.kind,
    fields: Object.fromEntries(['emitterName', 'birthScale0', 'scale0', 'isUniformScale', 'primitive'].filter(k => e.originalFields[k] !== undefined).map(k => [k, e.originalFields[k]])),
    meshSourceXYZ: e.meshSourceXYZ, mappedSize0: e.mappedSize0, mappedSize: e.mappedSize,
  })));
  const result = { models: Object.keys(manifest.models).length, effects: Object.keys(manifest.effects).length,
    references, bindings: Object.values(manifest.actionEffects).reduce((n, a) => n + a.attack.length + a.cast.length, 0),
    realDirectory: !(await lstat(root)).isSymbolicLink(), modes, blends, orientations, oversized };
  await writeOutputFile(join(root, 'audit-report.json'), JSON.stringify(result, null, 2) + '\n', { force: true });
  return { ...result, blends: blends.length, orientations: orientations.length, oversized: oversized.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await auditBatch(argumentsFor(process.argv.slice(2), ['--out']))));

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readGlb } from './glb.mjs';
import { safeInputPath } from './safe-path.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** The converter appends exclusive animation accessors/views after all model data.
 * Compare every other JSON field and every non-animation view's exact bytes.
 * Keep existing animation curves too; adding cast cannot alter prior actions. */
export function modelContent(glb) {
  const { document: doc, binary } = readGlb(glb);
  const view = index => {
    const { byteOffset = 0, ...metadata } = doc.bufferViews[index];
    return { ...metadata, sha256: hash(binary.subarray(byteOffset, byteOffset + metadata.byteLength)) };
  };
  const accessor = index => {
    const { bufferView, ...metadata } = doc.accessors[index];
    return { ...metadata, view: view(bufferView) };
  };
  const animations = Object.fromEntries((doc.animations ?? []).map(a => [a.name, {
    ...a, samplers: a.samplers.map(s => ({ ...s, input: accessor(s.input), output: accessor(s.output) }))
  }]));
  const used = new Set((doc.animations ?? []).flatMap(a => a.samplers.flatMap(s => [s.input, s.output])));
  const animationViews = new Set([...used].map(i => doc.accessors[i].bufferView));
  for (const [i, a] of (doc.accessors ?? []).entries())
    if (!used.has(i) && animationViews.has(a.bufferView)) throw new Error('shared-animation-model-view');
  const { animations: _animations, buffers: _buffers, accessors: _accessors, bufferViews: _views, ...other } = doc;
  return { model: { ...other, accessors: doc.accessors.flatMap((_, i) => used.has(i) ? [] : [accessor(i)]),
    views: doc.bufferViews.flatMap((_, i) => animationViews.has(i) ? [] : [view(i)]) }, animations };
}
export function compareAnimationRebuild(before, after, unchangedActions) {
  const a = modelContent(before), b = modelContent(after);
  return { beforeSha256: hash(before), afterSha256: hash(after),
    nonAnimationEqual: isDeepStrictEqual(a.model, b.model),
    priorAnimationsEqual: Object.entries(a.animations).every(([name, value]) => isDeepStrictEqual(value, b.animations[name])),
    ...(unchangedActions ? { wholeGlbEqual: before.equals(after) } : {}) };
}
export async function verifyAnimationRebuild({ before = ['assets3d-local/out/batch-cost12', 'assets3d-local/out/batch-cost345'],
  after = ['assets3d-local/out-anim/batch-cost12', 'assets3d-local/out-anim/batch-cost345'] } = {}) {
  if (before.length !== after.length) throw new Error('batch-pair-count-mismatch');
  const units = {};
  for (let i = 0; i < before.length; i++) {
    const oldRoot = resolve(before[i]), newRoot = resolve(after[i]);
    const read = async (root, path) => readFile(await safeInputPath(root, join(root, path)));
    const oldReport = JSON.parse(await read(oldRoot, 'build-report.json'));
    const newReport = JSON.parse(await read(newRoot, 'build-report.json'));
    if (!oldReport.ready || !newReport.ready) throw new Error('batch-not-ready');
    if (!isDeepStrictEqual(Object.keys(oldReport.units).sort(), Object.keys(newReport.units).sort())) throw new Error('batch-unit-set-mismatch');
    for (const [id, u] of Object.entries(oldReport.units)) {
      if (Object.hasOwn(units, id)) throw new Error(`duplicate-unit:${id}`);
      const path = `units/${id}/models/${id}/model.glb`;
      units[id] = compareAnimationRebuild(await read(oldRoot, path), await read(newRoot, path),
        isDeepStrictEqual(u.animations.mapped, newReport.units[id].animations.mapped));
    }
  }
  return { ready: Object.values(units).every(u => u.nonAnimationEqual && u.priorAnimationsEqual && u.wholeGlbEqual !== false), units };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('usage: verify-animation-rebuild.mjs (default batch pairs)');
    const report = await verifyAnimationRebuild(); console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

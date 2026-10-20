// Offline aggregate audit. Local evidence uses source ordinals, never copies
// textures or per-emitter original values into the shareable documentation.
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchOutputRoot } from './fx-batch.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { contracts } from './runtime.mjs';
import { PerspectiveCamera, Vector3 } from 'three';

export function rayFieldGroups(emitter, system = {}) {
  const has = key => Object.hasOwn(emitter, key);
  const flag = key => emitter[key] === 1 || emitter[key] === true;
  return Object.fromEntries([
    ['birthRotation0', has('birthRotation0')], ['rotation0', has('rotation0')],
    ['rotationOverride', has('rotationOverride')], ['system.transform', !!system.transform],
    ...['isLocalOrientation', 'particleIsLocalOrientation', 'isGroundLayer', 'useNavmeshMask', 'isFollowingTerrain'].flatMap(key =>
      [[key + '.present', has(key)], [key + '.enabled', flag(key)]]),
    ...['bindWeight', 'boneToSpawnAt', 'birthVelocity', 'velocity', 'EmitterPosition', 'SpawnShape'].map(key => [key, has(key)]),
    ['birthRotation0.probability', !!emitter.birthRotation0?.dynamics?.probabilityTables],
    ['SpawnShape.rotation', !!emitter.SpawnShape?.emitRotationAxes],
    ['SpawnShape.planar', emitter.SpawnShape?.__type === 'VfxShapeCylinder' && emitter.SpawnShape.height === 0 && emitter.SpawnShape.radius > 0
      || emitter.SpawnShape?.__type === 'VfxShapeBox' && emitter.SpawnShape.Size?.filter(n => n === 0).length === 1],
  ]);
}

export async function auditFixedRays({ out, capture = false }) {
  const root = await batchOutputRoot(out);
  const read = async path => JSON.parse(await readFile(await safeInputPath(root, join(root, path)), 'utf8'));
  const systems = await read('systems.json');
  const name = 'fixed-plane-rays-baseline.json';
  let baseline;
  if (capture) {
    baseline = [];
    for (const [unit, rows] of Object.entries(systems)) for (const s of rows) {
      if (!s.reportPath) continue;
      const report = await read(s.reportPath);
      for (const [index, row] of report.emitters.entries()) if (/^(unexpressible-emitter:)(rotated|ground)-stationary-ray-plane$/.test(row.reason)) {
        baseline.push({ unit, effectId: s.effectId, reportPath: s.reportPath, index,
          previousReason: row.reason, fields: rayFieldGroups(row.originalFields, report.originalFields) });
      }
    }
    // Never overwrite the original baseline with a post-regeneration census.
    await writeOutputFile(join(root, name), JSON.stringify(baseline, null, 2) + '\n');
  } else baseline = await read(name);
  const rows = [], fieldCounts = {}, statusCounts = {}, ruleCounts = {}, stillSkipped = [];
  const { parseParticleDocument } = await contracts();
  const { ParticleEffectV2 } = await import('../../src/rendering3d/particles-v2.ts');
  const camera = new PerspectiveCamera(); camera.position.set(4, 6, 8); camera.lookAt(0, 0, 0);
  for (const entry of baseline) {
    for (const [key, present] of Object.entries(entry.fields)) if (present) fieldCounts[key] = (fieldCounts[key] ?? 0) + 1;
    const report = await read(entry.reportPath), row = report.emitters[entry.index];
    const rule = row.approximations?.find(a => a.field === 'primitive' && a.handling.startsWith('fixed-ray-'))?.handling;
    const restored = ['mapped', 'approximated'].includes(row.status);
    const documentIndex = restored ? report.emitters.slice(0, entry.index).filter(e => ['mapped', 'approximated'].includes(e.status)).length : null;
    statusCounts[restored ? 'restored' : row.status] = (statusCounts[restored ? 'restored' : row.status] ?? 0) + 1;
    if (restored) ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1;
    let previewTime = null, visibleCells = 0, heightCells = 0;
    if (!capture && restored) {
      const s = systems[entry.unit].find(s => s.effectId === entry.effectId);
      const doc = parseParticleDocument(await read(s.path)), emitter = doc.emitters[documentIndex];
      const fx = new ParticleEffectV2({ ...doc, emitters: [emitter] }, { scale: .44 });
      const duration = Math.min(doc.limits.maxDuration, (emitter.delay ?? 0) + (emitter.emission.duration ?? 0) + emitter.lifetime);
      let best = 0;
      try {
        for (let frame = 0; frame * .05 < duration; frame++) {
          fx.update(frame ? .05 : 0, camera); fx.object.updateMatrixWorld(true);
          for (const mesh of fx.object.children) {
            mesh.geometry.computeBoundingBox();
            const size = mesh.geometry.boundingBox.getSize(new Vector3()).multiply(new Vector3().setFromMatrixScale(mesh.matrixWorld));
            const edge = Math.max(...size.toArray()), opacity = mesh.material.uniforms.opacity.value;
            if (size.toArray().filter(n => n > 1e-8).length >= 2 && opacity > 1 / 255 && edge * opacity > best) {
              best = edge * opacity; previewTime = frame * .05; visibleCells = edge / 62.4;
              heightCells = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).getSize(new Vector3()).y / 62.4;
            }
          }
        }
      } finally { fx.dispose(); }
    }
    rows.push({ ...entry, status: row.status, reason: row.reason, rule, documentIndex, previewTime, visibleCells, heightCells });
  }
  if (!capture) for (const [unit, systemsRows] of Object.entries(systems)) for (const s of systemsRows) {
    if (!s.reportPath) continue;
    const report = await read(s.reportPath);
    for (const [index, row] of report.emitters.entries()) if (/^unexpressible-emitter:stationary-ray-plane-without-(evidence|ground-normal)$/.test(row.reason)) {
      stillSkipped.push({ unit, effectId: s.effectId, index, reason: row.reason, fields: rayFieldGroups(row.originalFields, report.originalFields) });
    }
  }
  const result = { total: baseline.length, fieldCounts, statusCounts, ruleCounts, stillSkipped, rows };
  if (!capture) await writeOutputFile(join(root, 'fixed-plane-rays-audit.json'), JSON.stringify(result, null, 2) + '\n', { force: true });
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = argumentsFor(process.argv.slice(2).filter(arg => arg !== '--capture'), ['--out']);
  const result = await auditFixedRays({ ...args, capture: process.argv.includes('--capture') });
  const { rows, ...summary } = result;
  console.log(JSON.stringify(summary));
}

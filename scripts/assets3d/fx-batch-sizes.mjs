// Offline diagnosis of individual particle edges, not the aggregate effect AABB.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumentsFor } from './plan-fetch.mjs';
import { Box3, BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three';
import { contracts } from './runtime.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
import { batchOutputRoot } from './fx-batch.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';

export const FX_SCALE = 0.44;
export const CELL_DISTANCE = 62.4;
export async function batchSizes({ out = 'assets3d-local/fx-batch1' } = {}) {
const root = await batchOutputRoot(out);
const read = async p => JSON.parse(await readFile(await safeInputPath(root, join(root, p)), 'utf8'));
const { parseParticleDocument } = await contracts();
const { ParticleEffectV2 } = await import('../../src/rendering3d/particles-v2.ts');
const camera = new PerspectiveCamera(); camera.position.set(4, 6, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const results = [];
const manifest = await read('manifest.json'), bindings = await read('action-bindings.json');
for (const [unit, actions] of Object.entries(manifest.actionEffects)) {
 for (const [action, ids] of Object.entries(actions)) for (const id of ids) {
  const path = manifest.effects[id].path.slice(0, -5);
  const spec = bindings.playback[id], bodyScale = FX_SCALE;
  const doc = parseParticleDocument(await read(`${path}.json`)), report = await read(`${path}.report.json`).catch(e => { if (e.code !== 'ENOENT' || !id.startsWith('global_')) throw e; return { emitters: doc.emitters.map(e => ({ status: 'mapped', originalFields: { emitterName: e.name ?? 'shared-local-converted', provenance: 'fx-trial; no source sidecar copied' } })) }; });
  const accepted = report.emitters.filter(e => ['mapped', 'approximated'].includes(e.status));
  const emitters = [];
  for (const [index, emitter] of doc.emitters.entries()) {
    let geometry;
    if (emitter.kind === 'mesh') {
      const glb = readGlb(await readFile(await safeInputPath(root, join(root, emitter.mesh))));
      const positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
      geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions.flat(), 3));
    }
    const fx = new ParticleEffectV2({ ...doc, emitters: [emitter] }, { scale: 1, maxDuration: spec.maxDuration, mesh: () => geometry });
    let peak = 0, browserPeak = 0, peakAABB = 0, at = 0, nonzeroSurface = false;
    for (let frame = 0; frame * .05 < spec.maxDuration; frame++) {
      fx.update(frame ? .05 : 0, camera); fx.object.updateMatrixWorld(true);
      for (const mesh of fx.object.children) {
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox.getSize(new Vector3());
        const basis = new Vector3().setFromMatrixScale(mesh.matrixWorld);
        const dimensions = size.multiply(basis).toArray();
        nonzeroSurface ||= dimensions.filter(n => n > 1e-8).length >= 2;
        const edge = Math.max(...dimensions);
        if (edge > peak) { peak = edge; at = frame * .05; }
        if (frame) browserPeak = Math.max(browserPeak, edge);
        peakAABB = Math.max(peakAABB, ...new Box3().setFromObject(mesh).getSize(new Vector3()).toArray());
      }
    }
    emitters.push({ index, name: accepted[index].originalFields.emitterName, kind: emitter.kind,
      peakSourceEdge: peak, at, nonzeroSurface, browserSampleSourceEdge: browserPeak, cells: browserPeak * bodyScale / CELL_DISTANCE,
      peakSourceAABB: peakAABB, meshSourceXYZ: geometry ? (geometry.computeBoundingBox(), geometry.boundingBox.getSize(new Vector3()).toArray()) : undefined, mappedSize0: emitter.size0, mappedSize: emitter.size, originalFields: accepted[index].originalFields });
    fx.dispose(); geometry?.dispose();
  }
  emitters.sort((a, b) => b.browserSampleSourceEdge - a.browserSampleSourceEdge);
  results.push({ unit, action, effectId: id, phase: spec.phase, fxScale: bodyScale, cells: Math.max(0, ...emitters.filter(e => e.nonzeroSurface).map(e => e.cells)), emitters });
 }
}
await writeOutputFile(join(root, 'size-report.json'), JSON.stringify({
  method: 'Real ParticleEffectV2; per-particle geometry edge including mesh bounds and affine basis scale; t=0 separately, 50ms samples through each binding duration; scale=0.44 for every unit. Camera (4,6,8); default seeded RNG; no alpha crop. Source edges are orientation-independent; AABB is separate.',
  fxScale: FX_SCALE, cellDistance: CELL_DISTANCE, results,
}, null, 2) + '\n', { force: true });

return results;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const results = await batchSizes(argumentsFor(process.argv.slice(2), ['--out']));
 for (const r of results) console.log(r.unit, r.action, r.effectId, r.cells.toFixed(2));
}

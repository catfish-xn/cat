// Offline diagnosis of individual particle edges, not the aggregate effect AABB.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Box3, BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three';
import { contracts } from './runtime.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
import { batchOutputRoot } from './fx-batch1.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';

const root = await batchOutputRoot('assets3d-local/fx-batch1');
const read = async p => JSON.parse(await readFile(await safeInputPath(root, join(root, p)), 'utf8'));
const { parseParticleDocument } = await contracts();
const { ParticleEffectV2 } = await import('../../src/rendering3d/particles-v2.ts');
const camera = new PerspectiveCamera(); camera.position.set(4, 6, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const results = [];
for (const [unit, suffix, bodyScale] of [
  ['blitzcrank', 'q_cas', .543], ['caitlyn', 'r_bombardment_impact', .441], ['lux', 'w_mis', .673],
]) {
  const path = `effects/${unit}/tft13_${unit}_base_${suffix}`;
  const doc = parseParticleDocument(await read(`${path}.json`)), report = await read(`${path}.report.json`);
  const accepted = report.emitters.filter(e => ['mapped', 'approximated'].includes(e.status));
  const emitters = [];
  for (const [index, emitter] of doc.emitters.entries()) {
    let geometry;
    if (emitter.kind === 'mesh') {
      const glb = readGlb(await readFile(await safeInputPath(root, join(root, emitter.mesh))));
      const positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
      geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions.flat(), 3));
    }
    const fx = new ParticleEffectV2({ ...doc, emitters: [emitter] }, { scale: 1, maxDuration: 2.3, mesh: () => geometry });
    let peak = 0, browserPeak = 0, peakAABB = 0, at = 0, nonzeroSurface = false;
    for (let frame = 0; frame <= 22; frame++) {
      fx.update(frame ? .1 : 0, camera); fx.object.updateMatrixWorld(true);
      for (const mesh of fx.object.children) {
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox.getSize(new Vector3());
        const basis = new Vector3().setFromMatrixScale(mesh.matrixWorld);
        const dimensions = size.multiply(basis).toArray();
        nonzeroSurface ||= dimensions.filter(n => n > 1e-8).length >= 2;
        const edge = Math.max(...dimensions);
        if (edge > peak) { peak = edge; at = frame / 10; }
        if (frame) browserPeak = Math.max(browserPeak, edge);
        peakAABB = Math.max(peakAABB, ...new Box3().setFromObject(mesh).getSize(new Vector3()).toArray());
      }
    }
    emitters.push({ index, name: accepted[index].originalFields.emitterName, kind: emitter.kind,
      peakSourceEdge: peak, at, nonzeroSurface, browserSampleSourceEdge: browserPeak, cells: browserPeak * bodyScale / 62.4,
      peakSourceAABB: peakAABB, originalFields: accepted[index].originalFields });
    fx.dispose(); geometry?.dispose();
  }
  emitters.sort((a, b) => b.browserSampleSourceEdge - a.browserSampleSourceEdge);
  results.push({ unit, suffix, bodyScale, emitters });
  console.log(JSON.stringify({ unit, largest: emitters.slice(0, 3).map(({ originalFields, ...row }) => row) }));
}
await writeOutputFile(join(root, 'oversize-report.json'), JSON.stringify({
  method: 'Real ParticleEffectV2; per-particle geometry edge including mesh bounds and affine basis scale; t=0 separately, browser samples 0.1..2.2s. Camera (4,6,8); default seeded RNG; no alpha crop. Source edges are orientation-independent; AABB is separate.',
  cellDistance: 62.4, results,
}, null, 2) + '\n', { force: true });

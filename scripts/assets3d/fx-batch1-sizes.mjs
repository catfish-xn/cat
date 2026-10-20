// Deterministic numerical spot check using the real particle interpreter and mesh geometry.
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3, BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three';
import { contracts } from './runtime.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { batchOutputRoot } from './fx-batch1.mjs';

const read = async p => JSON.parse(await readFile(p, 'utf8'));
export async function batchSizes({ out = 'assets3d-local/fx-batch1', scales } = {}) {
  const root = await batchOutputRoot(out);
  const input = async p => readFile(await safeInputPath(root, join(root, p)));
  const manifest = JSON.parse(await input('manifest.json')), bindings = JSON.parse(await input('action-bindings.json'));
  const supplied = scales ? await read(scales) : null;
  const { parseParticleDocument } = await contracts();
  const { ParticleEffectV2 } = await import('../../src/rendering3d/particles-v2.ts');
  const result = { scaleStatus: supplied ? 'caller-supplied' : 'assumed-preview-fit-not-live-world-scale',
    method: 'Real ParticleEffectV2; default seeded RNG; 50ms sampling through binding duration; camera (4,6,8); peak XYZ AABB extent, including offsets/motion and actual mesh geometry. Static world anchors; no host trajectory. Transparent margins included. Mesh bind/animation/alpha visibility not evaluated.',
    scaleRule: supplied ? 'per-unit supplied body worldScale' : 'Assumption: fit body bind-mesh report height to 1.8 scene units. This is NOT verified against the absent 3D host.',
    cellDistance: supplied?.cellDistance ?? Math.sqrt(3),
    cellRule: 'Adjacent hex center distance; assumed radius=1 unless supplied.', units: {} };
  const camera = new PerspectiveCamera(); camera.position.set(4, 6, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  for (const [unit, actions] of Object.entries(manifest.actionEffects)) {
    let report;
    for (const batch of ['batch-cost12', 'batch-cost345']) {
      try { report = await read(`assets3d-local/out/${batch}/units/${unit}/build-report.json`); break; }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    const height = report.units[unit].bbox.height;
    const scale = supplied?.units?.[unit] ?? (supplied ? NaN : 1.8 / height);
    if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(result.cellDistance) || result.cellDistance <= 0) throw new Error('invalid-size-scale');
    const row = { bodyHeight: height, bodyWorldScale: scale, attack: actions.attack.length, cast: actions.cast.length, impacts: [] };
    for (const id of actions.cast.filter(id => bindings.playback[id].phase === 'impact')) {
      const spec = bindings.playback[id], doc = parseParticleDocument(JSON.parse(await input(manifest.effects[id].path)));
      const geometries = new Map();
      for (const e of doc.emitters.filter(e => e.kind === 'mesh')) {
        if (geometries.has(e.mesh)) continue;
        const glb = readGlb(await input(e.mesh));
        const positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
        const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions.flat(), 3));
        geometries.set(e.mesh, geometry);
      }
      const fx = new ParticleEffectV2(doc, { scale, maxDuration: spec.maxDuration, mesh: p => geometries.get(p) });
      const peak = new Vector3(), size = new Vector3(); let samples = 0;
      for (let t = 0; t < spec.maxDuration - 1e-8; t += .05) {
        fx.update(t === 0 ? 0 : .05, camera); fx.object.updateMatrixWorld(true);
        const box = new Box3().setFromObject(fx.object);
        if (!box.isEmpty()) { box.getSize(size); peak.max(size); samples++; }
      }
      const maxExtent = Math.max(...peak.toArray()), cells = maxExtent / result.cellDistance;
      row.impacts.push({ effectId: id, peakXYZ: peak.toArray(), maxExtent, cells, samples,
        flag: cells > 3 ? 'over-3-cells-review' : cells < .2 ? 'under-0.2-cells-review' : 'within-spot-check-range',
        skipped: fx.skippedReasons });
      fx.dispose(); for (const g of geometries.values()) g.dispose();
    }
    result.units[unit] = row;
  }
  await writeOutputFile(join(root, 'size-report.json'), `${JSON.stringify(result, null, 2)}\n`, { force: true });
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await batchSizes(argumentsFor(process.argv.slice(2), ['--out', '--scales']));
  for (const [unit, row] of Object.entries(result.units)) console.log(unit, row.bodyWorldScale.toFixed(6), row.impacts.map(i => `${i.effectId.split('_base_').at(-1)}=${i.maxExtent.toFixed(3)} (${i.cells.toFixed(2)} cells) ${i.flag}`).join('; '));
}

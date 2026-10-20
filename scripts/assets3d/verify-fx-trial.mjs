import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { contracts } from './runtime.mjs';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';

/** Headless geometry/material/lifecycle smoke, deliberately no claim of GPU or
 * shell visual acceptance. Reads only the independent root; no input writes. */
export async function verifyFxTrial({ root = 'assets3d-local/fx-trial', force = false } = {}) {
  const { assertManifest, parseParticleDocument } = await contracts();
  const { ParticleEffect } = await import('../../src/rendering3d/particles.ts');
  const input = resolve(root), read = async p => readFile(await safeInputPath(input, join(input, p)));
  const manifest = JSON.parse(await read('manifest.json')); assertManifest(manifest);
  const meshes = new Map(), textures = new Map(), loader = new GLTFLoader();
  const results = [];
  try {
    for (const [id, entry] of Object.entries(manifest.effects)) {
      const doc = parseParticleDocument(JSON.parse(await read(entry.path)));
      if (doc.schemaVersion !== 2) throw new Error('trial-expected-v2');
      for (const e of doc.emitters) {
        if (e.texture && !textures.has(e.texture)) {
          const b = await read(e.texture);
          if (!b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || !b.readUInt32BE(16) || !b.readUInt32BE(20)) throw new Error('invalid-trial-png');
          textures.set(e.texture, new Texture());
        }
        if (e.kind === 'mesh' && !meshes.has(e.mesh)) {
          const b = await read(e.mesh), model = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '');
          let geometry;
          model.scene.traverse(child => { if (child.isMesh) geometry ??= child.geometry; });
          if (!geometry) throw new Error('missing-trial-mesh');
          meshes.set(e.mesh, geometry);
          model.scene.traverse(child => { if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose()); });
        }
      }
      const fx = new ParticleEffect(doc, { scale: 1, texture: p => textures.get(p), mesh: p => meshes.get(p) });
      let peak = fx.particleCount, drawnGeometry = false;
      const camera = new PerspectiveCamera(); camera.position.set(500, 500, 500); camera.lookAt(0, 0, 0);
      // Fixed frame steps are needed for trail history. Inspect actual geometry,
      // material assignments, transforms, opacity and resource resolution.
      for (let t = 0; t < 1.5; t += .05) {
        // Trails need host motion; this synthetic path is part of the smoke,
        // never a claim that the shell already supplies a projectile path.
        fx.object.position.x += 5;
        fx.update(.05, camera); peak = Math.max(peak, fx.particleCount);
        for (const mesh of fx.object.children) {
          if (!mesh.position.toArray().every(Number.isFinite) || !mesh.matrix.elements.every(Number.isFinite)) throw new Error('nonfinite-trial-transform');
          const points = mesh.geometry.getAttribute('position');
          if (points && points.count > 0 && mesh.material.uniforms.opacity.value > 0 && mesh.scale.x !== 0 && mesh.scale.y !== 0) drawnGeometry = true;
        }
      }
      fx.update(doc.limits.maxDuration); const finished = fx.finished;
      const skips = [...fx.skippedReasons];
      fx.dispose();
      if (skips.length || !finished || peak === 0 || !drawnGeometry) throw new Error(`trial-not-renderable:${id}`);
      results.push({ id, emitters: doc.emitters.length, peakParticles: peak, geometryAndMaterialReady: drawnGeometry, lifecycleFinished: finished, skipped: skips });
    }
    for (const model of Object.values(manifest.models)) {
      const b = await read(model.path); if (b.toString('ascii', 0, 4) !== 'glTF' || b.readUInt32LE(8) !== b.length) throw new Error('invalid-trial-model');
    }
    const report = { method: 'real-v2-runtime-headless-geometry-material-lifecycle-smoke', syntheticHostMotion: 'X += 5 League units / 50 ms', gpuVisualAcceptance: false,
      models: Object.keys(manifest.models), documents: results.length, textures: textures.size, meshes: meshes.size, results };
    await writeOutputFile(join(input, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`, { force });
    return report;
  } finally { meshes.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyFxTrial(argumentsFor(process.argv.slice(2), ['--root']));
  console.log(JSON.stringify({ documents: result.documents, textures: result.textures, meshes: result.meshes, gpuVisualAcceptance: result.gpuVisualAcceptance }));
}

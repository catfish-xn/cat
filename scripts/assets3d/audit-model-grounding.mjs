/** Read-only assets; actual Three CPU skinning, same fitting/contact code as the renderer. No browser/texture decode.
 * node --experimental-loader ./scripts/assets3d/ts-loader.mjs scripts/assets3d/audit-model-grounding.mjs
 *   --root /local/assets --output /tmp/grounding.json [--fps 30] [--only akali,irelia]
 * Before = same fit with support calibration omitted (HEAD 4baaaf5a behavior); after includes idle contact update.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AnimationMixer, Bone, Box3, DoubleSide, Quaternion, Raycaster, SkinnedMesh, Vector3 } from 'three';
import { loadGeometry } from './audit-skinned-bounds.mjs';
import { animationEnvelope, ENVELOPE_ACTIONS, LOOPING_ACTIONS, fitModel, readUnitScale, standingFeet, standingSupport, HOVERING_MODELS } from '../../src/rendering/three-mode/model-fit.ts';
import { createSupportSampler, supportRotation, updateModelGrounding } from '../../src/rendering/three-mode/model-grounding.ts';

// Renderer monster presentation metadata, guarded below against drift. Not simulation data.
const monsterFit = {
  'pve-minion-melee': [0.57, -0.03], 'pve-minion-ranged': [0.43, 0.02], 'pve-krug': [0.78, 0.03],
  'pve-wolf-large': [0.87, 0.01], 'pve-wolf-small': [0.52, 0.04], 'pve-razorbeak-large': [0.87, 0.1],
  'pve-razorbeak-small': [0.48, 0.05], 'pve-elder-dragon': [1.52, 0], 'pve-rift-herald': [1.36, 0.01],
};
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, '');
  if (!['root', 'output', 'fps', 'only'].includes(key) || !args[i + 1]) throw Error(`invalid-option:${args[i]}`);
  options[key] = args[i + 1];
}
const root = resolve(options.root ?? 'assets3d-local/test-server-v8'), fps = Number(options.fps ?? 30);
if (!(fps > 0) || !Number.isFinite(fps)) throw Error('invalid-fps');
const manifestBytes = await readFile(resolve(root, 'manifest.json')), manifest = JSON.parse(manifestBytes);
const renderer = await readFile(new URL('../../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
for (const [id, [height, lift]] of Object.entries(monsterFit)) {
  if (!renderer.includes(`'${id}': { height: ${height}, lift: ${lift} }`)) throw Error(`monster-fit-drift:${id}`);
}
const report = { root, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), fps,
  origin: 'piece root / board or bench support plane, y=0', thresholds: { gap: 2, penetration: -2, center: 8, soleTilt: 2, allMeshPenetrationRatio: 0.01, residual: 0.2 }, models: [], errors: [] };
const point = new Vector3(), up = new Vector3(0, 1, 0);
const stats = numbers => ({ min: Math.min(...numbers), max: Math.max(...numbers), mean: numbers.reduce((n, v) => n + v, 0) / numbers.length });
const meshesOf = body => { const meshes = []; body.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); }); return meshes; };
const dispose = body => body.traverse(node => { if (node.isMesh) { node.geometry.dispose(); node.skeleton?.dispose();
  for (const m of Array.isArray(node.material) ? node.material : [node.material]) m.dispose(); } });

// Check the real arena triangles, rather than assuming that the manifest's reference y=0 is a rendered floor.
if (manifest.boards?.['board-default'] && manifest.models['board-default']) {
  const arena = await loadGeometry(resolve(root, manifest.models['board-default'].path));
  try {
    const { alignment, grid } = manifest.boards['board-default'], samples = [];
    arena.scene.position.fromArray(alignment.offset); arena.scene.scale.fromArray(alignment.scale);
    arena.scene.traverse(mesh => { if (mesh.isMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.side = DoubleSide; });
    arena.scene.updateMatrixWorld(true);
    for (let row = 0; row < (grid?.rows ?? 8); row++) for (let col = 0; col < (grid?.columns ?? 7); col++) {
      const x = alignment.target.origin.x + Math.sqrt(3) * alignment.target.radius * (col + (row % 2) / 2);
      const z = alignment.target.origin.y + 1.5 * alignment.target.radius * row;
      const hits = new Raycaster(new Vector3(x, 1000, z), new Vector3(0, -1, 0)).intersectObject(arena.scene, true);
      const floor = hits.sort((a, b) => Math.abs(a.point.y) - Math.abs(b.point.y))[0]?.point.y;
      samples.push({ col, row, floor: floor ?? null });
    }
    const ys = samples.flatMap(sample => sample.floor === null ? [] : [sample.floor]);
    report.arena = { method: 'actual GLB triangles nearest the reference support plane at each hex center', samples,
      floorMin: Math.min(...ys), floorMax: Math.max(...ys) };
    if (ys.length !== samples.length || ys.some(y => Math.abs(y) > 0.001)) report.errors.push({ id: 'arena-floor', error: 'nonzero-or-missing-floor' });
  } finally { dispose(arena.scene); }
}

async function measure(model, entry, id, envelope, after, category) {
  const body = model.scene, meshes = meshesOf(body), unitScale = readUnitScale(manifest.models, id);
  const monster = monsterFit[id] ?? monsterFit[id.replace(/-[a-c]$/, '')];
  const support = after ? standingSupport(id, envelope) : undefined;
  if (category === 'unit') {
    const drawn = fitModel(body, { height: monster ? Infinity : 92, width: monster ? Infinity : 110, sourceScale: 0.44, unitScale,
      ...(monster ? { ...(support ? { feet: envelope.feet } : {}) } : { envelopeRadius: envelope.radius, ground: envelope.ground, feet: standingFeet(id, envelope) }), support });
    if (monster && !support) body.position.y += drawn * monster[1] / monster[0];
  }
  // Non-combat models are scanned in source units, not misrepresented as board-fitted champions.
  const box = new Box3().setFromObject(body), height = Math.max(1, box.max.y - box.min.y);
  const clip = model.animations.find(c => c.name === (entry.animations?.idle ?? 'idle'));
  const rootBone = meshes.flatMap(m => m.skeleton.bones).find(b => /^root$/i.test(b.name))
    ?? meshes.flatMap(m => m.skeleton.bones).find(b => !(b.parent instanceof Bone));
  body.updateMatrixWorld(true);
  const rootHome = rootBone?.getWorldPosition(new Vector3()) ?? new Vector3();
  const mixer = new AnimationMixer(body);
  if (clip) mixer.clipAction(clip).play();
  const frames = clip ? Math.max(32, Math.ceil(clip.duration * fps)) : 1, samples = [];
  try {
    for (let frame = 0; frame < frames; frame++) {
      mixer.setTime((clip?.duration ?? 0) * frame / frames);
      if (after && category === 'unit') updateModelGrounding(body, true, 1 / fps);
      body.updateMatrixWorld(true);
      const sampler = createSupportSampler(meshes, height);
      let lowest = Infinity, highest = -Infinity;
      for (let index = 0; index < meshes.length; index++) {
        const mesh = meshes[index]; mesh.skeleton.update();
        for (let v = 0; v < mesh.geometry.attributes.position.count; v++) {
          mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld);
          lowest = Math.min(lowest, point.y); highest = Math.max(highest, point.y); sampler.vertex(index, v, point);
        }
      }
      sampler.frame(); const measured = sampler.finish();
      const rootUp = rootBone ? up.clone().applyQuaternion(rootBone.getWorldQuaternion(new Quaternion())) : up;
      samples.push({ time: (clip?.duration ?? 0) * frame / frames, floor: measured?.floor ?? lowest,
        center: measured?.center ?? [0, lowest, 0], soleTilt: measured?.tiltDegrees ?? null,
        rootTilt: Math.acos(Math.max(-1, Math.min(1, rootUp.y))) * 180 / Math.PI,
        rootPitch: Math.atan2(rootUp.z, rootUp.y) * 180 / Math.PI,
        rootRoll: -Math.atan2(rootUp.x, rootUp.y) * 180 / Math.PI,
        rootDrift: rootBone ? rootBone.getWorldPosition(new Vector3()).sub(rootHome).toArray() : [0, 0, 0], allMeshMin: lowest, meshHeight: highest - lowest,
        // Independent full-vertex measurement. No support sampler/contact subset supplies this minimum.
        penetrationRatio: Math.max(0, -lowest) / (highest - lowest),
        groundingResidual: Math.min(measured?.floor ?? lowest, lowest + (envelope.support?.height ?? height) * body.scale.y * 0.009) });
    }
  } finally { mixer.stopAllAction(); mixer.uncacheRoot(body); }
  const center = [0, 1, 2].map(axis => samples.reduce((sum, p) => sum + p.center[axis], 0) / samples.length);
  return { frames, duration: clip?.duration ?? 0, scale: body.scale.toArray(), position: body.position.toArray(),
    floor: stats(samples.map(p => p.floor)), center, centerDistance: Math.hypot(center[0], center[2]),
    soleTilt: stats(samples.map(p => p.soleTilt ?? 0)), rootTilt: stats(samples.map(p => p.rootTilt)),
    rootPitch: stats(samples.map(p => p.rootPitch)), rootRoll: stats(samples.map(p => p.rootRoll)),
    rootDriftY: stats(samples.map(p => p.rootDrift[1])),
    allMeshMin: stats(samples.map(p => p.allMeshMin)), meshHeight: stats(samples.map(p => p.meshHeight)),
    penetrationRatio: stats(samples.map(p => p.penetrationRatio)), groundingResidual: stats(samples.map(p => p.groundingResidual)), samples };
}

for (const [id, entry] of Object.entries(manifest.models)) {
  if (options.only && !options.only.split(',').includes(id)) continue;
  const models = [];
  try {
    const bytes = await readFile(resolve(root, entry.path));
    const beforeModel = await loadGeometry(resolve(root, entry.path)); models.push(beforeModel);
    const meshes = meshesOf(beforeModel.scene);
    const category = id.startsWith('little-legend-') ? 'legend' : id.startsWith('pve-') || (!id.includes('-') && !['shimmer-flask', 'conqueror-chest'].includes(id)) ? 'unit' : 'prop';
    if (!meshes.length) { report.models.push({ id, category, static: true, sha256: createHash('sha256').update(bytes).digest('hex') }); continue; }
    beforeModel.scene.updateMatrixWorld(true);
    const sourceNodeTilt = Math.max(...meshes.map(mesh => Math.acos(Math.max(-1, Math.min(1,
      up.clone().applyQuaternion(mesh.getWorldQuaternion(new Quaternion())).y))) * 180 / Math.PI));
    const loadedBox = new Box3().setFromObject(beforeModel.scene), sampler = createSupportSampler(meshes, Math.max(1, loadedBox.max.y - loadedBox.min.y));
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i]; mesh.skeleton.update();
      for (let v = 0; v < mesh.geometry.attributes.position.count; v++) {
        mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld); sampler.vertex(i, v, point);
      }
    }
    sampler.frame(); const bindSupport = sampler.finish();
    const nameOf = action => entry.animations?.[action] ?? action;
    const clips = beforeModel.animations.filter(clip => ENVELOPE_ACTIONS.map(nameOf).includes(clip.name)).map(clip => ({ clip,
      loop: ENVELOPE_ACTIONS.some(action => LOOPING_ACTIONS.has(action) && nameOf(action) === clip.name), ground: true, feet: clip.name === nameOf('idle') }));
    const envelope = animationEnvelope(beforeModel.scene, clips);
    const before = await measure(beforeModel, entry, id, envelope, false, category);
    const afterModel = await loadGeometry(resolve(root, entry.path)); models.push(afterModel);
    const after = await measure(afterModel, entry, id, envelope, true, category);
    const hover = HOVERING_MODELS.has(id), flags = [];
    if (category === 'unit' && !hover) {
      if (before.floor.max > report.thresholds.gap) flags.push('gap');
      if (before.floor.min < report.thresholds.penetration) flags.push('penetration');
      if (before.centerDistance > report.thresholds.center) flags.push('center');
      if (before.soleTilt.mean > report.thresholds.soleTilt) flags.push('sole-tilt-review');
      if (after.penetrationRatio.max > report.thresholds.allMeshPenetrationRatio) flags.push('all-mesh-penetration');
      if (after.floor.max > 0.2) flags.push('prop-compromise');
    }
    const rotation = envelope.support ? supportRotation(envelope.support).angleTo(new Quaternion()) * 180 / Math.PI : 0;
    report.models.push({ id, category, unitScale: entry.unitScale ?? null, hover, flags,
      sha256: createHash('sha256').update(bytes).digest('hex'), sourceNodeTilt, bindSupport, envelope, correctionDegrees: rotation, before, after });
    console.log(`${id}: ${before.frames} frames; y=${before.floor.min.toFixed(2)}..${before.floor.max.toFixed(2)} → ${after.floor.min.toFixed(2)}..${after.floor.max.toFixed(2)}; xz=${before.centerDistance.toFixed(2)} → ${after.centerDistance.toFixed(2)}; ${flags.join(',')}`);
  } catch (error) { report.errors.push({ id, error: error.stack }); }
  finally { for (const model of models) dispose(model.scene); }
}
if (options.output) await writeFile(resolve(options.output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ models: report.models.length, errors: report.errors }));
if (report.errors.length) process.exitCode = 1;
for (const model of report.models.filter(m => m.category === 'unit' && !m.static && !m.hover)) {
  if (model.after.floor.min < -0.2 || model.after.groundingResidual.min < -0.2 || model.after.groundingResidual.max > 0.2 || model.after.centerDistance > 8
    || model.after.penetrationRatio.max > report.thresholds.allMeshPenetrationRatio + 1e-6) {
    console.error(`unresolved-grounding:${model.id}`); process.exitCode = 1;
  }
}

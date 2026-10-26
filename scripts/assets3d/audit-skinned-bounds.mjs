/** Read-only, one-model-at-a-time CPU skinning audit (no WebGL, textures or network).
 * node --experimental-loader ./scripts/assets3d/ts-loader.mjs scripts/assets3d/audit-skinned-bounds.mjs
 *   --root /local/asset-root --output /tmp/skinned-bounds.json [--only elise,pve-rift-herald] [--fps 30] [--runtime true]
 * --root must contain manifest.json; --manifest can select another manifest under that root.
 * Bounds are in loaded model units, before board fitting. Flags are review candidates, not proof of corrupt art.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, LoopOnce, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { writeGlb } from './glb.mjs';

export async function loadGeometry(path) {
  const input = await readFile(path);
  if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(4) !== 2) throw new Error('invalid-glb');
  const jsonSize = input.readUInt32LE(12);
  const document = JSON.parse(input.subarray(20, 20 + jsonSize).toString());
  // Meshopt GLBs may have a second, virtual fallback buffer; retain it unchanged.
  const binary = input.subarray(28 + jsonSize);
  // Skip image decoding only; preserve all geometry, skeleton, animation and node bytes/TRS.
  for (const mesh of document.meshes ?? []) for (const primitive of mesh.primitives) delete primitive.material;
  delete document.materials; delete document.textures; delete document.images;
  const bytes = writeGlb(document, binary);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

export function skinnedBounds(root, metrics) {
  root.updateMatrixWorld(true);
  const box = new Box3(), point = new Vector3();
  if (metrics) metrics.maxEdge = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.skeleton?.update();
    const positions = mesh.geometry.getAttribute('position');
    const vertices = metrics ? new Float64Array(positions.count * 3) : null;
    for (let i = 0; i < positions.count; i++) {
      // getVertexPosition includes morph targets and applyBoneTransform for SkinnedMesh.
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
      if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('non-finite-skinned-vertex');
      box.expandByPoint(point);
      if (vertices) point.toArray(vertices, i * 3);
    }
    if (vertices) {
      const index = mesh.geometry.index, count = index?.count ?? positions.count;
      for (let i = 0; i + 2 < count; i += 3) {
        for (let corner = 0; corner < 3; corner++) {
          const a = (index ? index.getX(i + corner) : i + corner) * 3;
          const b = (index ? index.getX(i + (corner + 1) % 3) : i + (corner + 1) % 3) * 3;
          const edge = Math.hypot(vertices[a] - vertices[b], vertices[a + 1] - vertices[b + 1], vertices[a + 2] - vertices[b + 2]);
          metrics.maxEdge = Math.max(metrics.maxEdge, edge);
        }
      }
    }
  });
  if (box.isEmpty()) throw new Error('empty-model');
  return box;
}

export function measureClip(root, clip, fps = 30) {
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(clip.duration) || clip.duration < 0) throw new Error('invalid-sampling');
  const mixer = new AnimationMixer(root), action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const union = new Box3(), metrics = {}; let peak = 0, peakTime = 0, maxEdge = 0;
  const frames = Math.max(1, Math.ceil(clip.duration * fps));
  try {
    for (let frame = 0; frame <= frames; frame++) {
      const time = Math.min(frame / fps, clip.duration);
      mixer.setTime(time);
      const box = skinnedBounds(root, metrics), span = box.getSize(new Vector3()).length();
      maxEdge = Math.max(maxEdge, metrics.maxEdge);
      union.union(box);
      if (span > peak) { peak = span; peakTime = time; }
    }
    return { min: union.min.toArray(), max: union.max.toArray(), peak, peakTime, maxEdge, frames: frames + 1 };
  } finally { mixer.stopAllAction(); mixer.uncacheRoot(root); }
}

export async function measureTransitions(root, animations, entry, fps = 30) {
  const { UnitAnimationMixer } = await import('../../src/rendering3d/animation-mixer.ts');
  const adapter = new UnitAnimationMixer(root, animations, entry.animations, entry);
  const union = new Box3(), metrics = {}; let revision = 0, peak = 0, peakTime = 0, elapsed = 0, maxEdge = 0;
  const phases = [];
  try {
    const castCount = Math.max(3, entry.castVariants?.rotate?.length ?? 0);
    for (let castIndex = 0; castIndex < castCount; castIndex++) {
      for (const state of ['idle', 'attack', 'cast', 'idle']) {
        const playback = state === 'idle' ? undefined : adapter.resolvePlayback(state, castIndex, { starLevel: 3 });
        adapter.apply({ state, previous: state, revision: revision++, loop: state === 'idle', blendSeconds: .12,
          ...(playback ? { playback } : {}) });
        const seconds = playback?.durationSeconds ?? .5, frames = Math.ceil(seconds * fps);
        const phase = new Box3();
        for (let i = 0; i <= frames; i++) {
          const dt = i === 0 ? 0 : Math.min(1 / fps, seconds - (i - 1) / fps);
          adapter.update(dt); elapsed += dt;
          const box = skinnedBounds(root, metrics), span = box.getSize(new Vector3()).length();
          maxEdge = Math.max(maxEdge, metrics.maxEdge);
          union.union(box); phase.union(box);
          if (span > peak) { peak = span; peakTime = elapsed; }
        }
        phases.push({ state, castIndex, min: phase.min.toArray(), max: phase.max.toArray() });
      }
    }
    return { name: 'runtime-transitions', min: union.min.toArray(), max: union.max.toArray(), peak, peakTime, maxEdge, phases };
  } finally { adapter.dispose(); }
}

function dispose(root) {
  const resources = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry); if (mesh.skeleton) resources.add(mesh.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) resources.add(material);
  });
  for (const resource of resources) resource.dispose();
  root.clear();
}

export async function audit({ root, manifest = 'manifest.json', fps = 30, only, runtime = false } = {}) {
  const manifestBytes = await readFile(resolve(root, manifest));
  const entries = JSON.parse(manifestBytes.toString('utf8')).models;
  const report = { root: resolve(root), manifest, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    fps, thresholds: { sizeRatio: 2, downHeights: 1, extensionHeights: 2, edgeRatio: 4 }, models: [], errors: [], flagged: [] };
  for (const [id, entry] of Object.entries(entries)) {
    if (only && !only.includes(id)) continue;
    if (!entry.animations?.idle) continue;
    let model;
    try {
      model = await loadGeometry(resolve(root, entry.path));
      const names = new Set(['idle', 'attack', 'cast'].map(action => entry.animations[action]).filter(Boolean));
      // Include sequence stages and every display variant, even ones not selected at star 1.
      const visit = value => {
        if (typeof value === 'string') names.add(value);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
      };
      visit(entry.castSequence); visit(entry.castVariants);
      const clips = [];
      for (const name of names) {
        const clip = model.animations.find(clip => clip.name === name);
        if (!clip) throw new Error(`missing-clip:${name}`);
        clips.push({ name, ...measureClip(model.scene, clip, fps) });
      }
      if (runtime) clips.push(await measureTransitions(model.scene, model.animations, entry, fps));
      const idle = clips[0], height = Math.max(idle.max[1] - idle.min[1], 1e-6);
      for (const clip of clips) {
        clip.sizeRatio = clip.peak / idle.peak;
        clip.downHeights = (idle.min[1] - clip.min[1]) / height;
        clip.extensionHeights = Math.max(...clip.max.map((v, i) => v - idle.max[i]), ...clip.min.map((v, i) => idle.min[i] - v)) / height;
        clip.edgeRatio = clip.maxEdge / Math.max(idle.maxEdge, 1e-6);
        clip.stretchedEdges = clip.edgeRatio > 4 && clip.maxEdge > height * .5;
        if (clip.sizeRatio > 2 || clip.downHeights > 1 || clip.extensionHeights > 2 || clip.stretchedEdges)
          report.flagged.push({ id, ...clip });
      }
      report.models.push({ id, clips });
      console.error(`${id}: ${clips.length} clips checked`);
    } catch (error) { report.errors.push({ id, error: error.message }); }
    finally { if (model) dispose(model.scene); }
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, ''), value = args[i + 1];
    if (!['root', 'manifest', 'output', 'fps', 'only', 'runtime'].includes(key) || !value) throw new Error(`invalid-option:${args[i]}`);
    options[key] = value;
  }
  options.root = resolve(options.root ?? 'assets3d-local/test-server-v8');
  options.fps = Number(options.fps ?? 30);
  if (!Number.isFinite(options.fps) || options.fps <= 0) throw new Error('invalid-fps');
  if (options.only) options.only = options.only.split(',');
  options.runtime = options.runtime === 'true';
  const report = await audit(options), json = JSON.stringify(report, null, 2);
  if (options.output) await writeFile(resolve(options.output), json + '\n');
  console.log(JSON.stringify({ models: report.models.length, errors: report.errors,
    flagged: report.flagged.map(({ id, name, sizeRatio, downHeights, extensionHeights, edgeRatio, stretchedEdges, min, max }) =>
      ({ id, name, sizeRatio, downHeights, extensionHeights, edgeRatio, stretchedEdges, min, max })) }, null, 2));
  if (report.errors.length) process.exitCode = 1;
}

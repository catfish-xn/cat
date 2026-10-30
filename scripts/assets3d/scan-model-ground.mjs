/** Landing height and tilt for every champion GLB under a configurable asset root.
 * Models stay outside git (assets3d-local/ or ASSETS3D_ROOT). This script only reads them.
 *
 * node --experimental-loader ./scripts/assets3d/ts-loader.mjs scripts/assets3d/scan-model-ground.mjs
 *   --root assets3d-local [--only irelia,akali] [--output assets3d-local/grounding-scan.json]
 *
 * Landing height is the lowest foot vertex (board units, y=0 is the cell plane) after the same
 * fitModel + idle contact update the board uses. Tilt is the support-plane angle before correction
 * and the skinned sole angle after it. Hovering models are listed and not flagged.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { AnimationMixer, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { loadGeometry } from './audit-skinned-bounds.mjs';
import { animationEnvelope, fitModel, HOVERING_MODELS, readUnitScale } from '../../src/rendering/three-mode/model-fit.ts';
import { supportRotation, updateModelGrounding } from '../../src/rendering/three-mode/model-grounding.ts';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, '');
  if (!['root', 'only', 'output'].includes(key) || !args[i + 1]) throw new Error(`invalid-option:${args[i]}`);
  options[key] = args[i + 1];
}
const root = resolve(options.root ?? process.env.ASSETS3D_ROOT ?? 'assets3d-local');
const only = options.only ? new Set(options.only.split(',').filter(Boolean)) : null;
const SOURCE_SCALE = 0.44, HEIGHT = 92, WIDTH = 110;
const GAP = 0.5, PENETRATION = -0.2, TILT = 1.5;
const up = new Vector3(0, 1, 0);
const point = new Vector3();

async function glbFiles() {
  const found = [];
  const walk = async dir => {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'cd' || entry.name === 'grounding-review' || entry.name === 'models-before') continue;
        await walk(path);
      } else if (entry.name.endsWith('.glb')) found.push(path);
    }
  };
  await walk(root);
  return found.sort();
}

function idOf(path, manifest) {
  if (manifest) {
    for (const [id, entry] of Object.entries(manifest.models ?? {})) {
      if (entry?.path && resolve(root, entry.path) === path) return id;
    }
  }
  return basename(path, '.glb');
}

function footMin(body) {
  let foot = Infinity, all = Infinity;
  body.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    const index = node.geometry.index, indices = node.geometry.attributes.skinIndex, weights = node.geometry.attributes.skinWeight;
    const count = index ? index.count : node.geometry.attributes.position.count;
    const seen = new Set();
    for (let i = 0; i < count; i++) seen.add(index ? index.getX(i) : i);
    for (const vertex of seen) {
      node.getVertexPosition(vertex, point).applyMatrix4(node.matrixWorld);
      all = Math.min(all, point.y);
      let best = 0, bone = 0;
      for (let k = 0; k < 4; k++) {
        const weight = weights.getComponent(vertex, k);
        if (weight > best) { best = weight; bone = indices.getComponent(vertex, k); }
      }
      const name = node.skeleton.bones[bone]?.name ?? '';
      if (/(?:^|_)(?:foot|toe|toes|ankle|paw|hoof|hooves)(?:_|$|\d)/i.test(name)
        && !/weapon|sword|blade|axe|shield|kama|kunai|dagger|hook|sickle|shuriken|buffbone|overhead|(?:^|_)fx(?:_|$)/i.test(name))
        foot = Math.min(foot, point.y);
    }
  });
  return { foot, all };
}

let manifest = null;
try { manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8')); }
catch { /* a loose GLB directory has no manifest */ }

const rows = [], anomalies = [], errors = [];
for (const path of await glbFiles()) {
  const id = idOf(path, manifest);
  if (only && !only.has(id) && !only.has(basename(path, '.glb'))) continue;
  const hovering = HOVERING_MODELS.has(id);
  let model;
  try { model = await loadGeometry(path); }
  catch (error) { errors.push({ id, error: String(error?.message ?? error) }); continue; }
  try {
    const clip = model.animations.find(c => c.name === 'idle') ?? model.animations[0];
    if (!clip) { errors.push({ id, error: 'no-animation' }); continue; }
    const envelope = animationEnvelope(model.scene, [{ clip, loop: true, ground: true, feet: true }]);
    const support = hovering ? undefined : envelope.support;
    const unitScale = manifest ? readUnitScale(manifest.models, id) ?? 1 : 1;
    const rotation = support ? supportRotation(support).angleTo(new Quaternion()) * 180 / Math.PI : 0;
    fitModel(model.scene, { height: HEIGHT, width: WIDTH, unitScale, sourceScale: SOURCE_SCALE,
      envelopeRadius: envelope.radius, ground: envelope.ground, feet: hovering ? null : envelope.feet, support });
    const mixer = new AnimationMixer(model.scene);
    mixer.clipAction(clip).play();
    const feet = [], soles = [];
    const times = 8;
    for (let i = 0; i < times; i++) {
      mixer.setTime(clip.duration * i / times);
      if (support) updateModelGrounding(model.scene, true, 1);
      model.scene.updateMatrixWorld(true);
      const measured = footMin(model.scene);
      feet.push(measured.foot);
      soles.push(measured.all);
    }
    mixer.stopAllAction();
    const footGap = { min: Math.min(...feet), max: Math.max(...feet) };
    const row = { id, hovering, frames: times, rotationDegrees: rotation,
      tiltDegrees: support?.tiltDegrees ?? null, soleDeviation: support?.soleDeviation ?? null, soleSpread: support?.soleSpread ?? null,
      footGap, meshMin: { min: Math.min(...soles), max: Math.max(...soles) },
      bakedFloor: support?.floor ?? null, method: support?.method ?? null };
    rows.push(row);
    const flags = [];
    if (!hovering && footGap.min < PENETRATION) flags.push(`穿透 ${footGap.min.toFixed(3)}`);
    if (!hovering && footGap.max > GAP) flags.push(`脚底离地 ${footGap.min.toFixed(3)}～${footGap.max.toFixed(3)}`);
    if (!hovering && (support?.tiltDegrees ?? 0) > TILT && rotation === 0) flags.push(`未回正倾斜 ${support.tiltDegrees.toFixed(2)}°（双脚差 ${support.soleSpread?.toFixed(2) ?? 'n/a'}°）`);
    if (flags.length) anomalies.push({ id, flags, ...row });
  } catch (error) {
    errors.push({ id, error: String(error?.message ?? error) });
  } finally {
    model.scene.traverse(node => {
      if (node.isMesh) { node.geometry.dispose(); node.skeleton?.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); }
    });
  }
}

const line = row => `${row.id.padEnd(22)} 脚隙 ${row.footGap.min.toFixed(3)}～${row.footGap.max.toFixed(3)}  倾斜 ${row.tiltDegrees == null ? '—' : row.tiltDegrees.toFixed(2) + '°'}  回正 ${row.rotationDegrees.toFixed(2)}°  源脚底 ${row.bakedFloor == null ? '—' : row.bakedFloor.toFixed(2)}  ${row.hovering ? '悬浮' : row.method ?? ''}`;
console.log(`# 落地扫描 ${root}`);
console.log(`# 棋盘平面 y=0，单位为棋盘单位（sourceScale ${SOURCE_SCALE}）。异常：脚隙 > ${GAP} 或 < ${PENETRATION}，或倾斜 > ${TILT}° 且未回正。`);
for (const row of rows) console.log(line(row));
console.log(`# 异常 ${anomalies.length}，读取失败 ${errors.length}`);
for (const row of anomalies) console.log(`! ${row.id}: ${row.flags.join('；')}`);
for (const row of errors) console.log(`! ${row.id}: ${row.error}`);
if (options.output) {
  await writeFile(options.output, JSON.stringify({ root, gap: GAP, penetration: PENETRATION, tilt: TILT, rows, anomalies, errors }, null, 2));
  console.log(`# wrote ${options.output}`);
}

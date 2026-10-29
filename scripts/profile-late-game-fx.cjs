// CPU-only crowded skill-effect probe. No browser, JSDOM, WebGL or FPS claims.
// Times particle updates, attack tracers and the LTK multi-pass scene walk.
const fs = require('node:fs');
const path = require('node:path');
const { performance, PerformanceObserver } = require('node:perf_hooks');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'artifacts/lag/fx');

function percentile(times, p) {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  let gcMs = 0, gcCount = 0;
  const gc = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) { gcMs += entry.duration; gcCount += 1; }
  });
  gc.observe({ entryTypes: ['gc'], buffered: true });
  await build({
    stdin: {
      resolveDir: root,
      contents: `
        export { ParticleEffect } from './src/rendering3d/particles';
        export { createSkillFeel } from './src/rendering/three-mode/skill-feel';
        export { createVfxPasses } from './src/rendering/three-mode/vfx-ltk/rendering/passes';
        export { GROUND_LAYER, FLOOR_LAYER } from './src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
        export { ltkRenderNeeds, LTK_PASS_DEGRADE_AT } from './src/rendering/three-mode/vfx-ltk/runtime';
        export * as THREE from 'three';
      `,
    },
    bundle: true, platform: 'node', format: 'cjs', outfile: path.join(out, 'fx.cjs'),
  });
  const a = require(path.join(out, 'fx.cjs'));
  const T = a.THREE;
  const camera = new T.PerspectiveCamera(45, 1, 1, 2000);
  camera.position.set(0, 400, 600); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const doc = (rate, life, kind = 'quad') => ({
    schemaVersion: 2,
    limits: { maxParticles: 80, maxDuration: 8 },
    emitters: [{
      kind, emission: { mode: 'continuous', rate, loop: true }, lifetime: life,
      velocity: [40, 80, 0], drag: 1.5, gravity: [0, -20, 0],
      ...(kind === 'trail' ? { trail: { width: [{ time: 0, value: 8 }, { time: 1, value: 1 }], lifetime: 0.35, segments: 8, uvMode: 'stretch' } } : {}),
    }],
  });
  const parent = new T.Group(); parent.position.set(10, 0, 20); parent.updateMatrixWorld(true);
  const quads = Array.from({ length: 8 }, () => new a.ParticleEffect(doc(50, 0.45), { scale: 1, maxParticles: 40 }));
  const trails = Array.from({ length: 4 }, () => new a.ParticleEffect(doc(20, 0.3, 'trail'), { scale: 1, maxParticles: 12 }));
  for (const fx of [...quads, ...trails]) parent.add(fx.object);
  for (let i = 0; i < 30; i++) for (const fx of quads) fx.update(1 / 60, camera);
  for (let i = 0; i < 30; i++) for (const fx of trails) fx.update(1 / 60, camera);
  const quadTimes = [], trailTimes = [];
  const beforeGc = gcMs;
  for (let i = 0; i < 180; i++) {
    parent.position.x = 10 + (i % 7);
    parent.updateMatrixWorld(true);
    let t = performance.now();
    for (const fx of quads) fx.update(1 / 60, camera);
    quadTimes.push(performance.now() - t);
    t = performance.now();
    for (const fx of trails) fx.update(1 / 60, camera);
    trailTimes.push(performance.now() - t);
  }
  const built = quads.map(fx => fx.builtMeshes ?? null);
  const live = quads.reduce((n, fx) => n + fx.particleCount, 0) + trails.reduce((n, fx) => n + fx.particleCount, 0);
  for (const fx of [...quads, ...trails]) fx.dispose();

  const feel = a.createSkillFeel();
  const from = new T.Vector3(), to = new T.Vector3(80, 0, 40);
  for (let i = 0; i < 20; i++) { feel.attack(from, to, true, 0); feel.update(1 / 60); }
  const attackTimes = [];
  for (let i = 0; i < 120; i++) {
    const t = performance.now();
    for (let n = 0; n < 24; n++) feel.attack(from, to, true, 0);
    feel.update(1 / 60);
    attackTimes.push(performance.now() - t);
  }
  feel.dispose();

  let traverseCalls = 0;
  const orig = T.Object3D.prototype.traverse;
  T.Object3D.prototype.traverse = function (callback) {
    traverseCalls += 1;
    return orig.call(this, callback);
  };
  const scene = new T.Scene(), floor = new T.Group();
  for (let u = 0; u < 16; u++) {
    const root = new T.Group();
    const skin = new T.SkinnedMesh(new T.PlaneGeometry(), new T.MeshBasicMaterial());
    let bone = new T.Bone(); skin.add(bone);
    for (let b = 0; b < 40; b++) { const next = new T.Bone(); bone.add(next); bone = next; }
    root.add(skin); scene.add(root);
  }
  const ground = new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial());
  ground.layers.set(a.GROUND_LAYER); scene.add(floor, ground);
  const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, render() {} };
  const passes = a.createVfxPasses(gl, () => [floor]);
  traverseCalls = 0;
  const passTimes = [];
  for (let i = 0; i < 40; i++) {
    const t = performance.now();
    passes.render(scene, camera, { early: false, late: false, soft: false });
    passTimes.push(performance.now() - t);
  }
  const traverseCallsPerPass = traverseCalls / 40;
  T.Object3D.prototype.traverse = orig;
  ground.geometry.dispose(); ground.material.dispose();

  const needs = a.ltkRenderNeeds(Array.from({ length: a.LTK_PASS_DEGRADE_AT }, () => ({ passes: { early: true, late: true, soft: true } })));
  const report = {
    node: process.version,
    quadFrame: { n: quadTimes.length, p50Ms: percentile(quadTimes, 0.5), p95Ms: percentile(quadTimes, 0.95) },
    trailFrame: { n: trailTimes.length, p50Ms: percentile(trailTimes, 0.5), p95Ms: percentile(trailTimes, 0.95) },
    attackBurst: { n: attackTimes.length, p50Ms: percentile(attackTimes, 0.5), p95Ms: percentile(attackTimes, 0.95) },
    passFrame: { n: passTimes.length, p50Ms: percentile(passTimes, 0.5), p95Ms: percentile(passTimes, 0.95), traverseCallsPerPass },
    liveParticles: live, builtMeshes: built, gcDuring: { ms: gcMs - beforeGc, count: gcCount },
    degradeAtCap: needs,
  };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report) + '\n');
  gc.disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; });

// CPU/allocation microbenchmarks only. No browser, JSDOM, WebGL or FPS claims.
// --baseline reads the two changed client modules from HEAD, without changing Git/worktree.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { build } = require('esbuild');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), out = path.resolve(process.argv[2] || 'artifacts/lag/client');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const baseline = process.argv.includes('--baseline');
  await build({ stdin: { resolveDir: root, contents: `
    export * from './src/rendering3d';
    export { createUnitOverhead, DEFAULT_METER_COLORS } from './src/rendering/three-mode/unit-overhead';
    export { ScoutMinimap } from './src/rendering/online/scout-minimap';
    export { createScoutStage } from './src/rendering/three-mode/scout-stage';
    export { createSkillFeel } from './src/rendering/three-mode/skill-feel';
    export { createVfxLibrary } from './src/rendering/three-mode/vfx-ltk/loader';
    export { createLtkParticles, unitAnchor, unitJoints } from './src/rendering/three-mode/vfx-ltk/particles';
    export { syntheticIndex, syntheticSystem, num, constant } from './tests/vfx-ltk-synthetic';
    export { RemoteSession } from './src/rendering/online/remote-session';
    export { createMatch } from './src/simulation/match';
    export * as THREE from 'three';
  ` }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(out, 'client.cjs'), plugins: baseline ? [{ name: 'baseline', setup(b) {
    b.onLoad({ filter: /src\/rendering\/online\/scout-minimap\.ts$/ }, ({ path: file }) => ({
      contents: execFileSync('git', ['show', `HEAD:${path.relative(root, file)}`], { cwd: root, encoding: 'utf8' }), loader: 'ts', resolveDir: path.dirname(file),
    }));
  } }] : [] });
  const a = require(path.join(out, 'client.cjs')), T = a.THREE;
  let created = 0, fills = 0;
  const context = { clearRect() {}, fillRect() { fills++; }, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  class Node {
    constructor() { created++; this.children = []; this.dataset = {}; this.style = {}; this.listeners = {}; }
    setAttribute() {} append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; }
    remove() {} addEventListener(type, cb) { this.listeners[type] = cb; } getContext() { return context; }
  }
  global.document = { createElement: () => new Node() };
  function bench(run, n = 2000) {
    for (let i = 0; i < 200; i++) run(i);
    const times = [];
    for (let i = 0; i < n; i++) { const t = performance.now(); run(i); times.push(performance.now() - t); }
    times.sort((x, y) => x - y); return { n, p50Ms: times[Math.floor(n * .5)], p95Ms: times[Math.floor(n * .95)] };
  }
  const report = { node: process.version, baseline, units: [], particles: [], minimap: [], scout: [], history: [] };
  const camera = new T.PerspectiveCamera(), scene = new T.Scene();
  camera.position.set(0, 300, 400); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  for (const count of [8, 24, 48]) {
    const units = Array.from({ length: count }, (_, i) => {
      const root = new T.Group(); scene.add(root);
      const bones = Array.from({ length: 24 }, (_, b) => { const bone = new T.Bone(); bone.name = `b${b}`; root.add(bone); return bone; });
      const clip = new T.AnimationClip('idle', 1, bones.map((bone, b) => new T.NumberKeyframeTrack(`${bone.name}.rotation[y]`, [0, .5, 1], [0, b / 100, 0])));
      const mixer = new T.AnimationMixer(root); mixer.clipAction(clip).play();
      const overhead = a.createUnitOverhead({ colors: () => a.DEFAULT_METER_COLORS, itemTexture: async () => null });
      const star = a.createStarMark({ effectiveStarLevel: 3, colorFor: () => '#fff' }); scene.add(star.object);
      const target = new T.Vector3(i, 0, i), turn = new a.UnitActionState(`u${i}`);
      return { root, mixer, overhead, star, target, turn };
    });
    const meters = { hp: 1800, maxHp: 2500, mana: 50, maxMana: 100, shield: 100 }, items = [{ id: 'x', icon: null }];
    const frame = bench(() => { for (const u of units) {
      u.root.position.addScaledVector(u.target.clone().sub(u.root.position), .1); u.turn.update(1 / 60); u.mixer.update(1 / 60);
      u.overhead.object.position.copy(u.root.position).setY(100); u.star.object.position.copy(u.root.position).setY(92);
    } scene.updateMatrixWorld(true); });
    const unchangedMeters = bench(() => { for (const u of units) u.overhead.set('player', meters, items); });
    const changingMeters = bench(i => { for (const u of units) u.overhead.set('player', { ...meters, hp: 1800 - i % 100 }, items); });
    report.units.push({ count, synthetic24BoneFrame: frame, unchangedMeters, changingMeters });
    for (const u of units) { u.mixer.stopAllAction(); u.mixer.uncacheRoot(u.root); u.root.removeFromParent(); u.overhead.dispose(); u.star.dispose(); }
  }
  // Authored LTK engine, real buffer writers, synthetic definition/texture only.
  const particleRoot = new T.Group();
  for (const rate of [30, 300, 3000]) {
    const library = a.createVfxLibrary('/synthetic/', { readJson: async url => url.endsWith('index.json') ? a.syntheticIndex()
      : a.syntheticSystem({ lifetime: a.num(100), rate: a.constant(a.num(rate)) }), readTexture: async () => new T.Texture() });
    const prepared = await library.load('sample');
    for (const count of [1, 3, 6]) {
    const effects = Array.from({ length: count }, (_, seed) => a.createLtkParticles(prepared, { anchor: a.unitAnchor(particleRoot, null), target: null, joints: a.unitJoints(particleRoot, null), duration: 100, seed }));
    const timing = bench(() => effects.forEach(fx => fx.update(1 / 60, camera)), 1000);
    report.particles.push({ rate, systems: count, liveParticles: effects.reduce((n, fx) => n + fx.driver.pool.count, 0), draws: effects.reduce((n, fx) => n + fx.draws.length, 0), timing });
    effects.forEach(fx => fx.dispose());
    }
    library.dispose();
  }
  const feel = a.createSkillFeel(), poolNodes = feel.object.children.length;
  for (let round = 1; round <= 40; round++) {
    for (let i = 0; i < 48; i++) feel.attack(new T.Vector3(), new T.Vector3(100, 0, 100), true, 0);
    for (let i = 0; i < 60; i++) feel.update(1 / 60);
    assert.equal(feel.object.children.length, poolNodes);
  }
  report.skillFeel = { rounds: 40, poolNodes, after: feel.object.children.length, visibleAfterExpiry: feel.object.children.filter(n => n.visible).length }; feel.dispose();
  for (const count of [8, 24, 48]) {
    const view = { mySeatId: 's0', opponentSeatId: 's1', seats: Array.from({ length: 8 }, (_, i) => ({ seatId: `s${i}`, name: `s${i}`, hp: 80, alive: true,
      publicBoard: { units: Array.from({ length: count }, (_, u) => ({ definitionId: 'vex', cell: { row: 4 + Math.floor(u / 7) % 4, col: u % 7 } })) } })) };
    const minimap = new a.ScoutMinimap(new Node(), () => {}); minimap.render(view, null); const start = created;
    const clones = Array.from({ length: 40 }, () => structuredClone(view));
    const timing = bench(i => minimap.render(clones[i % clones.length], null), 800);
    report.minimap.push({ unitsPerSeat: count, publications: 1000, createdNodes: created - start, timing }); minimap.dispose();
  }
  const owned = [], stage = a.createScoutStage({ scene, championHeight: 92, championWidth: 110, pawnHeight: 56, pawnWidth: 40, loadModel: null,
    legendModel: () => null, myLegend: () => null, starColor: () => '#fff', overhead: { colors: () => a.DEFAULT_METER_COLORS, itemTexture: async () => null }, itemIcon: () => null,
    own: resource => { owned.push(resource); return resource; } });
  const frame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null };
  for (let round = 1; round <= 40; round++) {
    stage.show({ seatId: `s${round % 8}`, name: 'test', board: { units: Array.from({ length: 12 }, (_, i) => ({ definitionId: 'vex', starLevel: 2, cell: { row: 4 + Math.floor(i / 7), col: i % 7 }, items: [] })) } }, frame);
    const nodes = []; stage.group.traverse(n => nodes.push(n)); report.scout.push({ round, nodes: nodes.length, owned: owned.length });
  }
  stage.show(null, null); report.scoutAfterClear = stage.group.children.length; stage.dispose(); owned.forEach(r => r.dispose());
  const client = { transport: 'local-room', send: () => ({ ok: 'pending', commandId: 0 }) }, initial = a.createMatch(42);
  const session = new a.RemoteSession(client, initial, () => 0);
  for (let round = 1; round <= 40; round++) {
    session.receiveState({ ...initial, round });
    const view = { combatId: `c${round}`, tick: 0, maxTicks: 1200, status: 'running', result: null, board: { rows: 8, columns: 7 }, units: [] };
    const ticks = Array.from({ length: 601 }, (_, tick) => ({ tick, events: [] })), terminal = { ...view, tick: 600, status: 'finished' };
    session.receiveReplay({ initial: view, ticks, terminal });
    if (round % 10 === 0) report.history.push({ round, recordings: session.battleHistory.length, retainedFrames: session.battleHistory.reduce((n, b) => n + b.replay.ticks.length, 0) });
  }
  session.forgetBattles(); report.historyAfterForget = session.battleHistory.length; session.dispose();
  report.streamPrefixes = [];
  for (const ticks of [300, 600, 1200]) {
    const sample = new a.RemoteSession(client, initial, () => 0), view = { combatId: 'prefix', tick: 0, units: [] };
    let reads = 0;
    const frames = Array.from({ length: ticks + 1 }, (_, tick) => ({ tick, events: [] }));
    const prefix = length => ({ initial: view, terminal: view, stream: { revision: 1, fromTick: 0, ended: false },
      ticks: new Proxy(frames.slice(0, length), { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } }) });
    sample.receiveReplay(prefix(1)); const started = performance.now();
    for (let through = 2; through <= ticks + 1; through++) sample.reviseReplay(prefix(through));
    report.streamPrefixes.push({ ticks, frameReferenceReads: reads, totalMs: performance.now() - started }); sample.forgetBattles(); sample.dispose();
  }
  assert.equal(report.historyAfterForget, 0); assert.equal(report.scoutAfterClear, 0);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ out, minimap: report.minimap, skillFeel: report.skillFeel, scoutAfterClear: report.scoutAfterClear, history: report.history }) + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; });

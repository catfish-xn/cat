import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VfxSystem, setVfxSeed } from './vfx.js';

const BASE = `${import.meta.env.BASE_URL}assets/`;
const params = new URLSearchParams(location.search);
let procedural = params.get('animation') === 'procedural';
// 联盟单位 → 场景单位。一格六边形中心距 ≈ 180 联盟单位
const LOL = 1 / 92;
const VFX_SCALE = Number(params.get('vfxScale') ?? 0.6);
const HEX_R = 1; // 六边形外接圆半径
const HEX_W = Math.sqrt(3) * HEX_R;
const ROW_H = 1.5 * HEX_R;

// ---------- 渲染器、场景、镜头 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1724);
scene.fog = new THREE.Fog(0x0d1724, 80, 180);

// 云顶镜头：从己方一侧斜俯视，约 55° 俯角，窄视角
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const camTarget = new THREE.Vector3(0, 0, 0.9);
function placeCamera() {
  const zoom = params.has('zoom');
  if (zoom) camTarget.set(0, 0, -3);
  const pitch = 54 * Math.PI / 180, dist = zoom ? 11 : params.get('shot') === 'board' ? 55 : 34;
  camera.position.set(0, Math.sin(pitch) * dist, camTarget.z + Math.cos(pitch) * dist);
  camera.lookAt(camTarget);
}
placeCamera();

scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x2a2018, 1.4));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
sun.shadow.radius = 4;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x7fb4ff, 0.8);
rim.position.set(5, 6, -10);
scene.add(rim);

// ---------- 棋盘（自建：官方竞技场几何 .mapgeo 在 CommunityDragon 上拿不到） ----------
const COLS = 7, ROWS = 8; // 每方 4 行 × 7 列
function hexCenter(col, row) {
  const x = (col - (COLS - 1) / 2) * HEX_W + (row % 2 ? HEX_W / 2 : 0) - HEX_W / 4;
  const z = ((ROWS - 1) / 2 - row) * ROW_H; // row 0 在己方最靠镜头处
  return new THREE.Vector3(x, 0, z);
}

function hexShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const p = [Math.cos(a) * r, Math.sin(a) * r];
    i ? s.lineTo(...p) : s.moveTo(...p);
  }
  s.closePath();
  return s;
}

function buildBoard() {
  const g = new THREE.Group();
  // 底座平台
  const platW = COLS * HEX_W + 3.2, platD = ROWS * ROW_H + 6.5;
  const plat = new THREE.Mesh(
    new THREE.BoxGeometry(platW, 0.6, platD),
    new THREE.MeshStandardMaterial({ color: 0x2b3542, roughness: 0.85 }));
  plat.position.y = -0.36; plat.receiveShadow = true; g.add(plat);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(platW + 0.25, 0.12, platD + 0.25),
    new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.4, metalness: 0.7 }));
  trim.position.y = -0.08; g.add(trim);
  const inner = new THREE.Mesh(
    new THREE.BoxGeometry(platW - 0.3, 0.05, platD - 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1d2631, roughness: 0.9 }));
  inner.position.y = -0.01; inner.receiveShadow = true; g.add(inner);
  // 远处地面
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.7; ground.receiveShadow = true; g.add(ground);

  const tileGeo = new THREE.ExtrudeGeometry(hexShape(HEX_R * 0.9), { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 });
  tileGeo.rotateX(-Math.PI / 2);
  const edgeGeo = new THREE.EdgesGeometry(new THREE.ShapeGeometry(hexShape(HEX_R * 0.95)));
  edgeGeo.rotateX(-Math.PI / 2);
  const mats = {
    ally: [new THREE.MeshStandardMaterial({ color: 0x5f7f8c, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x56747f, roughness: 0.7 })],
    enemy: [new THREE.MeshStandardMaterial({ color: 0x86706a, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x7a6560, roughness: 0.7 })],
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xd8e6ef, transparent: true, opacity: 0.35 });
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const side = row < 4 ? 'ally' : 'enemy';
    const tile = new THREE.Mesh(tileGeo, mats[side][(row + col) % 2]);
    tile.position.copy(hexCenter(col, row));
    tile.receiveShadow = true;
    g.add(tile);
    const edge = new THREE.LineSegments(edgeGeo, edgeMat);
    edge.position.copy(tile.position).setY(0.2);
    g.add(edge);
  }
  // 备战席（双方各 9 格）
  const benchGeo = new THREE.BoxGeometry(HEX_W * 0.82, 0.1, HEX_W * 0.82);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x3c4a59, roughness: 0.8 });
  for (const z of [ROWS / 2 * ROW_H + 2.0, -(ROWS / 2 * ROW_H + 2.0)]) for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(benchGeo, benchMat);
    b.position.set((i - 4) * HEX_W * 0.92, 0.02, z);
    b.receiveShadow = true; g.add(b);
  }
  return g;
}
const proceduralBoard = buildBoard();

// ---------- 英雄 ----------
const manifest = await (await fetch(`${BASE}manifest.json`)).json().catch(() => null);
if (!manifest) {
  document.getElementById('missing').hidden = false;
  throw new Error('缺少素材，先运行 npm run fetch-assets');
}
procedural ||= !Object.values(manifest.units).every(info => info.rigged);
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
let arena = null;
if (manifest.arena && params.get('board') !== 'procedural') {
  arena = (await gltfLoader.loadAsync(BASE + manifest.arena.model)).scene;
  // Map22's authored arena center is (2000, 0, 2000); keep League world scale.
  arena.scale.setScalar(LOL);
  arena.position.set(-2000 * LOL, 0, -2000 * LOL);
  arena.traverse(o => {
    if (/^Layer[2-8]$/.test(o.name)) o.visible = false;
    if (o.isLight) o.visible = false;
    if (o.isMesh) o.receiveShadow = true;
  });
  scene.add(arena);
} else scene.add(proceduralBoard);
const clips = {};
async function loadUnitTemplate(id) {
  const info = manifest.units[id];
  const [gltf, tex] = await Promise.all([
    gltfLoader.loadAsync(BASE + (!procedural && info.rigged ? info.rigged : info.model)),
    texLoader.loadAsync(BASE + info.texture),
  ]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35 });
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    // lol2gltf groups Body and Torch into one skinned mesh; hide Torch by material.
    const replace = m => m.name === 'Torch' ? new THREE.MeshBasicMaterial({ visible: false }) : mat;
    o.material = Array.isArray(o.material) ? materials.map(replace) : replace(o.material);
    o.castShadow = true;
  });
  gltf.scene.scale.setScalar(info.skinScale * LOL);
  clips[id] = gltf.animations;
  return gltf.scene;
}
const templates = { jinx: await loadUnitTemplate('jinx'), vi: await loadUnitTemplate('vi') };

const hud = document.getElementById('hud');
class Unit {
  constructor(id, col, row, team, star) {
    this.id = id; this.team = team; this.home = hexCenter(col, row);
    this.root = new THREE.Group();
    this.body = cloneSkeleton(templates[id]);
    this.body.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
    this.mixer = new THREE.AnimationMixer(this.body);
    this.actions = Object.fromEntries(clips[id].map(c => [c.name, this.mixer.clipAction(c)]));
    this.root.add(this.body);
    this.root.position.copy(this.home);
    this.root.rotation.y = team === 'ally' ? Math.PI : 0; // 面向对方
    scene.add(this.root);
    // 脚下光圈
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 40),
      new THREE.MeshBasicMaterial({ color: team === 'ally' ? 0x4fd2ff : 0xff5a4f, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.22; this.root.add(ring);
    this.anim = 'idle'; this.t = Math.random() * 3; this.hp = 1; this.mana = 0.3 + Math.random() * 0.4;
    this.el = document.createElement('div');
    this.el.className = `bar ${team}`;
    this.el.innerHTML = `<div class="stars">${'★'.repeat(star)}</div><div class="hp"><i></i></div><div class="mp"><i></i></div>`;
    hud.appendChild(this.el);
    this.flash = 0;
    this.play('idle');
  }
  setMaterialFlash(v) {
    this.body.traverse((o) => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m.emissive) m.emissiveIntensity = 0.35 + v * 1.4; });
  }
  play(name, target) {
    if (this.anim === 'death' && name !== 'death') {
      this.el.style.opacity = '1';
      this.body.traverse(o => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.opacity = 1; m.transparent = false; } });
    }
    this.anim = name; this.t = 0; this.target = target; this.fired = false;
    this.mixer.stopAllAction();
    const action = this.actions[name === 'hit' ? 'idle' : name];
    if (action) {
      action.reset().setLoop(['idle', 'move', 'hit'].includes(name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = true;
      action.play();
    }
  }
}

const units = [
  new Unit('jinx', 2, 0, 'ally', 2),
  new Unit('vi', 3, 2, 'ally', 2),
  new Unit('vi', 3, 5, 'enemy', 1),
  new Unit('jinx', 4, 7, 'enemy', 1),
];
const [allyJinx, allyVi, enemyVi, enemyJinx] = units;

// ---------- 技能特效：金克丝“死亡火箭” ----------
async function loadVfx(name) {
  const def = await (await fetch(BASE + manifest.vfx[name])).json();
  // 特效整体尺寸：原版数值直接套用会覆盖约 5 格，这里按 0.6 缩小（换算比例是估计值）
  const geometry = new Map();
  for (const e of [...(def.complexEmitterDefinitionData ?? []), ...(def.simpleEmitterDefinitionData ?? [])]) {
    if (!e.meshGlb || geometry.has(e.meshGlb)) continue;
    const model = await gltfLoader.loadAsync(BASE + e.meshGlb);
    model.scene.traverse(o => { if (o.isMesh) geometry.set(e.meshGlb, o.geometry); });
  }
  return new VfxSystem(def, { baseUrl: BASE, scale: LOL * VFX_SCALE, geometry });
}
const vfxTar = await loadVfx('TFT13_Jinx_Base_R_Tar');
const vfxRocket = await loadVfx('TFT13_Jinx_Base_R_Rocket_Child');
{
  const kinds = {};
  for (const s of vfxTar.skipped) { const k = s.match(/（(.*)）/)?.[1] ?? '其他'; kinds[k] = (kinds[k] ?? 0) + 1; }
  const info = document.getElementById('vfx-info');
  info.textContent = `金克丝大招命中特效：原版 ${vfxTar.emitters.length + vfxTar.skipped.length} 个发射器，还原 ${vfxTar.emitters.length} 个，跳过 ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join('、')}`;
  info.title = vfxTar.skipped.join('\n');
}
const liveVfx = [];
window.__dbg = { vfxRocket, vfxTar, liveVfx, units, scene, camera, arena, procedural };
const projectiles = [];

// 火箭本体和尾焰都使用原版粒子定义；本体几何来自 WAD 中的 SCB。
const rocketVfx = await loadVfx('TFT13_Jinx_Base_R_Mis');
function spawnRocket(from, to, target) {
  const start = from.clone().setY(1.3), end = to.clone().setY(0.3);
  const mesh = new THREE.Group(); scene.add(mesh);
  const effect = rocketVfx.spawn(mesh, new THREE.Vector3());
  projectiles.push({ start, end, t: 0, dur: 0.55, trailT: 0, mesh, effect, target });
}
function spawnTracer(from, to, color) {
  const geo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const a = from.clone().setY(1.0), b = to.clone().setY(0.9);
  m.position.copy(a); m.lookAt(b); m.scale.z = a.distanceTo(b);
  scene.add(m);
  projectiles.push({ tracer: m, t: 0, dur: 0.12 });
}

// ---------- 动画：默认原版骨骼，保留程序动画作同镜头对比 ----------
const ease = (x) => 1 - Math.pow(1 - x, 3);
function animate(u, dt) {
  if (!procedural && u.actions.idle) { animateOriginal(u, dt); return; }
  u.t += dt;
  const b = u.body, r = u.root;
  b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.setScalar(templates[u.id].scale.x);
  r.position.copy(u.home);
  const toTarget = u.target ? u.target.home.clone().sub(u.home).setY(0).normalize() : new THREE.Vector3();
  let flash = 0;
  switch (u.anim) {
    case 'idle': {
      b.position.y = Math.sin(u.t * 2.2) * 0.03;
      b.scale.y *= 1 + Math.sin(u.t * 2.2 + 1) * 0.015;
      b.rotation.y = Math.sin(u.t * 0.7) * 0.06;
      break;
    }
    case 'move': {
      r.position.addScaledVector(toTarget.lengthSq() ? toTarget : new THREE.Vector3(0, 0, -1), Math.sin(u.t) * 0.8);
      b.position.y = Math.abs(Math.sin(u.t * 7)) * 0.08;
      break;
    }
    case 'attack': {
      const d = 0.6;
      const k = Math.min(u.t / d, 1);
      if (u.id === 'vi') {
        // 前冲出拳
        const lunge = k < 0.35 ? ease(k / 0.35) : 1 - ease((k - 0.35) / 0.65);
        r.position.addScaledVector(toTarget, lunge * 0.9);
        b.rotation.x = lunge * 0.25;
        if (!u.fired && k > 0.35) { u.fired = true; u.target.hit(); }
      } else {
        // 机枪后坐
        const recoil = Math.sin(Math.min(k * 4, 1) * Math.PI) * 0.12;
        r.position.addScaledVector(toTarget, -recoil);
        b.rotation.x = -recoil;
        if (!u.fired && k > 0.2) { u.fired = true; spawnTracer(u.home, u.target.home, 0xffd27a); u.target.hit(); }
      }
      if (k >= 1) u.play('idle');
      break;
    }
    case 'cast': {
      const d = 1.0, k = Math.min(u.t / d, 1);
      const jump = Math.sin(k * Math.PI);
      b.position.y = jump * 0.5;
      b.rotation.y = ease(k) * Math.PI * 2;
      flash = Math.sin(k * Math.PI) * 0.6;
      if (!u.fired && k > 0.45) {
        u.fired = true;
        if (u.id === 'jinx') spawnRocket(u.home, u.target.home, u.target);
        else { u.target.hit(); liveVfx.push(vfxTar.spawn(scene, u.target.home.clone(), { timeScale: 1 })); }
      }
      if (k >= 1) u.play('idle');
      break;
    }
    case 'death': {
      const k = Math.min(u.t / 1.1, 1);
      b.rotation.x = -ease(Math.min(k * 1.6, 1)) * Math.PI / 2;
      b.position.y = -Math.max(0, k - 0.6) * 1.2;
      b.traverse((o) => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.transparent = true; m.opacity = 1 - Math.max(0, (k - 0.5) * 2); } });
      u.el.style.opacity = String(1 - k);
      if (u.t > 2.4) { u.reset(); }
      break;
    }
    case 'hit': {
      const k = Math.min(u.t / 0.3, 1);
      r.position.addScaledVector(u.hitDir ?? new THREE.Vector3(), Math.sin(k * Math.PI) * 0.12);
      flash = 1 - k;
      if (k >= 1) u.play('idle');
      break;
    }
  }
  u.setMaterialFlash(flash);
}
function animateOriginal(u, dt) {
  u.t += dt;
  u.mixer.update(dt);
  u.root.position.copy(u.home);
  const action = u.actions[u.anim];
  const duration = action?.getClip().duration ?? 0.3;
  if (u.anim === 'move') {
    const direction = u.team === 'ally' ? -1 : 1;
    u.root.position.z += direction * Math.sin(u.t * 0.8) * 1.2;
  }
  if (['attack', 'cast'].includes(u.anim) && !u.fired && u.t >= duration * (u.anim === 'cast' ? 0.45 : 0.3)) {
    u.fired = true;
    if (u.anim === 'cast' && u.id === 'jinx') spawnRocket(u.home, u.target.home, u.target);
    else {
      if (u.id === 'jinx') spawnTracer(u.home, u.target.home, 0xffd27a);
      u.target?.hit();
    }
  }
  u.setMaterialFlash(u.anim === 'hit' ? Math.max(0, 1 - u.t / 0.3) : 0);
  if (['attack', 'cast', 'hit'].includes(u.anim) && u.t >= duration) u.play('idle');
  if (u.anim === 'death') u.el.style.opacity = '0';
}
Unit.prototype.hit = function () {
  this.hp = Math.max(0.05, this.hp - 0.18);
  this.hitDir = this.team === 'ally' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);
  if (this.anim === 'idle' || this.anim === 'hit') this.play('hit');
};
Unit.prototype.reset = function () {
  this.play('idle'); this.hp = 1;
  this.body.traverse((o) => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.opacity = 1; m.transparent = false; } });
  this.el.style.opacity = '1';
};

// ---------- 主循环 ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
let paused = false;
function frame(dtOverride, draw = true) {
  const dt = dtOverride ?? Math.min(clock.getDelta(), 0.05);
  for (const u of units) animate(u, dt);
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.t += dt;
    const k = Math.min(p.t / p.dur, 1);
    if (p.tracer) {
      p.tracer.material.opacity = 1 - k;
      if (k >= 1) { p.tracer.removeFromParent(); projectiles.splice(i, 1); }
      continue;
    }
    const pos = p.start.clone().lerp(p.end, k); pos.y += Math.sin(k * Math.PI) * 1.6;
    const ahead = p.start.clone().lerp(p.end, Math.min(k + 0.02, 1)); ahead.y += Math.sin(Math.min(k + 0.02, 1) * Math.PI) * 1.6;
    p.mesh.position.copy(pos); p.mesh.lookAt(ahead);
    p.effect?.update(dt, camera);
    p.trailT -= dt;
    if (p.trailT <= 0) {
      p.trailT = 0.03;
      // 原版发射点在挂点下方 180，这里抬回来
      liveVfx.push(vfxRocket.spawn(scene, pos.clone().setY(pos.y + 180 * LOL * VFX_SCALE), { timeScale: 1.6 }));
    }
    if (k >= 1) {
      projectiles.splice(i, 1);
      p.mesh.removeFromParent();
      p.effect?.dispose();
      liveVfx.push(vfxTar.spawn(scene, p.end.clone().setY(0.15)));
      p.target?.hit();
    }
  }
  for (let i = liveVfx.length - 1; i >= 0; i--) { liveVfx[i].update(dt, camera); if (liveVfx[i].done) liveVfx.splice(i, 1); }
  if (!draw) return;
  renderer.render(scene, camera);
  // 血条跟随
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const u of units) {
    tmp.copy(u.root.position).setY(2.55).project(camera);
    u.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    u.el.querySelector('.hp i').style.width = `${u.hp * 100}%`;
    u.el.querySelector('.mp i').style.width = `${u.mana * 100}%`;
  }
}
function loop() { if (!paused) frame(); requestAnimationFrame(loop); }

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- 控件 ----------
let selected = allyJinx;
const targetOf = (u) => (u.team === 'ally' ? enemyVi : allyVi);
document.querySelectorAll('[data-unit]').forEach((btn) => btn.addEventListener('click', () => {
  selected = { 'ally-jinx': allyJinx, 'ally-vi': allyVi, 'enemy-vi': enemyVi, 'enemy-jinx': enemyJinx }[btn.dataset.unit];
  document.querySelectorAll('[data-unit]').forEach((b) => b.classList.toggle('on', b === btn));
}));
document.querySelectorAll('[data-anim]').forEach((btn) => btn.addEventListener('click', () => {
  selected.play(btn.dataset.anim, targetOf(selected));
}));
document.getElementById('vfx-only').addEventListener('click', () => {
  liveVfx.push(vfxTar.spawn(scene, enemyVi.home.clone().setY(0.15)));
});
document.getElementById('comparison').href = `?animation=${procedural ? 'original' : 'procedural'}`;
document.getElementById('comparison').textContent = procedural ? '切换原版骨骼动作' : '对比程序动画';
document.getElementById('note').textContent = `${manifest.wadVersion ?? manifest.version} 素材 · ${procedural ? '程序动作对比' : '原版骨骼与五类动作'} · ${arena ? 'Map22 原版竞技场' : '自建棋盘'}。`;
window.__trial = { frame, units, scene, camera, manifest, procedural };
let demo = null;
document.getElementById('demo').addEventListener('click', (ev) => {
  if (demo) { clearInterval(demo); demo = null; ev.target.textContent = '自动演示'; return; }
  ev.target.textContent = '停止演示';
  let step = 0;
  demo = setInterval(() => {
    const seq = [
      () => allyJinx.play('attack', enemyVi), () => enemyVi.play('attack', allyVi), () => allyVi.play('attack', enemyVi),
      () => enemyJinx.play('attack', allyVi), () => allyJinx.play('cast', enemyVi), () => {}, () => enemyVi.play('death'),
      () => {}, () => {},
    ];
    seq[step % seq.length](); step++;
  }, 700);
});

// 截图用：?shot=idle|cast|impact|death 固定到某个瞬间后暂停
const shot = params.get('shot');
if (shot) {
  paused = true;
  setVfxSeed(7);
  units.forEach((u, i) => { u.t = i * 0.8; });
  const step = (sec) => { for (let i = 0; i < sec * 60; i++) frame(1 / 60, false); };
  step(0.5);
  if (shot === 'cast') { allyJinx.play('cast', enemyVi); step(0.75); }
  if (shot === 'impact') { liveVfx.push(vfxTar.spawn(scene, enemyVi.home.clone().setY(0.15))); step(0.2); }
  if (shot === 'move') { allyJinx.play('move', enemyVi); allyVi.play('move', enemyVi); step(0.3); }
  if (shot === 'attack') { allyVi.play('attack', enemyVi); enemyJinx.play('attack', allyVi); step(0.22); }
  if (shot === 'death') { enemyVi.play('death'); step(0.75); }
  // 等特效贴图加载完再画最后一帧
  setTimeout(() => { frame(0); document.body.dataset.ready = '1'; }, 1500);
} else {
  document.body.dataset.ready = '1';
}
loop();

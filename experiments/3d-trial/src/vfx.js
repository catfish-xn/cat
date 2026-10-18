// 原版粒子定义（VfxSystemDefinitionData 的 JSON）的简化解释器。
// 能还原：贴图、颜色曲线、缩放曲线、寿命、延迟、数量、初速度、阻力、加速度、
// 发射形状（圆柱/球/偏移+绕轴随机旋转）、贴地/朝镜头/沿速度/任意朝向的面片、序列帧、
// 溶解贴图（alpha erosion）、加法/透明混合。
// 不还原（跳过）：网格粒子（.scb 拿不到）、镜头拖尾、屏幕扭曲、子粒子系统、软粒子、调色板。
import * as THREE from 'three';

let seed = 1;
export function setVfxSeed(s) { seed = s >>> 0 || 1; }
function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

const DEG = Math.PI / 180;
const BOARD_TOP = 0.2; // 棋盘格子表面高度（场景单位），贴地粒子放在它上面
const loader = new THREE.TextureLoader();
const texCache = new Map();
function getTexture(url, srgb = true) {
  if (!texCache.has(url)) {
    const t = loader.load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(url, t);
  }
  return texCache.get(url);
}

// ---- 取值：常量 / 动画曲线 / 概率表 ----
function sampleCurve(dyn, t) {
  const { times, values } = dyn;
  if (!times || times.length === 0) return values?.[0];
  if (t <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++) {
    if (t <= times[i]) {
      const a = values[i - 1], b = values[i], k = (t - times[i - 1]) / ((times[i] - times[i - 1]) || 1);
      return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * k) : a + (b - a) * k;
    }
  }
  return values[values.length - 1];
}
function applyProbability(v, tables) {
  if (!tables) return v;
  const one = (x, tab) => {
    if (!tab || !tab.keyValues) return x;
    const kv = tab.keyValues;
    if (kv.length === 1) return x + rand() * kv[0];
    return x * (kv[0] + (kv[kv.length - 1] - kv[0]) * rand());
  };
  return Array.isArray(v) ? v.map((x, i) => one(x, tables[i])) : one(v, tables[0]);
}
// 出生时取一次值（含随机）
function birthValue(field, fallback) {
  if (!field) return fallback;
  const dyn = field.dynamics;
  let v = dyn ? sampleCurve(dyn, 0) : field.constantValue;
  if (v === undefined) v = field.constantValue ?? fallback;
  return applyProbability(Array.isArray(v) ? [...v] : v, dyn?.probabilityTables);
}
// 随粒子寿命变化的曲线（0..1）
function overLife(field, t, fallback) {
  if (!field) return fallback;
  if (field.dynamics) return sampleCurve(field.dynamics, t);
  return field.constantValue ?? fallback;
}

// ---- 粒子着色器：贴图 × 颜色，序列帧，溶解 ----
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
  uniform sampler2D map; uniform vec4 uvRect; uniform vec4 tint;
  uniform sampler2D erosionMap; uniform vec4 erosionMixer; uniform float erosion; uniform vec2 feather; uniform float useErosion;
  uniform float additive;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(map, uvRect.xy + vUv * uvRect.zw);
    vec4 c = tex * tint;
    if (useErosion > 0.5) {
      float e = dot(texture2D(erosionMap, vUv), erosionMixer);
      c.a *= smoothstep(erosion - feather.x, erosion + feather.y, e);
    }
    if (c.a < 0.003) discard;
    gl_FragColor = additive > 0.5 ? vec4(c.rgb * c.a, 1.0) : c;
  }`;

const SUPPORTED = new Set([undefined, 'VfxPrimitiveArbitraryQuad', 'VfxPrimitiveRay']);

export class VfxSystem {
  // def: 原版 JSON；scale: 联盟单位 → 场景单位
  constructor(def, { baseUrl, scale }) {
    this.def = def;
    this.scale = scale;
    this.emitters = [];
    this.skipped = [];
    const all = [...(def.complexEmitterDefinitionData ?? []), ...(def.simpleEmitterDefinitionData ?? [])];
    const only = new URLSearchParams(location.search).get('only');
    for (const e of all) {
      if (only && !new RegExp(only).test(e.emitterName)) continue;
      const prim = e.primitive?.__type;
      if (!SUPPORTED.has(prim) || !e.texturePng || e.distortionDefinition) {
        const why = prim === 'VfxPrimitiveMesh' ? '网格' : prim === 'VfxPrimitiveCameraTrail' ? '拖尾' : e.distortionDefinition ? '扭曲' : prim;
        this.skipped.push(`${e.emitterName}（${why}）`);
        continue;
      }
      this.emitters.push({
        def: e,
        texture: getTexture(baseUrl + e.texturePng),
        erosion: e.erosionMapPng ? getTexture(baseUrl + e.erosionMapPng, false) : null,
      });
    }
  }

  spawn(scene, position, { yaw = 0, timeScale = 1 } = {}) {
    return new VfxInstance(this, scene, position, yaw, timeScale);
  }
}

class VfxInstance {
  constructor(system, scene, position, yaw, timeScale) {
    this.system = system;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = yaw;
    scene.add(this.group);
    this.time = 0;
    this.timeScale = timeScale;
    this.particles = [];
    this.pending = [];
    this.done = false;
    for (const em of system.emitters) {
      const e = em.def;
      const count = Math.max(1, Math.round(birthValue(e.rate, 1)));
      const delay = e.timeBeforeFirstEmission ?? 0;
      const emLife = e.lifetime ?? 1;
      for (let i = 0; i < count; i++) {
        // 单发：一次性全部发出；连续：在发射器寿命内均匀发出
        const t0 = e.isSingleParticle ? delay : delay + (i / count) * emLife;
        this.pending.push({ em, t0 });
      }
    }
    this.pending.sort((a, b) => a.t0 - b.t0);
    this.maxTime = Math.max(...this.pending.map((p) => p.t0 + 3), 0.5);
  }

  birth({ em }) {
    const e = em.def, S = this.system.scale;
    let life = birthValue(e.particleLifetime, 1);
    if (life < 0) life = e.lifetime ?? 1;
    const [cols, rows] = e.texDiv ?? [1, 1];
    const frames = e.numFrames ?? cols * rows;
    const name = e.emitterName ?? '';
    const additive = e.blendMode === 4 || (e.blendMode === undefined && /^add/i.test(name));
    const ero = e.alphaErosionDefinition;
    const mixer = ero?.erosionMapChannelMixer?.constantValue ?? [0, 0, 0, 1];
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        map: { value: em.texture }, uvRect: { value: new THREE.Vector4(0, 0, 1, 1) }, tint: { value: new THREE.Vector4(1, 1, 1, 1) },
        erosionMap: { value: em.erosion ?? em.texture }, erosionMixer: { value: new THREE.Vector4(...mixer) },
        erosion: { value: 0 }, feather: { value: new THREE.Vector2(ero?.erosionFeatherIn ?? 0.05, ero?.erosionFeatherOut ?? 0.05) },
        useErosion: { value: ero ? 1 : 0 }, additive: { value: additive ? 1 : 0 },
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    if (!em.erosion && ero) mat.uniforms.erosionMixer.value.set(0, 0, 0, 1); // 没有单独溶解图时用本身 alpha
    const mesh = new THREE.Mesh(PLANE, mat);
    mesh.renderOrder = 10 + (e.pass ?? 0) / 10000;

    // 发射位置与形状
    const pos = new THREE.Vector3(...birthValue(e.EmitterPosition, [0, 0, 0]));
    const vel = new THREE.Vector3(...birthValue(e.birthVelocity, [0, 0, 0]));
    const shape = e.SpawnShape ?? {};
    if (shape.__type === 'VfxShapeCylinder' || shape.__type === 'VfxShapeSphere') {
      const r = (shape.radius ?? 0) * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      pos.x += Math.cos(a) * r; pos.z += Math.sin(a) * r;
      vel.applyAxisAngle(UP, -a); // 速度的 x 分量按出生方向朝外
      if (shape.__type === 'VfxShapeSphere') pos.y += (rand() * 2 - 1) * (shape.radius ?? 0);
    }
    if (shape.emitOffset) pos.add(new THREE.Vector3(...birthValue(shape.emitOffset, [0, 0, 0])));
    if (shape.emitRotationAngles) {
      shape.emitRotationAngles.forEach((ang, i) => {
        const deg = birthValue(ang, 0);
        const axis = new THREE.Vector3(...(shape.emitRotationAxes?.[i] ?? [0, 1, 0])).normalize();
        pos.applyAxisAngle(axis, deg * DEG);
        vel.applyAxisAngle(axis, deg * DEG);
      });
    }
    const rot = birthValue(e.birthRotation0, [0, 0, 0]);
    const rotVel = birthValue(e.birthRotationalVelocity0, [0, 0, 0]);
    const primType = e.primitive?.__type;
    const directional = !!e.isDirectionOriented;
    const ground = !directional && (primType === 'VfxPrimitiveArbitraryQuad' && Math.abs(Math.abs(rot[0]) - 90) < 1);
    this.particles.push({
      e, mesh, mat, cols, rows, frames, life, age: 0,
      pos, vel,
      drag: new THREE.Vector3(...birthValue(e.birthDrag, [0, 0, 0])),
      acc: new THREE.Vector3(...birthValue(e.worldAcceleration, [0, 0, 0])),
      birthColor: birthValue(e.birthColor, [1, 1, 1, 1]),
      birthScale: birthValue(e.birthScale0, [100, 100, 100]),
      rot, rotVel, ground, directional,
      ray: primType === 'VfxPrimitiveRay',
      frame0: e.isRandomStartFrame ? Math.floor(rand() * frames) : 0,
      S,
    });
    this.group.add(mesh);
  }

  update(dt, camera) {
    dt *= this.timeScale;
    this.time += dt;
    while (this.pending.length && this.pending[0].t0 <= this.time) this.birth(this.pending.shift());
    for (const p of this.particles) {
      p.age += dt;
      const t = Math.min(p.age / p.life, 1);
      const u = p.mat.uniforms;
      // 运动：阻力 + 加速度
      p.vel.set(p.vel.x * Math.exp(-p.drag.x * dt), p.vel.y * Math.exp(-p.drag.y * dt), p.vel.z * Math.exp(-p.drag.z * dt));
      p.vel.addScaledVector(p.acc, dt);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0 && p.acc.y < 0) { p.pos.y = 0; p.vel.set(0, 0, 0); } // 落地停住
      p.mesh.position.copy(p.pos).multiplyScalar(p.S);

      // 颜色 = 出生色 × 寿命曲线
      const c = overLife(p.e.color, t, [1, 1, 1, 1]);
      const bc = p.birthColor;
      u.tint.value.set(c[0] * bc[0], c[1] * bc[1], c[2] * bc[2], p.age > p.life ? 0 : (c[3] ?? 1) * (bc[3] ?? 1));
      if (p.e.alphaErosionDefinition) u.erosion.value = overLife(p.e.alphaErosionDefinition.erosionDriveCurve, t, 0);

      // 缩放：面片尺寸 = 出生尺寸 × 寿命曲线
      const sc = overLife(p.e.scale0, t, [1, 1, 1]);
      let sx = p.birthScale[0] * sc[0];
      let sy = p.e.isUniformScale ? sx : p.birthScale[1] * (sc[1] ?? sc[0]);
      if (p.ray) { sx = p.birthScale[0] * sc[0] * 0.15; sy = p.birthScale[1] * (sc[1] ?? 1) * 0.5; }
      p.mesh.scale.set(Math.max(sx, 1e-4) * p.S, Math.max(sy, 1e-4) * p.S, 1);

      // 朝向
      if (p.ground) {
        p.mesh.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (p.rot[1] + p.rotVel[1] * p.age) * DEG));
        p.mesh.position.y = BOARD_TOP - this.group.position.y + 0.01 + (p.e.pass ?? 0) * 1e-6;
      } else {
        p.mesh.quaternion.copy(camera.quaternion);
        if (p.directional && p.vel.lengthSq() > 1) {
          // 沿速度方向拉伸：把速度投到屏幕上取角度
          const a = p.mesh.getWorldPosition(TMP).clone().project(camera);
          const b = TMP.add(p.vel.clone().normalize().multiplyScalar(0.3)).project(camera);
          p.mesh.rotateZ(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
        } else {
          p.mesh.rotateZ(((p.ray ? p.rot[2] : p.rot[0] + p.rotVel[0] * p.age)) * DEG);
        }
      }

      // 序列帧
      if (p.cols * p.rows > 1) {
        const rate = p.e.frameRate ?? 0;
        const f = (p.frame0 + (rate ? Math.floor(p.age * rate) : Math.floor(t * (p.frames - 1)))) % p.frames;
        u.uvRect.value.set((f % p.cols) / p.cols, 1 - (Math.floor(f / p.cols) + 1) / p.rows, 1 / p.cols, 1 / p.rows);
      }
    }
    if (this.time > this.maxTime && this.particles.every((p) => p.age > p.life)) this.dispose();
  }

  dispose() {
    if (this.done) return;
    this.done = true;
    for (const p of this.particles) p.mat.dispose();
    this.group.removeFromParent();
  }
}

const PLANE = new THREE.PlaneGeometry(1, 1);
const TMP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

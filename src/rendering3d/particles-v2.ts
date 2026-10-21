import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group,
  Matrix4, Mesh, MultiplyBlending, NormalBlending, PlaneGeometry, Quaternion, ShaderMaterial, Vector3,
  type Camera } from 'three';
import type { BirthValue, ParticleDocumentV2, ParticleEmitterV2 } from './contracts';
import { fragmentShader, sampleCurve, vertexShader } from './particle-common';
import type { ParticleOptions, ParticleSkip } from './particles';

interface Source {
  emitter: ParticleEmitterV2;
  index: number;
  next: number;
  burstLeft: number;
  ordinal: number;
  geometry?: BufferGeometry;
}
interface Live {
  source: Source;
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  birth: number;
  death: number;
  origin: Vector3;
  size: Vector3;
  rotation: Quaternion;
  history: { time: number; world: Vector3 }[];
}
const finite = (n: number) => Number.isFinite(n);
/** Bounded total birth attempts as well as live GPU objects, including cap drops. */
const MAX_BIRTH_ATTEMPTS = 100000;
// Shared 8 ULP time boundary: scale tolerance to the compared times, never to a
// fixed epsilon. Strictly-before is !reached(end, at); inclusive is reached(at, end).
const reached = (at: number, time: number) => at <= time + Number.EPSILON * Math.max(Math.abs(at), Math.abs(time)) * 8;
// Repeat inside the atlas cell without mutating a borrowed texture's wrap mode.
const v2FragmentShader = fragmentShader.replace('uniform vec2 tiles;', 'uniform bool repeatU; uniform vec2 tiles;')
  .replace('(vUv+cell)/tiles', '(vec2(repeatU?fract(vUv.x):vUv.x,vUv.y)+cell)/tiles')
  .replace('varying vec2 vUv;', 'varying vec2 vUv; varying vec4 vParticleColor;')
  .replace('texel.rgb*tint,texel.a*opacity', 'texel.rgb*tint*vParticleColor.rgb,texel.a*opacity*vParticleColor.a');
const v2VertexShader = vertexShader.replace('varying vec2 vUv;', 'varying vec2 vUv; varying vec4 vParticleColor;')
  .replace('vUv=uv;', `vUv=uv;
 #ifdef USE_COLOR_ALPHA
 vParticleColor=color;
 #elif defined(USE_COLOR)
 vParticleColor=vec4(color,1.0);
 #else
 vParticleColor=vec4(1.0);
 #endif
 `);

export class ParticleEffectV2 {
  readonly object = new Group();
  readonly skipped = { mesh: 0, trail: 0, screenDistortion: 0 };
  readonly skippedReasons: ParticleSkip[] = [];
  droppedParticles = 0;
  private sources: Source[] = [];
  private live: Live[] = [];
  private plane = new PlaneGeometry(1, 1);
  private rayPlane = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
  private elapsed = 0;
  private closed = false;
  private initializing = true;
  private attempts = 0;
  private limit: number;
  private duration: number;
  private random: () => number;
  constructor(doc: ParticleDocumentV2, private options: ParticleOptions) {
    const scale = options.scale ?? 0.6;
    this.limit = Math.min(doc.limits.maxParticles, options.maxParticles ?? 10000);
    this.duration = Math.min(doc.limits.maxDuration, options.maxDuration ?? 3600);
    if (!finite(scale) || scale <= 0 || !Number.isSafeInteger(options.maxParticles ?? 10000)
      || (options.maxParticles ?? 10000) < 0 || !finite(options.maxDuration ?? 3600) || !finite(this.duration) || this.duration <= 0) {
      this.plane.dispose(); this.rayPlane.dispose(); throw new Error('invalid-particle-options');
    }
    this.object.scale.setScalar(scale);
    let state = 1;
    this.random = options.random ?? (() => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296;
    });
    try {
      for (const [index, emitter] of doc.emitters.entries()) {
        if (emitter.kind === 'screenDistortion') {
          this.skipped.screenDistortion++;
          this.skippedReasons.push({ emitterIndex: index, kind: emitter.kind, reason: 'screen-distortion-requires-scene-color' });
          continue;
        }
        const geometry = emitter.kind === 'mesh' ? options.mesh?.(emitter.mesh) : undefined;
        if (emitter.kind === 'mesh' && !geometry) {
          this.skipped.mesh++;
          this.skippedReasons.push({ emitterIndex: index, kind: 'mesh', reason: 'mesh-resource-unavailable' });
          continue;
        }
        const em = emitter.emission;
        const burstLeft = em.mode === 'burst' ? em.count : em.burst ?? 0;
        const ordinal = em.mode === 'continuous' && burstLeft === 0 ? 1 : 0;
        const next = (emitter.delay ?? 0) + (em.mode === 'continuous' ? ordinal / em.rate : 0);
        this.sources.push({ emitter, index, geometry, next: (em.mode === 'burst' && burstLeft === 0)
          || (em.mode === 'continuous' && em.loop !== true && !reached(next, (emitter.delay ?? 0) + em.duration)) ? Infinity : next,
          burstLeft, ordinal });
      }
      this.update(0);
      this.initializing = false;
    } catch (error) { this.dispose(); throw error; }
  }
  get particleCount(): number { return this.live.length; }
  get finished(): boolean {
    return this.closed || reached(this.duration, this.elapsed) || (this.live.length === 0 && this.sources.every(s => s.next === Infinity));
  }
  private draw(): number {
    const n = this.random();
    if (!finite(n) || n < 0 || n >= 1) throw new Error('invalid-random');
    return n;
  }
  private birthValue(value: BirthValue | undefined, fallback: number, rotation = false): Vector3 {
    let v: number | readonly number[] = value === undefined ? fallback : value as number | readonly number[];
    if (typeof value === 'object' && !Array.isArray(value) && value && 'min' in value) {
      const { min, max } = value;
      const interpolate = (lo: number, hi: number) => { const u = this.draw(); return (1 - u) * lo + u * hi; };
      v = typeof min === 'number' ? interpolate(min, max as number)
        : min.map((n, i) => interpolate(n, (max as readonly number[])[i]));
    }
    return typeof v === 'number' ? (rotation ? new Vector3(0, 0, v) : new Vector3(v, v, v)) : new Vector3(...v as [number, number, number]);
  }
  private spawn(source: Source, birth: number): void {
    const e = source.emitter;
    const origin = new Vector3(...(e.position ?? [0, 0, 0]));
    if (e.shape?.kind === 'box') origin.add(new Vector3(...e.shape.halfExtents.map(n => (this.draw() * 2 - 1) * n) as [number, number, number]));
    if (e.shape?.kind === 'sphere') {
      const z = this.draw() * 2 - 1, phi = this.draw() * Math.PI * 2, r = Math.cbrt(this.draw()) * e.shape.radius;
      origin.add(new Vector3(Math.sqrt(1 - z * z) * Math.cos(phi), Math.sqrt(1 - z * z) * Math.sin(phi), z).multiplyScalar(r));
    }
    if (e.shape?.kind === 'cylinder') {
      const phi = this.draw() * Math.PI * 2, r = Math.sqrt(this.draw()) * e.shape.radius;
      origin.add(new Vector3(Math.cos(phi) * r, (this.draw() - 0.5) * e.shape.height, Math.sin(phi) * r));
    }
    const size = this.birthValue(e.size0, 1), degrees = this.birthValue(e.rotation0, 0, true).multiplyScalar(Math.PI / 180);
    const rotation = new Quaternion().setFromEuler(new Euler(degrees.x, degrees.y, degrees.z, 'XYZ'));
    const texture = e.texture ? this.options.texture?.(e.texture) : undefined;
    let geometry = source.geometry ?? (e.kind === 'ray' ? this.rayPlane : this.plane);
    if (e.kind === 'trail') {
      geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array((e.trail.segments + 1) * 6), 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array((e.trail.segments + 1) * 4), 2));
      const indices: number[] = [];
      for (let i = 0; i < e.trail.segments; i++) {
        const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
      }
      geometry.setIndex(indices); geometry.setDrawRange(0, 0);
    }
    const material = new ShaderMaterial({ vertexShader: v2VertexShader, fragmentShader: v2FragmentShader,
      vertexColors: !!geometry.getAttribute('color'), transparent: true, depthWrite: false, side: DoubleSide,
      blending: e.blend === 'additive' ? AdditiveBlending : e.blend === 'multiply' ? MultiplyBlending : NormalBlending,
      uniforms: { map: { value: texture ?? null }, hasMap: { value: !!texture }, tint: { value: new Color(1, 1, 1) },
        opacity: { value: 1 }, dissolve: { value: 0 }, tiles: { value: [e.frames?.columns ?? 1, e.frames?.rows ?? 1] }, frame: { value: 0 },
        repeatU: { value: e.kind === 'trail' && e.trail.uvMode === 'repeat' } } });
    const mesh = new Mesh(geometry, material);
    if (e.kind === 'trail') mesh.frustumCulled = false;
    this.object.add(mesh);
    this.live.push({ source, mesh, birth, origin, size, rotation, history: [],
      death: e.lifetime === 'infinite' ? this.duration : birth + e.lifetime });
  }
  private remove(p: Live): void {
    p.mesh.material.dispose();
    if (p.source.emitter.kind === 'trail') p.mesh.geometry.dispose();
    p.mesh.removeFromParent();
  }
  private expire(time: number): void {
    this.live = this.live.filter(p => {
      const tail = p.source.emitter.kind === 'trail' ? p.source.emitter.trail.lifetime : 0;
      if (reached(p.death + tail, time) || reached(this.duration, time)) { this.remove(p); return false; }
      return true;
    });
  }
  private position(p: Live, age: number): Vector3 {
    const e = p.source.emitter, drag = e.drag ?? 0;
    const vf = drag === 0 ? age : -Math.expm1(-drag * age) / drag;
    const gf = drag === 0 ? age * age / 2 : (age - vf) / drag;
    const position = p.origin.clone().addScaledVector(new Vector3(...(e.velocity ?? [0, 0, 0])), vf)
      .addScaledVector(new Vector3(...(e.gravity ?? [0, 0, 0])), gf);
    return e.localTransform ? position.applyMatrix4(new Matrix4().fromArray(e.localTransform)) : position;
  }
  private trail(p: Live, time: number, size: number, camera?: Camera): void {
    const e = p.source.emitter;
    if (e.kind !== 'trail') return;
    // The host attaches/positions the effect after construction. Do not seed a
    // world-space tail at the unattached constructor origin.
    if (this.initializing) return;
    const end = Math.min(time, p.death);
    if (!p.history.length || !reached(end, p.history[p.history.length - 1].time)) {
      p.history.push({ time: end, world: this.object.localToWorld(this.position(p, end - p.birth)) });
    }
    p.history = p.history.filter(h => !reached(h.time, time - e.trail.lifetime)).slice(-e.trail.segments - 1);
    const points = p.history.map(h => this.object.worldToLocal(h.world.clone()));
    const positions = p.mesh.geometry.getAttribute('position'), uv = p.mesh.geometry.getAttribute('uv');
    const view = camera ? camera.getWorldDirection(new Vector3()).transformDirection(this.object.matrixWorld.clone().invert()) : new Vector3(0, 0, -1);
    let distance = 0;
    for (let i = 0; i < points.length; i++) {
      const tangent = points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(0, i - 1)]);
      const side = tangent.cross(view).normalize();
      if (side.lengthSq() < 1e-10) side.set(1, 0, 0);
      side.applyQuaternion(p.rotation);
      const width = sampleCurve(e.trail.width, (time - p.history[i].time) / e.trail.lifetime, 1) * p.size.x * size;
      const a = points[i].clone().addScaledVector(side, width / 2), b = points[i].clone().addScaledVector(side, -width / 2);
      positions.setXYZ(i * 2, a.x, a.y, a.z); positions.setXYZ(i * 2 + 1, b.x, b.y, b.z);
      if (i) distance += points[i].distanceTo(points[i - 1]);
      const u = e.trail.uvMode === 'repeat' ? distance / e.trail.tileLength! : i / Math.max(1, points.length - 1);
      uv.setXY(i * 2, u, 0); uv.setXY(i * 2 + 1, u, 1);
    }
    positions.needsUpdate = true; uv.needsUpdate = true;
    p.mesh.geometry.setDrawRange(0, Math.max(0, points.length - 1) * 6);
  }
  update(seconds: number, camera?: Camera): void {
    if (this.closed) return;
    if (!finite(seconds) || seconds < 0) throw new Error('invalid-delta');
    const target = Math.min(this.duration, this.elapsed + seconds);
    try {
      // Global chronological order; ties use document emitter order. No frame-rate based rate rounding.
      while (true) {
        let source: Source | undefined;
        for (const s of this.sources) if (s.next !== Infinity && reached(s.next, target) && !reached(this.duration, s.next)
          && (!source || !reached(source.next, s.next))) source = s;
        if (!source) break;
        const em = source.emitter.emission, at = source.next, start = source.emitter.delay ?? 0;
        if (em.mode === 'burst' && source.burstLeft === 0) { source.next = Infinity; continue; }
        if (em.mode === 'continuous' && em.loop !== true && !reached(at, start + em.duration)) { source.next = Infinity; continue; }
        if (this.attempts >= MAX_BIRTH_ATTEMPTS) {
          for (const s of this.sources) {
            if (s.next !== Infinity) this.skippedReasons.push({ emitterIndex: s.index, kind: s.emitter.kind, reason: 'total-birth-attempt-budget-exceeded' });
            s.next = Infinity;
          }
          break;
        }
        this.attempts++;
        this.expire(at);
        if (this.live.length < this.limit) this.spawn(source, at); else this.droppedParticles++;
        if (source.burstLeft > 0) source.burstLeft--;
        if (source.burstLeft > 0) source.next = start;
        else if (em.mode === 'burst') source.next = Infinity;
        else {
          source.ordinal++; source.next = start + source.ordinal / em.rate;
          if (em.loop !== true && !reached(source.next, start + em.duration)) source.next = Infinity;
        }
      }
      this.elapsed = target;
      this.expire(target);
      this.object.updateWorldMatrix(true, true);
      for (const p of this.live) {
        const e = p.source.emitter, age = Math.max(0, Math.min(target, p.death) - p.birth);
        const t = e.lifetime === 'infinite' ? 0 : age / e.lifetime;
        const size = sampleCurve(e.size, t, 1);
        if (e.kind === 'trail') this.trail(p, target, size, camera);
        else {
          p.mesh.position.copy(this.position(p, age));
          p.mesh.scale.copy(p.size).multiplyScalar(size);
          p.mesh.quaternion.identity();
          if (e.kind === 'quad' && camera) {
            camera.getWorldQuaternion(p.mesh.quaternion);
            p.mesh.quaternion.premultiply(this.object.getWorldQuaternion(new Quaternion()).invert());
          }
          if (e.kind === 'ray') {
            const length = Math.hypot(...e.direction);
            p.mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...e.direction.map(n => n / length) as [number, number, number]));
          }
          p.mesh.quaternion.multiply(p.rotation);
          if (e.localTransform) {
            // Preserve affine orientation, scale and shear without decomposing
            // the matrix. Translation was already applied to position above.
            const linear = new Matrix4().fromArray(e.localTransform).setPosition(0, 0, 0);
            p.mesh.updateMatrix();
            const position = p.mesh.position.clone();
            p.mesh.matrix.setPosition(0, 0, 0).premultiply(linear).setPosition(position);
            p.mesh.matrixAutoUpdate = false;
            p.mesh.matrixWorldNeedsUpdate = true;
          }
        }
        const u = p.mesh.material.uniforms;
        u.opacity.value = sampleCurve(e.opacity, t, 1); u.dissolve.value = sampleCurve(e.dissolve, t, 0);
        if (e.color) {
          const rgb = [0, 1, 2].map(c => sampleCurve(e.color!.map(k => ({ time: k.time, value: k.value[c] })), t, 1));
          (u.tint.value as Color).setRGB(rgb[0], rgb[1], rgb[2]);
        }
        if (e.frames) {
          const count = e.frames.columns * e.frames.rows, frame = Math.floor(age * e.frames.fps);
          u.frame.value = e.frames.loop ? frame % count : Math.min(frame, count - 1);
        }
      }
    } catch (error) { this.dispose(); throw error; }
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.live.forEach(p => this.remove(p)); this.live = []; this.sources = [];
    this.plane.dispose(); this.rayPlane.dispose(); this.object.clear(); this.object.removeFromParent();
  }
}

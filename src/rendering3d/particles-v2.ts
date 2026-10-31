import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group,
  Matrix4, Mesh, MultiplyBlending, NormalBlending, PlaneGeometry, Quaternion, ShaderMaterial, Vector3,
  type Camera } from 'three';
import type { BirthValue, ParticleDocumentV2, ParticleEmitterV2 } from './contracts';
import { colorChannels, fragmentShader, sampleCurve, vertexShader } from './particle-common';
import type { ParticleOptions, ParticleSkip } from './particles';

interface Source {
  emitter: ParticleEmitterV2;
  index: number;
  next: number;
  burstLeft: number;
  ordinal: number;
  geometry?: BufferGeometry;
}
interface Sample { time: number; world: Vector3 }
interface Live {
  source: Source;
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  /** Its material's pool variant. */
  key: string;
  birth: number;
  death: number;
  origin: Vector3;
  size: Vector3;
  rotation: Quaternion;
  history: Sample[];
}
const finite = (n: number) => Number.isFinite(n);
const ZERO = [0, 0, 0] as const, scratch = new Vector3();
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
// Three declares color and selects RGB/RGBA via the material's vertexColors flag.
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
  /** Meshes constructed for this effect. Quad and ray births reuse them. */
  builtMeshes = 0;
  private readonly freeMeshes: Mesh<BufferGeometry, ShaderMaterial>[] = [];
  private readonly spareVec: Vector3[] = [];
  private readonly spareQuat: Quaternion[] = [];
  private readonly spareSamples: Sample[] = [];
  private readonly spareHistories: Sample[][] = [];
  private readonly spawnScratch = new Vector3();
  private readonly spawnEuler = new Euler();
  private readonly placed = new Vector3();
  private readonly linear = new Matrix4();
  private readonly worldQuat = new Quaternion();
  private readonly cameraQuat = new Quaternion();
  private readonly rayFrom = new Vector3(0, 1, 0);
  private readonly rayTo = new Vector3();
  private readonly trailView = new Vector3();
  private readonly trailInv = new Matrix4();
  private readonly trailA = new Vector3();
  private readonly trailB = new Vector3();
  private readonly trailTangent = new Vector3();
  private readonly trailSide = new Vector3();
  private readonly trailPoints: Vector3[] = [];
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
  private takeVec(): Vector3 { return this.spareVec.pop() ?? new Vector3(); }
  private giveVec(value: Vector3): void { this.spareVec.push(value); }
  private takeQuat(): Quaternion { return this.spareQuat.pop() ?? new Quaternion(); }
  private giveQuat(value: Quaternion): void { this.spareQuat.push(value); }
  private takeSample(): Sample {
    const sample = this.spareSamples.pop();
    if (sample) return sample;
    return { time: 0, world: this.takeVec() };
  }
  private giveSample(sample: Sample): void { this.spareSamples.push(sample); }
  private takeHistory(): Sample[] {
    const history = this.spareHistories.pop();
    if (history) { history.length = 0; return history; }
    return [];
  }
  private giveHistory(history: Sample[]): void {
    for (const sample of history) this.giveSample(sample);
    history.length = 0; this.spareHistories.push(history);
  }
  private takeMesh(geometry: BufferGeometry, material: ShaderMaterial, trail: boolean): Mesh<BufferGeometry, ShaderMaterial> {
    if (!trail) {
      const pooled = this.freeMeshes.pop();
      if (pooled) {
        pooled.geometry = geometry; pooled.material = material;
        pooled.visible = true; pooled.frustumCulled = true; pooled.matrixAutoUpdate = true;
        pooled.position.set(0, 0, 0); pooled.quaternion.identity(); pooled.scale.set(1, 1, 1); pooled.rotation.set(0, 0, 0);
        pooled.matrix.identity(); pooled.matrixWorldNeedsUpdate = true;
        return pooled;
      }
    }
    this.builtMeshes++;
    const mesh = new Mesh(geometry, material);
    if (trail) mesh.frustumCulled = false;
    return mesh;
  }
  private birthValue(value: BirthValue | undefined, fallback: number, out: Vector3, rotation = false): Vector3 {
    let v: number | readonly number[] = value === undefined ? fallback : value as number | readonly number[];
    if (typeof value === 'object' && !Array.isArray(value) && value && 'min' in value) {
      const { min, max } = value;
      const interpolate = (lo: number, hi: number) => { const u = this.draw(); return (1 - u) * lo + u * hi; };
      if (typeof min === 'number') v = interpolate(min, max as number);
      else {
        const hi = max as readonly number[];
        return out.set(interpolate(min[0], hi[0]), interpolate(min[1], hi[1]), interpolate(min[2], hi[2]));
      }
    }
    return typeof v === 'number' ? (rotation ? out.set(0, 0, v) : out.set(v, v, v)) : out.set(v[0], v[1], v[2]);
  }
  private spawn(source: Source, birth: number): void {
    const e = source.emitter;
    const origin = this.takeVec().set(e.position?.[0] ?? 0, e.position?.[1] ?? 0, e.position?.[2] ?? 0);
    if (e.shape?.kind === 'box') {
      const half = e.shape.halfExtents;
      origin.add(this.spawnScratch.set((this.draw() * 2 - 1) * half[0], (this.draw() * 2 - 1) * half[1], (this.draw() * 2 - 1) * half[2]));
    }
    if (e.shape?.kind === 'sphere') {
      const z = this.draw() * 2 - 1, phi = this.draw() * Math.PI * 2, r = Math.cbrt(this.draw()) * e.shape.radius;
      const ring = Math.sqrt(1 - z * z);
      origin.add(this.spawnScratch.set(ring * Math.cos(phi), ring * Math.sin(phi), z).multiplyScalar(r));
    }
    if (e.shape?.kind === 'cylinder') {
      const phi = this.draw() * Math.PI * 2, r = Math.sqrt(this.draw()) * e.shape.radius;
      origin.add(this.spawnScratch.set(Math.cos(phi) * r, (this.draw() - 0.5) * e.shape.height, Math.sin(phi) * r));
    }
    const size = this.birthValue(e.size0, 1, this.takeVec());
    const degrees = this.birthValue(e.rotation0, 0, this.spawnScratch, true).multiplyScalar(Math.PI / 180);
    const rotation = this.takeQuat().setFromEuler(this.spawnEuler.set(degrees.x, degrees.y, degrees.z, 'XYZ'));
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
    const vertexColors = !!geometry.getAttribute('color');
    const blending = e.blend === 'additive' ? AdditiveBlending : e.blend === 'multiply' ? MultiplyBlending : NormalBlending;
    const uniforms = { map: { value: texture ?? null }, hasMap: { value: !!texture }, tint: { value: new Color(1, 1, 1) },
      opacity: { value: 1 }, dissolve: { value: 0 }, tiles: { value: [e.frames?.columns ?? 1, e.frames?.rows ?? 1] }, frame: { value: 0 },
      repeatU: { value: e.kind === 'trail' && e.trail.uvMode === 'repeat' } };
    const key = `v2/${blending}/${vertexColors}`;
    const material = this.options.materials?.take(key, uniforms) ?? new ShaderMaterial({ vertexShader: v2VertexShader,
      fragmentShader: v2FragmentShader, vertexColors, transparent: true, depthWrite: false, side: DoubleSide, blending, uniforms });
    const mesh = this.takeMesh(geometry, material, e.kind === 'trail');
    this.object.add(mesh);
    this.live.push({ source, mesh, key, birth, origin, size, rotation, history: this.takeHistory(),
      death: e.lifetime === 'infinite' ? this.duration : birth + e.lifetime });
    if (this.options.budget) this.options.budget.live++;
  }
  private remove(p: Live): void {
    if (this.options.materials) this.options.materials.give(p.key, p.mesh.material); else p.mesh.material.dispose();
    if (this.options.budget) this.options.budget.live--;
    const trail = p.source.emitter.kind === 'trail';
    if (trail) p.mesh.geometry.dispose();
    p.mesh.removeFromParent();
    this.giveHistory(p.history); this.giveVec(p.origin); this.giveVec(p.size); this.giveQuat(p.rotation);
    if (!trail) this.freeMeshes.push(p.mesh);
  }
  private expire(time: number): void {
    let kept = 0;
    for (let i = 0; i < this.live.length; i++) {
      const p = this.live[i]!;
      const tail = p.source.emitter.kind === 'trail' ? p.source.emitter.trail.lifetime : 0;
      if (reached(p.death + tail, time) || reached(this.duration, time)) this.remove(p);
      else this.live[kept++] = p;
    }
    this.live.length = kept;
  }
  private placeInto(p: Live, age: number, out: Vector3): Vector3 {
    const e = p.source.emitter, drag = e.drag ?? 0;
    const vf = drag === 0 ? age : -Math.expm1(-drag * age) / drag;
    const gf = drag === 0 ? age * age / 2 : (age - vf) / drag;
    out.copy(p.origin).addScaledVector(scratch.set((e.velocity ?? ZERO)[0], (e.velocity ?? ZERO)[1], (e.velocity ?? ZERO)[2]), vf)
      .addScaledVector(scratch.set((e.gravity ?? ZERO)[0], (e.gravity ?? ZERO)[1], (e.gravity ?? ZERO)[2]), gf);
    return e.localTransform ? out.applyMatrix4(this.linear.fromArray(e.localTransform)) : out;
  }
  private trail(p: Live, time: number, size: number, camera?: Camera): void {
    const e = p.source.emitter;
    if (e.kind !== 'trail') return;
    // The host attaches/positions the effect after construction. Do not seed a
    // world-space tail at the unattached constructor origin.
    if (this.initializing) return;
    const end = Math.min(time, p.death);
    if (!p.history.length || !reached(end, p.history[p.history.length - 1]!.time)) {
      const sample = this.takeSample();
      sample.time = end;
      this.object.localToWorld(this.placeInto(p, end - p.birth, sample.world));
      p.history.push(sample);
    }
    const cutoff = time - e.trail.lifetime;
    let kept = 0;
    for (let i = 0; i < p.history.length; i++) {
      const sample = p.history[i]!;
      if (!reached(sample.time, cutoff)) p.history[kept++] = sample;
      else this.giveSample(sample);
    }
    p.history.length = kept;
    const max = e.trail.segments + 1;
    if (p.history.length > max) {
      const drop = p.history.length - max;
      for (let i = 0; i < drop; i++) this.giveSample(p.history[i]!);
      p.history.copyWithin(0, drop);
      p.history.length = max;
    }
    const positions = p.mesh.geometry.getAttribute('position'), uv = p.mesh.geometry.getAttribute('uv');
    this.trailInv.copy(this.object.matrixWorld).invert();
    if (camera) camera.getWorldDirection(this.trailView).transformDirection(this.trailInv);
    else this.trailView.set(0, 0, -1);
    const count = p.history.length;
    for (let i = 0; i < count; i++) {
      const point = this.trailPoints[i] ?? (this.trailPoints[i] = new Vector3());
      point.copy(p.history[i]!.world).applyMatrix4(this.trailInv);
    }
    let distance = 0;
    for (let i = 0; i < count; i++) {
      const point = this.trailPoints[i]!;
      const next = this.trailPoints[Math.min(i + 1, count - 1)]!;
      const prev = this.trailPoints[Math.max(0, i - 1)]!;
      this.trailSide.copy(this.trailTangent.copy(next).sub(prev)).cross(this.trailView).normalize();
      if (this.trailSide.lengthSq() < 1e-10) this.trailSide.set(1, 0, 0);
      this.trailSide.applyQuaternion(p.rotation);
      const width = sampleCurve(e.trail.width, (time - p.history[i]!.time) / e.trail.lifetime, 1) * p.size.x * size;
      this.trailA.copy(point).addScaledVector(this.trailSide, width / 2);
      this.trailB.copy(point).addScaledVector(this.trailSide, -width / 2);
      positions.setXYZ(i * 2, this.trailA.x, this.trailA.y, this.trailA.z);
      positions.setXYZ(i * 2 + 1, this.trailB.x, this.trailB.y, this.trailB.z);
      if (i) distance += point.distanceTo(prev);
      const u = e.trail.uvMode === 'repeat' ? distance / e.trail.tileLength! : i / Math.max(1, count - 1);
      uv.setXY(i * 2, u, 0); uv.setXY(i * 2 + 1, u, 1);
    }
    positions.needsUpdate = true; uv.needsUpdate = true;
    p.mesh.geometry.setDrawRange(0, Math.max(0, count - 1) * 6);
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
        const budget = this.options.budget;
        if (this.live.length < this.limit && (!budget || budget.live < budget.max)) this.spawn(source, at); else this.droppedParticles++;
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
      // Camera-facing in this effect's space, the same for every quad this frame.
      const facing = camera ? this.object.getWorldQuaternion(this.worldQuat).invert().multiply(camera.getWorldQuaternion(this.cameraQuat)) : null;
      for (const p of this.live) {
        const e = p.source.emitter, age = Math.max(0, Math.min(target, p.death) - p.birth);
        const t = e.lifetime === 'infinite' ? 0 : age / e.lifetime;
        const size = sampleCurve(e.size, t, 1);
        if (e.kind === 'trail') this.trail(p, target, size, camera);
        else {
          p.mesh.position.copy(this.placeInto(p, age, this.placed));
          p.mesh.scale.copy(p.size).multiplyScalar(size);
          p.mesh.quaternion.identity();
          if (e.kind === 'quad' && facing) p.mesh.quaternion.copy(facing);
          if (e.kind === 'ray') {
            const direction = e.direction, length = Math.hypot(direction[0], direction[1], direction[2]);
            p.mesh.quaternion.setFromUnitVectors(this.rayFrom, this.rayTo.set(direction[0] / length, direction[1] / length, direction[2] / length));
          }
          p.mesh.quaternion.multiply(p.rotation);
          if (e.localTransform) {
            // Preserve affine orientation, scale and shear without decomposing
            // the matrix. Translation was already applied to position above.
            this.linear.fromArray(e.localTransform).setPosition(0, 0, 0);
            p.mesh.updateMatrix();
            this.placed.copy(p.mesh.position);
            p.mesh.matrix.setPosition(0, 0, 0).premultiply(this.linear).setPosition(this.placed);
            p.mesh.matrixAutoUpdate = false;
            p.mesh.matrixWorldNeedsUpdate = true;
          }
        }
        const u = p.mesh.material.uniforms;
        u.opacity.value = sampleCurve(e.opacity, t, 1); u.dissolve.value = sampleCurve(e.dissolve, t, 0);
        if (e.color) {
          const [r, g, b] = colorChannels(e.color);
          (u.tint.value as Color).setRGB(sampleCurve(r, t, 1), sampleCurve(g, t, 1), sampleCurve(b, t, 1));
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
    this.freeMeshes.length = 0; this.spareVec.length = 0; this.spareQuat.length = 0;
    this.spareSamples.length = 0; this.spareHistories.length = 0;
    this.plane.dispose(); this.rayPlane.dispose(); this.object.clear(); this.object.removeFromParent();
  }
}

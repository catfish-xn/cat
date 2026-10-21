import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Group, Mesh, MultiplyBlending, NormalBlending,
  PlaneGeometry, Quaternion, ShaderMaterial, TextureLoader, Vector3, type Camera, type Texture } from 'three';
import { assetUrl, DEFAULT_ASSET_ROOT, type AssetManifest, type ParticleEmitter } from './contracts';

import { parseParticleDocument, parseParticleDocumentV1 } from './particle-validation';
import { colorChannels, fragmentShader, vertexShader, sampleCurve, type ParticleBudget, type ParticleMaterialPool } from './particle-common';
import { ParticleEffectV2 } from './particles-v2';
export { parseParticleDocument } from './particle-validation';
export { sampleCurve, ParticleMaterialPool, type ParticleBudget } from './particle-common';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const ZERO = [0, 0, 0] as const, scratch = new Vector3();
interface Particle { emitter: ParticleEmitter; mesh: Mesh<PlaneGeometry, ShaderMaterial>; origin: Vector3; key: string }
export interface ParticleOptions {
  scale?: number;
  maxParticles?: number;
  /** v2 only: a host can lower, never increase, document limits. */
  maxDuration?: number;
  random?: () => number;
  /** Textures remain owned by the caller, unless using loadParticleEffect. */
  texture?: (path: string) => Texture | undefined;
  /** Static, UV-mapped geometry in League units. Borrowed; effect owns its materials. */
  mesh?: (path: string) => BufferGeometry | undefined;
  /** Materials are taken from and handed back to this pool instead of built and disposed per particle. */
  materials?: ParticleMaterialPool;
  /** Shared live-particle cap across effects; particles past it are not born. */
  budget?: ParticleBudget;
}
export interface ParticleSkip { emitterIndex: number; kind: string; reason: string }
/** Short, stable code for a failed mesh read: HTTP status, the adapter's own code, or `read-failed`. */
function meshErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const http = /http-(\d{3})/.exec(message);
  if (http) return `http-${http[1]}`;
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(message) ? message : 'read-failed';
}
function seededRandom(): () => number {
  let state = 1;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
class ParticleEffectV1 {
  readonly object = new Group();
  readonly skipped: Record<'mesh' | 'trail' | 'screenDistortion', number> = { mesh: 0, trail: 0, screenDistortion: 0 };
  private particles: Particle[] = [];
  private elapsed = 0;
  private geometry: PlaneGeometry;
  private closed = false;
  private materials?: ParticleMaterialPool;
  private budget?: ParticleBudget;
  constructor(document: unknown, options: ParticleOptions = {}) {
    const doc = parseParticleDocumentV1(document);
    this.materials = options.materials; this.budget = options.budget;
    const scale = options.scale ?? 0.6, limit = options.maxParticles ?? 10000;
    if (!finite(scale) || scale <= 0 || !Number.isInteger(limit) || limit < 0) throw new Error('invalid-particle-options');
    if (doc.emitters.reduce((sum, e) => sum + (e.kind === 'sprite' ? e.count : 0), 0) > limit) {
      throw new Error('particle-budget-exceeded');
    }
    this.geometry = new PlaneGeometry(1, 1);
    this.object.scale.setScalar(scale);
    const random = options.random ?? seededRandom();
    const draw = () => { const n = random(); if (!finite(n) || n < 0 || n >= 1) throw new Error('invalid-random'); return n; };
    try {
      for (const emitter of doc.emitters as readonly ParticleEmitter[]) {
        if (emitter.kind !== 'sprite') { this.skipped[emitter.kind]++; continue; }
        const texture = emitter.texture ? options.texture?.(emitter.texture) : undefined;
        const frames = emitter.frames;
        for (let i = 0; i < emitter.count; i++) {
          const origin = new Vector3();
          const shape = emitter.shape;
          if (shape?.kind === 'box') origin.set(...shape.halfExtents.map(n => (draw() * 2 - 1) * n) as [number, number, number]);
          if (shape?.kind === 'sphere') {
            const z = draw() * 2 - 1, phi = draw() * Math.PI * 2, r = Math.cbrt(draw()) * shape.radius;
            origin.set(Math.sqrt(1 - z * z) * Math.cos(phi), Math.sqrt(1 - z * z) * Math.sin(phi), z).multiplyScalar(r);
          }
          if (this.budget && this.budget.live >= this.budget.max) continue;
          const blending = emitter.blend === 'additive' ? AdditiveBlending : emitter.blend === 'multiply' ? MultiplyBlending : NormalBlending;
          const uniforms = { map: { value: texture ?? null }, hasMap: { value: !!texture }, tint: { value: new Color(1, 1, 1) },
            opacity: { value: 1 }, dissolve: { value: 0 }, tiles: { value: [frames?.columns ?? 1, frames?.rows ?? 1] }, frame: { value: 0 } };
          const key = `v1/${blending}`;
          const material = options.materials?.take(key, uniforms) ?? new ShaderMaterial({ vertexShader, fragmentShader, transparent: true,
            depthWrite: false, side: DoubleSide, blending, uniforms });
          const mesh = new Mesh(this.geometry, material);
          this.object.add(mesh);
          this.particles.push({ emitter, mesh, origin, key });
          if (this.budget) this.budget.live++;
        }
      }
      this.update(0);
    } catch (error) { this.dispose(); throw error; }
  }
  get finished(): boolean { return this.particles.every(p => this.elapsed >= (p.emitter.delay ?? 0) + p.emitter.lifetime); }
  /** Analytical drag/gravity integration: same result for large or small steps. */
  update(seconds: number, camera?: Camera): void {
    if (this.closed) return;
    if (!finite(seconds) || seconds < 0) throw new Error('invalid-delta');
    this.elapsed += seconds;
    // Camera-facing in the effect parent's space, the same for every particle this frame.
    const facing = camera ? this.object.getWorldQuaternion(new Quaternion()).invert().multiply(camera.getWorldQuaternion(new Quaternion())) : null;
    for (const { emitter: e, mesh, origin } of this.particles) {
      const age = this.elapsed - (e.delay ?? 0);
      mesh.visible = age >= 0 && age < e.lifetime;
      if (!mesh.visible) continue;
      const t = age / e.lifetime, drag = e.drag ?? 0;
      const velocityFactor = drag === 0 ? age : -Math.expm1(-drag * age) / drag;
      const gravityFactor = drag === 0 ? age * age / 2 : (age - velocityFactor) / drag;
      mesh.position.copy(origin).addScaledVector(scratch.set(...(e.velocity ?? ZERO)), velocityFactor)
        .addScaledVector(scratch.set(...(e.gravity ?? ZERO)), gravityFactor);
      mesh.scale.setScalar(sampleCurve(e.size, t, 1));
      if (facing) mesh.quaternion.copy(facing);
      const u = mesh.material.uniforms;
      u.opacity.value = sampleCurve(e.opacity, t, 1);
      u.dissolve.value = sampleCurve(e.dissolve, t, 0);
      if (e.color) {
        const [r, g, b] = colorChannels(e.color);
        (u.tint.value as Color).setRGB(sampleCurve(r, t, 1), sampleCurve(g, t, 1), sampleCurve(b, t, 1));
      }
      if (e.frames) {
        const count = e.frames.columns * e.frames.rows, frame = Math.floor(age * e.frames.fps);
        u.frame.value = e.frames.loop ? frame % count : Math.min(frame, count - 1);
      }
    }
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.particles.forEach(p => this.materials ? this.materials.give(p.key, p.mesh.material) : p.mesh.material.dispose());
    if (this.budget) this.budget.live -= this.particles.length;
    this.geometry.dispose(); this.object.clear(); this.object.removeFromParent(); this.particles = [];
  }
}
/** Version dispatch leaves the v1 allocation, validation and update semantics intact. */
export class ParticleEffect {
  private runtime: ParticleEffectV1 | ParticleEffectV2;
  readonly skippedReasons: readonly ParticleSkip[];
  constructor(document: unknown, options: ParticleOptions = {}) {
    const doc = parseParticleDocument(document);
    this.runtime = doc.schemaVersion === 1 ? new ParticleEffectV1(doc, options) : new ParticleEffectV2(doc, options);
    this.skippedReasons = this.runtime instanceof ParticleEffectV2 ? this.runtime.skippedReasons
      : doc.emitters.flatMap((e, emitterIndex) => e.kind === 'sprite' ? []
        : [{ emitterIndex, kind: e.kind, reason: `v1-runtime-skips-${e.kind}` }]);
  }
  get object(): Group { return this.runtime.object; }
  get skipped(): Record<'mesh' | 'trail' | 'screenDistortion', number> { return this.runtime.skipped; }
  get droppedParticles(): number { return this.runtime instanceof ParticleEffectV2 ? this.runtime.droppedParticles : 0; }
  /** v1 keeps its allocated burst children; v2 removes expired particles. */
  get particleCount(): number { return this.object.children.length; }
  get finished(): boolean { return this.runtime.finished; }
  update(seconds: number, camera?: Camera): void { this.runtime.update(seconds, camera); }
  dispose(): void { this.runtime.dispose(); }
}
/** Load only when explicitly called by a lazy 3D entry. No browser globals at import. */
export async function loadParticleEffect(manifest: AssetManifest, id: string,
  options: Omit<ParticleOptions, 'texture' | 'mesh'> & { root?: string; readTexture?: (url: string) => Promise<Texture>;
    /** Receives an asset-root URL; the returned value is validated before any resource loads. */
    readJson?: (url: string) => Promise<unknown>;
    /** Adapter supplies geometry from one static mesh (or rejects); unavailable emitters are skipped. */
    readMesh?: (url: string) => Promise<BufferGeometry>;
    /** The readers' textures and geometry stay theirs (a caching reader): the effect never disposes them. */
    borrowed?: boolean } = {}): Promise<ParticleEffect> {
  const entry = Object.hasOwn(manifest.effects ?? {}, id) ? manifest.effects![id] : undefined;
  if (manifest.schemaVersion !== 1 || !entry) throw new Error('unknown-effect');
  const root = options.root ?? DEFAULT_ASSET_ROOT;
  const readJson = options.readJson ?? (async (url: string): Promise<unknown> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`particle-http-${response.status}`);
    return response.json();
  });
  const doc = parseParticleDocument(await readJson(assetUrl(root, entry.path)));
  const textures = new Map<string, Texture>();
  const meshes = new Map<string, BufferGeometry>();
  const loadedGeometry = new Set<BufferGeometry>();
  /** Why each unusable mesh was dropped; appended to its skip reason. */
  const meshFailures = new Map<string, string>();
  const cleanup = () => {
    if (!options.borrowed) { new Set(textures.values()).forEach(t => t.dispose()); loadedGeometry.forEach(g => g.dispose()); }
    textures.clear(); loadedGeometry.clear(); meshes.clear();
  };
  try {
    if (doc.schemaVersion === 2 && options.readMesh) {
      const attempted = new Set<string>();
      for (const e of doc.emitters) if (e.kind === 'mesh' && !attempted.has(e.mesh)) {
        attempted.add(e.mesh);
        // A failed adapter (including non-static/ambiguous models) must not
        // reject unrelated emitters or trigger this emitter's texture reads.
        let geometry: BufferGeometry;
        try { geometry = await options.readMesh(assetUrl(root, e.mesh)); }
        catch (error) { meshFailures.set(e.mesh, meshErrorCode(error)); continue; }
        if (!(geometry instanceof BufferGeometry)) { meshFailures.set(e.mesh, 'not-buffer-geometry'); continue; }
        loadedGeometry.add(geometry);
        const position = geometry.getAttribute('position');
        if (!position || position.itemSize !== 3) { meshFailures.set(e.mesh, 'missing-position'); continue; }
        if (position.count === 0) { meshFailures.set(e.mesh, 'empty-geometry'); continue; }
        meshes.set(e.mesh, geometry);
      }
    }
    const renderable = doc.schemaVersion === 1 ? doc.emitters.filter(e => e.kind === 'sprite')
      : doc.emitters.filter(e => e.kind !== 'screenDistortion' && (e.kind !== 'mesh' || meshes.has(e.mesh)));
    const paths = [...new Set(renderable.filter(e => e.texture).map(e => e.texture!))];
    // Sequential loads ensure a failure never leaves an unobserved in-flight texture.
    for (const path of paths) textures.set(path, await (options.readTexture ?? (url => new TextureLoader().loadAsync(url)))(assetUrl(root, path)));
    const effect = new ParticleEffect(doc, { ...options, texture: path => textures.get(path), mesh: path => meshes.get(path) });
    if (doc.schemaVersion === 2) for (const skip of effect.skippedReasons as ParticleSkip[]) {
      const emitter = doc.emitters[skip.emitterIndex];
      if (skip.kind === 'mesh' && emitter?.kind === 'mesh' && skip.reason === 'mesh-resource-unavailable')
        skip.reason = `mesh-resource-unavailable:${meshFailures.get(emitter.mesh) ?? (options.readMesh ? 'not-loaded' : 'no-mesh-reader')}`;
    }
    const dispose = effect.dispose.bind(effect);
    effect.dispose = () => { dispose(); cleanup(); };
    return effect;
  } catch (error) { cleanup(); throw error; }
}

import { AdditiveBlending, Color, DoubleSide, Group, Mesh, MultiplyBlending, NormalBlending,
  PlaneGeometry, ShaderMaterial, TextureLoader, Vector3, type BufferGeometry, type Camera, type Texture } from 'three';
import { assetUrl, DEFAULT_ASSET_ROOT, type AssetManifest, type ParticleEmitter } from './contracts';

import { parseParticleDocument, parseParticleDocumentV1 } from './particle-validation';
import { fragmentShader, vertexShader, sampleCurve } from './particle-common';
import { ParticleEffectV2 } from './particles-v2';
export { parseParticleDocument } from './particle-validation';
export { sampleCurve } from './particle-common';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
interface Particle { emitter: ParticleEmitter; mesh: Mesh<PlaneGeometry, ShaderMaterial>; origin: Vector3 }
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
}
export interface ParticleSkip { emitterIndex: number; kind: string; reason: string }
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
  constructor(document: unknown, options: ParticleOptions = {}) {
    const doc = parseParticleDocumentV1(document);
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
          const material = new ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false, side: DoubleSide,
            blending: emitter.blend === 'additive' ? AdditiveBlending : emitter.blend === 'multiply' ? MultiplyBlending : NormalBlending,
            uniforms: { map: { value: texture ?? null }, hasMap: { value: !!texture }, tint: { value: new Color(1, 1, 1) },
              opacity: { value: 1 }, dissolve: { value: 0 }, tiles: { value: [frames?.columns ?? 1, frames?.rows ?? 1] }, frame: { value: 0 } } });
          const mesh = new Mesh(this.geometry, material);
          this.object.add(mesh);
          this.particles.push({ emitter, mesh, origin });
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
    for (const { emitter: e, mesh, origin } of this.particles) {
      const age = this.elapsed - (e.delay ?? 0);
      mesh.visible = age >= 0 && age < e.lifetime;
      if (!mesh.visible) continue;
      const t = age / e.lifetime, drag = e.drag ?? 0;
      const velocityFactor = drag === 0 ? age : -Math.expm1(-drag * age) / drag;
      const gravityFactor = drag === 0 ? age * age / 2 : (age - velocityFactor) / drag;
      mesh.position.copy(origin).addScaledVector(new Vector3(...(e.velocity ?? [0, 0, 0])), velocityFactor)
        .addScaledVector(new Vector3(...(e.gravity ?? [0, 0, 0])), gravityFactor);
      mesh.scale.setScalar(sampleCurve(e.size, t, 1));
      if (camera) {
        camera.getWorldQuaternion(mesh.quaternion);
        // Convert world-facing orientation into the effect parent's local space.
        mesh.quaternion.premultiply(this.object.getWorldQuaternion(this.object.quaternion.clone()).invert());
      }
      const u = mesh.material.uniforms;
      u.opacity.value = sampleCurve(e.opacity, t, 1);
      u.dissolve.value = sampleCurve(e.dissolve, t, 0);
      if (e.color) {
        const channels = [0, 1, 2].map(channel => sampleCurve(e.color!.map(k => ({ time: k.time, value: k.value[channel] })), t, 1));
        (u.tint.value as Color).setRGB(channels[0], channels[1], channels[2]);
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
    this.particles.forEach(p => p.mesh.material.dispose());
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
    /** Converter supplies static GLB geometry; this segment does not decode arbitrary source meshes. */
    readMesh?: (url: string) => Promise<BufferGeometry> } = {}): Promise<ParticleEffect> {
  const entry = Object.hasOwn(manifest.effects ?? {}, id) ? manifest.effects![id] : undefined;
  if (manifest.schemaVersion !== 1 || !entry) throw new Error('unknown-effect');
  const root = options.root ?? DEFAULT_ASSET_ROOT;
  const response = await fetch(assetUrl(root, entry.path));
  if (!response.ok) throw new Error(`particle-http-${response.status}`);
  const doc = parseParticleDocument(await response.json());
  const textures = new Map<string, Texture>();
  const meshes = new Map<string, BufferGeometry>();
  const cleanup = () => { new Set(textures.values()).forEach(t => t.dispose()); textures.clear();
    new Set(meshes.values()).forEach(g => g.dispose()); meshes.clear(); };
  try {
    if (doc.schemaVersion === 2 && options.readMesh) {
      for (const e of doc.emitters) if (e.kind === 'mesh' && !meshes.has(e.mesh)) {
        meshes.set(e.mesh, await options.readMesh(assetUrl(root, e.mesh)));
      }
    }
    const renderable = doc.schemaVersion === 1 ? doc.emitters.filter(e => e.kind === 'sprite')
      : doc.emitters.filter(e => e.kind !== 'screenDistortion' && (e.kind !== 'mesh' || meshes.has(e.mesh)));
    const paths = [...new Set(renderable.filter(e => e.texture).map(e => e.texture!))];
    // Sequential loads ensure a failure never leaves an unobserved in-flight texture.
    for (const path of paths) textures.set(path, await (options.readTexture ?? (url => new TextureLoader().loadAsync(url)))(assetUrl(root, path)));
    const effect = new ParticleEffect(doc, { ...options, texture: path => textures.get(path), mesh: path => meshes.get(path) });
    const dispose = effect.dispose.bind(effect);
    effect.dispose = () => { dispose(); cleanup(); };
    return effect;
  } catch (error) { cleanup(); throw error; }
}

import { AdditiveBlending, Color, DoubleSide, Group, Mesh, MultiplyBlending, NormalBlending,
  PlaneGeometry, ShaderMaterial, TextureLoader, Vector3, type Camera, type Texture } from 'three';
import { assetUrl, DEFAULT_ASSET_ROOT, type AssetManifest, type Curve, type ParticleDocument, type ParticleEmitter, type Vec3 } from './contracts';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vector = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
function curveValid(value: unknown, color = false): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((key, i) => key && finite(key.time)
    && key.time >= 0 && key.time <= 1 && (i === 0 || value[i - 1].time < key.time)
    && (color ? vector(key.value) && key.value.every((n: number) => n >= 0 && n <= 1) : finite(key.value) && key.value >= 0));
}
/** Reject malformed supported emitters before allocating GPU resources. Unsupported kinds are counted/skipped. */
export function parseParticleDocument(value: unknown): ParticleDocument {
  if (!value || typeof value !== 'object') throw new Error('invalid-particle-document');
  const doc = value as ParticleDocument;
  if (doc.schemaVersion !== 1 || !Array.isArray(doc.emitters)) throw new Error('invalid-particle-document');
  for (const emitter of doc.emitters as readonly ParticleEmitter[]) {
    if (!emitter || !['sprite', 'mesh', 'trail', 'screenDistortion'].includes(emitter.kind)) throw new Error('invalid-emitter-kind');
    if (emitter.kind !== 'sprite') continue;
    if (!Number.isInteger(emitter.count) || emitter.count < 0 || !finite(emitter.lifetime) || emitter.lifetime <= 0
      || (emitter.delay !== undefined && (!finite(emitter.delay) || emitter.delay < 0))
      || (emitter.drag !== undefined && (!finite(emitter.drag) || emitter.drag < 0))) throw new Error('invalid-emitter-timing');
    for (const v of [emitter.velocity, emitter.gravity]) if (v !== undefined && !vector(v)) throw new Error('invalid-vector');
    for (const c of [emitter.size, emitter.opacity, emitter.dissolve]) if (c !== undefined && !curveValid(c)) throw new Error('invalid-curve');
    for (const c of [emitter.opacity, emitter.dissolve]) if (c?.some(k => k.value > 1)) throw new Error('invalid-normalized-curve');
    if (emitter.color !== undefined && !curveValid(emitter.color, true)) throw new Error('invalid-color');
    if (emitter.texture !== undefined) { if (typeof emitter.texture !== 'string') throw new Error('invalid-texture'); assetUrl('', emitter.texture); }
    if (emitter.blend !== undefined && !['normal', 'additive', 'multiply'].includes(emitter.blend)) throw new Error('invalid-blend');
    const shape = emitter.shape;
    if (shape && (shape.kind === 'sphere' ? !finite(shape.radius) || shape.radius < 0
      : shape.kind === 'box' ? !vector(shape.halfExtents) || shape.halfExtents.some(n => n < 0)
      : shape.kind !== 'point')) throw new Error('invalid-shape');
    const f = emitter.frames;
    if (f && (!Number.isInteger(f.columns) || f.columns < 1 || !Number.isInteger(f.rows) || f.rows < 1
      || !finite(f.fps) || f.fps < 0 || (f.loop !== undefined && typeof f.loop !== 'boolean'))) throw new Error('invalid-frames');
  }
  return structuredClone(doc);
}
export function sampleCurve(curve: Curve | undefined, time: number, fallback: number): number {
  if (!curve?.length) return fallback;
  if (time <= curve[0].time) return curve[0].value;
  for (let i = 1; i < curve.length; i++) {
    const left = curve[i - 1], right = curve[i];
    if (time <= right.time) return left.value + (right.value - left.value) * (time - left.time) / (right.time - left.time);
  }
  return curve[curve.length - 1].value;
}
const vertexShader = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader = `uniform sampler2D map; uniform bool hasMap;
uniform vec3 tint; uniform float opacity; uniform float dissolve;
uniform vec2 tiles; uniform float frame; varying vec2 vUv;
void main(){
 vec2 cell=vec2(mod(frame,tiles.x),tiles.y-1.0-floor(frame/tiles.x));
 vec4 texel=hasMap?texture2D(map,(vUv+cell)/tiles):vec4(1.0);
 float noise=fract(sin(dot(floor(vUv*64.0),vec2(12.9898,78.233)))*43758.5453);
 if(dissolve>=1.0 || noise<dissolve)discard;
 gl_FragColor=vec4(texel.rgb*tint,texel.a*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
interface Particle { emitter: ParticleEmitter; mesh: Mesh<PlaneGeometry, ShaderMaterial>; origin: Vector3 }
export interface ParticleOptions {
  scale?: number;
  maxParticles?: number;
  random?: () => number;
  /** Textures remain owned by the caller, unless using loadParticleEffect. */
  texture?: (path: string) => Texture | undefined;
}
function seededRandom(): () => number {
  let state = 1;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export class ParticleEffect {
  readonly object = new Group();
  readonly skipped: Record<'mesh' | 'trail' | 'screenDistortion', number> = { mesh: 0, trail: 0, screenDistortion: 0 };
  private particles: Particle[] = [];
  private elapsed = 0;
  private geometry: PlaneGeometry;
  private closed = false;
  constructor(document: unknown, options: ParticleOptions = {}) {
    const doc = parseParticleDocument(document);
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
/** Load only when explicitly called by a lazy 3D entry. No browser globals at import. */
export async function loadParticleEffect(manifest: AssetManifest, id: string,
  options: Omit<ParticleOptions, 'texture'> & { root?: string; readTexture?: (url: string) => Promise<Texture> } = {}): Promise<ParticleEffect> {
  const entry = Object.hasOwn(manifest.effects ?? {}, id) ? manifest.effects![id] : undefined;
  if (manifest.schemaVersion !== 1 || !entry) throw new Error('unknown-effect');
  const root = options.root ?? DEFAULT_ASSET_ROOT;
  const response = await fetch(assetUrl(root, entry.path));
  if (!response.ok) throw new Error(`particle-http-${response.status}`);
  const doc = parseParticleDocument(await response.json());
  const textures = new Map<string, Texture>();
  try {
    const paths = [...new Set(doc.emitters.filter(e => e.kind === 'sprite' && e.texture).map(e => e.texture!))];
    // Sequential loads ensure a failure never leaves an unobserved in-flight texture.
    for (const path of paths) textures.set(path, await (options.readTexture ?? (url => new TextureLoader().loadAsync(url)))(assetUrl(root, path)));
    const effect = new ParticleEffect(doc, { ...options, texture: path => textures.get(path) });
    const dispose = effect.dispose.bind(effect);
    effect.dispose = () => { dispose(); textures.forEach(texture => texture.dispose()); textures.clear(); };
    return effect;
  } catch (error) { textures.forEach(texture => texture.dispose()); throw error; }
}

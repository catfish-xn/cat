/** D7 -> D8 contract v1. Seconds, three world axes, normalized curve time [0,1]. */
export type ActionState = 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'death';
export type ActionEffects = Record<string, Partial<Record<ActionState, readonly string[]>>>;
export interface AssetManifest {
  schemaVersion: 1;
  models: Record<string, { path: string; animations?: Partial<Record<ActionState, string>> }>;
  effects?: Record<string, { path: string }>;
  /** Explicit playback selection; name-based build-report suggestions are separate. */
  actionEffects?: ActionEffects;
}
export type Vec3 = readonly [number, number, number];
export type Curve = readonly { time: number; value: number }[];
export type ColorCurve = readonly { time: number; value: Vec3 }[];
export interface ParticleEmitter {
  kind: 'sprite' | 'mesh' | 'trail' | 'screenDistortion';
  texture?: string;
  count: number;
  lifetime: number;
  delay?: number;
  velocity?: Vec3;
  drag?: number;
  gravity?: Vec3;
  shape?: { kind: 'point' } | { kind: 'sphere'; radius: number } | { kind: 'box'; halfExtents: Vec3 };
  color?: ColorCurve;
  opacity?: Curve;
  size?: Curve;
  frames?: { columns: number; rows: number; fps: number; loop?: boolean };
  /** Threshold curve against a deterministic procedural noise mask. */
  dissolve?: Curve;
  blend?: 'normal' | 'additive' | 'multiply';
}
export interface ParticleDocumentV1 { schemaVersion: 1; emitters: readonly ParticleEmitter[] }
export type ParticleBlend = NonNullable<ParticleEmitter['blend']>;
/** Uniform scalar, or independent uniform draws per axis. Degrees for rotation. */
export type BirthValue = number | Vec3 | { min: number; max: number } | { min: Vec3; max: Vec3 };
export type ParticleEmission = { mode: 'burst'; count: number }
  | ({ mode: 'continuous'; rate: number; burst?: number } &
    ({ duration: number; loop?: false } | { loop: true }));
export interface ParticleLimits { maxParticles: number; maxDuration: number }
export interface ParticleEmitterV2Base extends Omit<ParticleEmitter, 'kind' | 'count' | 'lifetime'> {
  emission: ParticleEmission;
  /** infinite lives until the document's hard maxDuration, only with loop:true. */
  lifetime: number | 'infinite';
  position?: Vec3;
  size0?: BirthValue;
  /** Scalar = local Z rotation; vector = local XYZ Euler degrees. */
  rotation0?: BirthValue;
}
export type ParticleEmitterV2 = ParticleEmitterV2Base & (
  | { kind: 'quad' }
  | { kind: 'mesh'; mesh: string }
  | { kind: 'trail'; trail: { width: Curve; lifetime: number; segments: number;
      uvMode: 'stretch' | 'repeat'; tileLength?: number } }
  | { kind: 'ray'; direction: Vec3 }
  | { kind: 'arbitraryQuad' }
  | { kind: 'screenDistortion'; distortion: { normalMap: string; strength: number } }
);
export interface ParticleDocumentV2 {
  schemaVersion: 2;
  /** Hard effect-wide live count and playback time, including delays and trail tails. */
  limits: ParticleLimits;
  emitters: readonly ParticleEmitterV2[];
}
export type ParticleDocument = ParticleDocumentV1 | ParticleDocumentV2;
export const DEFAULT_ASSET_ROOT = 'assets3d-local/';

/** Manifest paths stay below a configurable root; roots may be CDN URLs. */
export function assetUrl(root: string, path: string): string {
  if (!path || /[\\?#]/.test(path) || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path)
    || path.split('/').some(part => part === '..' || /%/i.test(part))) throw new Error('invalid-asset-path');
  return `${root.replace(/\/?$/, '/')}${path}`;
}
export function assertManifest(value: unknown): asserts value is AssetManifest {
  if (!value || typeof value !== 'object') throw new Error('invalid-manifest');
  const m = value as AssetManifest;
  if (m.schemaVersion !== 1 || !m.models || typeof m.models !== 'object' || Array.isArray(m.models)) throw new Error('invalid-manifest');
  for (const entry of Object.values(m.models)) {
    if (!entry || typeof entry.path !== 'string' || !/\.glb$/i.test(entry.path)) throw new Error('invalid-model');
    assetUrl('', entry.path);
    if (entry.animations && Object.entries(entry.animations).some(([key, name]) =>
      !['idle', 'move', 'attack', 'cast', 'hit', 'death'].includes(key) || typeof name !== 'string')) throw new Error('invalid-animation-map');
  }
  if (m.effects !== undefined) {
    if (!m.effects || typeof m.effects !== 'object' || Array.isArray(m.effects)) throw new Error('invalid-effects');
    for (const effect of Object.values(m.effects)) {
      if (!effect || typeof effect.path !== 'string' || !effect.path.endsWith('.json')) throw new Error('invalid-effect');
      assetUrl('', effect.path);
    }
  }
  if (m.actionEffects !== undefined) parseActionEffects(m.actionEffects, m);
}

/** Also accepts build-report.actionEffects, but the host must deliberately select
 * suggestions: it must not automatically play every name-matched system. */
export function parseActionEffects(value: unknown, manifest: AssetManifest): ActionEffects {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!record(value)) throw new Error('invalid-action-effects');
  const result: ActionEffects = {};
  for (const [unit, actions] of Object.entries(value)) {
    if (!Object.hasOwn(manifest.models, unit) || !record(actions)) throw new Error('invalid-action-effects-unit');
    const mapped: Partial<Record<ActionState, readonly string[]>> = {};
    for (const [action, ids] of Object.entries(actions)) {
      if (!['idle', 'move', 'attack', 'cast', 'hit', 'death'].includes(action)) throw new Error('invalid-action-effects-action');
      if (!Array.isArray(ids) || ids.length > 64 || Array.from(ids).some(id => typeof id !== 'string'
        || !Object.hasOwn(manifest.effects ?? {}, id)) || new Set(ids).size !== ids.length) throw new Error('invalid-action-effects-reference');
      Object.defineProperty(mapped, action, { value: [...ids], enumerable: true });
    }
    Object.defineProperty(result, unit, { value: mapped, enumerable: true });
  }
  return result;
}

/** D7 -> D8 contract v1. Seconds, three world axes, normalized curve time [0,1]. */
export type ActionState = 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'death';
/**
 * Clips a model may name beyond the combat states: little legends also celebrate, run and grab (carousel); a summon
 * may name the clip it rises with (`spawn`: the Hextech Forge when it appears or Jayce revives it).
 */
export type ModelAction = ActionState | 'celebrate' | 'run' | 'grab' | 'spawn';
export const MODEL_ACTIONS: readonly ModelAction[] = ['idle', 'move', 'attack', 'cast', 'hit', 'death', 'celebrate', 'run', 'grab', 'spawn'];
export type AnimationNames = Partial<Record<Exclude<ModelAction, 'cast'>, string>> & { cast?: string | null };
/** Array main rotates between casts; the other stages each play once. */
export interface CastSequence { in?: string; main: string | readonly string[]; hold?: string; out?: string }
export interface CastVariants {
  star3?: CastSequence; hero?: CastSequence; front?: CastSequence; back?: CastSequence;
  rotate?: readonly string[]; branch?: Record<string, CastSequence>;
}
export interface CastMetadata { castSequence?: CastSequence; castVariants?: CastVariants }
export type ActionEffects = Record<string, Partial<Record<ActionState, readonly string[]>>>;
export interface AssetManifest {
  schemaVersion: 1;
  /**
   * `unitScale` (optional): the unit's official model scale from the client's skin data (1 = its mesh as authored);
   * the 3D layer draws a champion at that scale instead of fitting every one to the same height.
   */
  models: Record<string, { path: string; animations?: AnimationNames; unitScale?: number } & CastMetadata>;
  effects?: Record<string, { path: string }>;
  /** Explicit playback selection; name-based build-report suggestions are separate. */
  actionEffects?: ActionEffects;
  /** Arena scenes (models of the same key) and their alignment to the hex grid; see BoardAlignment. */
  boards?: Record<string, BoardEntry>;
}
/**
 * Source → hex-grid placement, built offline against a reference grid (`target`: hex radius and origin of cell 0,0
 * in board units). World = offset + scale × source; a live grid of another radius/origin is a uniform retarget.
 */
export interface BoardAlignment {
  scale: Vec3; offset: Vec3;
  target: { radius: number; origin: { x: number; y: number } };
  /**
   * Optional: the arena's own bench cells, nine floor centers in the board model's source space (placed like its
   * vertices), left to right as the player sees them; entry i is BoardFrame.bench[i]. Without nine finite entries
   * the 3D bench stays on the 2D bench coordinates.
   */
  bench?: readonly Vec3[];
}
export interface BoardEntry { alignment: BoardAlignment; grid?: { columns: number; rows: number } }
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
export interface ParticleEmitterV2Base extends Omit<ParticleEmitter, 'kind' | 'count' | 'lifetime' | 'shape'> {
  shape?: ParticleEmitter['shape'] | { kind: 'cylinder'; radius: number; height: number };
  /** Column-major affine matrix in runtime coordinates. Applied to local
   * positions/directions after shape sampling, before host/world transforms. */
  localTransform?: readonly number[];
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
/** Accepted `models[id].unitScale` (official skin scale; 1 = the mesh as authored). Anything else rejects the manifest. */
export const UNIT_SCALE_RANGE = { min: 0.2, max: 3 } as const;
export function assertManifest(value: unknown): asserts value is AssetManifest {
  if (!value || typeof value !== 'object') throw new Error('invalid-manifest');
  const m = value as AssetManifest;
  if (m.schemaVersion !== 1 || !m.models || typeof m.models !== 'object' || Array.isArray(m.models)) throw new Error('invalid-manifest');
  for (const entry of Object.values(m.models)) {
    if (!entry || typeof entry.path !== 'string' || !/\.glb$/i.test(entry.path)) throw new Error('invalid-model');
    assetUrl('', entry.path);
    if (entry.unitScale !== undefined && !(typeof entry.unitScale === 'number' && Number.isFinite(entry.unitScale)
      && entry.unitScale >= UNIT_SCALE_RANGE.min && entry.unitScale <= UNIT_SCALE_RANGE.max)) throw new Error('invalid-unit-scale');
    if (entry.animations && Object.entries(entry.animations).some(([key, name]) =>
      !(MODEL_ACTIONS as readonly string[]).includes(key) || !(key === 'cast' && name === null) && (typeof name !== 'string' || !name))) throw new Error('invalid-animation-map');
    if (entry.castSequence !== undefined) assertCastSequence(entry.castSequence);
    if (entry.castVariants !== undefined) {
      const variants = entry.castVariants;
      if (!variants || typeof variants !== 'object' || Array.isArray(variants)) throw new Error('invalid-cast-variants');
      for (const [key, sequence] of Object.entries(variants)) {
        if (['star3', 'hero', 'front', 'back'].includes(key)) assertCastSequence(sequence);
        else if (key === 'rotate') assertClipList(sequence);
        else if (key === 'branch') {
          if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence) || !Object.keys(sequence).length) throw new Error('invalid-cast-branch');
          for (const [branch, value] of Object.entries(sequence)) {
            if (!/^[a-zA-Z0-9_-]+$/.test(branch)) throw new Error('invalid-cast-branch');
            assertCastSequence(value);
          }
        } else throw new Error('invalid-cast-variants');
      }
    }
    if (entry.animations?.cast === null && (entry.castSequence || entry.castVariants)) throw new Error('disabled-cast-sequence');
  }
  if (m.effects !== undefined) {
    if (!m.effects || typeof m.effects !== 'object' || Array.isArray(m.effects)) throw new Error('invalid-effects');
    for (const effect of Object.values(m.effects)) {
      if (!effect || typeof effect.path !== 'string' || !effect.path.endsWith('.json')) throw new Error('invalid-effect');
      assetUrl('', effect.path);
    }
  }
  if (m.actionEffects !== undefined) parseActionEffects(m.actionEffects, m);
  if (m.boards !== undefined) assertBoards(m.boards, m);
}

function assertClipList(value: unknown): void {
  if (!Array.isArray(value) || !value.length || value.length > 64 || Array.from(value).some(v => typeof v !== 'string' || !v.trim())) throw new Error('invalid-cast-clips');
}
function assertCastSequence(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-cast-sequence');
  const sequence = value as CastSequence;
  for (const key of Object.keys(sequence)) if (!['in', 'main', 'hold', 'out'].includes(key)) throw new Error('invalid-cast-sequence');
  if (typeof sequence.main === 'string') { if (!sequence.main.trim()) throw new Error('invalid-cast-sequence'); }
  else assertClipList(sequence.main);
  for (const key of ['in', 'hold', 'out'] as const) if (sequence[key] !== undefined && (typeof sequence[key] !== 'string' || !sequence[key]!.trim())) throw new Error('invalid-cast-sequence');
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const vec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(finite);
/** Each board names a model of this manifest (same key) and how its source coordinates land on the hex grid. */
function assertBoards(value: unknown, manifest: AssetManifest): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-boards');
  for (const [key, entry] of Object.entries(value as Record<string, BoardEntry>)) {
    if (!Object.hasOwn(manifest.models, key)) throw new Error('invalid-board-model');
    const a = entry?.alignment, target = a?.target;
    if (!a || !vec3(a.scale) || !vec3(a.offset) || !target || !finite(target.radius) || target.radius <= 0
      || !finite(target.origin?.x) || !finite(target.origin?.y)) throw new Error('invalid-board-alignment');
  }
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

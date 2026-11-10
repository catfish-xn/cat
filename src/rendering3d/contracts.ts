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
export interface CastSequence { in?: string; main: string | readonly string[]; hold?: string; out?: string; layers?: readonly string[] }
export interface CastVariants {
  star3?: CastSequence; hero?: CastSequence; front?: CastSequence; back?: CastSequence;
  rotate?: readonly string[]; branch?: Record<string, CastSequence>;
}
export type FormAnimationActions = Partial<Record<'idle' | 'move' | 'attack', string>>;
export interface FormAnimations { front?: FormAnimationActions; back?: FormAnimationActions }
export interface CastMetadata { castSequence?: CastSequence; castVariants?: CastVariants; formAnimations?: FormAnimations; attackSequence?: CastSequence }
export type ActionEffects = Record<string, Partial<Record<ActionState, readonly string[]>>>;
export interface AssetManifest {
  schemaVersion: 1;
  /**
   * `unitScale` (optional): the unit's official model scale from the client's skin data (1 = its mesh as authored);
   * the 3D layer draws a champion at that scale instead of fitting every one to the same height.
   * `selfIllumination` (optional): the skin's own light term for the champion lighting of a board (BoardEntry.lighting);
   * a model without it keeps the generic lit material.
   */
  models: Record<string, {
    path: string;
    animations?: AnimationNames;
    formAnimations?: FormAnimations;
    unitScale?: number;
    selfIllumination?: number;
    clipRanges?: Record<string, readonly [number, number]>;
    clipSegments?: Record<string, readonly [string, number, number]>;
  } & CastMetadata>;
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
/**
 * `lighting` (optional): a ChampionLighting JSON beside the manifest. Champions with `selfIllumination` are then lit by
 * it instead of the scene lights; without it (or on older roots) every model keeps the generic lit material.
 */
export interface BoardEntry { alignment: BoardAlignment; grid?: { columns: number; rows: number }; lighting?: { path: string } }
/**
 * Champion light for one board, built offline from the board's light data: six colours along the world axes
 * (+X, −X, +Y, −Y, +Z, −Z; display-encoded 0..1), blended by the squared world normal, scaled by `ambientScale`, plus the
 * model's selfIllumination × `selfScale`; the sum is clamped to [0, 1] and multiplies the model's texture.
 */
export interface ChampionLighting {
  schemaVersion: 1;
  ambientCube: readonly [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];
  ambientScale: number;
  selfScale: number;
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
/** Accepted `models[id].selfIllumination` and ChampionLighting scales. */
export const LIGHT_TERM_RANGE = { min: 0, max: 4 } as const;
const lightTerm = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= LIGHT_TERM_RANGE.min && v <= LIGHT_TERM_RANGE.max;
export function assertManifest(value: unknown): asserts value is AssetManifest {
  if (!value || typeof value !== 'object') throw new Error('invalid-manifest');
  const m = value as AssetManifest;
  if (m.schemaVersion !== 1 || !m.models || typeof m.models !== 'object' || Array.isArray(m.models)) throw new Error('invalid-manifest');
  for (const entry of Object.values(m.models)) {
    if (!entry || typeof entry.path !== 'string' || !/\.glb$/i.test(entry.path)) throw new Error('invalid-model');
    assetUrl('', entry.path);
    if (entry.unitScale !== undefined && !(typeof entry.unitScale === 'number' && Number.isFinite(entry.unitScale)
      && entry.unitScale >= UNIT_SCALE_RANGE.min && entry.unitScale <= UNIT_SCALE_RANGE.max)) throw new Error('invalid-unit-scale');
    if (entry.selfIllumination !== undefined && !lightTerm(entry.selfIllumination)) throw new Error('invalid-self-illumination');
    if (entry.animations && Object.entries(entry.animations).some(([key, name]) =>
      !(MODEL_ACTIONS as readonly string[]).includes(key) || !(key === 'cast' && name === null) && (typeof name !== 'string' || !name))) throw new Error('invalid-animation-map');
    if (entry.formAnimations !== undefined) assertFormAnimations(entry.formAnimations);
    if (entry.clipRanges !== undefined) assertClipRanges(entry.clipRanges);
    if (entry.clipSegments !== undefined) assertClipSegments(entry.clipSegments);
    if (entry.attackSequence !== undefined) assertAttackSequence(entry.attackSequence);
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function assertFormAnimations(value: unknown): void {
  if (!isPlainObject(value)) throw new Error('invalid-form-animations');
  for (const [form, actions] of Object.entries(value)) {
    if ((form !== 'front' && form !== 'back') || !isPlainObject(actions)) throw new Error('invalid-form-animations');
    for (const [action, name] of Object.entries(actions)) {
      if ((action !== 'idle' && action !== 'move' && action !== 'attack') || typeof name !== 'string' || !name.trim()) {
        throw new Error('invalid-form-animations');
      }
    }
  }
}
function assertClipRanges(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw new Error('invalid-clip-ranges');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 64 || entries.some(([key, range]) => !key.trim() || !Array.isArray(range) || range.length !== 2
    || !finite(range[0]) || !finite(range[1]) || range[0] < 0 || range[0] >= range[1])) throw new Error('invalid-clip-ranges');
}
function assertClipSegments(value: unknown): void {
  if (!isPlainObject(value)) throw new Error('invalid-clip-segments');
  const entries = Object.entries(value);
  if (entries.length > 64 || entries.some(([alias, seg]) => !alias.trim() || !Array.isArray(seg) || seg.length !== 3
    || typeof seg[0] !== 'string' || !seg[0].trim() || !finite(seg[1]) || !finite(seg[2]) || seg[1] < 0 || seg[1] >= seg[2])) {
    throw new Error('invalid-clip-segments');
  }
}
function assertCastLayers(value: unknown): void {
  if (!Array.isArray(value) || !value.length || value.length > 4 || Array.from(value).some(v => typeof v !== 'string' || !v.trim())) {
    throw new Error('invalid-cast-layers');
  }
}
function assertClipList(value: unknown): void {
  if (!Array.isArray(value) || !value.length || value.length > 64 || Array.from(value).some(v => typeof v !== 'string' || !v.trim())) throw new Error('invalid-cast-clips');
}
function assertCastSequence(value: unknown): void {
  if (!isPlainObject(value)) throw new Error('invalid-cast-sequence');
  const sequence = value as unknown as CastSequence;
  for (const key of Object.keys(sequence)) if (!['in', 'main', 'hold', 'out', 'layers'].includes(key)) throw new Error('invalid-cast-sequence');
  if (typeof sequence.main === 'string') { if (!sequence.main.trim()) throw new Error('invalid-cast-sequence'); }
  else assertClipList(sequence.main);
  for (const key of ['in', 'hold', 'out'] as const) if (sequence[key] !== undefined && (typeof sequence[key] !== 'string' || !sequence[key]!.trim())) throw new Error('invalid-cast-sequence');
  if (sequence.layers !== undefined) assertCastLayers(sequence.layers);
}
function assertAttackSequence(value: unknown): void {
  try {
    assertCastSequence(value);
  } catch (error) {
    if ((error as Error)?.message === 'invalid-cast-layers') throw error;
    throw new Error('invalid-attack-sequence');
  }
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
    if (entry.lighting !== undefined) {
      if (!entry.lighting || typeof entry.lighting.path !== 'string' || !/\.json$/i.test(entry.lighting.path)) throw new Error('invalid-board-lighting');
      assetUrl('', entry.lighting.path);
    }
  }
}

export function assertChampionLighting(value: unknown): asserts value is ChampionLighting {
  const v = value as ChampionLighting | null;
  const colour = (c: unknown) => vec3(c) && (c as number[]).every(n => n >= 0 && n <= 1);
  if (!v || typeof v !== 'object' || v.schemaVersion !== 1 || !Array.isArray(v.ambientCube) || v.ambientCube.length !== 6
    || !v.ambientCube.every(colour) || !lightTerm(v.ambientScale) || !lightTerm(v.selfScale)) throw new Error('invalid-champion-lighting');
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

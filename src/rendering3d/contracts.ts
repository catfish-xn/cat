/** D7 -> D8 contract v1. Seconds, three world axes, normalized curve time [0,1]. */
export type ActionState = 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'death';
export interface AssetManifest {
  schemaVersion: 1;
  models: Record<string, { path: string; animations?: Partial<Record<ActionState, string>> }>;
  effects?: Record<string, { path: string }>;
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
export interface ParticleDocument { schemaVersion: 1; emitters: readonly ParticleEmitter[] }
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
}

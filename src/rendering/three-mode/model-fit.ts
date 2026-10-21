/**
 * Champion model sizing shared by the board, the carousel and the scout stage (planning/3d/model-scale-plan).
 * With the asset root's official per-unit scale (`models[id].unitScale`, from the 14.24 skin data), a model keeps its
 * own League size: drawn at sourceScale × unitScale, so a short champion (Amumu, Ziggs) stays short. The result is
 * capped at MAX_HEIGHT_RATIO × height tall and `width` across whichever way the piece faces (the footprint's
 * circumscribed circle about its upright axis), never stretched up. Without a unitScale (older asset roots) every
 * model is fitted to `height` and its x/z box to `width` exactly as before.
 */
import { Box3, Vector3, type Object3D } from 'three';

/** A drawn champion may be at most this many times the reference height (the plan's 1.6 × 92). */
export const MAX_HEIGHT_RATIO = 1.6;

/** The manifest's unitScale for a model when it is a positive finite number, else null (JSON from an asset root). */
export function readUnitScale(models: Readonly<Record<string, unknown>> | undefined, id: string): number | null {
  const entry = models && Object.hasOwn(models, id) ? models[id] : undefined;
  const value = entry && typeof entry === 'object' ? (entry as { unitScale?: unknown }).unitScale : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Scales `body` (feet on y=0) and returns its drawn height in board units. */
export function fitModel(body: Object3D, options: { height: number; width?: number; unitScale?: number | null; sourceScale: number }): number {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3()), width = options.width ?? Infinity;
  const { min, max } = box, official = !!options.unitScale;
  // Official scale: the footprint's diameter about the upright axis (the piece turns to face its target); fitted: the box.
  const across = official ? 2 * Math.max(...[min.x, max.x].flatMap(x => [min.z, max.z].map(z => Math.hypot(x, z)))) : Math.max(size.x, size.z);
  const cap = Math.min(size.y > 0 ? options.height * (official ? MAX_HEIGHT_RATIO : 1) / size.y : Infinity, across > 0 ? width / across : Infinity);
  const scale = official ? Math.min(options.sourceScale * options.unitScale!, cap) : cap;
  if (!Number.isFinite(scale) || scale <= 0) return options.height;
  body.scale.multiplyScalar(scale);
  body.position.y -= box.min.y * scale;
  return size.y * scale;
}

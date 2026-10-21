/**
 * Champion model sizing shared by the board, the carousel and the scout stage (planning/3d/model-scale-plan).
 * With the asset root's official per-unit scale (`models[id].unitScale`, from the 14.24 skin data), a model keeps its
 * own League size: drawn at sourceScale × unitScale, so a short champion (Amumu, Ziggs) stays short. The result is
 * capped at MAX_HEIGHT_RATIO × height tall and `width` across whichever way the piece faces (the footprint's
 * circumscribed circle about its upright axis), never stretched up. Without a unitScale (older asset roots) every
 * model is fitted to `height` and its x/z box to `width` exactly as before.
 */
import { AnimationMixer, Box3, SkinnedMesh, Vector3, type AnimationClip, type Object3D } from 'three';

/** A drawn champion may be at most this many times the reference height (the plan's 1.6 × 92). */
export const MAX_HEIGHT_RATIO = 1.6;

/** The manifest's unitScale for a model when it is a positive finite number, else null (JSON from an asset root). */
export function readUnitScale(models: Readonly<Record<string, unknown>> | undefined, id: string): number | null {
  const entry = models && Object.hasOwn(models, id) ? models[id] : undefined;
  const value = entry && typeof entry === 'object' ? (entry as { unitScale?: unknown }).unitScale : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Clip samples and the vertex stride for the animation envelope: enough to catch a wide swing, cheap once per model. */
const ENVELOPE_SAMPLES = 8, ENVELOPE_STRIDE = 7;
/** The envelope is this quantile of the sampled vertex distances, so a stray vertex (a thrown weapon) cannot set it. */
const ENVELOPE_QUANTILE = 0.98;
/** The clips a board piece stands, walks and fights in; death, dances and the like do not size its cell. */
export const ENVELOPE_ACTIONS = ['idle', 'move', 'attack', 'hit'] as const;

/**
 * How far from the body's upright axis its skinned vertices reach (ENVELOPE_QUANTILE of the samples) over the given
 * clips, in the world units fitModel's box reads (the unattached body's own transform, before fitting); 0 without
 * skinned meshes or clips. A one-frame box misses an idle that spreads its arms (Nami, Trundle) or an attack that
 * swings wide (Garen). Leaves the skeleton in its bind pose.
 */
export function animationEnvelopeRadius(body: Object3D, clips: readonly AnimationClip[]): number {
  const meshes: SkinnedMesh[] = [];
  body.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  if (!meshes.length || !clips.length) return 0;
  const mixer = new AnimationMixer(body), point = new Vector3(), radii: number[] = [];
  for (const clip of clips) {
    const action = mixer.clipAction(clip); action.play();
    for (let i = 0; i < ENVELOPE_SAMPLES; i++) {
      mixer.setTime(clip.duration * i / Math.max(1, ENVELOPE_SAMPLES - 1));
      body.updateMatrixWorld(true);
      for (const mesh of meshes) {
        mesh.skeleton.update();
        const count = mesh.geometry.attributes.position?.count ?? 0;
        for (let v = 0; v < count; v += ENVELOPE_STRIDE) {
          mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld);
          radii.push(Math.hypot(point.x, point.z));
        }
      }
    }
    action.stop();
  }
  mixer.stopAllAction(); mixer.uncacheRoot(body);
  for (const mesh of meshes) mesh.skeleton.pose();
  body.updateMatrixWorld(true);
  if (!radii.length) return 0;
  radii.sort((a, b) => a - b);
  return radii[Math.min(radii.length - 1, Math.floor(radii.length * ENVELOPE_QUANTILE))]!;
}

/**
 * Scales `body` (feet on y=0) and returns its drawn height in board units. `envelopeRadius` (official scale only, from
 * animationEnvelopeRadius) widens the footprint the width cap reads to everything the clips reach.
 */
export function fitModel(body: Object3D, options: { height: number; width?: number; unitScale?: number | null; sourceScale: number; envelopeRadius?: number }): number {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3()), width = options.width ?? Infinity;
  const { min, max } = box, official = !!options.unitScale;
  // Official scale: the footprint's diameter about the upright axis (the piece turns to face its target), over its
  // animations when known; fitted: the box.
  const bind = Math.max(...[min.x, max.x].flatMap(x => [min.z, max.z].map(z => Math.hypot(x, z))));
  const across = official ? 2 * Math.max(bind, options.envelopeRadius ?? 0) : Math.max(size.x, size.z);
  const cap = Math.min(size.y > 0 ? options.height * (official ? MAX_HEIGHT_RATIO : 1) / size.y : Infinity, across > 0 ? width / across : Infinity);
  const scale = official ? Math.min(options.sourceScale * options.unitScale!, cap) : cap;
  if (!Number.isFinite(scale) || scale <= 0) return options.height;
  body.scale.multiplyScalar(scale);
  body.position.y -= box.min.y * scale;
  return size.y * scale;
}

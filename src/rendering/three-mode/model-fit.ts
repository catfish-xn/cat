/**
 * Champion model sizing shared by the board, the carousel and the scout stage (planning/3d/model-scale-plan).
 * With the asset root's official per-unit scale (`models[id].unitScale`, from the 14.24 skin data), a model keeps its
 * own League size: drawn at sourceScale × unitScale, so a short champion (Amumu, Ziggs) stays short. The result is
 * capped at MAX_HEIGHT_RATIO × height tall and `width` across whichever way the piece faces (the footprint's
 * circumscribed circle about its upright axis), never stretched up. Without a unitScale (older asset roots) every
 * model is fitted to `height` and its x/z box to `width` exactly as before.
 */
import { AnimationMixer, Bone, Box3, LoopOnce, SkinnedMesh, Vector3, type AnimationClip, type Object3D } from 'three';

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
/** Of those, the ones that loop (sampled at distinct times; the others play once and keep their last frame). */
export const LOOPING_ACTIONS: ReadonlySet<string> = new Set(['idle', 'move']);
/** `ground`: a clip whose lowest point (net of the root's own motion) can set where the feet go. */
export interface EnvelopeClip { readonly clip: AnimationClip; readonly loop: boolean; readonly ground?: boolean }
/**
 * What the clips reach: `radius` from the upright axis (the width cap), and `ground`, the lowest point over the
 * `ground` clips' samples once each sample's root drift from its bind place is taken out (null without such clips),
 * in the same units. A bind pose can stand far below every clip (Darius, Nami): grounding on the bind box left those
 * pieces floating. fitModel never puts the feet below the bind box with it, so a hovering model (root raised in its
 * clips: Malzahar, Nocturne) keeps its height and no clip sinks under the cell.
 */
export interface Envelope { readonly radius: number; readonly ground: number | null }

/** Vertices read between time checks in the sliced envelope (a few hundred microseconds of work). */
const ENVELOPE_CHUNK = 1500;

/**
 * How far from the body's upright axis its skinned vertices reach (ENVELOPE_QUANTILE of the samples) over the given
 * clips, in the world units fitModel's box reads (the unattached body's own transform, before fitting); 0 without
 * skinned meshes or clips. A one-frame box misses an idle that spreads its arms (Nami, Trundle) or an attack that
 * swings wide (Garen). Distances are taken from the skeleton root's own horizontal place in each sample, so a clip
 * that carries the whole body sideways (Vi, Zoe) does not count as reach. Leaves the skeleton in its bind pose.
 * The work is a generator that pauses every ENVELOPE_CHUNK vertices: the sync form runs it through, the async form
 * spreads it over idle slices.
 */
function* envelopeSteps(body: Object3D, clips: readonly EnvelopeClip[]): Generator<void, Envelope> {
  const meshes: SkinnedMesh[] = [];
  body.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  if (!meshes.length || !clips.length) return { radius: 0, ground: null };
  let ground = Infinity;
  const mixer = new AnimationMixer(body), point = new Vector3(), rootAt = new Vector3(), radii: number[] = [];
  // Vertices read since the last pause, across poses, meshes and clips (small meshes alone never reach a chunk).
  let work = 0;
  // Each mesh's skeleton root: its first bone whose parent is not a bone.
  const roots = meshes.map(mesh => mesh.skeleton.bones.find(bone => !(bone.parent instanceof Bone)) ?? null);
  // Where each root stands in the bind pose: the reach is measured from there plus the root's drift in that sample.
  for (const mesh of meshes) mesh.skeleton.pose();
  body.updateMatrixWorld(true);
  const homes = roots.map(root => root ? root.getWorldPosition(new Vector3()) : new Vector3());
  try {
    for (const { clip, loop, ground: standing } of clips) {
      const action = mixer.clipAction(clip);
      // Looping clips: ENVELOPE_SAMPLES distinct times (duration itself wraps to 0); once-only clips end on their last frame.
      if (!loop) { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; }
      action.play();
      for (let i = 0; i < ENVELOPE_SAMPLES; i++) {
        // Set the pose again on every resume: nothing else animates this body, but a slice boundary may fall here.
        // A once-only clip that reached its end pauses itself (clampWhenFinished): wake it before posing again.
        const pose = () => { action.paused = false; action.enabled = true; mixer.setTime(clip.duration * i / (loop ? ENVELOPE_SAMPLES : Math.max(1, ENVELOPE_SAMPLES - 1))); body.updateMatrixWorld(true); };
        pose();
        for (let index = 0; index < meshes.length; index++) {
          const mesh = meshes[index]!, root = roots[index];
          mesh.skeleton.update();
          // The axis moved by the root's horizontal drift from its bind place (0 when the skeleton has no root bone).
          if (root) root.getWorldPosition(rootAt).sub(homes[index]!); else rootAt.set(0, 0, 0);
          const count = mesh.geometry.attributes.position?.count ?? 0;
          for (let v = 0; v < count; v += ENVELOPE_STRIDE) {
            mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld);
            radii.push(Math.hypot(point.x - rootAt.x, point.z - rootAt.z));
            // Feet without the skeleton root's own vertical motion (a hover, a jump, a crouch stays the clip's):
            // what is left is how far the skinned body sits from its bind pose (Darius ~100 source units up).
            if (standing && point.y - rootAt.y < ground) ground = point.y - rootAt.y;
            if (++work >= ENVELOPE_CHUNK) { work = 0; yield; pose(); mesh.skeleton.update(); if (root) root.getWorldPosition(rootAt).sub(homes[index]!); }
          }
        }
      }
      action.stop();
    }
  } finally {
    mixer.stopAllAction(); mixer.uncacheRoot(body);
    for (const mesh of meshes) mesh.skeleton.pose();
    body.updateMatrixWorld(true);
  }
  const low = Number.isFinite(ground) ? ground : null;
  if (!radii.length) return { radius: 0, ground: low };
  // The quantile in its own slice: a typed numeric sort (no comparator calls) of every sample.
  yield;
  const sorted = Float64Array.from(radii).sort();
  return { radius: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ENVELOPE_QUANTILE))]!, ground: low };
}

/** The envelope at once (a piece mounting outside combat with nothing measured yet). */
export function animationEnvelope(body: Object3D, clips: readonly EnvelopeClip[]): Envelope {
  const steps = envelopeSteps(body, clips);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
export function animationEnvelopeRadius(body: Object3D, clips: readonly EnvelopeClip[]): number { return animationEnvelope(body, clips).radius; }
/** The standing clip's lowest point alone (pass just that clip, `ground: true`); null without skinned meshes or clips. */
export function animationGround(body: Object3D, clips: readonly EnvelopeClip[]): number | null { return animationEnvelope(body, clips).ground; }

/**
 * The same envelope in slices of about `budgetMs`, handing the thread back between them (`pause`, an idle callback by
 * default). Resolves null when `stop()` turns true at a slice boundary (a combat began, the renderer went); the body is
 * left in its bind pose either way.
 */
export async function animationEnvelopeRadiusSliced(body: Object3D, clips: readonly EnvelopeClip[], options: SliceOptions = {}): Promise<number | null> {
  return (await animationEnvelopeSliced(body, clips, options))?.radius ?? null;
}
interface SliceOptions { budgetMs?: number; stop?: () => boolean; pause?: () => Promise<void>; now?: () => number }
/** animationGround in slices; resolves undefined when stopped (null still means "nothing to stand on"). */
export async function animationGroundSliced(body: Object3D, clips: readonly EnvelopeClip[], options: SliceOptions = {}): Promise<number | null | undefined> {
  const envelope = await animationEnvelopeSliced(body, clips, options);
  return envelope === null ? undefined : envelope.ground;
}
export async function animationEnvelopeSliced(body: Object3D, clips: readonly EnvelopeClip[], options: SliceOptions = {}): Promise<Envelope | null> {
  const budget = options.budgetMs ?? 3, now = options.now ?? (() => performance.now());
  const pause = options.pause ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  const steps = envelopeSteps(body, clips);
  for (;;) {
    const started = now();
    for (;;) {
      const next = steps.next();
      if (next.done) return next.value;
      if (now() - started >= budget) break;
    }
    await pause();
    if (options.stop?.()) { steps.return({ radius: 0, ground: null }); return null; }
  }
}

/**
 * Scales `body` (feet on y=0) and returns its drawn height in board units. `envelopeRadius` (official scale only, from
 * animationEnvelopeRadius) widens the footprint the width cap reads to everything the clips reach.
 */
export function fitModel(body: Object3D, options: { height: number; width?: number; unitScale?: number | null; sourceScale: number; envelopeRadius?: number;
  /** Official scale only: the standing clip's lowest point (Envelope.ground) goes on y=0 instead of the bind box's. */
  ground?: number | null }): number {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3()), width = options.width ?? Infinity;
  const { min, max } = box, official = !!options.unitScale;
  // Official scale: the footprint's diameter about the upright axis (the piece turns to face its target), over its
  // animations when known; fitted: the box.
  const bind = Math.max(...[min.x, max.x].flatMap(x => [min.z, max.z].map(z => Math.hypot(x, z))));
  const across = official ? 2 * Math.max(bind, options.envelopeRadius ?? 0) : Math.max(size.x, size.z);
  const cap = Math.min(size.y > 0 ? options.height * (official ? MAX_HEIGHT_RATIO : 1) / size.y : Infinity, across > 0 ? width / across : Infinity);
  const scale = official ? Math.min(options.sourceScale * options.unitScale!, cap) : cap;
  if (!Number.isFinite(scale) || scale <= 0) return Number.isFinite(options.height) ? options.height : size.y;
  body.scale.multiplyScalar(scale);
  // Feet: the standing clip's lowest point when measured (official scale), else the bind box's; the height runs from there.
  // Never below the bind box: a ground under it would only come from root motion already taken out, so keep the bind feet.
  const floor = official && options.ground != null && Number.isFinite(options.ground) ? Math.max(box.min.y, options.ground) : box.min.y;
  body.position.y -= floor * scale;
  return (box.max.y - floor) * scale;
}

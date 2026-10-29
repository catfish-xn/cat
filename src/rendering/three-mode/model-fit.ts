/**
 * Champion model sizing shared by the board, the carousel and the scout stage (planning/3d/model-scale-plan).
 * With the asset root's official per-unit scale (`models[id].unitScale`, from the 14.24 skin data), a model keeps its
 * own League size: drawn at sourceScale × unitScale, so a short champion (Amumu, Ziggs) stays short. The result is
 * capped at MAX_HEIGHT_RATIO × height tall and `width` across whichever way the piece faces (the footprint's
 * circumscribed circle about its upright axis), never stretched up. Without a unitScale (older asset roots) every
 * model is fitted to `height` and its x/z box to `width` exactly as before.
 */
import { AnimationMixer, Bone, Box3, LoopOnce, SkinnedMesh, Sphere, Vector3, type AnimationClip, type Object3D } from 'three';
import { createSupportSampler, registerModelGrounding, supportRotation, supportVertexSteps, MESH_PENETRATION_RATIO, type ModelSupport } from './model-grounding';

/** A drawn champion may be at most this many times the reference height (the plan's 1.6 × 92). */
export const MAX_HEIGHT_RATIO = 1.6;

/**
 * Playtest 10-22 art overrides of the manifest unitScale (Ekko read too tall, Vi too big next to the rest of the cast).
 * Candidates pending the user's confirmation; they replace the official skinScale only for models the root ships.
 */
export const UNIT_SCALE_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({ ekko: 0.86, vi: 0.82 });

/** The manifest's unitScale for a model when it is a positive finite number, else null (JSON from an asset root). */
export function readUnitScale(models: Readonly<Record<string, unknown>> | undefined, id: string): number | null {
  const entry = models && Object.hasOwn(models, id) ? models[id] : undefined;
  if (entry && Object.hasOwn(UNIT_SCALE_OVERRIDES, id)) return UNIT_SCALE_OVERRIDES[id]!;
  const value = entry && typeof entry === 'object' ? (entry as { unitScale?: unknown }).unitScale : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Clip samples and the radius stride; grounding reads every vertex so a foot between strides is not missed. */
const ENVELOPE_SAMPLES = 8, ENVELOPE_STRIDE = 7;
/** The envelope is this quantile of the sampled vertex distances, so a stray vertex (a thrown weapon) cannot set it. */
const ENVELOPE_QUANTILE = 0.98;
/** The clips a board piece stands, walks and fights in; death, dances and the like do not size its cell. */
export const ENVELOPE_ACTIONS = ['idle', 'move', 'attack', 'hit'] as const;
/** Of those, the ones that loop (sampled at distinct times; the others play once and keep their last frame). */
export const LOOPING_ACTIONS: ReadonlySet<string> = new Set(['idle', 'move']);
/**
 * `ground`: a clip whose lowest point (net of the root's own motion) can set where the feet go. `feet`: a clip whose
 * plain lowest point (root motion included) is where the piece stands (the board's idle).
 */
export interface EnvelopeClip { readonly clip: AnimationClip; readonly loop: boolean; readonly ground?: boolean; readonly feet?: boolean }
/**
 * What the clips reach: `radius` from the upright axis (the width cap), and `ground`, the lowest point over the
 * `ground` clips' samples once each sample's root drift from its bind place is taken out (null without such clips),
 * in the same units. A bind pose can stand far below every clip (Darius, Nami): grounding on the bind box left those
 * pieces floating. fitModel never puts the feet below the bind box with it, so a hovering model (root raised in its
 * clips: Malzahar, Nocturne) keeps its height and no clip sinks under the cell.
 */
export interface Envelope { readonly radius: number; readonly ground: number | null; readonly feet?: number | null;
  /** Indexed idle body/foot contacts, preferred to the legacy whole-mesh floor for grounded models. */
  readonly support?: ModelSupport }

/**
 * Models whose idle hovers on purpose (Malzahar, Nocturne, Corki's flyer): they keep the root-motion-free `ground`.
 * Every other official-scale model stands its idle's lowest point on the cell. Netting out the root's rise floated
 * pieces whose clips lift the skeleton root while the feet stay put (Steb ~77 board units up, Rell, Jayce, Mordekaiser).
 */
export const HOVERING_MODELS: ReadonlySet<string> = new Set(['malzahar', 'nocturne', 'corki', 'pve-elder-dragon']);
/** The `feet` fitModel takes for this model: the envelope's idle feet, unless the model hovers by design. */
export function standingFeet(id: string, envelope: Envelope | undefined): number | null {
  return HOVERING_MODELS.has(id) ? null : envelope?.feet ?? null;
}
export function standingSupport(id: string, envelope: Envelope | undefined): ModelSupport | undefined {
  return HOVERING_MODELS.has(id) ? undefined : envelope?.support;
}

/** Vertices read between time checks in the sliced envelope (a few hundred microseconds of work). */
const ENVELOPE_CHUNK = 512;

/**
 * How far from the body's upright axis its skinned vertices reach (ENVELOPE_QUANTILE of the samples) over the given
 * clips, in the world units fitModel's box reads (the unattached body's own transform, before fitting); 0 without
 * skinned meshes or clips. A one-frame box misses an idle that spreads its arms (Nami, Trundle) or an attack that
 * swings wide (Garen). Distances are taken from the skeleton root's own horizontal place in each sample, so a clip
 * that carries the whole body sideways (Vi, Zoe) does not count as reach. Leaves all nodes in their original loaded pose.
 * The work is a generator that pauses every ENVELOPE_CHUNK vertices: the sync form runs it through, the async form
 * spreads it over idle slices.
 */
function* envelopeSteps(body: Object3D, clips: readonly EnvelopeClip[]): Generator<void, Envelope> {
  const meshes: SkinnedMesh[] = [];
  body.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  if (!meshes.length || !clips.length) return { radius: 0, ground: null, feet: null };
  let ground = Infinity, feet = Infinity;
  const mixer = new AnimationMixer(body), point = new Vector3(), rootAt = new Vector3(), radii: number[] = [];
  // Vertices read since the last pause, across poses, meshes and clips (small meshes alone never reach a chunk).
  let work = 0;
  // A shared skeleton may contain independent rigs (Nunu and Willump). Use the root
  // with the greatest skin weight on this mesh, never an unused first skeleton bone.
  // Detached leaf facial/weapon controls are pose changes, not whole-body locomotion.
  // A prop-only mesh follows the skeleton body root even when none of its vertices weights that root.
  const roots: (Bone | null)[] = [];
  for (const mesh of meshes) {
    const byBone = mesh.skeleton.bones.map(bone => {
      let root = bone;
      while (root.parent instanceof Bone) root = root.parent;
      return root;
    });
    const totals = new Map<Bone, number>();
    const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
    for (let vertex = 0; vertex < indices.count; vertex++) {
      if (++work >= ENVELOPE_CHUNK) { work = 0; yield; }
      for (let component = 0; component < 4; component++) {
        const weight = weights.getComponent(vertex, component), root = byBone[indices.getComponent(vertex, component)];
        if (weight > 0 && root?.children.some(child => child instanceof Bone)) totals.set(root, (totals.get(root) ?? 0) + weight);
      }
    }
    roots.push([...totals].sort((a, b) => b[1] - a[1])[0]?.[0]
      ?? byBone.find(root => root.children.some(child => child instanceof Bone)) ?? byBone[0] ?? null);
  }
  // This is an independent, freshly loaded lease. In quantized glTFs the inverse bind matrices can include
  // dequantization: Skeleton.pose() reconstructs different TRS, not the authored loading pose.
  // Include non-bone animated ancestors as well as bones (including skeleton nodes outside the mesh subtree).
  const nodes = new Set<Object3D>();
  body.traverse(node => nodes.add(node));
  for (const mesh of meshes) for (const bone of mesh.skeleton.bones) {
    for (let node: Object3D | null = bone; node && node !== body.parent; node = node.parent) nodes.add(node);
  }
  const loaded = [...nodes].map(node => ({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  body.updateWorldMatrix(true, true);
  for (const node of nodes) node.updateWorldMatrix(true, false);
  const boxes: Box3[] = [];
  for (const mesh of meshes) {
    mesh.skeleton.update(); const box = new Box3();
    for (let v = 0; v < mesh.geometry.attributes.position!.count; v++) {
      box.expandByPoint(mesh.getVertexPosition(v, point));
      if (++work >= ENVELOPE_CHUNK) { work = 0; yield; }
    }
    mesh.boundingBox = box; boxes.push(box.clone());
  }
  // Some clips hide a weapon by moving its bones thousands of units below the floor (Draven's thrown axes).
  // That is not a foot. Keep every vertex near the loaded body, including feet between the radius sampler's strides.
  const bindBox = new Box3().setFromObject(body);
  const classified: (readonly (string | null)[])[] = [];
  for (const mesh of meshes) classified.push(yield* supportVertexSteps(mesh));
  const support = createSupportSampler(meshes, Math.max(bindBox.max.y - bindBox.min.y, 1), classified);
  const groundLimit = bindBox.min.y - Math.max(bindBox.max.y - bindBox.min.y, 1) * 2;
  const restore = () => {
    for (const { node, position, quaternion, scale } of loaded) {
      node.position.copy(position); node.quaternion.copy(quaternion); node.scale.copy(scale); node.updateMatrix();
    }
    body.updateWorldMatrix(true, true);
    for (const node of nodes) node.updateWorldMatrix(true, false);
    meshes.forEach((mesh, index) => {
      mesh.skeleton.update();
      // The restored pose has exactly the loaded bounds. Its enclosing sphere is conservative and needs no rescan.
      mesh.boundingBox = boxes[index]!.clone();
      mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new Sphere());
    });
  };
  // Root homes and the bind box must describe that same loaded pose.
  const homes = roots.map(root => root ? root.getWorldPosition(new Vector3()) : new Vector3());
  try {
    for (const { clip, loop, ground: standing, feet: stands } of clips) {
      restore();
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
          for (let v = 0; v < count; v += standing || stands ? 1 : ENVELOPE_STRIDE) {
            mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld);
            if (stands) support.vertex(index, v, point);
            if (v % ENVELOPE_STRIDE === 0) radii.push(Math.hypot(point.x - rootAt.x, point.z - rootAt.z));
            // Feet without the skeleton root's own vertical motion (a hover, a jump, a crouch stays the clip's):
            // what is left is how far the skinned body sits from its bind pose (Darius ~100 source units up).
            const foot = point.y - rootAt.y;
            if (standing && foot >= groundLimit && foot < ground) ground = foot;
            if (stands && point.y >= groundLimit && point.y < feet) feet = point.y;
            if (++work >= ENVELOPE_CHUNK) { work = 0; yield; pose(); mesh.skeleton.update(); if (root) root.getWorldPosition(rootAt).sub(homes[index]!); }
          }
        }
        if (stands) yield* support.frameSteps();
      }
      action.stop();
      restore();
    }
  } finally {
    mixer.stopAllAction(); mixer.uncacheRoot(body);
    restore();
  }
  const low = Number.isFinite(ground) ? ground : null, plain = Number.isFinite(feet) ? feet : null;
  if (!radii.length) return { radius: 0, ground: low, feet: plain };
  // The quantile in its own slice: a typed numeric sort (no comparator calls) of every sample.
  yield;
  const sorted = Float64Array.from(radii).sort();
  const measuredSupport = support.finish();
  return { radius: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ENVELOPE_QUANTILE))]!, ground: low, feet: plain,
    ...(measuredSupport ? { support: measuredSupport } : {}) };
}

/** The envelope at once (a piece mounting outside combat with nothing measured yet). */
export function animationEnvelope(body: Object3D, clips: readonly EnvelopeClip[]): Envelope {
  const steps = envelopeSteps(body, clips);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
export function animationEnvelopeRadius(body: Object3D, clips: readonly EnvelopeClip[]): number { return animationEnvelope(body, clips).radius; }

/**
 * The same envelope in slices of about `budgetMs`, handing the thread back between them (`pause`, an idle callback by
 * default). Resolves null when `stop()` turns true at a slice boundary (a combat began, the renderer went); the body is
 * left in its loaded pose either way (also when the pause callback rejects).
 */
export async function animationEnvelopeRadiusSliced(body: Object3D, clips: readonly EnvelopeClip[], options: SliceOptions = {}): Promise<number | null> {
  return (await animationEnvelopeSliced(body, clips, options))?.radius ?? null;
}
interface SliceOptions { budgetMs?: number; stop?: () => boolean; pause?: () => Promise<void>; now?: () => number }
export async function animationEnvelopeSliced(body: Object3D, clips: readonly EnvelopeClip[], options: SliceOptions = {}): Promise<Envelope | null> {
  const budget = options.budgetMs ?? 3, now = options.now ?? (() => performance.now());
  const pause = options.pause ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  const steps = envelopeSteps(body, clips);
  try {
    for (;;) {
      const started = now();
      for (;;) {
        const next = steps.next();
        if (next.done) return next.value;
        if (now() - started >= budget) break;
      }
      await pause();
      if (options.stop?.()) return null;
    }
  } finally {
    steps.return({ radius: 0, ground: null, feet: null });
  }
}

/**
 * Scales `body` (feet on y=0) and returns its drawn height in board units. `envelopeRadius` (official scale only, from
 * animationEnvelopeRadius) supplies the animated footprint instead of an unused, spread-out loading pose.
 */
export function fitModel(body: Object3D, options: { height: number; width?: number; unitScale?: number | null; sourceScale: number; envelopeRadius?: number;
  /** Official scale only: the standing clip's lowest point (Envelope.ground) goes on y=0 instead of the bind box's. */
  ground?: number | null;
  /** Official scale only: the idle's plain lowest point; wins over `ground` when no support calibration is supplied. */
  feet?: number | null;
  /** Idle support calibration; omit for intentionally hovering models. Shared by board, scout and carousel. */
  support?: ModelSupport }): number {
  const support = options.unitScale ? options.support : undefined;
  const correction = support ? supportRotation(support) : null;
  if (correction) { body.quaternion.premultiply(correction); body.updateWorldMatrix(true, true); }
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3()), width = options.width ?? Infinity;
  const { min, max } = box, official = !!options.unitScale;
  // Official scale: the footprint's diameter about the upright axis (the piece turns to face its target), over its
  // animations when known; fitted: the box.
  const bind = Math.max(...[min.x, max.x].flatMap(x => [min.z, max.z].map(z => Math.hypot(x, z))));
  const across = official ? 2 * (options.envelopeRadius && options.envelopeRadius > 0 ? options.envelopeRadius : bind) : Math.max(size.x, size.z);
  const cap = Math.min(size.y > 0 ? options.height * (official ? MAX_HEIGHT_RATIO : 1) / size.y : Infinity, across > 0 ? width / across : Infinity);
  const scale = official ? Math.min(options.sourceScale * options.unitScale!, cap) : cap;
  if (!Number.isFinite(scale) || scale <= 0) return Number.isFinite(options.height) ? options.height : size.y;
  body.scale.multiplyScalar(scale);
  // Feet: the standing clip's lowest point when measured (official scale), else the bind box's; the height runs from there.
  // The clips' own feet (root drift taken out) land where the bind feet stand, at most on the origin: a body lifted off
  // its bind pose in every clip comes down (Darius), a bind pose that already hovers keeps that hover, and a foot posed
  // below the bind floor is raised onto the cell. Without a measured ground, the bind box's bottom goes on y=0 as before.
  const standing = official && options.feet != null && Number.isFinite(options.feet);
  const measured = official && options.ground != null && Number.isFinite(options.ground);
  const center = support ? new Vector3(...support.center).applyQuaternion(correction!) : null;
  const floor = support ? new Vector3(support.center[0], Math.min(support.floor, support.meshFloor + support.height * MESH_PENETRATION_RATIO), support.center[2]).applyQuaternion(correction!).y
    : standing ? options.feet! : measured ? options.ground! - Math.max(box.min.y, 0) : box.min.y;
  body.position.y -= floor * scale;
  if (center) { body.position.x -= center.x * scale; body.position.z -= center.z * scale; }
  if (support) registerModelGrounding(body, support, floor * scale, scale);
  return (box.max.y - floor) * scale;
}

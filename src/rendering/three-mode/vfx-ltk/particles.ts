/** Bare Three.js host over the upstream simulation and original GPU buffer writers. */
import { Box3, BufferAttribute, Camera, Group, Matrix4, Vector3, type BufferGeometry, type Object3D } from 'three';
import type { PreparedVfx } from './loader';
import { AXIS_SIGN } from './space';
import { FIRST_FLIGHT, type Anchor, type Joints, type RigModel } from './engine/model/rig';
import { createDriver } from './engine/simulation/driver';
import type { Source } from './engine/simulation/particleRead';
import { createQuads } from './rendering/components/Quads';
import { createTrails } from './rendering/components/Trails';
import { createBeams } from './rendering/components/Beams';
import { createProjections } from './rendering/components/Projections';
import { createMeshes } from './rendering/components/Meshes';
import { borrowMeshBuffers } from './rendering/utils/drawBufferPool';
import { drawsAsBeam, drawsAsMesh, drawsAsProjection, drawsAsQuad, drawsAsTrail, drawsTheAttachment } from './rendering/utils/drawKind';
import { createAttachedMeshes, type AttachedDraw } from './rendering/components/AttachedMeshes';
import { stencilOf, type StencilClaim } from './rendering/utils/stencil';
import type { ParticleDraw, DrawFrameState } from './rendering/lifetime';
import { meshPose } from './rendering/utils/meshPose';
import { drawLayersOf } from './rendering/utils/frame';
import { drawPhases } from './rendering/utils/drawKind';
import { fades } from './rendering/utils/softParticle';
import { withDrawFade } from './engine/simulation/particleRead';

/** League units -> board units. Shared across champions regardless of model fitting. */
export const FX_SCALE = 0.44;
export const ROOT_PARTICLES = 150, CHILD_PARTICLES = 100;
/**
 * A fading cue's alpha at `elapsed` seconds: full until `stopAfter`, then easing to nothing at `duration`, so particles
 * that outlive the cue leave with it instead of being cut off at full strength. 1 without a soft stop.
 */
export function fadeAt(elapsed: number, duration: number, stopAfter: number | undefined): number {
  if (stopAfter === undefined || !(duration > stopAfter) || elapsed <= stopAfter) return 1;
  const through = Math.min(1, (elapsed - stopAfter) / (duration - stopAfter));
  return 1 - through * through * (3 - 2 * through);
}
/** Match the upstream mesh decoder's explicit RGBA vertex colour lane. GLB colour is optional. */
export function staticMeshGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone();
  if (!geometry.getAttribute('vertexColor')) {
    const position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
    const values = new Float32Array(position.count * 4).fill(1);
    if (color) for (let at = 0; at < position.count; at++) {
      values[at * 4] = color.getX(at); values[at * 4 + 1] = color.getY(at); values[at * 4 + 2] = color.getZ(at);
      values[at * 4 + 3] = color.itemSize > 3 ? color.getW(at) : 1;
    }
    geometry.setAttribute('vertexColor', new BufferAttribute(values, 4));
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  return geometry;
}
/** Capture current world bone pose as engine coordinates; missing bones bind to unit position. */
export function pointAnchor(point: readonly [number, number, number]): Anchor {
  return { originAt: () => [point[0] * AXIS_SIGN[0] / FX_SCALE, point[1] / FX_SCALE, point[2] / FX_SCALE],
    basisInto(_time, out) { out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return out; } };
}
/**
 * Share of the body's height a missing body locator stands in at (11-12: hits authored on the chest landed on the feet).
 * Fitted values, not 14.24 data: chosen to sit near where those locators are on the models that have them.
 */
const MISSING_LOCATOR_SHARE: readonly [RegExp, number][] = [
  [/^c?_?buffbone_glb_chest_loc$/i, 0.6], [/^c?_?buffbone_glb_center_loc$/i, 0.5], [/^c?_?buffbone_glb_head_loc$/i, 0.9],
  [/^c?_?buffbone_glb_overhead_loc$/i, 1],
];
/**
 * Height above the unit's origin for a requested bone the model does not have. Body locators (chest, centre, head,
 * overhead) take their share of `bodyHeight`; any other missing bone (ground, a weapon) stays on the origin, as before.
 */
export function missingLocatorLift(bone: string, bodyHeight: number): number {
  const share = MISSING_LOCATOR_SHARE.find(([pattern]) => pattern.test(bone))?.[1];
  return share === undefined || !(bodyHeight > 0) ? 0 : share * bodyHeight;
}
const box = new Box3();
/** World height of the body's top above the unit's origin (bind-pose bounds), 0 without geometry. */
function bodyHeightAbove(root: Object3D, body: Object3D): number {
  box.setFromObject(body); if (box.isEmpty()) return 0;
  return box.max.y - root.getWorldPosition(new Vector3()).y;
}
/** The buff locators that only mark a place on the unit. Their own axes differ per skeleton (11-06 four-way check: the ground
 * locator's +Z faces forward on Zyra but backward on Irelia, Kog'Maw and Akali; Kog'Maw's head and chest locators face
 * backward too, Irelia's chest sideways), while bins author "in front" as the unit's facing. Weapon and named bones keep
 * their own axes (Kog'Maw's W mouth spray rides the weapon locator's +Y toward the target). */
const PLACE_ONLY_LOCATOR = /^c?_?buffbone_glb_(ground|center|chest|head)_loc$/i;
/**
 * `aim` (a cast's primary target) turns the unit-facing basis toward it: the model turns over TURN_SECONDS after the
 * cast event, and a cast-start from a resting unit otherwise faced the camera (11-07: Zyra's roots thrown at open ground).
 */
export function unitAnchor(root: Object3D, body: Object3D | null, bone?: string, aim?: () => Object3D | null): Anchor {
  const point = new Vector3(), toward = new Vector3(), matrix = new Matrix4();
  let attachment: Object3D | undefined;
  if (bone) body?.traverse(node => { if (!attachment && node.name.toLowerCase() === bone.toLowerCase()) attachment = node; });
  const node = () => attachment ?? root;
  // A body locator the model lacks stands in at its share of the body's height above the unit, not on the floor.
  const lift = !attachment && bone && body ? missingLocatorLift(bone, bodyHeightAbove(root, body)) : 0;
  return {
    originAt() { node().getWorldPosition(point); point.y += lift; return [point.x * AXIS_SIGN[0] / FX_SCALE, point.y / FX_SCALE, point.z / FX_SCALE]; },
    basisInto(_time, out) {
      // A place-only locator lends its position; the effect faces the way the unit faces (Irelia's W swipe pointed backward).
      const held = attachment && !PLACE_ONLY_LOCATOR.test(attachment.name) ? attachment : root;
      held.updateWorldMatrix(true, false); matrix.copy(held.matrixWorld);
      const aimed = held === root ? aim?.() : null;
      if (aimed) {
        root.getWorldPosition(point); aimed.getWorldPosition(toward);
        const dx = toward.x - point.x, dz = toward.z - point.z;
        // Same convention as the root's own heading: rotation.y = atan2(dx, dz) looks along +z.
        if (dx * dx + dz * dz > 1e-6) matrix.makeRotationY(Math.atan2(dx, dz));
      }
      const e = matrix.elements;
      for (let column = 0; column < 3; column++) {
        const length = Math.hypot(e[column * 4], e[column * 4 + 1], e[column * 4 + 2]) || 1;
        for (let row = 0; row < 3; row++) out[row * 3 + column] = e[column * 4 + row] / length * AXIS_SIGN[row] * AXIS_SIGN[column];
      }
      return out;
    },
  };
}
export function unitJoints(root: Object3D, body: Object3D | null): Joints {
  const anchors = new Map<string, Anchor>();
  return name => {
    let held = anchors.get(name);
    if (!held) { held = unitAnchor(root, body, name); anchors.set(name, held); }
    return held;
  };
}
export function createLtkParticles(prepared: PreparedVfx, options: {
  anchor: Anchor; target: Anchor | null; joints: Joints; projectileSeconds?: number; duration: number; stopAfter?: number; seed: number;
  /** After `stopAfter`, ease every particle's alpha to nothing by `duration` (see `fadeAt`). */
  fadeOut?: boolean;
  /** Seconds from cue start when alpha begins easing to nothing by `duration` (see `fadeAt`). */
  fadeFrom?: number;
  /** Cue scale about the anchor. Omitted means 1. Not applied to the root group's FX_SCALE. */
  scale?: number;
  attachment?: { root: Object3D; body: Object3D | null; disposed?: boolean };
}) {
  const resolveFadeFrom = (next: typeof options) => 'fadeFrom' in next ? next.fadeFrom : next.fadeOut ? next.stopAfter : undefined;
  const spec = { ...options, scale: options.scale ?? 1, fadeFrom: resolveFadeFrom(options) };
  const rigFor = (): RigModel => {
    const from = spec.anchor.originAt(0), to = spec.target?.originAt(0) ?? from;
    const distance = Math.hypot(...from.map((value, index) => value - to[index]));
    // Emitters without particleLinger vanish on a rig stop, so fadeOut keeps emitting and only fades alpha past stopAfter.
    return { life: 'once', height: 0, joints: spec.joints, stopAt: spec.fadeOut ? undefined : spec.stopAfter,
      motion: spec.projectileSeconds && distance > 0 ? { kind: 'missile', from, to,
        flight: { ...FIRST_FLIGHT, movement: { kind: 'fixedSpeed', speed: distance / spec.projectileSeconds } } }
        : { kind: 'bone', anchor: spec.anchor, target: spec.target } };
  };
  // Cue scale stays off this group: scaling it would pull the anchor toward the world origin.
  const object = new Group(); object.name = 'ltk-vfx'; object.scale.setScalar(FX_SCALE);
  const driver = createDriver(spec.seed, { capacity: ROOT_PARTICLES, seekable: false, childBudget: CHILD_PARTICLES, maxChildren: 8 });
  driver.setScale(spec.scale);
  let rig = rigFor();
  driver.swap(prepared.model);
  if (prepared.surfaces) driver.setSurfaces(prepared.surfaces);
  driver.steer(rig);
  const stencils: (StencilClaim & { material: ParticleDraw['material'] })[] = [];
  const draws: ParticleDraw[] = [], overlays: AttachedDraw[] = [], rootSources: Source[] = [driver];
  const passes = { early: false, late: false, soft: false };
  try {
    for (const definition of prepared.drawn) {
      const emitter = definition.emitter;
      if (emitter.disabled) continue;
      // Simulation may still feed children, but only colour/warp phases get a draw.
      // In particular, castsShadow alone is not permission to join the colour pass.
      const layers = drawLayersOf(emitter);
      if (!layers.length) continue;
      const sources = definition.path ? driver.sources(definition.path) : rootSources;
      const samplers = prepared.samplers.get(definition.key)!;
      const props = { emitter, sources, samplers, rank: definition.rank, hidden: false, room: ROOT_PARTICLES };
      let draw: ParticleDraw | undefined;
      if (drawsTheAttachment(emitter)) {
        const attached = createAttachedMeshes(emitter, sources, samplers, definition.rank, object, spec.attachment);
        for (const held of attached) {
          held.object.layers.disableAll(); for (const layer of layers) held.object.layers.enable(layer);
          draws.push(held); overlays.push(held); object.add(held.object);
          const use = stencilOf(emitter); if (use) stencils.push({ use, live: true, material: held.material });
        }
      } else if (drawsAsMesh(emitter)) {
        const geometry = prepared.meshes.get(definition.key);
        if (geometry) {
          const pose = prepared.poses?.get(definition.key);
          // definition.key is only the emitter's place inside its own system, so other systems share it.
          // Pooled buffers carry their mesh, so they are keyed by the loaded geometry itself (Ezreal W blobs, 11-06).
          draw = createMeshes({
            ...props,
            meshKey: geometry.uuid,
            buffers: { ...borrowMeshBuffers(geometry.uuid, staticMeshGeometry(geometry)), ...(pose ? { pose: meshPose(pose) } : {}) },
          });
        }
      } else if (drawsAsQuad(emitter)) draw = createQuads(props);
      else if (drawsAsTrail(emitter)) draw = createTrails(props);
      else if (drawsAsBeam(emitter)) draw = createBeams(props);
      else if (drawsAsProjection(emitter)) draw = createProjections(props);
      if (draw) {
        // Named for dev probes only (dev/castcmp probes.ts emitters()); nothing in the renderer reads it.
        draw.object.name = `${emitter.name ?? '?'}#${definition.rank}`;
        draw.object.layers.disableAll(); for (const layer of layers) draw.object.layers.enable(layer);
        const phases = drawPhases(emitter); passes.early ||= phases.warpsEarly; passes.late ||= phases.warpsLate; passes.soft ||= fades(emitter);
        draws.push(draw); object.add(draw.object); const use = stencilOf(emitter); if (use) stencils.push({ use, live: true, material: draw.material });
      }
    }
  } catch (error) { for (const draw of draws) draw.dispose(); throw error; }
  let elapsed = 0, closed = false, peak = 0;
  const eye = new Camera(), frameRenderer = { info: { render: { frame: 0 } } };
  return {
    object, driver, draws, stencils, passes,
    /** The host-body overlays among `draws`, which the runtime counts against its screen cap. */
    attached: overlays,
    /** Most root particles live at once in this play, which the runtime reserves for the system's next play. */
    get peak() { return peak; },
    /** It runs child systems, whose room (CHILD_PARTICLES) the root count does not show. */
    children: prepared.drawn.some(definition => !!definition.path),
    /** Play the same prepared system again. The caller only does this for the same attachment. */
    reuse(next: typeof options) {
      if (closed) return;
      spec.anchor = next.anchor; spec.target = next.target; spec.joints = next.joints; spec.attachment = next.attachment;
      spec.projectileSeconds = next.projectileSeconds; spec.duration = next.duration; spec.stopAfter = next.stopAfter; spec.seed = next.seed; spec.fadeOut = next.fadeOut; spec.fadeFrom = resolveFadeFrom(next);
      spec.scale = next.scale ?? 1; driver.setScale(spec.scale);
      elapsed = 0; peak = 0; driver.reseed(next.seed); rig = rigFor(); driver.steer(rig);
    },
    get finished() { return closed || elapsed >= spec.duration; },
    stop() { if (!closed) { rig = { ...rig, stopAt: driver.time }; driver.steer(rig); } },
    update(seconds: number, camera: Camera) {
      if (closed || !Number.isFinite(seconds) || seconds < 0) return;
      elapsed += seconds;
      // Bound a tab-resume frame; old queued bursts are discarded by the timeline host.
      driver.advance(Math.min(seconds, 0.1));
      peak = Math.max(peak, driver.pool.count);
      camera.getWorldPosition(eye.position).divideScalar(FX_SCALE); camera.getWorldQuaternion(eye.quaternion); eye.up.copy(camera.up); eye.updateMatrixWorld();
      frameRenderer.info.render.frame++;
      const state: DrawFrameState = { camera: eye, gl: frameRenderer };
      const fade = spec.fadeFrom !== undefined ? fadeAt(elapsed, spec.duration, spec.fadeFrom) : 1;
      withDrawFade(fade, () => { for (const draw of draws) draw.update(state); });
    },
    dispose() { if (closed) return; closed = true; object.removeFromParent(); for (const draw of draws) draw.dispose(); object.clear(); },
  };
}
export type LtkParticles = ReturnType<typeof createLtkParticles>;
/**
 * The most root particles a run of `prepared` holds at once: the same engine runs it in place, without drawing, for
 * `seconds` at 1/30 s steps (stopped at `stopAfter` when given). What a first play reserves before any play was seen.
 */
export function measurePeak(prepared: PreparedVfx, seconds: number, stopAfter?: number): number {
  const anchor = pointAnchor([0, 0, 0]);
  const driver = createDriver(1, { capacity: ROOT_PARTICLES, seekable: false, childBudget: CHILD_PARTICLES, maxChildren: 8 });
  driver.swap(prepared.model);
  if (prepared.surfaces) driver.setSurfaces(prepared.surfaces);
  driver.steer({ life: 'once', height: 0, joints: () => anchor, stopAt: stopAfter, motion: { kind: 'bone', anchor, target: null } });
  let peak = 0;
  for (let at = 0; at < seconds; at += 1 / 30) { driver.advance(1 / 30); peak = Math.max(peak, driver.pool.count); }
  return peak;
}

/** Bare Three.js host over the upstream simulation and original GPU buffer writers. */
import { BufferAttribute, Camera, Group, Matrix4, Vector3, type BufferGeometry, type Object3D } from 'three';
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
import { meshBuffers } from './rendering/utils/buffers';
import { drawsAsBeam, drawsAsMesh, drawsAsProjection, drawsAsQuad, drawsAsTrail, drawsTheAttachment } from './rendering/utils/drawKind';
import { createAttachedMeshes } from './rendering/components/AttachedMeshes';
import { stencilOf, type StencilClaim } from './rendering/utils/stencil';
import type { ParticleDraw, DrawFrameState } from './rendering/lifetime';
import { meshPose } from './rendering/utils/meshPose';
import { drawLayersOf } from './rendering/utils/frame';
import { drawPhases } from './rendering/utils/drawKind';
import { fades } from './rendering/utils/softParticle';

/** League units -> board units. Shared across champions regardless of model fitting. */
export const FX_SCALE = 0.44;
export const ROOT_PARTICLES = 150, CHILD_PARTICLES = 100;
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
export function unitAnchor(root: Object3D, body: Object3D | null, bone?: string): Anchor {
  const point = new Vector3(), matrix = new Matrix4();
  let attachment: Object3D | undefined;
  if (bone) body?.traverse(node => { if (!attachment && node.name.toLowerCase() === bone.toLowerCase()) attachment = node; });
  const node = () => attachment ?? root;
  return {
    originAt() { node().getWorldPosition(point); return [point.x * AXIS_SIGN[0] / FX_SCALE, point.y / FX_SCALE, point.z / FX_SCALE]; },
    basisInto(_time, out) {
      const held = node(); held.updateWorldMatrix(true, false); matrix.copy(held.matrixWorld);
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
  attachment?: { root: Object3D; body: Object3D | null; disposed?: boolean };
}) {
  const object = new Group(); object.scale.setScalar(FX_SCALE);
  const driver = createDriver(options.seed, { capacity: ROOT_PARTICLES, seekable: false, childBudget: CHILD_PARTICLES, maxChildren: 8 });
  const from = options.anchor.originAt(0), to = options.target?.originAt(0) ?? from;
  const distance = Math.hypot(...from.map((value, index) => value - to[index]));
  let rig: RigModel = { life: 'once', height: 0, joints: options.joints, stopAt: options.stopAfter,
    motion: options.projectileSeconds && distance > 0 ? { kind: 'missile', from, to,
      flight: { ...FIRST_FLIGHT, movement: { kind: 'fixedSpeed', speed: distance / options.projectileSeconds } } }
      : { kind: 'bone', anchor: options.anchor, target: options.target },
  };
  driver.swap(prepared.model); driver.steer(rig);
  const stencils: (StencilClaim & { material: ParticleDraw['material'] })[] = [];
  const draws: ParticleDraw[] = [], rootSources: Source[] = [driver];
  const passes = { early: false, late: false, soft: false };
  try {
    for (const definition of prepared.drawn) {
      const emitter = definition.emitter;
      if (emitter.disabled) continue;
      const sources = definition.path ? driver.sources(definition.path) : rootSources;
      const samplers = prepared.samplers.get(definition.key)!;
      const props = { emitter, sources, samplers, rank: definition.rank, hidden: false, room: ROOT_PARTICLES };
      let draw: ParticleDraw | undefined;
      if (drawsTheAttachment(emitter)) {
        const attached = createAttachedMeshes(emitter, sources, samplers, definition.rank, object, options.attachment);
        for (const held of attached) {
          held.object.layers.disableAll(); for (const layer of drawLayersOf(emitter)) held.object.layers.enable(layer);
          draws.push(held); object.add(held.object);
          const use = stencilOf(emitter); if (use) stencils.push({ use, live: true, material: held.material });
        }
      } else if (drawsAsMesh(emitter)) {
        const geometry = prepared.meshes.get(definition.key);
        if (geometry) {
          const pose = prepared.poses?.get(definition.key);
          draw = createMeshes({ ...props, buffers: { ...meshBuffers(staticMeshGeometry(geometry)), ...(pose ? { pose: meshPose(pose) } : {}) } });
        }
      } else if (drawsAsQuad(emitter)) draw = createQuads(props);
      else if (drawsAsTrail(emitter)) draw = createTrails(props);
      else if (drawsAsBeam(emitter)) draw = createBeams(props);
      else if (drawsAsProjection(emitter)) draw = createProjections(props);
      if (draw) {
        draw.object.layers.disableAll(); for (const layer of drawLayersOf(emitter)) draw.object.layers.enable(layer);
        const phases = drawPhases(emitter); passes.early ||= phases.warpsEarly; passes.late ||= phases.warpsLate; passes.soft ||= fades(emitter);
        draws.push(draw); object.add(draw.object); const use = stencilOf(emitter); if (use) stencils.push({ use, live: true, material: draw.material });
      }
    }
  } catch (error) { for (const draw of draws) draw.dispose(); throw error; }
  let elapsed = 0, closed = false;
  const eye = new Camera(), frameRenderer = { info: { render: { frame: 0 } } };
  return {
    object, driver, draws, stencils, passes,
    get finished() { return closed || elapsed >= options.duration; },
    stop() { if (!closed) { rig = { ...rig, stopAt: driver.time }; driver.steer(rig); } },
    update(seconds: number, camera: Camera) {
      if (closed || !Number.isFinite(seconds) || seconds < 0) return;
      elapsed += seconds;
      // Bound a tab-resume frame; old queued bursts are discarded by the timeline host.
      driver.advance(Math.min(seconds, 0.1));
      camera.getWorldPosition(eye.position).divideScalar(FX_SCALE); camera.getWorldQuaternion(eye.quaternion); eye.up.copy(camera.up); eye.updateMatrixWorld();
      frameRenderer.info.render.frame++;
      const state: DrawFrameState = { camera: eye, gl: frameRenderer };
      for (const draw of draws) draw.update(state);
    },
    dispose() { if (closed) return; closed = true; object.removeFromParent(); for (const draw of draws) draw.dispose(); object.clear(); },
  };
}
export type LtkParticles = ReturnType<typeof createLtkParticles>;

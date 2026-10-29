/*! @license GPL-3.0-or-later
 * Derived from ltk-manager (GPL-3.0-or-later).
 * Source: src/modules/workshop/bin/vfx/rendering/components/Meshes.tsx
 * Port/adaptation: catfish-xn/cat, 2026-10-26. See NOTICE.md and LICENSE.
 */
// Bare Three.js adaptation: retains original mesh particle transform and appearance.
import { drawLifetime, showPair } from "../lifetime";
import { BackSide, DoubleSide, FrontSide } from "three";
import type { EmitterModel as SideEmitter } from "../../engine/model/model";
function meshSide(emitter: SideEmitter) { return emitter.backfaceCull ? emitter.flipWinding ? BackSide : FrontSide : DoubleSide; }
import {
  type BufferGeometry,
  type Camera,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import { AXIS_SIGN } from "../../space";

import type { BeamModel, EmitterModel, MeshModel } from "../../engine/model/model";
import {
  age01,
  appearance,
  type DrawFrame,
  drawnPlace,
  drawnPlaceInto,
  erosionDrive,
  frameInto,
  frameOf,
  type FrameSlot,
  particleBasisInto,
  type Source,
} from "../../engine/simulation/particleRead";
import { FRAME_SLOTS, type Pool } from "../../engine/simulation/pool";
import { beamInto, mirrorInto, standingInto, unscaleInto } from "../../engine/utils/basis";
import type { EmitterSamplers } from "../hooks/useVfxTextures";
import { fragmentTests, premultiplyInto } from "../utils/blend";
import {
  MESH_LAYOUT,
  MESH_STRIDE,
  type MeshBuffers,
  MESHES_PER_EMITTER,
  rowsWritten,
  written,
} from "../utils/buffers";
import { colorLookupInto } from "../utils/colorLookup";
import { bucketRange, bucketsOf, renderStamp } from "../utils/emitterBuckets";
import { meshMaterial } from "../utils/materials";
import { sourcesScrollInto } from "../utils/palette";
import { beamEndsInto, beamTint } from "../utils/ribbon";
import { type LayerDraws, layersOf } from "../utils/uniforms";
import { layerOf, uvDraw, uvTransformInto } from "../utils/uvTransform";

/** Scratch the frame reuses, so a draw allocates nothing per particle. */
const DRAWN = { scale: new Float32Array(3), color: new Float32Array(4) };
const UV_DRAWN = uvDraw();
const PLACE = new Matrix4();
const AT = new Vector3();
const TURN = new Quaternion();
const SPREAD = new Vector3();
const FACING = new Vector3();
const ASIDE = new Vector3();
const LIFT = new Vector3();
const ROLL = new Quaternion();
const FRAME = new Float32Array(FRAME_SLOTS);
const STANDING = new Float32Array(FRAME_SLOTS);
const STOOD = new Float32Array(FRAME_SLOTS);
const FRAME4 = new Matrix4();

/** The scale the spawn frame carries in its columns, which stands beside the turn. */
const FRAME_SCALE = new Float32Array(3);

/** Where one particle draws, in the engine's space, before the mirror. */
const PLACED = drawnPlace();

/** Scratch for one source's beam mesh placement. */
const BEAM_FROM: [number, number, number] = [0, 0, 0];
const BEAM_TO: [number, number, number] = [0, 0, 0];
const BEAM_AXIS = new Float32Array(3);
const BEAM_BASIS = new Float32Array(FRAME_SLOTS);
const BEAM_AT = new Vector3();
const BEAM_TURN = new Quaternion();

/** Squared beam length at or below which the engine skips a beam mesh. */
const BEAM_SHORTEST = 1e-9;

/** Where the lookup starts in an instance's row: the ramp's two floats, then the erosion drive. */
const LOOKUP = MESH_LAYOUT.lookup[0];

/** The rim, the reflection and the soft fade a mesh's shader compiles, and no ramp. */
const DRAWS: LayerDraws = { ramp: false, sheen: true, fade: true };

export interface MeshesProps {
  emitter: EmitterModel;
  /** Every system whose pool holds this emitter's particles. See `Quads`. */
  sources: readonly Source[];
  /** The emitter's own geometry, with the per-instance attributes the frame writes. */
  buffers: MeshBuffers;
  samplers: EmitterSamplers;
  /** Where the emitter falls in the system's draw order, from `drawRanks`. */
  rank: number;
  hidden: boolean;
}

/**
 * One emitter's particles, as instances of its mesh.
 *
 * A mesh takes a whole transform where a quad takes a centre and a size, so this builds
 * one matrix per particle rather than writing three arrays, and hands the fragment the
 * same two layer transforms a quad does. `AlignYawToCamera` and `AlignPitchToCamera`
 * turn that matrix toward the eye on the axis each names. A `VfxPrimitiveBeam` instance
 * ignores the particle's position and rotation and is stretched between the beam's ends
 * (see `stretchInto`).
 *
 * With the game's shaders on, the instances draw through each translated pass of the
 * emitter's custom material, or through the `mesh` or `distortion_mesh` pair, once they are
 * ready, and through the hand-written material until then.
 */
export function createMeshes({
  emitter,
  sources,
  buffers,
  samplers,
  rank,
  hidden,
}: MeshesProps) {
  const { memo, eachFrame, cleanup, finish } = drawLifetime();
  const { geometry, tint } = buffers;
  const beam = emitter.beam;
  const depth = memo(() => depthOf(geometry), [geometry]);
  const material = memo(() => {
    const material = meshMaterial(
      emitter.blendMode,
      samplers.base,
      emitter.depthBias,
      layersOf(emitter, samplers, DRAWS),
      fragmentTests(emitter),
      meshSide(emitter),
    );
    if (buffers.pose) {
      material.defines.PARTICLE_SKINNING = 1;
      material.uniforms.particleBones = { value: buffers.pose.texture };
    }
    return material;
  }, [emitter, samplers, buffers.pose]);

  const instanced = new InstancedMesh(geometry, material, MESHES_PER_EMITTER);
  const pair = { solid: instanced };
  cleanup(() => () => { buffers.pose?.texture.dispose(); geometry.dispose(); instanced.dispose(); });
  const drawn = !hidden && !emitter.disabled;

  let frameSlot: FrameSlot | undefined;
  eachFrame((state) => {
    const held = instanced;
    /* Claimed every frame rather than once, because a change of `args` hands the ref a
       fresh mesh carrying a matrix of its own that the geometry's would shadow. */
    held.instanceMatrix = buffers.instanceMatrix;

    if (!drawn) {
      held.count = 0;
      showPair(pair, false);
      return;
    }

    const scroll = material.uniforms.paletteScroll.value as number[];
    sourcesScrollInto(emitter, sources, scroll);
    const turns = [buffers.uvTurn, buffers.uvTurnMult];
    const rows = buffers.rows.array as Float32Array;
    const shifts = [buffers.uvShift, buffers.uvShiftMult];

    const stamp = renderStamp(state.gl);
    let instance = 0;
    for (const source of sources) {
      const pool = source.pool;
      frameSlot ??= frameOf(source, emitter) as FrameSlot;
      const frame = frameInto(source, emitter, frameSlot);
      const time = frame.now;
      const stretch = beam === null ? 0 : stretchInto(source, beam, depth);
      if (beam !== null && stretch === 0) continue;

      const bound = beam === null ? null : beamTint(source, beam);
      const buckets = bucketsOf(pool, stamp);
      const [first, last] = bucketRange(buckets, emitter.index);
      for (let listed = first; listed < last && instance < MESHES_PER_EMITTER; listed += 1) {
        const at = buckets.order[listed];
        appearance(pool, at, emitter, time, DRAWN);
        if (bound !== null) {
          for (let channel = 0; channel < 4; channel += 1) {
            DRAWN.color[channel] *= bound[channel] ?? 1;
          }
        }
        premultiplyInto(emitter, DRAWN.color);

        const age = time - pool.birthTime[at];
        buffers.pose?.write(instance, age);
        const through = age01(pool, at, time);

        const row = instance * MESH_STRIDE;
        colorLookupInto(emitter, pool, at, through, rows, row + LOOKUP);
        rows[row + LOOKUP + 2] = erosionDrive(pool, at, emitter, time);
        for (let layer = 0; layer < turns.length; layer += 1) {
          const over = layerOf(emitter, layer);
          if (over === null) continue;
          uvTransformInto(pool, at, over, layer, age, through, time, UV_DRAWN, false);
          turns[layer].setXYZ(instance, UV_DRAWN.turn, UV_DRAWN.scaleU, UV_DRAWN.scaleV);
          shifts[layer].setXYZW(
            instance,
            UV_DRAWN.offsetU,
            UV_DRAWN.offsetV,
            UV_DRAWN.cellU,
            UV_DRAWN.cellV,
          );
        }

        if (beam !== null) {
          SPREAD.set(DRAWN.scale[0], DRAWN.scale[1], stretch);
          held.setMatrixAt(instance, PLACE.compose(BEAM_AT, BEAM_TURN, SPREAD));
          tint.setXYZW(instance, DRAWN.color[0], DRAWN.color[1], DRAWN.color[2], DRAWN.color[3]);
          instance += 1;
          continue;
        }

        drawnPlaceInto(pool, at, frame, PLACED);
        AT.set(
          PLACED.place[0] * AXIS_SIGN[0],
          PLACED.place[1] * AXIS_SIGN[1],
          PLACED.place[2] * AXIS_SIGN[2],
        );
        const stood = face(pool, at, emitter, frame, state.camera, AT);
        /* The complex mesh path scales each axis by its own component, `isUniformScale`
         having already broadcast the first over the other two where it is set. The
         spawn frame's own scale rides beside it, because `compose` takes the turn
         unscaled. */
        SPREAD.set(DRAWN.scale[0] * stood[0], DRAWN.scale[1] * stood[1], DRAWN.scale[2] * stood[2]);

        held.setMatrixAt(instance, PLACE.compose(AT, TURN, SPREAD));
        tint.setXYZW(instance, DRAWN.color[0], DRAWN.color[1], DRAWN.color[2], DRAWN.color[3]);
        instance += 1;
      }
    }

    held.count = instance;
    showPair(pair, instance > 0);
    if (instance === 0) return;
    buffers.pose?.commit(instance);
    written(buffers.instanceMatrix, instance);
    rowsWritten(buffers.rows, instance);
  });

  return finish(pair, geometry, material, rank);
}

/**
 * The turn one particle's mesh takes, into `TURN`, returning the scale it stood on.
 *
 * A mesh stands on the particle's whole basis: its spin, `postRotateOrientationAxis`, its
 * orbit, the definition's `transform`, its travel where it is direction oriented, and the
 * frame it was born in. The camera alignment each flag asks for takes the particle's own
 * spin alone.
 *
 * The returned scale is what the basis carried in its columns, `scaleOverride` and the
 * transform's own, and ones under a camera alignment, which discards them.
 */
function face(
  pool: Pool,
  at: number,
  emitter: EmitterModel,
  frame: DrawFrame,
  camera: Camera,
  placed: Vector3,
): Float32Array {
  FRAME_SCALE.fill(1);

  const mesh = emitter.mesh;
  if (mesh !== null && (mesh.alignYaw || mesh.alignPitch) && aimed(placed, mesh, camera)) {
    /* The alignment composes over the particle's own turn, the flag that would discard it
       instead being identity for a particle whose orientation never changed. */
    turnOf(standingInto(pool.rotation, at * 3, 0, STANDING), ROLL);
    TURN.multiply(ROLL);
    return FRAME_SCALE;
  }

  /* The basis is built on the engine's own axes and mirrored whole, because a cross
     product changes sign under the mirror where a basis does not. */
  particleBasisInto(pool, at, emitter, frame, STOOD);
  mirrorInto(STOOD, 0, FRAME, 0);
  unscaleInto(FRAME, 0, FRAME, 0, FRAME_SCALE);
  TURN.setFromRotationMatrix(matrixOf(FRAME));
  return FRAME_SCALE;
}

/** One row-major 3x3 as the `Matrix4` a quaternion is read off, into the scratch. */
function matrixOf(basis: Float32Array): Matrix4 {
  return FRAME4.set(
    basis[0],
    basis[1],
    basis[2],
    0,
    basis[3],
    basis[4],
    basis[5],
    0,
    basis[6],
    basis[7],
    basis[8],
    0,
    0,
    0,
    0,
    1,
  );
}

/**
 * `D3DXMatrixLookAtLH` from the particle at the point each flag blends, into `TURN`.
 *
 * The eye is the particle, the up is the camera's, and the point aimed at takes its `x`
 * from the camera under `AlignYawToCamera`, its `y` under `AlignPitchToCamera` and its
 * `z` from the camera whatever either says. So yaw alone is a yaw and pitch alone is not
 * a pitch: it holds the particle's own `x` and aims across the world's `YZ`. False for a
 * degenerate aim, which leaves the particle on the turn it already has.
 */
function aimed(placed: Vector3, mesh: MeshModel, camera: Camera): boolean {
  const eye = camera.position;
  const { x, y, z } = placed;

  FACING.set((mesh.alignYaw ? eye.x : x) - x, (mesh.alignPitch ? eye.y : y) - y, eye.z - z);
  if (FACING.lengthSq() === 0) return false;

  ASIDE.crossVectors(camera.up, FACING.normalize());
  if (ASIDE.lengthSq() === 0) return false;

  LIFT.crossVectors(FACING, ASIDE.normalize());
  /* A simple mesh aims by the right-handed look-at, whose inverse is the skinned one's
     yawed half a turn about the camera's up: the forward and the right both flip and the
     up stands. So a `.scb` shows the camera its back where a `.skn` shows its front. */
  if (!mesh.skinned) {
    ASIDE.negate();
    FACING.negate();
  }
  TURN.setFromRotationMatrix(FRAME4.makeBasis(ASIDE, LIFT, FACING));
  return true;
}

/**
 * Writes the placement of a beam mesh for `source` into `BEAM_AT` and `BEAM_TURN`, and
 * returns its scale along local `+Z`.
 *
 * Matches the kind-6 branch of `VfxComplexEmitter_DrawParticles`. The mesh is centred on the
 * midpoint of the beam's ends, its local `+Z` points from the target to the source, and its
 * `+Z` scale is the beam length divided by the mesh's `+Z` extent `depth`. Returns zero if the
 * squared beam length is at most `BEAM_SHORTEST` or if `depth` is not positive.
 */
function stretchInto(source: Source, beam: BeamModel, depth: number): number {
  beamEndsInto(source, beam, BEAM_FROM, BEAM_TO);
  for (let axis = 0; axis < 3; axis += 1) BEAM_AXIS[axis] = BEAM_FROM[axis] - BEAM_TO[axis];

  const squared = BEAM_AXIS[0] ** 2 + BEAM_AXIS[1] ** 2 + BEAM_AXIS[2] ** 2;
  if (squared <= BEAM_SHORTEST || depth <= 0) return 0;

  BEAM_AT.set(
    ((BEAM_FROM[0] + BEAM_TO[0]) / 2) * AXIS_SIGN[0],
    ((BEAM_FROM[1] + BEAM_TO[1]) / 2) * AXIS_SIGN[1],
    ((BEAM_FROM[2] + BEAM_TO[2]) / 2) * AXIS_SIGN[2],
  );
  turnOf(beamInto(BEAM_AXIS, BEAM_BASIS), BEAM_TURN);
  return Math.sqrt(squared) / depth;
}

/** Returns the `+Z` extent of the bounding box of `geometry`. */
function depthOf(geometry: BufferGeometry): number {
  if (geometry.boundingBox === null) geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  return box === null ? 0 : box.max.z - box.min.z;
}

/** One engine-space basis as the viewport's own turn, into `out`. */
function turnOf(basis: Float32Array, out: Quaternion): void {
  mirrorInto(basis, 0, FRAME, 0);
  out.setFromRotationMatrix(matrixOf(FRAME));
}

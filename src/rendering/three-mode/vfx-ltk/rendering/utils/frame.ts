/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/utils/frame.ts
 * Bare Three.js frame/depth passes, 2026-10-26. See NOTICE.md and LICENSE.
 */
import {
  type Camera,
  DepthTexture,
  ExternalTexture,
  FramebufferTexture,
  HalfFloatType,
  LinearFilter,
  OrthographicCamera,
  PerspectiveCamera,
  RGBFormat,
  type Scene,
  type Texture,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

import type { EmitterModel } from "../../engine/model/model";

import { drawPhases } from "./drawKind";
import { RENDER_PHASE } from '../../engine/model/enums';

/** The layer everything but a particle draws on: the stage, the grid and the character. */
export const SCENE_LAYER = 0;

/** The layer an emitter warping the frame between the two colour phases draws on. */
export const DISTORTION_LAYER = 1;

/**
 * The layer an emitter drawing colour after the late distortion sits on, the engine's
 * post-distortion phase, which the scene's depth pass leaves out.
 */
export const PARTICLE_LAYER = 2;

/** The layer a pass's glow copy draws on, which only the glow pass sees. */
export const GLOW_LAYER = 3;

/**
 * The layer an emitter drawing colour before the late distortion sits on, the engine's
 * default and ground-layer phases.
 */
export const UNDER_LAYER = 4;

/** The layer an emitter warping the frame ahead of every particle draws on. */
export const EARLY_DISTORTION_LAYER = 5;
/** Optional board host passes: floor/grid, then ground particles, then characters. */
export const FLOOR_LAYER = 6, GROUND_LAYER = 7;

/** Let `camera` see every particle drawing colour, in either colour phase. */
export function seeParticles(camera: Camera): void {
  camera.layers.enable(PARTICLE_LAYER);
  camera.layers.enable(UNDER_LAYER);
  camera.layers.enable(GROUND_LAYER);
}

const OVER_LAYERS = [PARTICLE_LAYER] as const;
const UNDER_LAYERS = [UNDER_LAYER] as const;
const WARP_LAYERS = [
  [],
  [EARLY_DISTORTION_LAYER],
  [DISTORTION_LAYER],
  [EARLY_DISTORTION_LAYER, DISTORTION_LAYER],
] as const;

/** The layers the draws of `emitter` sit on, by the render phases it is in. */
export function drawLayersOf(emitter: EmitterModel): readonly number[] {
  const phases = drawPhases(emitter);
  if (phases.colour && (emitter.groundLayer || emitter.renderPhaseOverride === RENDER_PHASE.groundLayer)) return [GROUND_LAYER];
  if (phases.colour === "under") return UNDER_LAYERS;
  if (phases.colour === "over") return OVER_LAYERS;
  return WARP_LAYERS[Number(phases.warpsEarly) + 2 * Number(phases.warpsLate)];
}

/**
 * The frame as it was before anything warped it, which a distorting fragment samples.
 *
 * Every distortion material's uniform keeps this one object, and it points at the copy of
 * the renderer drawing at the moment. Each canvas keeps a copy of its size, so canvases of
 * different sizes reallocate nothing from frame to frame.
 */
export const FRAME = new ExternalTexture();

/** The drawing buffer's size in pixels, which turns a fragment's place into a coordinate. */
export const VIEWPORT = new Vector2(1, 1);

/**
 * The depth the scene leaves with no particle in it, which a soft fade measures its gap to.
 *
 * Points at the depth target of the renderer drawing at the moment, as `FRAME` does.
 */
export const SCENE_DEPTH = new ExternalTexture();

/** The camera's near and far planes, which turn a stored depth back into a distance. */
export const DEPTH_RANGE = new Vector2(1, 1);

/** The textures one renderer's passes write, sized to its drawing buffer. */
interface FrameTargets {
  frame: FramebufferTexture;
  /**
   * Rendered rather than copied out of the canvas, because a target is what hands a depth
   * buffer back as a texture. Its colour holds the glow, drawn over the depth, and half
   * floats keep a glow brighter than white.
   */
  depth: WebGLRenderTarget;
}

const TARGETS = new WeakMap<WebGLRenderer, FrameTargets>();
const SPARE_FRAME_COPIES = 4;
const SPARE_DEPTH_TARGETS = 4;
const spareFrameCopies = new Map<string, FramebufferTexture[]>();
const spareDepthTargets = new Map<string, WebGLRenderTarget[]>();

export const frameTargetPoolStats = { frameAlloc: 0, frameReuse: 0, depthAlloc: 0, depthReuse: 0 };

function sizeKey(width: number, height: number): string {
  return `${width}x${height}`;
}

function newFrameCopy(width: number, height: number): FramebufferTexture {
  frameTargetPoolStats.frameAlloc += 1;
  const frame = new FramebufferTexture(width, height);
  frame.minFilter = LinearFilter;
  frame.magFilter = LinearFilter;
  /* The drawing buffer `opaqueRenderer` asks for has no alpha channel, and a copy into a
     texture with one fails with INVALID_OPERATION on every frame. */
  frame.format = RGBFormat;
  frame.internalFormat = "RGB8";
  return frame;
}

function takeFrameCopy(width: number, height: number): FramebufferTexture {
  const held = spareFrameCopies.get(sizeKey(width, height))?.pop();
  if (held !== undefined) {
    frameTargetPoolStats.frameReuse += 1;
    return held;
  }
  return newFrameCopy(width, height);
}

function giveFrameCopy(frame: FramebufferTexture): void {
  const width = Math.max(1, frame.image.width);
  const height = Math.max(1, frame.image.height);
  const stack = spareFrameCopies.get(sizeKey(width, height)) ?? [];
  if (stack.length < SPARE_FRAME_COPIES) {
    stack.push(frame);
    spareFrameCopies.set(sizeKey(width, height), stack);
    return;
  }
  frame.dispose();
}

function newDepthTarget(gl: WebGLRenderer, width: number, height: number): WebGLRenderTarget {
  frameTargetPoolStats.depthAlloc += 1;
  const depth = new WebGLRenderTarget(width, height, {
    depthTexture: new DepthTexture(width, height),
    type: HalfFloatType,
  });
  /* The depth pass writes no colour. ThreeJS picks the tone mapping and the output colour
     space of a program by its target, and these two make the depth pass pick the screen's,
     so a material keeps one program rather than switching it twice a frame. */
  Object.assign(depth, { isXRRenderTarget: true });
  depth.texture.colorSpace = gl.outputColorSpace;
  return depth;
}

function takeDepthTarget(gl: WebGLRenderer, width: number, height: number): WebGLRenderTarget {
  const held = spareDepthTargets.get(sizeKey(width, height))?.pop();
  if (held !== undefined) {
    frameTargetPoolStats.depthReuse += 1;
    held.texture.colorSpace = gl.outputColorSpace;
    return held;
  }
  return newDepthTarget(gl, width, height);
}

function giveDepthTarget(depth: WebGLRenderTarget): void {
  const width = Math.max(1, depth.width);
  const height = Math.max(1, depth.height);
  const stack = spareDepthTargets.get(sizeKey(width, height)) ?? [];
  if (stack.length < SPARE_DEPTH_TARGETS) {
    stack.push(depth);
    spareDepthTargets.set(sizeKey(width, height), stack);
    return;
  }
  depth.dispose();
}

function ensureFrameCopy(targets: FrameTargets, width: number, height: number): void {
  if (targets.frame.image.width === width && targets.frame.image.height === height) return;
  giveFrameCopy(targets.frame);
  targets.frame = takeFrameCopy(width, height);
}

function ensureDepthTarget(gl: WebGLRenderer, targets: FrameTargets, width: number, height: number): void {
  if (targets.depth.width === width && targets.depth.height === height) return;
  giveDepthTarget(targets.depth);
  targets.depth = takeDepthTarget(gl, width, height);
}

function targetsOf(gl: WebGLRenderer): FrameTargets {
  let targets = TARGETS.get(gl);
  if (targets === undefined) {
    targets = { frame: takeFrameCopy(1, 1), depth: takeDepthTarget(gl, 1, 1) };
    TARGETS.set(gl, targets);
  }

  return targets;
}

export function flushFrameTargetPool(): void {
  for (const stack of spareFrameCopies.values()) for (const frame of stack) frame.dispose();
  for (const stack of spareDepthTargets.values()) for (const depth of stack) depth.dispose();
  spareFrameCopies.clear();
  spareDepthTargets.clear();
}

/**
 * The GL texture `gl` allocated for `texture`, and null before its first upload.
 *
 * three exposes no public handle to a target's depth texture, so the renderer's property
 * record is read.
 */
function glTextureOf(gl: WebGLRenderer, texture: Texture | null): WebGLTexture | null {
  if (texture === null || !gl.properties.has(texture)) return null;

  const record = gl.properties.get(texture) as { __webglTexture?: WebGLTexture };
  return record.__webglTexture ?? null;
}

/**
 * Point `FRAME` and `SCENE_DEPTH` at the textures `gl` last wrote, before `gl` draws.
 *
 * A texture of another canvas belongs to another GL context, which a draw cannot bind.
 */
export function bindFrameTargets(gl: WebGLRenderer): void {
  const targets = TARGETS.get(gl);
  FRAME.sourceTexture = targets === undefined ? null : glTextureOf(gl, targets.frame);
  SCENE_DEPTH.sourceTexture =
    targets === undefined ? null : glTextureOf(gl, targets.depth.depthTexture);
}

/** Return the frame and depth targets of `gl` to the size pool for the next pass. */
export function releaseFrame(gl: WebGLRenderer): void {
  const targets = TARGETS.get(gl);
  if (targets === undefined) return;

  TARGETS.delete(gl);
  giveFrameCopy(targets.frame);
  giveDepthTarget(targets.depth);

  FRAME.sourceTexture = null;
  SCENE_DEPTH.sourceTexture = null;
}

/** Take the frame as it is, which is what the distortion pass draws over. */
export function grabFrame(gl: WebGLRenderer): void {
  gl.getDrawingBufferSize(VIEWPORT);
  const width = Math.max(1, Math.round(VIEWPORT.x));
  const height = Math.max(1, Math.round(VIEWPORT.y));
  const targets = targetsOf(gl);
  ensureFrameCopy(targets, width, height);
  const { frame } = targets;

  /* three copies into whichever unit is active, and skips the bind when its cache already
     has the texture on unit 0, so the copy can land in another material's sampler. */
  gl.state.activeTexture(gl.getContext().TEXTURE0);
  gl.copyFramebufferToTexture(frame);
  FRAME.sourceTexture = glTextureOf(gl, frame);
}

/**
 * Draw the scene's layer into `SCENE_DEPTH`, which is what a soft fade reads.
 *
 * The camera is left on the scene's layer alone, and the caller sets the layers it draws next.
 */
export function grabDepth(gl: WebGLRenderer, scene: Scene, camera: Camera): void {
  gl.getDrawingBufferSize(VIEWPORT);
  const width = Math.max(1, Math.round(VIEWPORT.x));
  const height = Math.max(1, Math.round(VIEWPORT.y));
  const targets = targetsOf(gl);
  ensureDepthTarget(gl, targets, width, height);
  const { depth } = targets;
  if (camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera) {
    DEPTH_RANGE.set(camera.near / 0.44, camera.far / 0.44);
  }

  const background = scene.background;
  scene.background = null;
  camera.layers.set(SCENE_LAYER);
  /* Only the depth is read, so the pass writes no colour. The lock keeps every material's
     `colorWrite` from turning the writes back on. */
  const color = gl.state.buffers.color;
  color.setMask(false);
  color.setLocked(true);
  const previous = gl.getRenderTarget();
  try {
    gl.setRenderTarget(depth);
    gl.render(scene, camera);
  } finally {
    gl.setRenderTarget(previous);
    color.setLocked(false);
    color.setMask(true);
    scene.background = background;
  }
  SCENE_DEPTH.sourceTexture = glTextureOf(gl, depth.depthTexture);
}

import { Camera, Group } from 'three';
import { describe, expect, it } from 'vitest';
import {
  borrowQuadBuffers,
  drawBufferPoolStats,
  flushDrawBufferPool,
  releaseQuadBuffers,
  resetDrawBufferPoolStats,
} from '../src/rendering/three-mode/vfx-ltk/rendering/utils/drawBufferPool';
import {
  flushFrameTargetPool,
  frameTargetPoolStats,
  grabDepth,
  grabFrame,
  releaseFrame,
} from '../src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
import type { WebGLRenderer } from 'three';

describe('LTK draw buffer pool', () => {
  it('reuses quad buffers of the same capacity after release', () => {
    resetDrawBufferPoolStats();
    const first = borrowQuadBuffers(150);
    expect(drawBufferPoolStats.quadAlloc).toBe(1);
    releaseQuadBuffers(first, 150);
    const second = borrowQuadBuffers(150);
    expect(drawBufferPoolStats.quadAlloc).toBe(1);
    expect(drawBufferPoolStats.quadReuse).toBe(1);
    expect(second.geometry).toBe(first.geometry);
    releaseQuadBuffers(second, 150);
    flushDrawBufferPool();
  });

  it('allocates again after flush clears the spare stack', () => {
    resetDrawBufferPoolStats();
    const first = borrowQuadBuffers(150);
    releaseQuadBuffers(first, 150);
    flushDrawBufferPool();
    resetDrawBufferPoolStats();
    borrowQuadBuffers(150);
    expect(drawBufferPoolStats.quadAlloc).toBe(1);
    expect(drawBufferPoolStats.quadReuse).toBe(0);
    flushDrawBufferPool();
  });

  it('pools frame and depth targets by drawing-buffer size across grab and release', () => {
    const scene = new Group();
    const camera = new Camera();
    let size = { w: 320, h: 180 };
    const gl = {
      autoClear: true,
      outputColorSpace: 'srgb',
      state: { buffers: { color: { setMask() {}, setLocked() {} } }, activeTexture() {} },
      getContext: () => ({ TEXTURE0: 0 }),
      getDrawingBufferSize: (out: { x: number; y: number }) => { out.x = size.w; out.y = size.h; },
      getRenderTarget: () => null,
      setRenderTarget() {},
      render() {},
      properties: { has: () => false, get: () => ({}) },
      copyFramebufferToTexture() {},
    };
    frameTargetPoolStats.frameAlloc = 0;
    frameTargetPoolStats.frameReuse = 0;
    frameTargetPoolStats.depthAlloc = 0;
    frameTargetPoolStats.depthReuse = 0;
    grabFrame(gl as unknown as WebGLRenderer);
    grabDepth(gl as unknown as WebGLRenderer, scene as never, camera);
    const frameAlloc = frameTargetPoolStats.frameAlloc;
    const depthAlloc = frameTargetPoolStats.depthAlloc;
    releaseFrame(gl as unknown as WebGLRenderer);
    grabFrame(gl as unknown as WebGLRenderer);
    grabDepth(gl as unknown as WebGLRenderer, scene as never, camera);
    expect(frameTargetPoolStats.frameAlloc).toBe(frameAlloc);
    expect(frameTargetPoolStats.frameReuse).toBeGreaterThan(0);
    expect(frameTargetPoolStats.depthAlloc).toBe(depthAlloc);
    expect(frameTargetPoolStats.depthReuse).toBeGreaterThan(0);
    size = { w: 640, h: 360 };
    grabFrame(gl as unknown as WebGLRenderer);
    expect(frameTargetPoolStats.frameAlloc).toBe(frameAlloc + 1);
    releaseFrame(gl as unknown as WebGLRenderer);
    flushFrameTargetPool();
  });
});

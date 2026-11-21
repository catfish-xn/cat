import { describe, expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { sealCanvasAlpha } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
import { syntheticSystem, struct } from './vfx-ltk-synthetic';

/** A GL double that records the raw calls the seal makes, in order. */
function recordingGl(target: object | null = null, lost = false) {
  const calls: string[] = [];
  const context = {
    COLOR_BUFFER_BIT: 0x4000, COLOR_CLEAR_VALUE: 0x0c22,
    isContextLost: () => lost,
    getParameter: () => new Float32Array([0.1, 0.2, 0.3, 1]),
    colorMask: (...mask: boolean[]) => calls.push(`mask ${mask.join(',')}`),
    clearColor: (...rgba: number[]) => calls.push(`clearColor ${rgba.join(',')}`),
    clear: (bits: number) => calls.push(`clear ${bits}`),
  };
  const reset = vi.fn();
  const gl = { getRenderTarget: () => target, getContext: () => context, state: { buffers: { color: { reset } } } };
  return { gl: gl as unknown as WebGLRenderer, calls, reset };
}

describe('subtract on the board canvas', () => {
  it('fills the canvas alpha back to whole and leaves colour and the clear value as they were', () => {
    const { gl, calls, reset } = recordingGl();
    sealCanvasAlpha(gl);
    expect(calls).toEqual(['mask false,false,false,true', 'clearColor 0,0,0,1', 'clear 16384', 'mask true,true,true,true',
      `clearColor ${[0.1, 0.2, 0.3, 1].map(Math.fround).join(',')}`]);
    expect(reset).toHaveBeenCalledOnce();
  });
  it('leaves an offscreen target, a lost context and a GL-less host alone', () => {
    for (const { gl, calls, reset } of [recordingGl({}), recordingGl(null, true)]) {
      sealCanvasAlpha(gl); expect(calls).toEqual([]); expect(reset).not.toHaveBeenCalled();
    }
    expect(() => sealCanvasAlpha({ getRenderTarget: () => null } as unknown as WebGLRenderer)).not.toThrow();
  });
  it('drops an emitter that needs a skin keyword the base skin never supplies', () => {
    const keyword = (items: string[]) => struct('VfxEmitterFiltering', { keywordsRequired: { type: 'container', items: items.map(value => ({ type: 'string' as const, value })) } });
    const skinOnly = readVfxSystem(syntheticSystem({ Filtering: keyword(['Skin14']) })).emitters[0];
    expect(skinOnly).toMatchObject({ culled: 'keywords', disabled: true });
    const open = readVfxSystem(syntheticSystem({ Filtering: keyword([]) })).emitters[0];
    expect(open.culled).toBeNull(); expect(open.disabled).toBe(false);
  });
});

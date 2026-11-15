import { describe, expect, it } from 'vitest';
import { STENCIL_MODE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { NO_STENCIL, stencilState, stencilStates } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/stencil';

// 11-15 (Fable): an emitter that writes the stencil mask draws into the mask only, never its colour; one that only tests the
// mask, or draws with no stencil, keeps its colour. Engine-wide, no champion special case (chosen from Viktor's storm).
describe('vfx-ltk stencil writers draw no colour', () => {
  it('both writing modes write the mask and no colour; the testing modes and no stencil keep their colour', () => {
    for (const mode of [STENCIL_MODE.writeMask, STENCIL_MODE.writeMaskIfTestNotEqual] as const)
      expect(stencilState({ mode, ref: 4, id: null }, 4).colorWrite).toBe(false);
    for (const mode of [STENCIL_MODE.testEqual, STENCIL_MODE.testNotEqual] as const)
      expect(stencilState({ mode, ref: 4, id: null }, 4).colorWrite).toBe(true);
    expect(NO_STENCIL.colorWrite).toBe(true);
  });

  it('a muted writer draws nothing special: its state falls back to no stencil, colour on', () => {
    const states = stencilStates([
      { use: { mode: STENCIL_MODE.writeMask, ref: 4, id: null }, live: false },
      { use: { mode: STENCIL_MODE.testEqual, ref: 4, id: null }, live: true },
    ]);
    expect(states[0]).toBe(NO_STENCIL);
    expect(states[1]!.colorWrite).toBe(true);
  });
});

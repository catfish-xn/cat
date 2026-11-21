import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { DISABLED_EMITTERS, EMITTER_ALPHA } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

describe('vfx-ltk EMITTER_ALPHA', () => {
  it("draws Irelia's shield bubble at half alpha and leaves its ring glow out (fitted values, Fable 11-20)", () => {
    expect(EMITTER_ALPHA['67665513']).toEqual({ Add_Shield: 0.5, Swirl_Mesh: 0.5, Swirl_Mesh1: 0.5 });
    expect(DISABLED_EMITTERS['67665513']).toEqual(['Alpha_RingGlow']);
    for (const table of Object.values(EMITTER_ALPHA)) for (const factor of Object.values(table)) expect(factor > 0 && factor <= 1).toBe(true);
  });
  it('scales only the named emitter of the named system, alpha only', async () => {
    const index = { version: 1, systems: { '67665513': 'systems/a.json', other: 'systems/b.json' }, assets: { 'synthetic.tex': 'textures/a.png' }, skills: {} };
    const named = (name: string) => syntheticSystem({ emitterName: { type: 'string', value: name } });
    const library = createVfxLibrary('/r/', { readJson: async (url: string) => url.endsWith('index.json') ? index
      : named('Add_Shield'), readTexture: async () => new Texture() });
    const shield = (await library.load('67665513')).model.emitters[0], other = (await library.load('other')).model.emitters[0];
    expect(other.modulation).toEqual([1, 1, 1, 1]);
    expect(shield.modulation).toEqual([1, 1, 1, 0.5]);
    expect(shield.disabled).toBe(false);
  });
});

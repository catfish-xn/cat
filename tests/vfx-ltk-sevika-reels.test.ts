import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { integratedInto } from '../src/rendering/three-mode/vfx-ltk/engine/utils/sampleCurve';
import type { ValueCurve } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { DISABLED_EMITTERS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { syntheticSystem } from './vfx-ltk-synthetic';

const curve = (keys: [number, number][]): ValueCurve =>
  ({ constant: [0, keys[0][1]], keys: keys.map(([time, v]) => ({ time, values: [0, v] })), tables: [] }) as unknown as ValueCurve;
/** Where a reel comes to rest: the birth offset plus the scroll integrated over a 2.2 s life, as a tile fraction. */
const rest = (scroll: ValueCurve, birth: number) => {
  const out = new Float32Array(2); integratedInto(scroll, 1, 1, out, 0);
  const at = birth + out[1] * 2.2; return Math.abs(at - Math.round(at));
};

describe('Sevika slot reels (14.24 map22.bin Slots_*_Mirrored, particleUVScrollRate over a 2.2 s life)', () => {
  it('lands every reel on a whole icon, the right one with nothing before its first key at 0.1', () => {
    expect(rest(curve([[0, -20], [.18, -10], [.19, -2], [.21, 2], [.25, -2], [.26, 0]]), 1.1)).toBeLessThan(.05);
    expect(rest(curve([[0, -20], [.3, -10], [.31, -1], [.33, 2], [.38, -2], [.39, 0]]), 1)).toBeLessThan(.05);
    // Holding -20 before 0.1 would add 4.4 tiles and stop the right reel 0.4 of an icon off (the cut-in-half shield).
    expect(rest(curve([[.1, -20], [.4, -10], [.5, -10], [.55, 0]]), .625)).toBeLessThan(.05);
  });
  it('accrues nothing before the first key and holds the last rate after it', () => {
    const out = new Float32Array(2), late = curve([[.5, 4], [.75, 4]]);
    integratedInto(late, .49, 1, out, 0); expect(out[1]).toBeCloseTo(0, 5);
    integratedInto(late, 1, 1, out, 0); expect(out[1]).toBeCloseTo(2, 2);
  });
  it('switches off the machine each result layer carries, which the board plays once on its own', async () => {
    const layers = ['flamethrower', 'punch', 'thrash', 'jackpot'].map(r => sevikaSkills[`sevika-slots-${r}`][0].system);
    expect(Object.keys(DISABLED_EMITTERS).sort()).toEqual([...layers].sort());
    const index = { version: 1, systems: { [layers[3]]: 'systems/a.json', other: 'systems/b.json' }, assets: { 'synthetic.tex': 'textures/a.png' }, skills: {} };
    const library = createVfxLibrary('/r/', { readJson: async (url: string) => url.endsWith('index.json') ? index
      : syntheticSystem({ emitterName: { type: 'string', value: 'Alpha_Boarder' } }), readTexture: async () => new Texture() });
    expect((await library.load(layers[3])).model.emitters[0].disabled).toBe(true);
    expect((await library.load('other')).model.emitters[0].disabled).toBe(false);
  });
});

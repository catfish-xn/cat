import { describe, expect, it } from 'vitest';
import { drawnEmitters } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
import type { EmitterModel, SystemModel } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';

const emitter = (index: number, pass: number, extra: Partial<EmitterModel> = {}) =>
  ({ index, pass, groundLayer: false, simple: false, blendMode: 1, miscRenderFlags: 1, childSet: null, disabled: false, mesh: null, ...extra }) as unknown as EmitterModel;
const system = (emitters: EmitterModel[]) => ({ emitters }) as unknown as SystemModel;
const orders = (model: SystemModel) => drawnEmitters(model).map(each => each.rank);

describe('draw order across systems', () => {
  // 14.24 map22.bin, TFT13_Lieutenant_Base_Slots_Mirrored and its Punch child: reel backs at pass 30, white lock-in at 45,
  // border at 50; the icons, a system of their own, at 33 (alpha) and 34 (alpha-add).
  const frame = system([emitter(0, 30), emitter(1, 35), emitter(2, 30), emitter(3, 30), emitter(4, 100), emitter(5, 0), emitter(6, 50),
    emitter(7, 25), emitter(8, 20), emitter(9, 45), ...Array.from({ length: 23 }, (_, at) => emitter(10 + at, 8))]);
  const icons = system([emitter(0, 0), emitter(1, 33), emitter(2, 33), emitter(3, 33), emitter(4, 34, { blendMode: 4 })]);
  it('interleaves two systems by pass: icons over the reel backs, under the lock-in flash and border', () => {
    const f = orders(frame), i = orders(icons);
    for (const back of [0, 2, 3]) for (const icon of [1, 2, 3, 4]) expect(i[icon]).toBeGreaterThan(f[back]);
    for (const over of [9, 6, 4]) for (const icon of [1, 2, 3, 4]) expect(i[icon]).toBeLessThan(f[over]);
  });
  it('keeps the comparator order within one system', () => {
    const f = orders(frame), sorted = [...f].sort((a, b) => a - b);
    expect(new Set(f).size).toBe(f.length);
    // Ascending pass, then blend rank and index, exactly as before: the order of the ranks is the old order.
    expect(frame.emitters.map((_, at) => at).sort((a, b) => f[a] - f[b]).map(at => frame.emitters[at].pass)).toEqual([...frame.emitters].map(e => e.pass).sort((a, b) => a - b));
    expect(sorted[0]).toBeGreaterThanOrEqual(0);
  });
  it('keeps a ground-layer emitter under everything else', () => {
    const ground = orders(system([emitter(0, 100, { groundLayer: true }), emitter(1, -5)]));
    expect(ground[0]).toBeLessThan(ground[1]);
  });
});

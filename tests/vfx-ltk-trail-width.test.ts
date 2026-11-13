import { describe, expect, it } from 'vitest';
import { ribbonBuffers, strand, writeTrail, type TrailBuild } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/ribbon';
import { plainUvLayer } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';
import { TRAIL_SMOOTHING } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';

// A straight strand along z, every point's width 5 and its side along x at `length` (the particle frame's scale).
function ribs(view: TrailBuild['view'], length: number): number[] {
  const held = strand(8), points = 4;
  (held as { count: number }).count = points;
  for (let at = 0; at < points; at += 1) {
    held.position.set([0, 0, at * 10], at * 3);
    held.width[at] = 5;
    held.side.set([length, 0, 0], at * 3);
    held.color.set([1, 1, 1, 1], at * 4);
    held.tiling.set([0, 0], at * 2);
  }
  const build: TrailBuild = { view, wake: false, smoothing: TRAIL_SMOOTHING.off, reach: 0, cutoff: 0,
    layers: { base: plainUvLayer(), mult: null } } as unknown as TrailBuild;
  const { arrays } = ribbonBuffers(points * 2) as unknown as { arrays: { position: Float32Array } };
  const cursor = { vertex: 0, index: 0 };
  writeTrail(held, build, arrays as never, cursor as never);
  const out: number[] = [];
  for (let rib = 0; rib < cursor.vertex / 2; rib += 1) {
    const a = arrays.position.subarray(rib * 6, rib * 6 + 3), b = arrays.position.subarray(rib * 6 + 3, rib * 6 + 6);
    out.push(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!));
  }
  return out;
}

describe('vfx-ltk trail width (ribbon.ts writeTrail)', () => {
  it('an arbitrary trail is as wide as its own scale on both sides, whatever the system transform scales its frame by', () => {
    // A system transform that scales the particle's frame gives the side that length (made-up scales here).
    for (const length of [1, 1.5, 2, 0.3]) {
      const widths = ribs(null, length);
      expect(widths).toHaveLength(4);
      for (const width of widths) expect(width).toBeCloseTo(10, 6);
    }
  });

  it('a side of nothing still draws nothing', () => {
    for (const width of ribs(null, 0)) expect(width).toBe(0);
  });

  it('a camera-facing trail was never scaled by it either', () => {
    for (const width of ribs([0, 1, 0], 2)) expect(width).toBeCloseTo(10, 6);
  });
});

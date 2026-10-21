import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline Node module.
import { benchFromGroundQuads, benchFromUvTiles, benchWorld, glbEvidence, groundTriangles, measureBenchSeams, validateBench } from '../scripts/assets3d/boards-bench.mjs';
// @ts-expect-error Offline Node module.
import { carouselRangeGlb } from '../scripts/assets3d/carousel-geometry.mjs';
// @ts-expect-error Offline Node module.
import { readGlb, writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Offline Node module.
import { encodePng } from '../scripts/assets3d/texture.mjs';

const alignment = { scale: [2, 2, -3], offset: [200, 0, 100], sourceSteps: [10, 10] };
const home = [-5, 0, 20];
const tiles = Array.from({ length: 9 }, (_, i) => ({ min: [i / 9, 0], max: [(i + 1) / 9, 1] }));
const point = (x: number, z: number) => ({ p: [-x, 2, z], uv: [x / 90, (z - 15) / 10] });
const triangles = Array.from({ length: 9 }, (_, i) => {
  const a = point(i * 10, 15), b = point((i + 1) * 10, 15);
  const c = point((i + 1) * 10, 25), d = point(i * 10, 25);
  return [{ i: i * 6, vs: [a, b, c] }, { i: i * 6 + 3, vs: [a, c, d] }];
}).flat();
const expected = Array.from({ length: 9 }, (_, i) => [-85 + i * 10, 2, 20]);

describe('bench geometry evidence (synthetic only)', () => {
  it('inverts nine seam-bounded UV cells and preserves baked reflection, player order and ground height', () => {
    // UV increases toward decreasing GLB X; output must reverse this ordering.
    const result = benchFromUvTiles(triangles, tiles, alignment, home);
    result.bench.forEach((p: number[], i: number) => p.forEach((v, k) => expect(v).toBeCloseTo(expected[i][k], 8)));
    expect(benchWorld(result.bench[0], alignment)).toEqual([30, 4, 40]);
    expect(benchWorld(result.bench[8], alignment)).toEqual([190, 4, 40]);
    expect(result.checks.maxLineDeviation).toBeCloseTo(0, 8);
    expect(result.checks.maxSpacingDeviationRatio).toBeCloseTo(0, 8);
    expect(result.checks.nearestAnchorIndex).toBe(8);
    expect(result.checks.midpointCloseToHome).toBe(false);
    expect(result.checks.midpointMinusHome).toEqual([-40, 2, 0]);
    expect(result.checks.gapOverSourceColumnStep).toBeCloseTo(1);
    // Duplicate hits on a shared diagonal are allowed when XYZ agrees.
    expect(result.cells[0].hits).toHaveLength(2);
  });

  it('takes each authored quad bbox centre, requiring nine complete ground faces', () => {
    expect(benchFromGroundQuads(triangles, alignment, home).bench).toEqual(expected);
    expect(() => benchFromGroundQuads(triangles.slice(1), alignment, home)).toThrow('bench-needs-nine-xyz');
    // A lone triangle's bbox is insufficient evidence of a rectangular tile.
    expect(() => benchFromGroundQuads(triangles.filter((_, i) => i % 2 === 0), alignment, home)).toThrow('bench-needs-nine-xyz');
  });

  it('rejects ABC + ABD overlapping halves despite four corners and equal total area', () => {
    const [a, b, c] = triangles[0].vs, d = triangles[1].vs[2];
    const overlapping = [{ i: 0, vs: [a, b, c] }, { i: 3, vs: [a, b, d] }, ...triangles.slice(2)];
    expect(() => benchFromGroundQuads(overlapping, alignment, home)).toThrow('bench-needs-nine-xyz');
    // The other diagonal, reversed winding and arbitrary triangle order remain valid.
    const alternate = [{ i: 3, vs: [d, c, b] }, { i: 0, vs: [d, b, a] }, ...triangles.slice(2)];
    expect(benchFromGroundQuads(alternate, alignment, home).bench).toEqual(expected);
  });

  it('checks area even when near-corner vertices share a diagonal and lie on opposite sides', () => {
    const incomplete = triangles.map(t => ({ ...t, vs: t.vs.map(v => ({ ...v, p: [...v.p] })) }));
    incomplete[1].vs[2].p[2] -= .004;
    expect(() => benchFromGroundQuads(incomplete, alignment, home)).toThrow('bench-needs-nine-xyz');
  });

  it('cross-checks a nonzero source range against actual GLB offsets, excluding surrounding faces', () => {
    const vertices = triangles.flatMap(t => t.vs.map(v => ({ ...v, p: [-v.p[0], v.p[1], v.p[2]] })));
    const ids = vertices.map((_, i) => i);
    const range = { start: 6, count: ids.length, material: 'synthetic-bench' };
    const mesh = { vertices, indices: [...ids.slice(0, 6), ...ids, ...ids.slice(0, 6)], ranges: [range],
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
    const png = encodePng({ width: 1, height: 1, rgba: Buffer.alloc(4, 255) });
    const converted = carouselRangeGlb(mesh, range, png, { origin: [0, 0, 0] });
    const { document, binary } = readGlb(converted.glb);
    document.nodes[0].name = 'synthetic';
    const glb = glbEvidence(writeGlb(document, binary), 'synthetic');
    const source = groundTriangles(mesh, home, alignment.sourceSteps);
    expect(source.map((t: { i: number }) => t.i)).toEqual(triangles.map(t => t.i));
    const sourceResult = benchFromGroundQuads(source, alignment, home);
    const used = new Set(sourceResult.cells.flatMap((c: { hits: { triangle: number }[] }) => c.hits.map(h => h.triangle)));
    const glbResult = benchFromGroundQuads(glb.triangles.filter((t: { i: number }) => used.has(t.i)), alignment, home);
    expect(sourceResult.bench).toEqual(expected);
    expect(glbResult.bench).toEqual(sourceResult.bench);
    expect(glbResult.cells.map((c: { hits: { triangle: number }[] }) => c.hits.map(h => h.triangle)))
      .toEqual(sourceResult.cells.map((c: { hits: { triangle: number }[] }) => c.hits.map(h => h.triangle)));
  });

  it('rejects missing, ambiguous or out-of-surface UV evidence', () => {
    expect(() => benchFromUvTiles(triangles, tiles.slice(1), alignment, home)).toThrow('bench-needs-nine-tiles');
    expect(() => benchFromUvTiles(triangles, [...tiles.slice(1), { min: [2, 0], max: [3, 1] }], alignment, home)).toThrow('bench-uv-outside-ground');
    const raised = triangles.map(t => ({ ...t, vs: t.vs.map(v => ({ ...v, p: [v.p[0], 3, v.p[2]] })) }));
    expect(() => benchFromUvTiles([...triangles, ...raised], tiles, alignment, home)).toThrow('bench-uv-ambiguous-ground');
  });

  it('falsifies incorrect count, order, collinearity, equal pitch, coordinates and anchor selection', () => {
    expect(() => validateBench(expected.slice(1), alignment, home)).toThrow('bench-needs-nine-xyz');
    expect(() => validateBench([...expected].reverse(), alignment, home)).toThrow('bench-player-order');
    const irregular = expected.map(p => [...p]); irregular[4][0] += 4;
    expect(() => validateBench(irregular, alignment, home)).toThrow('bench-unequal-spacing');
    const bent = expected.map(p => [...p]); bent[4][2] += 1;
    expect(() => validateBench(bent, alignment, home)).toThrow('bench-not-collinear');
    const nonfinite = expected.map(p => [...p]); nonfinite[0][1] = NaN;
    expect(() => validateBench(nonfinite, alignment, home)).toThrow('bench-needs-nine-xyz');
    expect(() => validateBench(expected, alignment, [-5, 0, 200])).toThrow('bench-away-from-home');
    expect(() => validateBench(expected, { ...alignment, scale: [0, 1, 1] }, home)).toThrow('invalid-bench-frame');
  });

  it.each([0, 1])('measures actual seam troughs along texture axis %i without inventing missing seams', async axis => {
    const width = axis === 0 ? 100 : 20, height = axis === 0 ? 20 : 100;
    const seams = Array.from({ length: 8 }, (_, i) => 15 + i * 10);
    const rgba = Buffer.alloc(width * height * 4, 255);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const shade = seams.some(s => Math.abs((axis === 0 ? x : y) - s) <= 1) ? 0 : 160;
      for (let k = 0; k < 3; k++) rgba[(y * width + x) * 4 + k] = shade;
    }
    const png = encodePng({ width, height, rgba });
    const island = { axis, band: [4, 16], windows: seams.map(s => [s - 2, s + 2]), ends: [5, 95], crossBounds: [3, 17], polarity: 'dark' };
    const result = await measureBenchSeams(png, [island]);
    expect(result.tiles).toHaveLength(9);
    expect(result.measurements[0].seams).toEqual([5, ...seams, 95]);
    expect(result.measurements[0].samples.every((s: {luminance: number}) => s.luminance === 0)).toBe(true);
    await expect(measureBenchSeams(png, [{ ...island, windows: [[0, 10]] }])).rejects.toThrow('invalid-bench-seam-window');
    const incomplete = await measureBenchSeams(png, [{ ...island, windows: island.windows.slice(1) }]);
    expect(() => benchFromUvTiles(triangles, incomplete.tiles, alignment, home)).toThrow('bench-needs-nine-tiles');
    await expect(measureBenchSeams(encodePng({ width, height, rgba: Buffer.alloc(width * height * 4, 255) }), [island]))
      .rejects.toThrow('bench-seam-no-contrast');
  });
});

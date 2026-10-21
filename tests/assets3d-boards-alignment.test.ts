import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
// @ts-expect-error Offline Node module.
import { boardGroundSpan, alignBoardGroundZ, alignBoardGroundXZ } from '../scripts/assets3d/boards-alignment.mjs';
// @ts-expect-error Offline Node module.
import { boardAlignment } from '../scripts/assets3d/boards-build.mjs';
import { arenaTransform } from '../src/rendering/three-mode/board-arena';
import { hexCenter } from '../src/rendering3d/picking';

// Entirely synthetic: transformed ground, four walls, and unrelated scenery.
function geometry() {
  const matrix = [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 17, 4, 8, 1];
  const mesh = (material: string, points: number[][]) => ({
    vertices: points.map(p => ({ p })), indices: points.map((_, i) => i), matrix,
    ranges: [{ material, start: 0, count: points.length }],
  });
  return { meshes: [
    mesh('synthetic/BattleField_A_MAT', [
      [-20, 0, -30], [20, 0, -30], [20, 0, 30], [-20, 0, -30], [20, 0, 30], [-20, 0, 30],
    ]),
    mesh('synthetic/Bench_A_MAT', [-24, 26].flatMap(z => [
      [-20, -5, z], [20, -5, z], [20, 5, z], [-20, -5, z], [20, 5, z], [-20, 5, z],
    ])),
    mesh('synthetic/scenery', [[-1000, 0, -1000], [1000, 0, -1000], [0, 0, 1000]]),
    // Slanted side walls: their bounds are not the centre-ray intersections.
    mesh('synthetic/Bench_A_MAT', [-16, 18].flatMap(x => [
      [x - 2.5, -5, -25], [x + 2.5, -5, 25], [x + 2.5, 5, 25],
      [x - 2.5, -5, -25], [x + 2.5, 5, 25], [x - 2.5, 5, -25],
    ])),
  ] };
}

const center = [17, 4, 8];
const legacy = () => boardAlignment([4, 4, -7], center, { radius: 6, origin: { x: 80, y: -20 } });

describe('board ground row alignment (synthetic only)', () => {
  it('measures transformed ground/wall triangles rather than decorative bounds', () => {
    const span = boardGroundSpan(geometry(), center);
    expect(span.floor).toEqual([-82, 98]);
    expect(span.min).toBeCloseTo(-64);
    expect(span.max).toBeCloseTo(86);
    const side = boardGroundSpan(geometry(), center, 'x');
    expect(side.floor).toEqual([-23, 57]);
    expect(side.min).toBeCloseTo(-15);
    expect(side.max).toBeCloseTo(53);
  });

  it.each([
    { hexRadius: 6, origin: { x: 80, y: -20 } },
    { hexRadius: 15, origin: { x: -100, y: 110 } },
  ])('fits all 56 centres and the full staggered envelope to four walls on %o', frame => {
    const g = geometry(), old = legacy();
    const spans = { x: boardGroundSpan(g, center, 'x'), z: boardGroundSpan(g, center) };
    const a = alignBoardGroundXZ(old, spans), t = arenaTransform(a, frame);
    // Independent fixture facts: X walls [-15,53], Z walls [-64,86].
    // 7.5 widths across X; 12.5 radii across Z. Wall midpoints differ from locator.
    const width = 68 / 7.5, sourceRadius = 12;
    expect(a.sourceSteps).toEqual([width, 18]);
    expect(a.sourceLocator).toEqual(old.sourceFirstCell);
    expect(a.scale[1]).toBe(old.scale[1]);
    expect(a.offset[1]).toBe(old.offset[1]);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const x = -15 + width / 2 + width * (col + (row % 2) / 2);
      const p = new Vector3(-x, 4, -52 + row * 18).multiply(t.scale).add(t.position);
      const cell = hexCenter({ col: 6 - col, row: 7 - row },
        { rows: 8, columns: 7, radius: frame.hexRadius, origin: frame.origin });
      expect(p.x).toBeCloseTo(cell.x);
      expect(p.z).toBeCloseTo(cell.z);
      expect(p.y).toBeCloseTo(0);
    }
    const runtimeWidth = Math.sqrt(3) * frame.hexRadius;
    const leftWall = t.position.x - spans.x.max * t.scale.x;
    const rightWall = t.position.x - spans.x.min * t.scale.x;
    expect(frame.origin.x - leftWall).toBeCloseTo(runtimeWidth / 2);
    expect(rightWall - (frame.origin.x + runtimeWidth * 6.5)).toBeCloseTo(runtimeWidth / 2);
    expect(rightWall - leftWall).toBeCloseTo(runtimeWidth * 7.5);
    expect(t.position.z + spans.z.min * t.scale.z - (frame.origin.y + 10.5 * frame.hexRadius)).toBeCloseTo(frame.hexRadius);
    expect(frame.origin.y - (t.position.z + spans.z.max * t.scale.z)).toBeCloseTo(frame.hexRadius);
    expect(a.sourceFirstCell[0] - spans.x.min).toBeCloseTo(width / 2);
    expect(a.sourceFirstCell[2] - spans.z.min).toBeCloseTo(sourceRadius);
    expect(a.deformation.scaleRatios.x).toBeCloseTo(a.scale[0] / old.scale[0]);
    expect(a.deformation.scaleRatios.z).toBeCloseTo(a.scale[2] / old.scale[2]);
    expect(a.deformation.xOverZ).toBeCloseTo(a.scale[0] / Math.abs(a.scale[2]));
    expect(a.sourceGroundX.policy).toContain('not recovered native cell centres');
  });

  it.each([
    { hexRadius: 6, origin: { x: 80, y: -20 } },
    { hexRadius: 15, origin: { x: -100, y: 110 } },
  ])('places all rows and leaves exactly one hex radius inside both walls on %o', frame => {
    const span = boardGroundSpan(geometry(), center), old = legacy();
    const alignment = alignBoardGroundZ(old, span);
    const t = arenaTransform(alignment, frame);
    const sourceRadius = 12; // 150-unit wall span / 12.5 radii
    expect(alignment.sourceSteps[1]).toBeCloseTo(18);
    expect(alignment.scale.slice(0, 2)).toEqual(old.scale.slice(0, 2));
    expect(alignment.offset.slice(0, 2)).toEqual(old.offset.slice(0, 2));
    // These source centres are independently specified by the synthetic fixture.
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const sourceX = old.sourceFirstCell[0] + old.sourceSteps[0] * (col + (row % 2) / 2);
      const p = new Vector3(-sourceX, 4, -52 + row * 18).multiply(t.scale).add(t.position);
      const cell = hexCenter({ col: 6 - col, row: 7 - row },
        { rows: 8, columns: 7, radius: frame.hexRadius, origin: frame.origin });
      expect(p.x).toBeCloseTo(cell.x);
      expect(p.z).toBeCloseTo(cell.z);
      expect(p.y).toBeCloseTo(0);
    }
    const nearWall = t.position.z + span.min * t.scale.z;
    const farWall = t.position.z + span.max * t.scale.z;
    const lastRow = frame.origin.y + 7 * 1.5 * frame.hexRadius;
    expect(nearWall - lastRow).toBeCloseTo(frame.hexRadius);
    expect(frame.origin.y - farWall).toBeCloseTo(frame.hexRadius);
    // Old locator interpolation passes its own cell-mapping test but misses this boundary.
    const previous = arenaTransform(old, frame);
    expect(previous.position.z + span.min * previous.scale.z - lastRow).toBeGreaterThan(frame.hexRadius);
    expect(alignment.sourceFirstCell[2] - span.min).toBeCloseTo(sourceRadius);
    expect(alignment.sourceGround.policy).toContain('not recovered native cell centres');
  });

  it('ignores unused vertices and out-of-range wall faces', () => {
    const g = geometry();
    g.meshes[0].vertices.push({ p: [0, 0, -100000] });
    g.meshes[1].vertices.push(...Array.from({ length: 3 }, () => ({ p: [0, 0, -100000] })));
    expect(boardGroundSpan(g, center).min).toBeCloseTo(-64);
    g.meshes[3].vertices.push({ p: [-100000, 0, 0] });
    expect(boardGroundSpan(g, center, 'x').min).toBeCloseTo(-15);
  });

  it('requires both side walls and a ground section; front/back walls do not substitute', () => {
    const g = geometry(), spans = { x: boardGroundSpan(g, center, 'x'), z: boardGroundSpan(g, center) };
    expect(() => boardGroundSpan({ meshes: g.meshes.slice(1) }, center, 'x')).toThrow('missing-board-ground-x-section');
    expect(() => boardGroundSpan({ meshes: g.meshes.slice(0, 3) }, center, 'x')).toThrow('missing-board-ground-x-walls');
    g.meshes[3].ranges[0].count = 6; // Only one side remains.
    expect(() => boardGroundSpan(g, center, 'x')).toThrow('missing-board-ground-x-walls');
    expect(() => boardGroundSpan(g, [17, 4, 10000], 'x')).toThrow('missing-board-ground-x-section');
    // A mislabeled decorative rock must not replace missing wall evidence.
    g.meshes[3].ranges[0].material = 'synthetic/Rocks_A_MAT';
    expect(() => boardGroundSpan(g, center, 'x')).toThrow('missing-board-ground-x-walls');
    for (const x of [undefined, { min: 5, max: 5 }, { min: 6, max: 5 }, { min: NaN, max: 5 }])
      expect(() => alignBoardGroundXZ(legacy(), { ...spans, x })).toThrow('invalid-board-ground-x-span');
    expect(() => alignBoardGroundXZ(legacy(), spans, 1)).toThrow('invalid-board-ground-x-span');
  });

  it('rejects unavailable source evidence instead of silently using an arena bbox', () => {
    const g = geometry();
    expect(() => boardGroundSpan({ meshes: g.meshes.slice(1) }, center)).toThrow('missing-board-ground-section');
    expect(() => boardGroundSpan({ meshes: [g.meshes[0]] }, center)).toThrow('missing-board-ground-walls');
    expect(() => boardGroundSpan(g, [10000, 4, 8])).toThrow('missing-board-ground-section');
    for (const span of [{ min: 5, max: 5 }, { min: 6, max: 5 }, { min: NaN, max: 5 }])
      expect(() => alignBoardGroundZ(legacy(), span)).toThrow('invalid-board-ground-span');
  });
});

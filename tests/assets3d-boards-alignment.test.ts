import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
// @ts-expect-error Offline Node module.
import { boardGroundSpan, alignBoardGroundZ } from '../scripts/assets3d/boards-alignment.mjs';
// @ts-expect-error Offline Node module.
import { boardAlignment } from '../scripts/assets3d/boards-build.mjs';
import { arenaTransform } from '../src/rendering/three-mode/board-arena';
import { hexCenter } from '../src/rendering3d/picking';

// Entirely synthetic: transformed ground, two walls, and unrelated scenery.
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

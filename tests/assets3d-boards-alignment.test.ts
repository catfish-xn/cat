import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Vector3 } from 'three';
// @ts-expect-error Offline Node module.
import { boardAlignment } from '../scripts/assets3d/boards-build.mjs';
// @ts-expect-error Offline Node module.
import { alignmentScaleFromWalkable } from '../scripts/assets3d/boards-ground-measure.mjs';
import { arenaTransform } from '../src/rendering/three-mode/board-arena';
import { hexCenter } from '../src/rendering3d/picking';

/** Synthetic locators: x/z steps differ and x step ≠ z step × √3/1.5. */
const first: [number, number, number] = [0, 4, 0];
const center: [number, number, number] = [13, 4, 17.5];
const target = { radius: 6, origin: { x: 80, y: -20 } };

describe('board locator alignment (synthetic only)', () => {
  it('derives independent x/z scale from BoardLocator and BoardCenterLocator', () => {
    const a = boardAlignment(first, center, target);
    const stepX = (center[0] - first[0]) / 3.25;
    const stepZ = (center[2] - first[2]) / 3.5;
    expect(stepX).toBeCloseTo(4);
    expect(stepZ).toBeCloseTo(5);
    expect(stepX).not.toBeCloseTo(stepZ * (Math.sqrt(3) / 1.5));
    expect(a.status).toBe('locator-aligned');
    expect(a.scale[0]).toBeCloseTo((Math.sqrt(3) * target.radius) / stepX);
    expect(a.scale[1]).toBe(a.scale[0]);
    expect(a.scale[2]).toBeCloseTo(-(1.5 * target.radius) / stepZ);
    expect(a.sourceSteps).toEqual([stepX, stepZ]);
    expect(a).not.toHaveProperty('sourceGround');
    expect(a).not.toHaveProperty('sourceGroundX');
  });

  it.each([
    { hexRadius: 6, origin: { x: 80, y: -20 } },
    { hexRadius: 15, origin: { x: -100, y: 110 } },
  ])('maps all 56 source cell centres through arenaTransform onto hexCenter on %o', frame => {
    const a = boardAlignment(first, center, target);
    const [stepX, stepZ] = a.sourceSteps;
    const t = arenaTransform(a, frame);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const sourceX = first[0] + stepX * (col + (row % 2) / 2);
      const sourceZ = first[2] + stepZ * row;
      const p = new Vector3(-sourceX, first[1], sourceZ).multiply(t.scale).add(t.position);
      const cell = hexCenter({ col: 6 - col, row: 7 - row },
        { rows: 8, columns: 7, radius: frame.hexRadius, origin: frame.origin });
      expect(p.x).toBeCloseTo(cell.x);
      expect(p.z).toBeCloseTo(cell.z);
      expect(p.y).toBeCloseTo(0);
    }
  });

  it('rejects invalid locator geometry', () => {
    expect(() => boardAlignment([0, 0, 0], [0, 0, 0], target)).toThrow('invalid-board-locators');
    expect(() => boardAlignment([5, 0, 0], [3, 0, 0], target)).toThrow('invalid-board-locators');
    expect(() => boardAlignment([0, 0, 0], [0, 0, -1], target)).toThrow('invalid-board-locators');
  });

  it('applies optional per-board alignmentScale uniformly to locator-aligned axes', () => {
    const base = boardAlignment(first, center, target);
    const scaled = boardAlignment(first, center, target, { alignmentScale: 1.25, alignmentEvidence: { method: 'synthetic' } });
    expect(scaled.alignmentScale).toBe(1.25);
    expect(scaled.scale[0]).toBeCloseTo(base.scale[0] * 1.25);
    expect(scaled.scale[2]).toBeCloseTo(base.scale[2] * 1.25);
    expect(scaled.sourceSteps).toEqual(base.sourceSteps);
    expect(scaled.status).toBe('locator-aligned');
  });

  it('defaults alignmentScale manifest field to literal default when omitted', () => {
    const a = boardAlignment(first, center, target);
    expect(a.alignmentScale).toBe('default');
  });

  it('rejects non-positive alignmentScale', () => {
    expect(() => boardAlignment(first, center, target, { alignmentScale: 0 })).toThrow('invalid-board-alignment-scale');
  });

  it('alignmentScaleFromWalkable sets f so implied cells times f matches target', () => {
    const implied = 9.07;
    const targetCells = 7.2;
    const f = alignmentScaleFromWalkable({ impliedWalkableCellsAtLocatorScale: implied }, targetCells);
    expect(f).toBeCloseTo(targetCells / implied);
    expect(Math.abs(implied * f - targetCells)).toBeLessThan(0.05);
  });

  it('does not reintroduce ground-span fitting in boards-build', async () => {
    const source = await readFile(resolve('scripts/assets3d/boards-build.mjs'), 'utf8');
    expect(source).not.toMatch(/alignBoardGround/);
    expect(source).not.toMatch(/boardGroundSpan/);
    expect(source).not.toMatch(/boards-alignment\.mjs/);
    expect(source).not.toMatch(/legacy estimate/i);
    expect(source).not.toMatch(/measured ground evidence/);
    const summary = await readFile(resolve('scripts/assets3d/boards-summary.mjs'), 'utf8');
    expect(summary).toMatch(/deformation:scene\.alignment\.deformation\?\?null/);
    expect(summary).not.toMatch(/full hex envelopes/);
    expect(summary).not.toMatch(/ground\/wall sections/);
  });
});

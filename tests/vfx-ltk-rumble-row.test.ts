import { describe, expect, it } from 'vitest';
import { hexCenter } from '../src/rendering3d/picking';
import { cellAt, rowStrikeCells, RUMBLE_STRIKES } from '../src/rendering/three-mode/vfx-ltk/rumble-row';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, RUMBLE_MISSILE } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { G2_ABILITY_DATA } from '../src/simulation/content/g2-abilities';

const grid = { rows: 8, columns: 7, radius: 34, origin: { x: 100, y: 80 } };

describe('Rumble row strikes', () => {
  it('maps a cell centre back to its cell on even and odd rows', () => {
    for (const cell of [{ col: 0, row: 0 }, { col: 3, row: 3 }, { col: 6, row: 7 }, { col: 2, row: 4 }]) {
      const at = hexCenter(cell, grid);
      expect(cellAt(at.x, at.z, grid)).toEqual(cell);
      expect(cellAt(at.x + 10, at.z - 8, grid)).toEqual(cell);
    }
  });
  it('one explosion per damage packet at its cell, then the nearest unstruck cells of the primary target\'s row, five in all', () => {
    expect(RUMBLE_STRIKES).toBe(G2_ABILITY_DATA['rumble-ability']!.variables.NumMissile![0]);
    const row = 3;
    // Three struck side by side, one packet each: two more cells next to the primary target.
    expect(rowStrikeCells([{ col: 2, row }, { col: 3, row }, { col: 4, row }], { col: 2, row }, 7))
      .toEqual([{ col: 2, row }, { col: 3, row }, { col: 4, row }, { col: 1, row }, { col: 0, row }]);
    // A lone enemy takes every missile (his ability text): five packets, five explosions on its cell, none elsewhere.
    const lone = Array.from({ length: 5 }, () => ({ col: 6, row }));
    expect(rowStrikeCells(lone, { col: 6, row }, 7)).toEqual(lone);
    // Two packets on one unit and one on another: three there, two more cells of the row.
    expect(rowStrikeCells([{ col: 3, row }, { col: 3, row }, { col: 5, row }], { col: 3, row }, 7))
      .toEqual([{ col: 3, row }, { col: 3, row }, { col: 5, row }, { col: 2, row }, { col: 4, row }]);
    // Never more than five, never off the board.
    const many = [0, 1, 2, 3, 4, 5, 6].map(col => ({ col, row }));
    expect(rowStrikeCells(many, { col: 0, row }, 7)).toHaveLength(RUMBLE_STRIKES);
    expect(rowStrikeCells([], { col: 1, row }, 3)).toEqual([{ col: 1, row }, { col: 0, row }, { col: 2, row }]);
  });
  it('explosions start on the damage\'s own tick, one rule tick apart along the row; each drop lands as its explosion starts', () => {
    const [drop] = CUE_EXTRA_SKILLS['rumble-drop']!, [strike] = CUE_EXTRA_SKILLS['rumble-strike']!;
    expect(strike).toMatchObject({ system: '89fc6454', event: 'cast-start', location: 'board', delay: 0 });
    expect(drop).toMatchObject({ system: '721e9fbc', event: 'projectile', location: 'board', delay: 0, travelSeconds: RUMBLE_MISSILE.fall, fromAbove: RUMBLE_MISSILE.from });
    // The k-th explosion starts k steps after the damage; its drop (k >= 1) starts fall before that and lands as it starts.
    expect(RUMBLE_MISSILE.step).toBe(0.05);
    expect(RUMBLE_MISSILE.fall).toBeLessThanOrEqual(RUMBLE_MISSILE.step);
    for (let k = 1; k < RUMBLE_STRIKES; k++) expect(Math.max(0, k * RUMBLE_MISSILE.step - RUMBLE_MISSILE.fall) + drop!.travelSeconds!).toBeCloseTo(k * RUMBLE_MISSILE.step, 9);
    // The whole row shows within its five explosions' stagger: a fifth of a second.
    expect((RUMBLE_STRIKES - 1) * RUMBLE_MISSILE.step).toBeCloseTo(0.2, 9);
    // His own row keeps the muzzle and rocket layers only: the fall and explosion are the two skills above.
    expect(CUE_OVERRIDES.rumble!.map(cue => cue.system)).toEqual(['0f2af66b', '59e2ab23', '5b8e7f02', '7562ce09']);
  });
});

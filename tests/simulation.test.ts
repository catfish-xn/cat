import { describe, expect, it } from 'vitest';
import { createGame, deployUnit } from '../src/simulation/game';
import { contains, DEFAULT_BOARD } from '../src/simulation/board';
import { HexLayout } from '../src/rendering/hex-layout';

describe('deployment state', () => {
  it('moves bench to board without mutating the previous snapshot', () => {
    const state = createGame(), cell = { col: 3, row: 4 };
    const result = deployUnit(state, 'unit-1', { kind: 'board', cell });
    expect(result.ok).toBe(true);
    expect(state.units[0].location).toEqual({ kind: 'bench', slot: 0 });
    expect(result.state.units[0].location).toEqual({ kind: 'board', cell });
    cell.col = 6;
    expect(result.state.units[0].location).toEqual({ kind: 'board', cell: { col: 3, row: 4 } });
  });
  it('supports board repositioning and returning to a free bench slot', () => {
    const first = deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 0, row: 4 } });
    const second = deployUnit(first.state, 'unit-1', { kind: 'board', cell: { col: 6, row: 7 } });
    expect(second.ok).toBe(true);
    const third = deployUnit(second.state, 'unit-1', { kind: 'bench', slot: 0 });
    expect(first.ok).toBe(true);
    expect(third.ok).toBe(true);
    expect(third.state.units[0].location).toEqual({ kind: 'bench', slot: 0 });
  });
  it('rejects occupied board cells and bench slots without changing state', () => {
    const state = deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 0, row: 4 } }).state;
    for (const target of [{ kind: 'board' as const, cell: { col: 0, row: 4 } }, { kind: 'bench' as const, slot: 2 }]) {
      const result = deployUnit(state, 'unit-2', target);
      expect(result).toEqual({ ok: false, reason: 'occupied', state });
      expect(result.state).toBe(state);
    }
    expect(deployUnit(state, 'unit-1', { kind: 'bench', slot: 1 }).ok).toBe(false);
  });
  it('allows dropping a unit onto its own bench slot or board cell', () => {
    expect(deployUnit(createGame(), 'unit-1', { kind: 'bench', slot: 0 }).ok).toBe(true);
    const target = { kind: 'board' as const, cell: { col: 0, row: 4 } };
    const state = deployUnit(createGame(), 'unit-1', target).state;
    expect(deployUnit(state, 'unit-1', target).ok).toBe(true);
  });
  it('rejects unknown units and invalid coordinates', () => {
    const state = createGame();
    expect(deployUnit(state, 'missing', { kind: 'bench', slot: 0 }).ok).toBe(false);
    for (const slot of [-1, 7, 0.5, NaN]) expect(deployUnit(state, 'unit-1', { kind: 'bench', slot }).ok).toBe(false);
    for (const cell of [{ col: -1, row: 0 }, { col: 7, row: 0 }, { col: 0, row: 8 }, { col: 0.5, row: 1 }, { col: NaN, row: 0 }]) {
      expect(contains(DEFAULT_BOARD, cell)).toBe(false);
      expect(deployUnit(state, 'unit-1', { kind: 'board', cell }).ok).toBe(false);
    }
  });
});
describe('hex layout', () => {
  const layout = new HexLayout(DEFAULT_BOARD);
  it('maps every cell center back to the correct cell', () => {
    for (let row = 0; row < DEFAULT_BOARD.rows; row++) for (let col = 0; col < DEFAULT_BOARD.columns; col++) expect(layout.hitTest(layout.center({ col, row }))).toEqual({ col, row });
  });
  it('rejects outside points and corners of the hex bounding rectangle', () => {
    expect(layout.hitTest({ x: 0, y: 0 })).toBeUndefined();
    const p = layout.center({ col: 0, row: 0 });
    expect(layout.hitTest({ x: p.x - layout.radius * 0.8, y: p.y - layout.radius * 0.9 })).toBeUndefined();
  });
  it('hits both sides of the odd/even boundary and the two added rows', () => {
    for (const row of [3, 4, 6, 7]) {
      const cell = { col: 3, row }, center = layout.center(cell);
      for (const dx of [-10, 10]) expect(layout.hitTest({ x: center.x + dx, y: center.y + 5 })).toEqual(cell);
    }
  });
  it('offsets odd rows by half the horizontal cell spacing', () => {
    expect(layout.center({ col: 0, row: 1 }).x - layout.center({ col: 0, row: 0 }).x).toBeCloseTo(Math.sqrt(3) * layout.radius / 2);
  });
});

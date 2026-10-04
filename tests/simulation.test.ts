import { describe, expect, it } from 'vitest';
import { createGame, moveUnit } from '../src/simulation/game';
import { contains, DEFAULT_BOARD } from '../src/simulation/board';
import { HexLayout } from '../src/rendering/hex-layout';

describe('deployment state', () => {
  it('moves bench to board without mutating the previous snapshot', () => {
    const state = createGame(), cell = { col: 3, row: 2 };
    const result = moveUnit(state, 'unit-1', { kind: 'board', cell });
    expect(result.ok).toBe(true);
    expect(state.units[0].location).toEqual({ kind: 'bench', slot: 0 });
    expect(result.state.units[0].location).toEqual({ kind: 'board', cell });
    cell.col = 6;
    expect(result.state.units[0].location).toEqual({ kind: 'board', cell: { col: 3, row: 2 } });
  });
  it('supports board repositioning and returning to a free bench slot', () => {
    const first = moveUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 0, row: 0 } });
    const second = moveUnit(first.state, 'unit-1', { kind: 'board', cell: { col: 6, row: 5 } });
    expect(second.ok).toBe(true);
    const third = moveUnit(second.state, 'unit-1', { kind: 'bench', slot: 0 });
    expect(third.ok).toBe(true);
    expect(third.state.units[0].location).toEqual({ kind: 'bench', slot: 0 });
  });
  it('rejects occupied board cells and bench slots without changing state', () => {
    const state = moveUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 0, row: 0 } }).state;
    for (const target of [{ kind: 'board' as const, cell: { col: 0, row: 0 } }, { kind: 'bench' as const, slot: 2 }]) {
      const result = moveUnit(state, 'unit-2', target);
      expect(result).toEqual({ ok: false, reason: 'occupied', state });
      expect(result.state).toBe(state);
    }
    expect(moveUnit(state, 'unit-1', { kind: 'bench', slot: 1 }).ok).toBe(false);
  });
  it('allows dropping a unit onto its own location', () => {
    expect(moveUnit(createGame(), 'unit-1', { kind: 'bench', slot: 0 }).ok).toBe(true);
  });
  it('rejects unknown units and invalid coordinates', () => {
    const state = createGame();
    expect(moveUnit(state, 'missing', { kind: 'bench', slot: 0 }).ok).toBe(false);
    for (const slot of [-1, 7, 0.5, NaN]) expect(moveUnit(state, 'unit-1', { kind: 'bench', slot }).ok).toBe(false);
    for (const cell of [{ col: -1, row: 0 }, { col: 7, row: 0 }, { col: 0, row: 6 }, { col: 0.5, row: 1 }, { col: NaN, row: 0 }]) {
      expect(contains(DEFAULT_BOARD, cell)).toBe(false);
      expect(moveUnit(state, 'unit-1', { kind: 'board', cell }).ok).toBe(false);
    }
  });
});
describe('hex layout', () => {
  const layout = new HexLayout(DEFAULT_BOARD);
  it('maps every cell center back to the correct cell', () => {
    for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) expect(layout.hitTest(layout.center({ col, row }))).toEqual({ col, row });
  });
  it('rejects outside points and corners of the hex bounding rectangle', () => {
    expect(layout.hitTest({ x: 0, y: 0 })).toBeUndefined();
    const p = layout.center({ col: 0, row: 0 });
    expect(layout.hitTest({ x: p.x - 34, y: p.y - 39 })).toBeUndefined();
  });
  it('offsets odd rows by half the horizontal cell spacing', () => {
    expect(layout.center({ col: 0, row: 1 }).x - layout.center({ col: 0, row: 0 }).x).toBeCloseTo(Math.sqrt(3) * 20);
  });
});

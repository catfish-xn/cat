import { describe, expect, it } from 'vitest';
import { contains, DEFAULT_BOARD, getNeighbors, hexDistance } from '../src/simulation/board';

const cell = (col: number, row: number) => ({ col, row });
describe('odd-row hex neighbors', () => {
  it('returns clockwise E, SE, SW, W, NW, NE for interior even and odd rows', () => {
    expect(getNeighbors(DEFAULT_BOARD, cell(3, 4))).toEqual([cell(4, 4), cell(3, 5), cell(2, 5), cell(2, 4), cell(2, 3), cell(3, 3)]);
    expect(getNeighbors(DEFAULT_BOARD, cell(3, 5))).toEqual([cell(4, 5), cell(4, 6), cell(3, 6), cell(2, 5), cell(3, 4), cell(4, 4)]);
  });
  it('filters edges and all four corners without changing the order', () => {
    expect(getNeighbors(DEFAULT_BOARD, cell(0, 4))).toEqual([cell(1, 4), cell(0, 5), cell(0, 3)]);
    expect(getNeighbors(DEFAULT_BOARD, cell(6, 5))).toEqual([cell(6, 6), cell(5, 5), cell(6, 4)]);
    expect(getNeighbors(DEFAULT_BOARD, cell(0, 0))).toEqual([cell(1, 0), cell(0, 1)]);
    expect(getNeighbors(DEFAULT_BOARD, cell(6, 0))).toEqual([cell(6, 1), cell(5, 1), cell(5, 0)]);
    expect(getNeighbors(DEFAULT_BOARD, cell(0, 7))).toEqual([cell(1, 7), cell(0, 6), cell(1, 6)]);
    expect(getNeighbors(DEFAULT_BOARD, cell(6, 7))).toEqual([cell(5, 7), cell(6, 6)]);
  });
  it('rejects invalid sources and keeps every neighbor valid, unique, and reciprocal', () => {
    for (const c of [cell(-1, 0), cell(7, 0), cell(0, 8), cell(0.5, 4)]) expect(getNeighbors(DEFAULT_BOARD, c)).toEqual([]);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const source = cell(col, row), neighbors = getNeighbors(DEFAULT_BOARD, source);
      expect(new Set(neighbors.map(c => `${c.col},${c.row}`)).size).toBe(neighbors.length);
      for (const neighbor of neighbors) {
        expect(contains(DEFAULT_BOARD, neighbor)).toBe(true);
        expect(getNeighbors(DEFAULT_BOARD, neighbor)).toContainEqual(source);
      }
    }
  });
  it('does not restrict neighbors at the team boundary', () => {
    expect(getNeighbors(DEFAULT_BOARD, cell(3, 3))).toContainEqual(cell(3, 4));
    expect(getNeighbors(DEFAULT_BOARD, cell(3, 4))).toContainEqual(cell(3, 3));
  });
});
describe('hex grid distance', () => {
  it('is zero for the same cell, one for neighbors, and symmetric for every pair', () => {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const a = cell(col, row);
      expect(hexDistance(a, a)).toBe(0);
      for (const b of getNeighbors(DEFAULT_BOARD, a)) expect(hexDistance(a, b)).toBe(1);
      for (let otherRow = 0; otherRow < 8; otherRow++) for (let otherCol = 0; otherCol < 7; otherCol++) {
        const b = cell(otherCol, otherRow);
        expect(hexDistance(a, b)).toBe(hexDistance(b, a));
      }
    }
  });
  it('measures grid steps across odd/even boundaries and new rows', () => {
    expect(hexDistance(cell(3, 3), cell(3, 4))).toBe(1);
    expect(hexDistance(cell(3, 3), cell(4, 4))).toBe(1);
    expect(hexDistance(cell(3, 4), cell(4, 5))).toBe(2);
    expect(hexDistance(cell(0, 6), cell(1, 7))).toBe(2);
    expect(hexDistance(cell(0, 0), cell(6, 7))).toBe(10);
    expect(hexDistance(cell(0, 0), cell(0, 7))).toBe(7);
  });
  it('agrees with minimum adjacent steps for every cell pair on the battlefield', () => {
    // Independent breadth-first traversal exists only in this test; no game pathfinding.
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const start = cell(col, row), queue = [{ cell: start, steps: 0 }];
      const visited = new Set([`${col},${row}`]);
      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        expect(hexDistance(start, current.cell)).toBe(current.steps);
        for (const neighbor of getNeighbors(DEFAULT_BOARD, current.cell)) {
          const key = `${neighbor.col},${neighbor.row}`;
          if (!visited.has(key)) { visited.add(key); queue.push({ cell: neighbor, steps: current.steps + 1 }); }
        }
      }
      expect(visited.size).toBe(56);
    }
  });
});

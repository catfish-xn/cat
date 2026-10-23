import { describe, expect, it } from 'vitest';
import { jayceGate } from '../src/simulation/combat-g2-3';
import { DEFAULT_BOARD, contains, hexDistance } from '../src/simulation/board';

describe('Jayce gate (project rule P, 2026-10-23)', () => {
  it('lands 3 hexes past the target on the line away from Jayce', () => {
    const from = { col: 3, row: 0 }, target = { col: 3, row: 2 };
    const gate = jayceGate(DEFAULT_BOARD, from, target);
    expect(hexDistance(target, gate)).toBe(3);
    expect(hexDistance(from, gate)).toBe(hexDistance(from, target) + 3);
  });
  it('steps back toward the target at the board edge', () => {
    const last = DEFAULT_BOARD.rows - 1, from = { col: 3, row: last - 2 }, target = { col: 3, row: last };
    const gate = jayceGate(DEFAULT_BOARD, from, target);
    expect(contains(DEFAULT_BOARD, gate)).toBe(true);
    expect(gate).toEqual(target);
  });
});

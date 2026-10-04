import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, isDeploymentCell } from '../src/simulation/board';
import { createGame, deployUnit, getPlayerDeploymentCount, validateDeployment } from '../src/simulation/game';
import type { UnitLocation } from '../src/simulation/units';

describe('teams and preparation deployment', () => {
  it('preserves five player bench units and seeds two enemies in their zone', () => {
    const state = createGame();
    expect(state.board).toMatchObject({ columns: 7, rows: 8 });
    expect(state.benchSize).toBe(7);
    expect(state.units.filter(unit => unit.team === 'player').map(unit => unit.definitionId)).toEqual(['sentinel', 'ranger', 'mystic', 'sentinel', 'ranger']);
    const enemies = state.units.filter(unit => unit.team === 'enemy');
    expect(enemies).toHaveLength(2);
    for (const enemy of enemies) {
      expect(enemy.location.kind).toBe('board');
      if (enemy.location.kind === 'board') expect(isDeploymentCell(state.board, 'enemy', enemy.location.cell)).toBe(true);
    }
    expect(new Set(state.units.map(unit => unit.id)).size).toBe(state.units.length);
    expect(getPlayerDeploymentCount(state)).toBe(0);
  });
  it('defines disjoint enemy rows 0–3 and player rows 4–7, including both boundaries', () => {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      expect(isDeploymentCell(DEFAULT_BOARD, 'player', { col, row })).toBe(row >= 4);
      expect(isDeploymentCell(DEFAULT_BOARD, 'enemy', { col, row })).toBe(row <= 3);
      const result = deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col, row } });
      expect(result.ok).toBe(row >= 4);
      if (!result.ok) expect(result.reason).toBe('outside-deployment-zone');
    }
    for (const cell of [{ col: 0, row: -1 }, { col: 0, row: 8 }, { col: 7, row: 4 }]) {
      expect(isDeploymentCell(DEFAULT_BOARD, 'player', cell)).toBe(false);
      expect(isDeploymentCell(DEFAULT_BOARD, 'enemy', cell)).toBe(false);
    }
  });
  it('uses the simulation board zone definition in deployment validation', () => {
    const state = createGame();
    const custom = { ...state, board: { ...state.board, deploymentZones: { ...state.board.deploymentZones, player: { firstRow: 5, lastRow: 6 } } } };
    expect(deployUnit(custom, 'unit-1', { kind: 'board', cell: { col: 0, row: 4 } }).ok).toBe(false);
    expect(deployUnit(custom, 'unit-1', { kind: 'board', cell: { col: 0, row: 5 } }).ok).toBe(true);
    expect(deployUnit(custom, 'unit-1', { kind: 'board', cell: { col: 0, row: 7 } }).ok).toBe(false);
  });
  it('rejects enemy moves to board, bench, and their own location', () => {
    const state = createGame();
    const targets: UnitLocation[] = [{ kind: 'board', cell: { col: 0, row: 4 } }, { kind: 'bench', slot: 6 }, state.units.find(unit => unit.id === 'enemy-1')!.location];
    for (const target of targets) expect(deployUnit(state, 'enemy-1', target)).toEqual({ ok: false, reason: 'enemy-unit', state });
  });
  it('does not mutate frozen previous state or replace it on any rejected operation', () => {
    const state = createGame();
    for (const unit of state.units) {
      if (unit.location.kind === 'board') Object.freeze(unit.location.cell);
      Object.freeze(unit.location);
      Object.freeze(unit);
    }
    Object.freeze(state.units);
    Object.freeze(state);
    const snapshot = JSON.stringify(state);
    const operations: [string, UnitLocation][] = [
      ['missing', { kind: 'bench', slot: 6 }],
      ['enemy-1', { kind: 'bench', slot: 6 }],
      ['unit-1', { kind: 'board', cell: { col: 2, row: 3 } }],
      ['unit-1', { kind: 'board', cell: { col: 7, row: 4 } }],
      ['unit-1', { kind: 'bench', slot: 7 }],
      ['unit-1', { kind: 'bench', slot: 1 }],
    ];
    for (const [id, target] of operations) {
      const result = deployUnit(state, id, target);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
      expect(JSON.stringify(state)).toBe(snapshot);
    }
  });
  it('uses the same validator for preview and commit, with no preview mutation', () => {
    const state = createGame(), snapshot = JSON.stringify(state);
    const targets: UnitLocation[] = [
      { kind: 'bench', slot: 0 }, { kind: 'bench', slot: 1 }, { kind: 'bench', slot: 6 },
      { kind: 'board', cell: { col: 0, row: 3 } }, { kind: 'board', cell: { col: 0, row: 4 } },
      { kind: 'board', cell: { col: 0, row: 8 } },
    ];
    for (const id of ['unit-1', 'enemy-1', 'missing']) for (const target of targets) {
      const reason = validateDeployment(state, id, target), result = deployUnit(state, id, target);
      expect(result.ok).toBe(reason === undefined);
      if (!result.ok) expect(result.reason).toBe(reason);
    }
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it('counts only player board units and allows all five player units without a cap', () => {
    let state = createGame();
    for (let col = 0; col < 5; col++) {
      const result = deployUnit(state, `unit-${col + 1}`, { kind: 'board', cell: { col, row: 4 } });
      expect(result.ok).toBe(true);
      state = result.state;
      expect(getPlayerDeploymentCount(state)).toBe(col + 1);
    }
    state = deployUnit(state, 'unit-1', { kind: 'bench', slot: 0 }).state;
    expect(getPlayerDeploymentCount(state)).toBe(4);
    expect(state.units.filter(unit => unit.team === 'enemy')).toHaveLength(2);
  });
});

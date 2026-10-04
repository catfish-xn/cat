import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, getNeighbors, hexDistance } from '../src/simulation/board';
import { createCombat, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { createGame, deployUnit } from '../src/simulation/game';
import { battle, freeze, unit } from './combat-helpers';

function run(initial: CombatState) {
  let state = initial;
  const events: CombatEvent[] = [];
  while (state.status === 'running' && state.tick < initial.maxTicks) {
    const next = stepCombat(state);
    state = next.state;
    events.push(...next.events);
    const cells = state.units.filter(unit => unit.alive).map(unit => `${unit.cell.col},${unit.cell.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  }
  expect(state.status).toBe('finished');
  return { state, events };
}

describe('deterministic combat simulation', () => {
  it('completes distant 1v1 with legal adjacent moves across deployment boundaries', () => {
    const initial = battle([unit('p', 'player', 0, 7, { hp: 200 }), unit('e', 'enemy', 6, 0, { moveCooldownTicks: 1200 })]);
    const { state, events } = run(initial);
    expect(state.result).toBe('playerWin');
    const movements = events.filter(event => event.type === 'movement');
    expect(movements.length).toBeGreaterThan(0);
    expect(movements.every(event => hexDistance(event.from, event.to) === 1)).toBe(true);
    expect(movements.some(event => event.unitId === 'p' && event.to.row < 4)).toBe(true);
    expect(events.some(event => event.type === 'death')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'combatFinished', reason: 'elimination' });
  });

  it('completes 2v2 and preserves unique living positions at every tick', () => {
    const { state } = run(battle([unit('p1', 'player', 2, 6), unit('p2', 'player', 4, 7),
      unit('e1', 'enemy', 2, 0), unit('e2', 'enemy', 4, 1)]));
    expect(state.tick).toBeLessThan(state.maxTicks);
    expect(['playerWin', 'enemyWin', 'draw']).toContain(state.result);
  });

  it('reserves a contested destination by ID, independently of array order', () => {
    const initial = battle([unit('b', 'player', 1, 0), unit('a', 'player', 0, 0),
      unit('e', 'enemy', 0, 2, { moveCooldownTicks: 100, cooldownTicks: 100 })]);
    const result = stepCombat(initial);
    expect(result.events.filter(event => event.type === 'movement')).toEqual([
      { type: 'movement', tick: 1, unitId: 'a', from: { col: 0, row: 0 }, to: { col: 0, row: 1 } },
    ]);
    expect(result.state.units.find(unit => unit.id === 'b')?.cell).toEqual({ col: 1, row: 0 });
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(result);
  });

  it('never enters a cell occupied at movement start, even if its occupant moves away', () => {
    const initial = battle([unit('a', 'player', 0, 0), unit('b', 'player', 0, 1), unit('e', 'enemy', 0, 7)],
      { board: { ...DEFAULT_BOARD, columns: 1 } });
    const { state, events } = stepCombat(initial);
    expect(state.units.find(unit => unit.id === 'a')?.cell).toEqual({ col: 0, row: 0 });
    expect(events).toContainEqual({ type: 'movement', tick: 1, unitId: 'b', from: { col: 0, row: 1 }, to: { col: 0, row: 2 } });
  });

  it('takes the fixed-neighbor first shortest path and routes around occupied cells', () => {
    const initial = battle([unit('p', 'player', 0, 0), unit('e', 'enemy', 2, 2, { moveCooldownTicks: 100, cooldownTicks: 100 })]);
    expect(stepCombat(initial).state.units.find(unit => unit.id === 'p')?.cell).toEqual({ col: 1, row: 0 });
    const blocked = { ...initial, units: [...initial.units, unit('blocker', 'player', 1, 0, { moveCooldownTicks: 100, cooldownTicks: 100 })] };
    expect(stepCombat(blocked).state.units.find(unit => unit.id === 'p')?.cell).toEqual({ col: 0, row: 1 });
    expect(stepCombat({ ...blocked, units: [...blocked.units].reverse() })).toEqual(stepCombat(blocked));
  });

  it('waits safely on blocked paths until timeout', () => {
    const center = { col: 3, row: 3 };
    const surrounding = getNeighbors(DEFAULT_BOARD, center).map((cell, i) =>
      unit(`block-${i}`, 'player', cell.col, cell.row, { moveCooldownTicks: 100, cooldownTicks: 100 }));
    const initial = battle([unit('p', 'player', center.col, center.row), ...surrounding,
      unit('e', 'enemy', 6, 7, { moveCooldownTicks: 100, cooldownTicks: 100 })], { maxTicks: 5 });
    const { state, events } = run(initial);
    expect(state.result).toBe('draw');
    expect(state.units.find(unit => unit.id === 'p')?.cell).toEqual(center);
    expect(events.filter(event => event.type === 'movement' && event.unitId === 'p')).toEqual([]);
  });

  it('chooses nearest enemy, breaking equal distance by code-point ID', () => {
    const initial = battle([unit('p', 'player', 3, 3, { cooldownTicks: 100 }),
      unit('z', 'enemy', 4, 3, { cooldownTicks: 100 }), unit('A', 'enemy', 2, 3, { cooldownTicks: 100 }),
      unit('0', 'enemy', 6, 7, { moveCooldownTicks: 100, cooldownTicks: 100 })]);
    expect(stepCombat(initial).state.units.find(unit => unit.id === 'p')?.targetId).toBe('A');
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(stepCombat(initial));
  });

  it('reselects a living target after the previous target dies', () => {
    const initial = battle([unit('p', 'player', 2, 3, { attackDamage: 100, attackIntervalTicks: 1 }),
      unit('e1', 'enemy', 3, 3, { attackDamage: 0 }), unit('e2', 'enemy', 5, 3, { cooldownTicks: 100, moveCooldownTicks: 100 })]);
    const first = stepCombat(initial);
    expect(first.state.units.find(unit => unit.id === 'e1')?.alive).toBe(false);
    const next = stepCombat(first.state);
    expect(next.state.units.find(unit => unit.id === 'p')?.targetId).toBe('e2');
    expect(next.events.some(event => event.type === 'movement' && event.unitId === 'p')).toBe(true);
  });

  it('fires at range boundary, waits outside range, and attacks after moving into range', () => {
    const shooter = unit('p', 'player', 0, 0, { attackRange: 3, moveCooldownTicks: 100 });
    const atRange = battle([shooter, unit('e', 'enemy', 3, 0, { moveCooldownTicks: 100, cooldownTicks: 100 })]);
    expect(stepCombat(atRange).events.some(event => event.type === 'attack' && event.attackerId === 'p')).toBe(true);
    const outside = battle([shooter, unit('e', 'enemy', 4, 0, { moveCooldownTicks: 100, cooldownTicks: 100 })]);
    expect(stepCombat(outside).events.filter(event => event.type === 'attack')).toEqual([]);
    const moving = stepCombat({ ...outside, units: [{ ...shooter, moveCooldownTicks: 0 }, outside.units[1]] });
    expect(moving.events.map(event => event.type)).toEqual(['movement', 'attack', 'damage', 'manaChanged', 'manaChanged']);
  });

  it('uses logical attack and movement intervals, with first actions ready immediately', () => {
    const attacks = run(battle([unit('p', 'player', 0, 0, { attackDamage: 1 }),
      unit('e', 'enemy', 1, 0, { attackDamage: 1 })], { maxTicks: 42 })).events
      .filter(event => event.type === 'attack' && event.attackerId === 'p');
    expect(attacks.map(event => event.tick)).toEqual([1, 21, 41]);
    const movements = run(battle([unit('p', 'player', 0, 0),
      unit('e', 'enemy', 6, 7, { moveCooldownTicks: 100, cooldownTicks: 100 })], { maxTicks: 12 })).events
      .filter(event => event.type === 'movement' && event.unitId === 'p');
    expect(movements.map(event => event.tick)).toEqual([1, 6, 11]);
  });

  it('aggregates damage and resolves same-tick mutual kills simultaneously in stable event order', () => {
    const initial = battle([unit('p', 'player', 0, 0, { hp: 40 }), unit('e', 'enemy', 1, 0, { hp: 40 })]);
    const result = stepCombat(initial);
    expect(result.state.result).toBe('draw');
    expect(result.events).toEqual([
      { type: 'attack', tick: 1, attackerId: 'e', targetId: 'p' },
      { type: 'attack', tick: 1, attackerId: 'p', targetId: 'e' },
      { type: 'damage', tick: 1, unitId: 'e', amount: 40, hp: 0, physicalAmount: 40, magicAmount: 0, absorbed: 0, hpDamage: 40, shield: 0 },
      { type: 'damage', tick: 1, unitId: 'p', amount: 40, hp: 0, physicalAmount: 40, magicAmount: 0, absorbed: 0, hpDamage: 40, shield: 0 },
      { type: 'death', tick: 1, unitId: 'e' },
      { type: 'death', tick: 1, unitId: 'p' },
      { type: 'combatFinished', tick: 1, result: 'draw', reason: 'elimination' },
    ]);
    expect(result.state.units.every(unit => !unit.alive && unit.hp === 0 && unit.targetId === null && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0)).toBe(true);
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(result);
  });

  it('emits one aggregated damage event per victim and clamps overkill HP', () => {
    const initial = battle([unit('p1', 'player', 0, 0, { attackDamage: 80 }), unit('p2', 'player', 1, 1, { attackDamage: 80 }),
      unit('e', 'enemy', 1, 0, { cooldownTicks: 100 })]);
    expect(stepCombat(initial).events.filter(event => event.type === 'damage')).toEqual([
      { type: 'damage', tick: 1, unitId: 'e', amount: 160, hp: 0, physicalAmount: 160, magicAmount: 0, absorbed: 0, hpDamage: 100, shield: 0 },
    ]);
  });

  it('does not let dead units block paths or attack', () => {
    const initial = battle([unit('p', 'player', 0, 0), unit('dead', 'enemy', 1, 0,
      { alive: false, hp: 0, attackDamage: 999 }), unit('e', 'enemy', 3, 0, { moveCooldownTicks: 100, cooldownTicks: 100 })]);
    const next = stepCombat(initial);
    expect(next.state.units.find(unit => unit.id === 'p')?.cell).toEqual({ col: 1, row: 0 });
    expect(next.events.some(event => event.type === 'attack' && event.attackerId === 'dead')).toBe(false);
  });

  it('resolves enemy victory and gives elimination precedence on the final allowed tick', () => {
    const initial = battle([unit('p', 'player', 0, 0, { hp: 1, attackDamage: 0 }), unit('e', 'enemy', 1, 0)], { maxTicks: 1 });
    expect(stepCombat(initial).events.at(-1)).toEqual({ type: 'combatFinished', tick: 1, result: 'enemyWin', reason: 'elimination' });
  });

  it('times out exactly at maxTicks and returns the identical terminal state with no further events', () => {
    const initial = battle([unit('p', 'player', 0, 0, { attackDamage: 0 }), unit('e', 'enemy', 1, 0, { attackDamage: 0 })], { maxTicks: 3 });
    const first = stepCombat(initial), second = stepCombat(first.state), third = stepCombat(second.state);
    expect(second.state.status).toBe('running');
    expect(third.events.at(-1)).toEqual({ type: 'combatFinished', tick: 3, result: 'draw', reason: 'timeout' });
    expect(stepCombat(third.state).state).toBe(third.state);
    expect(stepCombat(third.state).events).toEqual([]);
  });

  it('produces identical full event streams and terminal states for repeated runs and array permutations', () => {
    const initial = battle([unit('p1', 'player', 0, 6), unit('p2', 'player', 4, 7, { attackRange: 3 }),
      unit('e1', 'enemy', 2, 0), unit('e2', 'enemy', 5, 1, { attackRange: 3 })]);
    const expected = run(freeze(initial));
    expect(run(initial)).toEqual(expected);
    expect(run({ ...initial, units: [...initial.units].reverse() })).toEqual(expected);
    expect(run({ ...initial, units: [initial.units[2], initial.units[0], initial.units[3], initial.units[1]] })).toEqual(expected);
  });

  it('never mutates preparation or any previous combat snapshot over a complete real battle', () => {
    const preparation = freeze(deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 3, row: 7 } }).state);
    const before = structuredClone(preparation);
    let state = freeze(createCombat(preparation));
    const original = structuredClone(state);
    const originalState = state;
    while (state.status === 'running') state = freeze(stepCombat(state).state);
    expect(preparation).toEqual(before);
    expect(originalState).toEqual(original);
    expect(state.units.some(unit => !unit.alive)).toBe(true);
  });
});

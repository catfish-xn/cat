import { describe, expect, it } from 'vitest';
import { createGame, deployUnit } from '../src/simulation/game';
import { COMBAT_TICK_MS, createCombat, stepCombat } from '../src/simulation/combat';

function preparation() { return deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 3, row: 7 } }).state; }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
describe('frozen combat contract', () => {
  it('creates only board units without sharing mutable preparation objects', () => {
    const prep = preparation(), before = structuredClone(prep), combat = createCombat(freeze(prep));
    expect(combat.units.map(unit => unit.id)).toEqual(['enemy-1', 'enemy-2', 'unit-1']);
    expect(combat.board).not.toBe(prep.board);
    expect(combat.board.deploymentZones.player).not.toBe(prep.board.deploymentZones.player);
    const original = prep.units.find(unit => unit.id === 'unit-1')!;
    if (original.location.kind === 'board') expect(combat.units[2].cell).not.toBe(original.location.cell);
    stepCombat(freeze(combat));
    expect(prep).toEqual(before);
  });
  it('advances exactly one 50 ms tick without mutating its input', () => {
    const state = freeze(createCombat(preparation())), before = structuredClone(state);
    const next = stepCombat(state);
    expect(COMBAT_TICK_MS).toBe(50);
    expect(next.state.tick).toBe(1);
    expect(state).toEqual(before);
    expect(next.events.every(event => event.tick === 1)).toBe(true);
  });
  it('initializes fresh hp, life and cooldown for each battle', () => {
    const first = createCombat(preparation()), second = createCombat(preparation());
    expect(second).toEqual(first);
    expect(second.units.every(unit => unit.hp === unit.maxHp && unit.alive && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0)).toBe(true);
  });
  it('resolves empty or single-sided combat at creation and never advances terminal states', () => {
    const prep = createGame();
    expect(createCombat({ ...prep, units: [] }).result).toBe('draw');
    const combat = createCombat(prep);
    expect(combat.result).toBe('enemyWin');
    expect(stepCombat(combat)).toEqual({ state: combat, events: [] });
    expect(stepCombat(combat).state).toBe(combat);
  });
});

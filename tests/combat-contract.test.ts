import { describe, expect, it } from 'vitest';
import { createGame, deployUnit, type GameState } from '../src/simulation/game';
import { COMBAT_TICK_MS, createCombat, stepCombat } from '../src/simulation/combat';
import { ABILITY_DEFINITIONS } from '../src/simulation/combat-abilities';

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
  it('initializes fresh hp, life, Mana, shields and cooldown for each battle', () => {
    const first = createCombat(preparation()), second = createCombat(preparation());
    expect(second).toEqual(first);
    expect(second.units.every(unit => unit.hp === unit.maxHp && unit.alive && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0
      && unit.mana === 0 && unit.shield === 0 && unit.shieldExpiresAtTick === null && unit.targetId === null)).toBe(true);
  });
  it('snapshots integer star-scaled attributes, fixed defenses and independent resolved abilities', () => {
    const prep = preparation();
    const upgraded: GameState = { ...prep, units: prep.units.map(unit => unit.id === 'unit-1' ? { ...unit, starLevel: 2 } : unit) };
    const combat = createCombat(freeze(upgraded)), sentinel = combat.units.find(unit => unit.id === 'unit-1')!;
    expect(sentinel).toMatchObject({ starLevel: 2, hp: 1440, maxHp: 1440, attackDamage: 81, armor: 40, magicResist: 30,
      attackRange: 1, attackIntervalTicks: 20, maxMana: 80, ability: { id: 'sentinel-guard', kind: 'selfShield', amount: 400, durationTicks: 60 } });
    expect(sentinel.ability).not.toBe(ABILITY_DEFINITIONS['sentinel-guard']);
    expect(createCombat(upgraded).units.find(unit => unit.id === 'unit-1')?.ability).not.toBe(sentinel.ability);
    const threeStar: GameState = { ...prep, units: prep.units.map(unit => unit.id === 'unit-1' ? { ...unit, starLevel: 3 } : unit) };
    expect(createCombat(threeStar).units.find(unit => unit.id === 'unit-1')).toMatchObject({ hp: 2592, attackDamage: 145,
      armor: 40, magicResist: 30, ability: { amount: 720 } });
  });
  it('makes a two-star upgrade change a real symmetric duel from a draw to a win', () => {
    function duel(starLevel: 1 | 2) {
      const prep = createGame();
      const game: GameState = { ...prep, units: [
        { id: 'p', definitionId: 'sentinel', team: 'player', starLevel, location: { kind: 'board', cell: { col: 0, row: 0 } } },
        { id: 'e', definitionId: 'sentinel', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 1, row: 0 } } },
      ] };
      let state = createCombat(freeze(game));
      while (state.status === 'running') state = stepCombat(freeze(state)).state;
      return state;
    }
    expect(duel(1).result).toBe('draw');
    expect(duel(2).result).toBe('playerWin');
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

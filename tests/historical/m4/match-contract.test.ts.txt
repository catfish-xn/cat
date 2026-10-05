import { describe, expect, it } from 'vitest';
import { buyUnit, buyXp, createMatch, deployMatchUnit, getDeploymentCap, matchStartFailure, startMatchCombat, stepMatch, validateMatchDeployment } from '../src/simulation/match';
import { accepted, freeze } from './match-helpers';
import type { UnitLocation } from '../src/simulation/units';

describe('M4 public contract', () => {
  it('starts with a reproducible versioned shop, growth and separate preparation', () => {
    const first = createMatch();
    let rng = 42n;
    for (let i = 0; i < 10; i++) rng = (rng * 1664525n + 1013904223n) % 4294967296n;
    expect(first).toEqual(createMatch(42));
    expect(first).toMatchObject({ schemaVersion: 4, rulesVersion: 'm4-v1', contentVersion: 'm4-slice-v1',
      phase: 'preparation', round: 1, gold: 10, level: 3, xp: 0, playerHp: 100, rngState: Number(rng), nextUnitSerial: 6, combat: null, roundResults: [] });
    expect(first.shop.slots).toHaveLength(5);
    expect(first.preparation).not.toBe(createMatch().preparation);
    expect(first.preparation.units.every(unit => unit.starLevel === 1)).toBe(true);
  });
  it('accepts empty deployment as a single tick-zero defeat, with no step event', () => {
    const state = freeze(createMatch());
    const result = startMatchCombat(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map(event => event.type)).toEqual(['combatFinished', 'roundSettled']);
    expect(result.state).toMatchObject({ phase: 'settlement', playerHp: 94, gold: 15, xp: 2 });
    expect(result.state.roundResults).toHaveLength(1);
    expect(result.state.roundResults[0]).toMatchObject({ result: 'enemyWin', combatTicks: 0, playerDamage: 6 });
    expect(stepMatch(result.state)).toEqual({ state: result.state, events: [] });
    expect(stepMatch(result.state).state).toBe(result.state);
    expect(state.playerHp).toBe(100);
  });
  it('rejects stale shop and missing enemies atomically', () => {
    const state = createMatch();
    expect(buyUnit(state, 0, 0)).toEqual({ ok: false, state, reason: 'stale-shop' });
    expect(buyUnit(state, 0, 0).state).toBe(state);
    const empty = { ...state, preparation: { ...state.preparation, units: [] } };
    expect(startMatchCombat(empty)).toEqual({ ok: false, state: empty, reason: 'missing-both' });
    const playerOnly = { ...state, preparation: { ...state.preparation,
      units: [{ ...state.preparation.units[0], location: { kind: 'board' as const, cell: { col: 1, row: 4 } } }] } };
    expect(matchStartFailure(playerOnly)).toBe('missing-enemy');
  });
  it.each([-1, 0.5, 4294967296, NaN, Infinity])('rejects invalid initialization seed %s', seed => {
    expect(() => createMatch(seed)).toThrow(RangeError);
  });
  it.each([0, 4294967295])('accepts boundary seed %s', seed => {
    expect(createMatch(seed).seed).toBe(seed);
    expect(createMatch(seed)).toEqual(createMatch(seed));
  });
  it('shares population validation between preview and commit without limiting board repositioning', () => {
    let state = createMatch();
    for (let index = 0; index < 3; index++) state = accepted(deployMatchUnit(state, `unit-${index+1}`, { kind: 'board', cell: { col: index, row: 4 } }));
    const target: UnitLocation = { kind: 'board', cell: { col: 4, row: 4 } };
    expect(getDeploymentCap(state)).toBe(3);
    expect(validateMatchDeployment(state, 'unit-4', target)).toBe('population-cap');
    expect(deployMatchUnit(state, 'unit-4', target)).toEqual({ ok: false, state, reason: 'population-cap' });
    const moved = accepted(deployMatchUnit(state, 'unit-1', target));
    expect(validateMatchDeployment(moved, 'unit-1', { kind: 'bench', slot: 0 })).toBeUndefined();
    const upgraded = accepted(buyXp(accepted(buyXp(state))));
    expect(upgraded.level).toBe(4);
    expect(upgraded.shop).toBe(state.shop);
    expect(upgraded.rngState).toBe(state.rngState);
    expect(validateMatchDeployment(upgraded, 'unit-4', target)).toBeUndefined();
    expect(deployMatchUnit(upgraded, 'unit-4', target).ok).toBe(true);
    const overCap = { ...state, preparation: { ...state.preparation, units: state.preparation.units.map(unit => unit.id === 'unit-4' ? { ...unit, location: target } : unit) } };
    expect(matchStartFailure(overCap)).toBe('population-cap');
  });
  it('prioritizes phase then max-level then affordability for XP', () => {
    const state = createMatch();
    const max = { ...state, level: 9, gold: 0 };
    expect(buyXp(max)).toEqual({ ok: false, state: max, reason: 'max-level' });
    const poor = { ...state, gold: 3 };
    expect(buyXp(poor)).toEqual({ ok: false, state: poor, reason: 'insufficient-gold' });
    const settled = accepted(startMatchCombat(max));
    expect(buyXp(settled)).toEqual({ ok: false, state: settled, reason: 'wrong-phase' });
  });
});

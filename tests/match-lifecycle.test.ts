import { describe, expect, it } from 'vitest';
import { createCombat, type CombatResult } from '../src/simulation/combat';
import { buyUnit, createMatch, deployMatchUnit, nextRound, sellUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { accepted, battle, deployed, finish, freeze } from './match-helpers';

describe('round lifecycle and settlement', () => {
  it.each(['playerWin', 'enemyWin', 'draw'] as const)('settles real combat %s exactly once and permits Continue', result => {
    let state: MatchState;
    if (result === 'playerWin') state = battle();
    else state = accepted(startMatchCombat(accepted(deployMatchUnit(createMatch(), 'unit-1', { kind: 'board', cell: { col: 3, row: 7 } }))));
    if (result === 'draw' && state.phase === 'combat') state = { ...state, combat: { ...state.combat, maxTicks: 1 } };
    const gold = state.gold, rng = state.rngState;
    const settled = finish(freeze(state));
    expect(settled.combat?.result).toBe(result);
    expect(settled.gold).toBe(gold + 5);
    expect(settled.rngState).toBe(rng);
    expect(settled.roundResults).toEqual([{ round: 1, result, combatTicks: settled.combat!.tick, income: 5, goldBefore: gold, goldAfter: gold + 5 }]);
    for (let i = 0; i < 20; i++) expect(stepMatch(settled)).toEqual({ state: settled, events: [] });
    expect(stepMatch(settled).state).toBe(settled);
    const next = accepted(nextRound(freeze(settled), 1));
    expect(next).toMatchObject({ phase: 'preparation', round: 2, combat: null, gold: gold + 5 });
    expect(next.roundResults).toBe(settled.roundResults);
    expect(next.shop.generation).toBe(2);
    expect(next.shop.slots.every(slot => slot.status === 'available')).toBe(true);
    expect(nextRound(next, 1)).toEqual({ ok: false, state: next, reason: 'wrong-phase' });
  });

  it('rejects stale Continue in later settlement and never double-refreshes', () => {
    const first = finish(battle());
    const secondPrep = accepted(nextRound(first, 1));
    const second = finish(accepted(startMatchCombat(secondPrep)));
    const before = structuredClone(second);
    expect(nextRound(freeze(second), 1)).toEqual({ ok: false, state: second, reason: 'stale-round' });
    expect(second).toEqual(before);
    expect(accepted(nextRound(second, 2)).round).toBe(3);
  });

  it('does not settle or consume randomness from preparation ticks or rejected starts', () => {
    const state = freeze(createMatch());
    expect(stepMatch(state)).toEqual({ state, events: [] });
    expect(stepMatch(state).state).toBe(state);
    expect(startMatchCombat(state).state).toBe(state);
    for (const [teams, reason] of [[['player'], 'missing-enemy'], [[], 'missing-both']] as const) {
      const input = deployed();
      const fixture = { ...input, preparation: { ...input.preparation, units: input.preparation.units.filter(unit => (teams as readonly string[]).includes(unit.team)) } };
      expect(startMatchCombat(fixture)).toEqual({ ok: false, state: fixture, reason });
    }
  });
});

describe('match/preparation/combat isolation across rounds', () => {
  it('keeps every frozen historical snapshot and economic field stable before the atomic finish', () => {
    const prep = freeze(deployed()), original = structuredClone(prep);
    let state = accepted(startMatchCombat(prep));
    const snapshots: { actual: MatchState; copy: MatchState }[] = [];
    while (state.phase === 'combat') {
      snapshots.push({ actual: freeze(state), copy: structuredClone(state) });
      state = stepMatch(state).state;
      expect(state.preparation).toEqual(prep.preparation);
      expect(state.shop).toBe(prep.shop);
      expect(state.rngState).toBe(prep.rngState);
      expect(state.nextUnitSerial).toBe(prep.nextUnitSerial);
      expect(state.gold).toBe(prep.gold + (state.phase === 'settlement' ? 5 : 0));
    }
    expect(prep).toEqual(original);
    for (const snapshot of snapshots) expect(snapshot.actual).toEqual(snapshot.copy);
  });

  it('retains purchases and positions, never resurrects sales, and rebuilds fresh combat for five rounds', () => {
    let state = accepted(buyUnit(deployed(), 0, 1));
    state = accepted(deployMatchUnit(state, 'unit-6', { kind: 'board', cell: { col: 3, row: 6 } }));
    state = accepted(sellUnit(state, 'unit-4'));
    const owned = structuredClone(state.preparation);
    const results: CombatResult[] = [];
    for (let round = 1; round <= 5; round++) {
      const started = accepted(startMatchCombat(freeze(state)));
      expect(started.combat).toEqual(createCombat(owned));
      expect(started.combat!.units.every(unit => unit.alive && unit.hp === unit.maxHp && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0 && unit.targetId === null)).toBe(true);
      const settled = finish(started);
      results.push(settled.combat!.result!);
      state = accepted(nextRound(freeze(settled), round));
      expect(state.preparation).toEqual(owned);
      expect(state.combat).toBeNull();
      expect(state.preparation.units.some(unit => unit.id === 'unit-4')).toBe(false);
    }
    expect(state.round).toBe(6);
    expect(state.gold).toBe(10 - 3 + 2 + 5 * 5);
    expect(state.roundResults.map(record => record.result)).toEqual(results);
    expect(state.roundResults.map(record => record.round)).toEqual([1, 2, 3, 4, 5]);
  });
});

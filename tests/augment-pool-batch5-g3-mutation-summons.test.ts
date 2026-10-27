import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, proposeSettlement, resolveTwoSidedBattle, restoreBattleInput, startTwoSidedCombatWithEvents } from '../src/simulation/two-sided-battle';

/** Formal opening army: the earliest Black Rose is an emblem Experiment on the sacrifice square.
 * Lexical order and input order both disagree with acquisition order. */
function roseArmy(): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('3-2');
  const names = ['morgana', 'vladimir', 'cassiopeia', 'zyra', 'urgot'];
  const ids = ['unit-2', 'unit-10', 'unit-11', 'unit-12', 'unit-13'];
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    augments: [{ definitionId: 'natural-selection', choiceId: 'round:3-2:augment', acquiredRound: round.ordinal }],
    items: [{ id: 'item-1', definitionId: 'TFT13_Item_ExperimentEmblemItem', location: { kind: 'unit', unitId: 'unit-2', slot: 0 } }],
    preparation: { ...base.preparation, units: names.map((definitionId, i) => ({ id: ids[i], definitionId, team: 'player' as const, starLevel: 1 as const,
      location: { kind: 'board' as const, cell: i === 0 ? { col: 3, row: 6 } : { col: i, row: 7 } } })).reverse() } };
}
function opponent(): MatchState {
  const state = roseArmy();
  return { ...state, augments: [], items: [], preparation: { ...state.preparation, units: [
    { id: 'unit-1', definitionId: 'garen', team: 'player', starLevel: 3, location: { kind: 'board', cell: { col: 3, row: 4 } } },
  ] } };
}

describe('G3 sacrifice preserves the compiled Black Rose summon identity', () => {
  it('single-side construction creates the one compiled Sion and never spawns or kills its sacrificed namesake', () => {
    const state = roseArmy(), enemy = opponent().preparation.units[0];
    const preparation = { ...state.preparation, units: [...state.preparation.units, { ...enemy, id: 'enemy', team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 0 } } }] };
    const input = { ...state, preparation }, before = structuredClone(input), strategy = buildStrategySnapshot(input);
    expect(strategy.traits.find(t => t.team === 'player' && t.traitId === 'black-rose')?.tier).toBe(3);
    expect(strategy.units.filter(u => u.unitId.endsWith(':g23-sion')).map(u => u.unitId)).toEqual(['unit-2:g23-sion']);
    const start = createCombatWithEvents(preparation, strategy, 'solo-rose-sacrifice', 42);
    expect(start.state.units.filter(u => u.definitionId === 'g23-sion').map(u => u.id)).toEqual(['unit-2:g23-sion']);
    expect(start.state.units.some(u => u.id === 'unit-2')).toBe(false);
    expect(start.events.flatMap(e => e.type === 'unitSpawned' && e.definitionId === 'g23-sion' ? [e.unitId] : [])).toEqual(['unit-2:g23-sion']);
    expect(start.events.some(e => e.type === 'death')).toBe(false);
    expect(stepCombat(JSON.parse(JSON.stringify(start.state)))).toEqual(stepCombat(start.state));
    expect(input).toEqual(before);
  });

  it.each(['left', 'right', 'both', 'mirror'] as const)('%s online battle retains exactly one compiled Sion per Rose army through settlement', mode => {
    const a = snapshotForBattle(mode === 'right' ? opponent() : roseArmy(), 'A');
    const b = snapshotForBattle(mode === 'left' ? opponent() : roseArmy(), 'B');
    const input = compileBattle(a, b, 42, { battleId: `rose-sacrifice-${mode}`, ...(mode === 'mirror' ? { mirrorOfSeatId: 'B' } : {}) });
    const before = structuredClone(input), compiledIds = input.strategy.units.filter(u => u.unitId.endsWith(':g23-sion')).map(u => u.unitId).sort();
    expect(compiledIds).toHaveLength(mode === 'both' || mode === 'mirror' ? 2 : 1);
    const donors = input.mapping.filter(m => m.originalId === 'unit-2').map(m => m.combatId);
    expect(compiledIds).toEqual(donors.map(id => id + ':g23-sion').sort());
    const start = startTwoSidedCombatWithEvents(input);
    expect(start.state.units.filter(u => u.definitionId === 'g23-sion').map(u => u.id).sort()).toEqual(compiledIds);
    expect(start.events.flatMap(e => e.type === 'unitSpawned' && e.definitionId === 'g23-sion' ? [e.unitId] : []).sort()).toEqual(compiledIds);
    expect(start.state.units.some(u => donors.includes(u.id))).toBe(false);
    const result = resolveTwoSidedBattle(input, 1201);
    expect(result.terminal.status).toBe('finished');
    expect(result.terminal.units.filter(u => u.definitionId === 'g23-sion').map(u => u.id).sort()).toEqual(compiledIds);
    expect(result.events.some(e => e.type === 'death' && donors.includes(e.unitId))).toBe(false);
    const proposals = proposeSettlement(result);
    expect(proposeSettlement(JSON.parse(JSON.stringify(result)))).toEqual(proposals);
    expect([result.a, result.b].every(s => s.survivors.every(u => u.unitId !== 'unit-2'))).toBe(true);
    if (mode === 'mirror') expect(proposals.b).toMatchObject({ settlementEligible: false, damage: 0, growth: [] });
    expect(restoreBattleInput(JSON.stringify(input))).toEqual(input);
    expect(input).toEqual(before);
  });
});

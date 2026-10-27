import { expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { readCombatStrategyInputs } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, restoreBattleInput, startTwoSidedCombat } from '../src/simulation/two-sided-battle';

// Controlled holders isolate the already-promoted source; Hall remains naturally banned.
it.each(['cloning-facility', 'hall-of-mirrors'])('%s copies Singed four-star with the 14.24b reduction of 6000 Bps on both online sides', id => {
  const base = createMatch(42), round = getCatalogRoundById('5-1');
  const state: MatchState = { ...base, level: 2, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    augments: [{ definitionId: id, choiceId: 'fixture-r3', acquiredRound: 4 }],
    preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId: 'singed', team: 'player', starLevel: 3,
        location: { kind: 'board', cell: { col: 3, row: id === 'cloning-facility' ? 6 : 4 } } },
      { id: 'unit-2', definitionId: 'darius', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 2, row: 4 } } },
    ] }, items: [], anomalyBinding: { definitionId: 'ultimate-hero', unitId: 'unit-1', choiceId: 'fixture-anomaly', boundRound: 20 },
    d14: { choiceId: 'fixture-anomaly', anomalyId: 'ultimate-hero', unitId: 'unit-1', atOrdinal: 20,
      selectionPrefixLength: 1, phase: 'promoted', held: null,
      originalUnit: { id: 'unit-1', definitionId: 'singed', team: 'player', starLevel: 3,
        location: { kind: 'board', cell: { col: 3, row: id === 'cloning-facility' ? 6 : 4 } } } } };
  const d14Combat = { unitId: 'unit-1', anomalyId: 'ultimate-hero' as const, phase: 'promoted' as const };
  const inputs = { ...readCombatStrategyInputs(state), d14Combat };
  const original = buildStrategySnapshot({ ...inputs, augments: [] }).units.find(u => u.unitId === 'unit-1')!;
  expect(original.ability).toMatchObject({ championId: 'singed', variables: { DR: 6000 } });
  const strategy = buildStrategySnapshot(inputs);
  const copies = strategy.units.filter(u => u.itemSummon?.kind === 'cloning-facility' || u.r3Mirror);
  expect(copies).toHaveLength(id === 'cloning-facility' ? 1 : 2);
  for (const copy of copies) {
    expect(copy.effectiveStarLevel).toBe(4);
    expect(copy.ability).toEqual(original.ability);
    expect(copy.sources.some(s => s.source.sourceKind === 'anomaly')).toBe(false);
  }
  const local = createCombatWithEvents(inputs.preparation, strategy, 'r3-singed', 42).state;
  expect(local.units.filter(u => u.definitionId === 'singed').every(u => u.ability.kind === 's13' && u.ability.variables.DR === 6000)).toBe(true);
  const input = compileBattle({ ...snapshotForBattle(state, 'A'), d14Combat }, { ...snapshotForBattle(state, 'B'), d14Combat }, 42);
  expect(restoreBattleInput(JSON.stringify(input))).toEqual(input);
  const combat = startTwoSidedCombat(input);
  for (const team of ['player', 'enemy']) {
    const onlineCopies = combat.units.filter(u => u.team === team && (u.itemSummon?.kind === 'cloning-facility' || u.r3Mirror));
    expect(onlineCopies).toHaveLength(copies.length);
    for (const copy of onlineCopies) {
      expect(copy.effectiveStarLevel).toBe(4);
      expect(copy.ability).toEqual(original.ability);
      expect(copy.ability).toMatchObject({ variables: { DR: 6000 } });
    }
  }
});

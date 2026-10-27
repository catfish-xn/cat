import { expect, it } from 'vitest';
import { selectChoice, nextRound, type MatchState } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accepted, reachRound } from './match-helpers';
import type { MatchState } from '../src/simulation/match-types';

it.each([['pumping-up-i', 50], ['pumping-up-ii', 0], ['pumping-up-iii', 0]] as const)(
  '%s current project behavior across a real 2-4 supply settlement', (id, expectedGrowth) => {
    const before = reachRound('2-4', false);
    const state = { ...before, preparation: { ...before.preparation, units: before.preparation.units.map(u => u.id === 'unit-1' ? { ...u, location: { kind: 'board' as const, cell: { col: 0, row: 6 } } } : u) }, augments: [{ definitionId: id, choiceId: 'test', acquiredRound: 4 }],
      augmentProgress: { pumpingRounds: 3, investmentHp: 0 } };
    const choice = state.pendingChoice!;
    const settled = accepted(selectChoice(state, choice.choiceId, choice.generation, choice.offers[0]));
    expect(settled.roundResults.at(-1)?.result).toBe('supply');
    const next = accepted(nextRound(settled, settled.round));
    const speed = (s: MatchState) => buildStrategySnapshot(s).units.find(u => u.unitId === 'unit-1')!.stats.attackSpeedBonusBps!;
    expect(speed(next) - speed(state)).toBe(expectedGrowth);
    if (id === 'pumping-up-i') expect(settled.augmentProgress.pumpingRounds).toBe(4);
  });

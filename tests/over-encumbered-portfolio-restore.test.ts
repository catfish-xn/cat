import { beforeAll, describe, expect, it } from 'vitest';
import { buyUnit, nextRound, selectChoice, startMatchCombat, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, fieldBench, finish, reachRoundFielded, resolveM5Choices } from './match-helpers';

describe('seed 1558: Over-Encumbered and Diversified Portfolio+ survive round entry and restore', () => {
  let state: MatchState;
  const choose = (id: string) => {
    const choice = state.pendingChoice!;
    expect(choice.kind).toBe('augment');
    expect(choice.offers).toContain(id);
    state = accepted(selectChoice(state, choice.choiceId, choice.generation, id));
  };
  beforeAll(() => {
    state = reachRoundFielded('2-1', 1558);
    choose('over-encumbered');
  });

  for (let subround = 1; subround <= 7; subround++) {
    it(`builds real reserves during 2-${subround}`, () => {
      expect(state.roundDefinitionId).toBe(`2-${subround}`);
      state = resolveM5Choices(state);
      if (state.phase === 'preparation') {
        for (let slot = 0; slot < state.shop.slots.length; slot++) {
          if (state.preparation.units.filter(u => u.location.kind === 'bench').length >= 5) break;
          const bought = buyUnit(state, slot, state.shop.generation);
          if (bought.ok) state = bought.state;
        }
        state = finish(accepted(startMatchCombat(fieldBench(state))));
      }
      state = accepted(nextRound(resolveM5Choices(state), state.round));
    });
  }

  for (let subround = 1; subround <= 7; subround++) {
    let original: MatchState, serialized: string;
    it(`settles 3-${subround} with both capacity and portfolio history intact`, () => {
      expect(state.roundDefinitionId).toBe(`3-${subround}`);
      if (subround === 2) choose('diversified-portfolio-plus');
      state = resolveM5Choices(state);
      expect(state.preparation.usableBenchSlots).toBe(1);
      expect(state.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
      if (subround >= 2) {
        expect(state.augments.map(a => a.definitionId)).toEqual(['over-encumbered', 'diversified-portfolio-plus']);
      }
      if (state.phase === 'preparation') state = finish(accepted(startMatchCombat(state)));
      state = resolveM5Choices(state);
      expect(state.phase).toBe('settlement');
      expect(state.roundResults.at(-1)?.roundId).toBe(`3-${subround}`);
      if (subround === 7) {
        expect(state.preparation.usableBenchSlots).toBeUndefined();
        expect(state.preparation.overflowUnitIds).toBeUndefined();
      }
    });
    // Keep each authenticated operation within the existing per-case timeout.
    it(`serializes the 3-${subround} settlement`, () => {
      original = state;
      serialized = serializeMatch(state);
      expect(typeof serialized).toBe('string');
    });
    it(`restores the 3-${subround} settlement`, () => {
      state = restoreMatch(serialized);
      expect(state).toEqual(original);
    });
    it(`preserves the serialized 3-${subround} settlement exactly`, () => {
      expect(serializeMatch(state)).toBe(serialized);
    });
    if (subround < 7) it(`continues the restored 3-${subround} settlement identically`, () => {
      const continued = nextRound(original, original.round);
      const resumed = nextRound(state, state.round);
      expect(resumed).toEqual(continued);
      state = accepted(resumed);
      expect(state.roundDefinitionId).toBe(`3-${subround + 1}`);
    });
  }
});

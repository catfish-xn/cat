import { deepStrictEqual } from 'node:assert';
import { expect, it } from 'vitest';
import { accepted, reachRound } from '../match-helpers';
import { deployMatchUnit, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';

// Public-command reproduction from review A. No injected resources or combat inputs.
function checkpoint(): MatchState {
  // Pool integration shifted review A's seed-1 offer; seed 6 offers Corrosion directly.
  let state = reachRound('3-2', false, 6);
  const choice = state.pendingChoice!;
  expect(choice.offers).toContain('corrosion');
  state = accepted(selectChoice(state, choice.choiceId, choice.generation, 'corrosion'));
  const unit = state.preparation.units.find(u => u.team === 'player')!;
  state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: 3, row: 4 } }));
  state = accepted(startMatchCombat(state));
  while (state.phase === 'combat' && state.combat!.tick < 40) state = stepMatch(state).state;
  expect(state.phase).toBe('combat');
  expect(state.combat!.tick).toBe(40);
  expect(state.combat!.units.flatMap(u => u.mechanismState?.statuses ?? [])
    .flatMap(g => g.contributions).filter(c => c.source.definitionId === 'corrosion')).toHaveLength(10);
  return state;
}

it('Corrosion: legitimate tick-40 saves round-trip through all entries and preserve the tick-81 suffix', () => {
  const legal = checkpoint();
  const restored = [restoreMatch(legal), restoreMatch(JSON.stringify(legal)), restoreMatch(serializeMatch(legal))];
  for (const state of restored) deepStrictEqual(state, legal);
  let expected = legal;
  while (expected.phase === 'combat' && expected.combat!.tick < 81) expected = stepMatch(expected).state;
  expect(expected.combat!.tick).toBe(81);
  for (let state of restored) {
    while (state.phase === 'combat' && state.combat!.tick < 81) state = stepMatch(state).state;
    deepStrictEqual(state, expected);
  }
});

it.each(['deletion', 'addition', 'wrong target', 'wrong source'] as const)(
  'Corrosion: rejects %s in object restore, JSON restore and serializeMatch', mutation => {
    const bad = structuredClone(checkpoint());
    const units = bad.combat!.units;
    if (mutation === 'deletion') {
      // Remove both projections together, exactly as in the accepted review exploit.
      for (const unit of units) {
        Object.assign(unit, { statuses: unit.statuses!.filter(s => s.source.definitionId !== 'corrosion') });
        if (unit.mechanismState) Object.assign(unit.mechanismState, {
          statuses: unit.mechanismState.statuses.map(g => ({ ...g,
            contributions: g.contributions.filter(c => c.source.definitionId !== 'corrosion'),
          })).filter(g => g.contributions.length > 0),
        });
      }
    } else {
      const unit = units.find(u => u.mechanismState?.statuses.some(g => g.contributions.some(c => c.source.definitionId === 'corrosion')))!;
      const group = unit.mechanismState!.statuses.find(g => g.contributions.some(c => c.source.definitionId === 'corrosion'))!;
      const contribution = group.contributions.find(c => c.source.definitionId === 'corrosion')!;
      const legacy = unit.statuses!.find(s => s.key === contribution.key)!;
      expect(legacy).toBeDefined();
      const source = mutation === 'wrong source'
        ? { ...contribution.source, ownerId: units.find(u => u.id !== contribution.source.ownerId)!.id }
        : contribution.source;
      const targetId = mutation === 'wrong target' ? units.find(u => u.id !== unit.id)!.id : contribution.targetId;
      // Keep source, target and legacy key references internally consistent. The replay
      // must bind them to history, rather than merely trusting a well-formed identity.
      const tuple = JSON.parse(contribution.key);
      tuple[1] = source.ownerId;
      tuple[7] = targetId;
      if (mutation === 'addition') tuple[8] = JSON.stringify(['corrosion', 40, 2]);
      const key = JSON.stringify(tuple);
      const forged = { ...contribution, source, targetId, key };
      const projection = { ...legacy, source: { ...legacy.source, ownerId: source.ownerId }, key, contributionKeys: [key] };
      Object.assign(group, {
        contributions: mutation === 'addition' ? [...group.contributions, forged]
          : group.contributions.map(c => c === contribution ? forged : c),
        effectiveSourceKey: group.effectiveSourceKey === contribution.key && mutation !== 'addition' ? key : group.effectiveSourceKey,
      });
      Object.assign(unit, { statuses: mutation === 'addition' ? [...unit.statuses!, projection]
        : unit.statuses!.map(s => s === legacy ? projection : s) });
    }
    // Exact-replay rejection ensures these fail at the full-set authority boundary.
    expect(() => restoreMatch(bad)).toThrow(/Invalid authoritative .* replay/);
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow(/Invalid authoritative .* replay/);
    expect(() => serializeMatch(bad)).toThrow(/Invalid authoritative .* replay/);
  },
);

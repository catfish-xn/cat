import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, moveItemSummon, readItemSummons, sellUnit, startMatchCombat } from '../src/simulation/match';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { readItemSummonPositions } from '../src/simulation/g2-4b-voidspawn';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';

/** A saved Hextech Forge cell lives as long as its Jayce: selling him or a star-up consuming him drops the key. */
function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
const grant = (state: MatchState, receiptId: string) => accepted(grantMechanicUnit(state, { receiptId, source: 'test', definitionId: 'jayce' }));
const jayces = (state: MatchState) => state.preparation.units.filter(u => u.definitionId === 'jayce');
function roundtrip(state: MatchState) {
  const restored = restoreMatch(serializeMatch(state));
  expect(restored).toEqual(state);
  return restored;
}
function setup() {
  let state = accepted(deployMatchUnit(createMatch(42), 'unit-1', { kind: 'bench', slot: 8 }));
  state = grant(state, 'keys:jayce');
  const ownerId = jayces(state)[0].id;
  state = accepted(deployMatchUnit(state, ownerId, { kind: 'board', cell: { col: 3, row: 5 } }));
  state = accepted(moveItemSummon(state, ownerId, { col: 6, row: 7 }));
  return { state, ownerId };
}

describe('Hextech Forge position keys follow their Jayce', () => {
  it('drops the key when Jayce is sold; a later Jayce starts from its default cell', () => {
    const { state, ownerId } = setup();
    const sold = roundtrip(accepted(sellUnit(state, ownerId)));
    expect(readItemSummonPositions(sold)).toBeUndefined();
    const born = grant(sold, 'keys:replacement');
    const replacement = jayces(born)[0];
    const deployed = accepted(deployMatchUnit(born, replacement.id, { kind: 'board', cell: { col: 1, row: 4 } }));
    expect(readItemSummons(deployed).map(s => s.unit.location)).toEqual([{ kind: 'board', cell: { col: 1, row: 5 } }]);
  });

  it("drops a consumed Jayce's key on a star-up and keeps the survivor's own", () => {
    let { state, ownerId } = setup();
    state = accepted(deployMatchUnit(state, ownerId, { kind: 'bench', slot: 4 }));
    state = grant(state, 'keys:second');
    const survivor = jayces(state).find(u => u.id !== ownerId)!;
    state = accepted(deployMatchUnit(state, survivor.id, { kind: 'board', cell: { col: 1, row: 4 } }));
    state = accepted(moveItemSummon(state, survivor.id, { col: 0, row: 6 }));
    expect(Object.keys(readItemSummonPositions(state)!).sort()).toEqual([ownerId, survivor.id].sort());
    state = roundtrip(grant(state, 'keys:third'));
    expect(jayces(state)).toMatchObject([{ id: survivor.id, starLevel: 2 }]);
    expect(readItemSummonPositions(state)).toEqual({ [survivor.id]: { col: 0, row: 6 } });
    const combat = accepted(startMatchCombat(state)).combat!;
    expect(combat.units.filter(u => u.definitionId === 'g23-forge')).toMatchObject([{ id: `${survivor.id}:g23-forge`, cell: { col: 0, row: 6 } }]);
  });

  it('keeps the key while Jayce is benched or survives a star-up', () => {
    const { state, ownerId } = setup();
    const benched = roundtrip(accepted(deployMatchUnit(state, ownerId, { kind: 'bench', slot: 4 })));
    expect(readItemSummonPositions(benched)).toEqual({ [ownerId]: { col: 6, row: 7 } });
    const upgraded = roundtrip(grant(grant(state, 'keys:second'), 'keys:third'));
    expect(jayces(upgraded)).toMatchObject([{ id: ownerId, starLevel: 2 }]);
    expect(readItemSummonPositions(upgraded)).toEqual({ [ownerId]: { col: 6, row: 7 } });
  });

  it('leaves the state untouched when nothing is stale', () => {
    const { state, ownerId } = setup();
    const moved = accepted(deployMatchUnit(state, ownerId, { kind: 'board', cell: { col: 2, row: 5 } }));
    expect(readItemSummonPositions(moved)).toBe(readItemSummonPositions(state));
  });
});

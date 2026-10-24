import { describe, expect, it } from 'vitest';
import {
  createMatch, deployMatchUnit, equipItem, moveItemSummon, readItemSummons,
  sellUnit, startMatchCombat, lockMatchCombatRoster,
} from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { readItemSummonPositions } from '../src/simulation/g2-4b-voidspawn';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { snapshotForBattle, compileBattle, startTwoSidedCombat, enableMultiplayerSettlement } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { projectG23Summons } from '../src/simulation/g2-3-summons';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function grant(state: MatchState, receiptId: string): MatchState {
  return accepted(grantMechanicUnit(state, { receiptId, source: 'test', definitionId: 'jayce' }));
}
function setup() {
  let state = accepted(deployMatchUnit(createMatch(42), 'unit-1', { kind: 'bench', slot: 8 }));
  state = grant(state, 'review:jayce');
  const ownerId = state.preparation.units.find(u => u.definitionId === 'jayce')!.id;
  state = accepted(deployMatchUnit(state, ownerId, { kind: 'board', cell: { col: 3, row: 5 } }));
  state = accepted(moveItemSummon(state, ownerId, { col: 6, row: 7 }));
  return { state, ownerId };
}
function roundtrip(state: MatchState) {
  const restored = restoreMatch(serializeMatch(state));
  expect(restored).toEqual(state);
  expect(readItemSummons(restored)).toEqual(readItemSummons(state));
  return restored;
}
function pvp(state: MatchState) {
  const round = getCatalogRoundById('2-1');
  // Boundary fixture: battle snapshots validate PvP inputs, not the preceding PvE route.
  return { ...state, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...state.m8, round } };
}
function assertAbsent(state: MatchState, id: string) {
  expect(readItemSummons(state).some(s => s.ownerId === id)).toBe(false);
  expect(moveItemSummon(state, id, { col: 0, row: 7 })).toEqual({ ok: false, state, reason: 'unknown-unit' });
  expect(snapshotForBattle(pvp(state), 'A').itemSummonPositions?.[id]).toBeUndefined();
}

describe('v22 review #434: forge owner lifetime and command boundaries', () => {
  it('retains a harmless key after selling Jayce: no projection, command, snapshot or later-owner inheritance', () => {
    const { state, ownerId } = setup();
    const sold = roundtrip(accepted(sellUnit(state, ownerId)));
    expect(readItemSummonPositions(sold)).toEqual({ [ownerId]: { col: 6, row: 7 } });
    assertAbsent(sold, ownerId);
    const born = grant(sold, 'review:replacement');
    const replacement = born.preparation.units.find(u => u.definitionId === 'jayce')!;
    expect(replacement.id).not.toBe(ownerId);
    const deployed = roundtrip(accepted(deployMatchUnit(born, replacement.id, { kind: 'board', cell: { col: 1, row: 4 } })));
    expect(readItemSummons(deployed)).toHaveLength(1);
    expect(readItemSummons(deployed)[0].unit.location).toEqual({ kind: 'board', cell: { col: 1, row: 5 } });
    expect(startMatchCombat(deployed).state.combat!.units.some(u => u.id === `${ownerId}:g23-forge`)).toBe(false);
  });

  it('retains a harmless consumed-owner key after a star-up; survivor uses its own default cell', () => {
    let { state, ownerId } = setup();
    state = accepted(deployMatchUnit(state, ownerId, { kind: 'bench', slot: 4 }));
    state = grant(state, 'review:second');
    const survivor = state.preparation.units.find(u => u.definitionId === 'jayce' && u.id !== ownerId)!;
    state = accepted(deployMatchUnit(state, survivor.id, { kind: 'board', cell: { col: 1, row: 4 } }));
    state = roundtrip(grant(state, 'review:third'));
    expect(state.preparation.units.filter(u => u.definitionId === 'jayce')).toMatchObject([{ id: survivor.id, starLevel: 2 }]);
    expect(readItemSummonPositions(state)).toEqual({ [ownerId]: { col: 6, row: 7 } });
    assertAbsent(state, ownerId);
    expect(readItemSummons(state)).toHaveLength(1);
    expect(readItemSummons(state)[0].unit.location).toEqual({ kind: 'board', cell: { col: 1, row: 5 } });
    const combat = accepted(startMatchCombat(state)).combat!;
    expect(combat.units.filter(u => u.definitionId === 'g23-forge')).toMatchObject([{ id: `${survivor.id}:g23-forge`, cell: { col: 1, row: 5 } }]);
  });

  it('keeps the saved cell when the positioned Jayce survives a star-up', () => {
    const initial = setup();
    const state = roundtrip(grant(grant(initial.state, 'review:second'), 'review:third'));
    expect(state.preparation.units.find(u => u.id === initial.ownerId)?.starLevel).toBe(2);
    expect(readItemSummons(state)).toHaveLength(1);
    expect(readItemSummons(state)[0].unit.location).toEqual({ kind: 'board', cell: { col: 6, row: 7 } });
  });

  it('rejects bench, sale and equipment commands for the forge body atomically', () => {
    let { state } = setup();
    state = accepted(grantMechanicItem(state, { receiptId: 'review:item', source: 'test', definitionId: 'sword' }));
    const forge = readItemSummons(state)[0].unit;
    const before = serializeMatch(state);
    for (const result of [
      deployMatchUnit(state, forge.id, { kind: 'bench', slot: 0 }),
      sellUnit(state, forge.id), equipItem(state, state.items.at(-1)!.id, forge.id, 0),
    ]) {
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
      expect('events' in result).toBe(false);
    }
    expect(serializeMatch(state)).toBe(before);
    expect(state.preparation.units.some(u => u.id === forge.id)).toBe(false);
  });

  it('rejects position changes after roster lock and after combat starts', () => {
    const { state, ownerId } = setup();
    for (const frozen of [accepted(lockMatchCombatRoster(accepted(enableMultiplayerSettlement(pvp(state), 'A')))), accepted(startMatchCombat(state))]) {
      expect(moveItemSummon(frozen, ownerId, { col: 0, row: 7 })).toEqual({ ok: false, state: frozen, reason: 'wrong-phase' });
    }
  });

  it('restores a benched owner and its saved position, then deploys at that position', () => {
    const { state, ownerId } = setup();
    const benched = roundtrip(accepted(deployMatchUnit(state, ownerId, { kind: 'bench', slot: 4 })));
    assertAbsent(benched, ownerId);
    const deployed = roundtrip(accepted(deployMatchUnit(benched, ownerId, { kind: 'board', cell: { col: 0, row: 4 } })));
    expect(readItemSummons(deployed)[0].unit.location).toEqual({ kind: 'board', cell: { col: 6, row: 7 } });
    roundtrip(accepted(startMatchCombat(deployed)));
  });

  it('keeps asymmetric seat positions separate despite identical local unit IDs, and mirrors the upper seat', () => {
    const a = setup(), b = setup();
    const other = accepted(moveItemSummon(b.state, b.ownerId, { col: 0, row: 6 }));
    const sa = snapshotForBattle(pvp(a.state), 'A'), sb = snapshotForBattle(pvp(other), 'B');
    const combat = startTwoSidedCombat(compileBattle(sa, sb, 77));
    expect(combat.units.filter(u => u.definitionId === 'g23-forge').map(u => [u.team, u.cell])).toEqual(expect.arrayContaining([
      ['player', { col: 6, row: 7 }], ['enemy', { col: 0, row: 1 }],
    ]));
    expect(combat.units.filter(u => u.definitionId === 'g23-forge')).toHaveLength(2);
  });

  it('places a saved forge before Sion, but preserves the legacy order without a saved cell (P-F6)', () => {
    const base = createMatch(42).preparation;
    const preparation = { ...base, units: [
      { id: 'unit-2', definitionId: 'jayce', team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: 0, row: 5 } } },
      { id: 'unit-3', definitionId: 'morgana', team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: 0, row: 4 } } },
    ] };
    const traits = [{ team: 'player' as const, traitId: 'black-rose', tier: 3, count: 3, memberDefinitionIds: ['morgana'], memberUnitIds: ['unit-3'], targetUnitIds: [] }];
    const summons = (positions?: Record<string, { col: number; row: number }>) => projectG23Summons(preparation, traits, positions).units.slice(2);
    expect(summons().map(u => u.definitionId)).toEqual(['g23-sion', 'g23-forge']);
    expect(summons({ 'unit-2': { col: 3, row: 4 } }).map(u => u.definitionId)).toEqual(['g23-forge', 'g23-sion']);
    expect(summons({ 'unit-2': { col: 3, row: 4 } })[0].location).toEqual({ kind: 'board', cell: { col: 3, row: 4 } });
    expect(summons()[0].location).toEqual({ kind: 'board', cell: { col: 3, row: 4 } });
    expect(summons({ 'unit-2': { col: 3, row: 4 } })[1].location).not.toEqual({ kind: 'board', cell: { col: 3, row: 4 } });
  });
});

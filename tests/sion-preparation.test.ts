import { describe, expect, it } from 'vitest';
import { buyXp, createMatch, deployMatchUnit, equipItem, moveItemSummon, nextRound, readItemSummons, sellUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { restoreBattleInput } from '../src/simulation/two-sided-battle';
import { readItemSummonPositions, validateItemSummonPositions } from '../src/simulation/g2-4b-voidspawn';
import { getPlayerDeploymentCount } from '../src/simulation/game';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedCombatWithEvents } from '../src/simulation/two-sided-battle';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { formationAction } from '../src/simulation/bot/formation';
import { accepted, sionPreparation } from './fixtures/sion-preparation';
import type { MatchState } from '../src/simulation/match-types';

const sion = (state: MatchState) => readItemSummons(state).find(s => s.kind === 'sion');
const move = (state: MatchState, cell = { col: 6, row: 7 }) => accepted(moveItemSummon(state, 'g23-sion', cell));

describe('user 2026-10-29: movable Black Rose Sion in preparation', () => {
  it('appears immediately at three distinct deployed Black Rose, costs no population/bench/assets and cannot be sold, benched or equipped', () => {
    const state = sionPreparation(), summon = sion(state)!;
    expect(summon).toMatchObject({ kind: 'sion', itemInstanceId: 'g23-sion', unit: { definitionId: 'g23-sion', location: { kind: 'board', cell: { col: 3, row: 4 } } } });
    expect(getPlayerDeploymentCount(state.preparation)).toBe(3);
    expect(state.level).toBe(3);
    expect(state.preparation.units.filter(u => u.team === 'player')).toHaveLength(4);
    expect(state.preparation.units.some(u => u.id === summon.unit.id)).toBe(false);
    expect(UNIT_DEFINITIONS['g23-sion'].summon).toEqual({ sellable: false, countsTowardPopulation: false });
    const withItem = accepted(grantMechanicItem(state, { receiptId: 'sion:sword', source: 'test', definitionId: 'sword' }));
    for (const result of [sellUnit(state, summon.unit.id), deployMatchUnit(state, summon.unit.id, { kind: 'bench', slot: 0 }), equipItem(withItem, withItem.items.at(-1)!.id, summon.unit.id, 0)]) {
      expect(result.ok).toBe(false);
    }
    expect(sellUnit(state, summon.unit.id).state).toBe(state);
    expect(deployMatchUnit(state, summon.unit.id, { kind: 'bench', slot: 0 }).state).toBe(state);
    expect(equipItem(withItem, withItem.items.at(-1)!.id, summon.unit.id, 0).state).toBe(withItem);
  });

  it('saves moves without changing resources/RNG/roster, rejects invalid moves atomically, and survives preparation and combat restore', () => {
    const state = sionPreparation(), moved = move(state);
    expect(sion(moved)!.unit.location).toEqual({ kind: 'board', cell: { col: 6, row: 7 } });
    expect(moved.preparation).toBe(state.preparation);
    expect(moved.items).toBe(state.items);
    expect({ ...moved, seatMechanics: state.seatMechanics }).toEqual(state);
    expect(restoreMatch(serializeMatch(moved))).toEqual(moved);
    const occupied = state.preparation.units.find(u => u.definitionId === 'morgana')!.location;
    for (const [id, cell, reason] of [
      ['g23-sion', { col: 0, row: 0 }, 'outside-deployment-zone'],
      ['g23-sion', { col: 0.5, row: 4 }, 'outside-deployment-zone'],
      ['g23-sion', occupied.kind === 'board' ? occupied.cell : { col: -1, row: -1 }, 'occupied'],
      ['other-seat:g23-sion', { col: 6, row: 7 }, 'unknown-unit'],
    ] as const) {
      const result = moveItemSummon(state, id, cell);
      expect(result).toMatchObject({ ok: false, reason }); expect(result.state).toBe(state);
    }
    expect(moveItemSummon(createMatch(42), 'g23-sion', { col: 6, row: 7 })).toMatchObject({ ok: false, reason: 'unknown-unit' });
    const started = accepted(startMatchCombat(moved));
    expect(started.combat!.units.filter(u => u.definitionId === 'g23-sion')).toMatchObject([{ cell: { col: 6, row: 7 } }]);
    expect(restoreMatch(serializeMatch(started))).toEqual(started);
    const result = moveItemSummon(started, 'g23-sion', { col: 5, row: 7 });
    expect(result).toMatchObject({ ok: false, reason: 'wrong-phase' }); expect(result.state).toBe(started);
  });

  it('hides below threshold, remembers the seat cell across a different owner, and resolves a newly occupied cell without overlap', () => {
    const moved = move(sionPreparation()), oldId = sion(moved)!.unit.id;
    const owner = moved.preparation.units.find(u => u.id === sion(moved)!.ownerId)!;
    const benched = accepted(deployMatchUnit(moved, owner.id, { kind: 'bench', slot: 0 }));
    expect(sion(benched)).toBeUndefined();
    const back = accepted(deployMatchUnit(benched, owner.id, { kind: 'board', cell: { col: 6, row: 7 } }));
    expect(sion(back)!.unit.location).not.toEqual({ kind: 'board', cell: { col: 6, row: 7 } });
    expect(readItemSummonPositions(back)).toEqual({ 'g23-sion': { col: 6, row: 7 } });
    const freed = accepted(deployMatchUnit(back, owner.id, { kind: 'board', cell: { col: 5, row: 6 } }));
    expect(sion(freed)!.unit.location).toEqual({ kind: 'board', cell: { col: 6, row: 7 } });
    const switched = { ...freed, preparation: { ...freed.preparation, units: freed.preparation.units.map(u => u.id === owner.id ? { ...u, id: 'unit-99' } : u) } };
    expect(sion(switched)!.unit.id).not.toBe(oldId);
    expect(sion(switched)!.unit.location).toEqual(sion(freed)!.unit.location);
  });

  it('counts Black Rose emblems in preparation and freezes the same chosen cell into both mirrored battle sides', () => {
    let state = sionPreparation();
    const morgana = state.preparation.units.find(u => u.definitionId === 'morgana')!;
    state = accepted(deployMatchUnit(state, morgana.id, { kind: 'bench', slot: 0 }));
    state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 3, row: 6 } }));
    expect(sion(state)).toBeUndefined();
    const emblem = Object.values(EMBLEM_ITEMS).find(i => i.emblemTrait === 'black-rose')!;
    state = accepted(grantMechanicItem(state, { receiptId: 'sion:emblem', source: 'test', definitionId: emblem.id }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, 'unit-1', 0));
    expect(sion(state)).toBeDefined();
    state = move(state);
    expect(restoreMatch(serializeMatch(accepted(startMatchCombat(state))))).toMatchObject({ phase: 'combat' });
    const round = getCatalogRoundById('2-1');
    const pvp = { ...state, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...state.m8, round } };
    const a = snapshotForBattle(pvp, 'A'), b = snapshotForBattle(pvp, 'B');
    expect(a.units.some(u => u.definitionId === 'g23-sion')).toBe(false);
    expect(a.itemSummonPositions).toEqual({ 'g23-sion': { col: 6, row: 7 } });
    expect(restorePlayerBattleSnapshot(a)).toEqual(a);
    const input = compileBattle(a, b, 7), started = startTwoSidedCombatWithEvents(input);
    expect(input.mapping.some(m => m.kind === 'item' && m.originalId === 'g23-sion')).toBe(false);
    expect(started.state.units.filter(u => u.definitionId === 'g23-sion').map(u => [u.team, u.cell])).toEqual(expect.arrayContaining([
      ['player', { col: 6, row: 7 }], ['enemy', { col: 6, row: 0 }],
    ]));
    expect(started.events.filter(e => e.type === 'unitSpawned' && e.definitionId === 'g23-sion')).toHaveLength(2);
    expect(started.events.filter(e => e.type === 'bindingChanged' && e.bound)).toHaveLength(2);
    const injected = structuredClone(a);
    (injected.units as unknown[]).push(sion(state)!.unit);
    expect(() => restorePlayerBattleSnapshot(injected)).toThrow('invalid-snapshot');
  });

  it('keeps position through the round boundary; the combat Sion is isolated from the next preparation projection', () => {
    const moved = move(sionPreparation());
    let state = accepted(startMatchCombat(moved));
    while (state.phase === 'combat') state = stepMatch(state).state;
    expect(state.phase).toBe('settlement');
    const next = accepted(nextRound(state, state.round));
    expect(next.combat).toBeNull();
    expect(sion(next)!.unit.location).toEqual({ kind: 'board', cell: { col: 6, row: 7 } });
    expect(next.preparation.units.some(u => u.definitionId === 'g23-sion')).toBe(false);
  });

  it.each([false, true])('reserves emblem-activated Sion before Jayce forge in both PvP halves (mirror=%s)', mirror => {
    let state = sionPreparation();
    const morgana = state.preparation.units.find(u => u.definitionId === 'morgana')!;
    state = accepted(deployMatchUnit(state, morgana.id, { kind: 'bench', slot: 0 }));
    state = accepted(grantMechanicUnit(state, { receiptId: 'sion:jayce', source: 'test', definitionId: 'jayce', immediate: true }));
    const jayce = state.preparation.units.find(u => u.definitionId === 'jayce')!;
    state = accepted(deployMatchUnit(state, jayce.id, { kind: 'board', cell: { col: 4, row: 5 } }));
    const emblem = Object.values(EMBLEM_ITEMS).find(i => i.emblemTrait === 'black-rose')!;
    state = accepted(grantMechanicItem(state, { receiptId: 'sion:jayce:emblem', source: 'test', definitionId: emblem.id }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, jayce.id, 0));
    state = move(state, { col: 5, row: 6 });
    state = accepted(deployMatchUnit(state, jayce.id, { kind: 'board', cell: { col: 5, row: 5 } }));
    expect(readItemSummons(state)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sion', unit: expect.objectContaining({ location: { kind: 'board', cell: { col: 5, row: 6 } } }) }),
      expect.objectContaining({ kind: 'forge', unit: expect.objectContaining({ location: { kind: 'board', cell: { col: 0, row: 4 } } }) }),
    ]));
    const pve = accepted(startMatchCombat(state));
    expect(pve.combat!.units.find(u => u.definitionId === 'g23-sion')!.cell).toEqual({ col: 5, row: 6 });
    expect(pve.combat!.units.find(u => u.definitionId === 'g23-forge')!.cell).toEqual({ col: 0, row: 4 });
    expect(restoreMatch(serializeMatch(pve))).toEqual(pve);
    const round = getCatalogRoundById('2-1');
    const pvp = { ...state, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...state.m8, round } };
    const input = compileBattle(snapshotForBattle(pvp, 'A'), snapshotForBattle(pvp, 'B'), 7,
      { battleId: 'sion-emblem-jayce', ...(mirror ? { mirrorOfSeatId: 'B' } : {}) });
    // Check the pre-combat projection itself: a late Sion repair must not move either summon.
    for (const [team, sionRow, forgeRow] of [['player', 6, 4], ['enemy', 1, 3]] as const) {
      expect(input.strategy.traits.find(t => t.team === team && t.traitId === 'black-rose')).toMatchObject({ count: 3, tier: 3 });
      for (const [definitionId, col, row] of [['g23-sion', 5, sionRow], ['g23-forge', 0, forgeRow]] as const) {
        expect(input.preparation.units.filter(u => u.team === team && u.definitionId === definitionId)).toMatchObject([
          { location: { kind: 'board', cell: { col, row } } },
        ]);
      }
    }
    expect(restoreBattleInput(input)).toEqual(input);
    const started = startTwoSidedCombatWithEvents(input);
    for (const unit of input.preparation.units.filter(u => ['g23-sion', 'g23-forge'].includes(u.definitionId))) {
      expect(started.state.units.find(u => u.id === unit.id)!.cell).toEqual(unit.location.kind === 'board' ? unit.location.cell : null);
    }
    expect(started.events.filter(e => e.type === 'unitSpawned' && e.definitionId === 'g23-sion')).toHaveLength(2);
    expect(started.events.filter(e => e.type === 'bindingChanged' && e.bound)).toHaveLength(2);
  });

  it.each(['cloning-facility', 'hall-of-mirrors'] as const)('uses the compiler membership for preparation Sion activated by %s', definitionId => {
    let state = sionPreparation();
    const morgana = state.preparation.units.find(u => u.definitionId === 'morgana')!;
    const vladimir = state.preparation.units.find(u => u.definitionId === 'vladimir')!;
    const cassiopeia = state.preparation.units.find(u => u.definitionId === 'cassiopeia')!;
    state = accepted(deployMatchUnit(state, morgana.id, { kind: 'bench', slot: 0 }));
    state = accepted(deployMatchUnit(state, vladimir.id, { kind: 'board', cell: { col: 3, row: definitionId === 'cloning-facility' ? 6 : 4 } }));
    if (definitionId === 'hall-of-mirrors') {
      state = accepted(deployMatchUnit(state, cassiopeia.id, { kind: 'board', cell: { col: 4, row: 4 } }));
      state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 2, row: 4 } }));
    }
    expect(sion(state)).toBeUndefined();
    state = { ...state, augments: [{ definitionId, choiceId: 'fixture-r3-sion', acquiredRound: state.round }] };
    const before = structuredClone(state);
    expect(buildStrategySnapshot(state).traits.find(t => t.team === 'player' && t.traitId === 'black-rose')).toMatchObject({ count: 3, tier: 3 });
    expect(sion(state)).toBeDefined();
    expect(state).toEqual(before);
    if (definitionId === 'cloning-facility') {
      const occupied = moveItemSummon(state, 'g23-sion', { col: 2, row: 5 });
      expect(occupied).toMatchObject({ ok: false, reason: 'occupied' });
      expect(occupied.state).toBe(state);
    }
    const moved = move(state, { col: 5, row: 6 }), strategy = buildStrategySnapshot(moved);
    expect(strategy.units.find(u => u.unitId === sion(moved)!.unit.id)).toMatchObject({ summonCell: { col: 5, row: 6 } });
    const started = accepted(startMatchCombat(moved));
    expect(started.combat!.units.filter(u => u.definitionId === 'g23-sion')).toMatchObject([
      { id: sion(moved)!.unit.id, cell: { col: 5, row: 6 } },
    ]);
    const disabled = { ...moved, augments: [] };
    expect(sion(disabled)).toBeUndefined();
    expect(buildStrategySnapshot(disabled).units.some(u => u.unitId.endsWith(':g23-sion'))).toBe(false);
    expect(readItemSummonPositions(disabled)).toEqual({ 'g23-sion': { col: 5, row: 6 } });
    expect(sion({ ...disabled, augments: moved.augments })!.unit.location).toEqual({ kind: 'board', cell: { col: 5, row: 6 } });
    if (definitionId === 'hall-of-mirrors') {
      const nonRoseCenter = accepted(deployMatchUnit(moved, 'unit-1', { kind: 'board', cell: { col: 3, row: 4 } }));
      expect(sion(nonRoseCenter)).toBeUndefined();
      expect(buildStrategySnapshot(nonRoseCenter).traits.find(t => t.team === 'player' && t.traitId === 'black-rose')).toMatchObject({ count: 0, tier: 0 });
    }
    // Shared combat occupancy must not expose copy-only forge keys that cannot survive position/snapshot validation.
    const copiedJayce = { ...state, preparation: { ...state.preparation,
      units: state.preparation.units.map(u => u.id === vladimir.id ? { ...u, definitionId: 'jayce' } : u) } };
    const forges = readItemSummons(copiedJayce).filter(s => s.kind === 'forge');
    expect(forges.map(s => s.itemInstanceId)).toEqual([vladimir.id]);
    const placedForge = accepted(moveItemSummon(copiedJayce, vladimir.id, { col: 6, row: 7 }));
    expect(() => validateItemSummonPositions(readItemSummonPositions(placedForge))).not.toThrow();
  });

  it('stays movable during the real 2-1 preparation augment window, while other choices remain closed', () => {
    let state = move(sionPreparation());
    while (state.round < getCatalogRoundById('2-1').ordinal) {
      state = accepted(startMatchCombat(state));
      while (state.phase === 'combat') state = stepMatch(state).state;
      state = accepted(nextRound(state, state.round));
    }
    expect(state).toMatchObject({ phase: 'choice', pendingChoice: { kind: 'augment', returnPhase: 'preparation' } });
    expect(moveItemSummon(state, 'g23-sion', { col: 5, row: 7 })).toMatchObject({ ok: true });
    const other = { ...state, pendingChoice: { ...state.pendingChoice!, kind: 'component' as const } } as MatchState;
    const result = moveItemSummon(other, 'g23-sion', { col: 5, row: 7 });
    expect(result).toMatchObject({ ok: false, reason: 'wrong-phase' }); expect(result.state).toBe(other);
  });

  it('bot formation converges with Sion projected after heroes; saved position is retained and no summon is benched or sold', () => {
    let state = move(sionPreparation());
    while (state.level < 4) state = accepted(buyXp(state));
    let moves = 0;
    for (; moves < 30; moves++) {
      const roster = state.preparation.units.filter(u => u.team === 'player');
      const action = formationAction(state, roster);
      if (!action) break;
      expect(action.type).toBe('deploy');
      if (action.type !== 'deploy') throw new Error('unexpected bot formation action');
      expect(action.unitId).not.toContain('g23-sion');
      state = accepted(deployMatchUnit(state, action.unitId, action.target));
    }
    expect(moves).toBeLessThan(30);
    expect(sion(state)).toBeDefined();
    const cells = [...state.preparation.units.filter(u => u.team === 'player'), sion(state)!.unit].flatMap(u => u.location.kind === 'board' ? [JSON.stringify(u.location.cell)] : []);
    expect(new Set(cells).size).toBe(cells.length);
    expect(readItemSummonPositions(state)).toEqual({ 'g23-sion': { col: 6, row: 7 } });
  });

  it('accepts only the exact Sion seat key and an integer own-board cell', () => {
    expect(() => validateItemSummonPositions({ 'g23-sion': { col: 6, row: 7 } }, 1, 1)).not.toThrow();
    for (const bad of [{ 'g23-sion-x': { col: 6, row: 7 } }, { 'g23-sion': { col: 1, row: 0 } }, { 'g23-sion': { col: 1.5, row: 4 } }]) {
      expect(() => validateItemSummonPositions(bad)).toThrow();
    }
  });
});

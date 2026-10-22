import { describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toCombatReplayFor, toPlayerView, toPublicBoard } from '../../src/server/room/projection';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import type { MatchState } from '../../src/simulation/match-types';
import { DamageResolver, expectUniqueRanking, makeRoom, runUntil } from './helpers';

describe('toPlayerView', () => {
  it('is a whitelist: no rule state, rng or other seats\' private data leaks', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const view = toPlayerView(room.state, 's1', clock.now());
    expect(Object.keys(view).sort()).toEqual(['carousel', 'fault', 'mySeatId', 'openingEncounter', 'opponentCandidates', 'opponentSeatId', 'phase', 'ranking', 'seats']);
    expect(view.fault).toBeNull();
    expect(view.phase).toEqual({ kind: 'preparation', round: 1, roundName: '1-2', endsAt: 1_000, serverNow: 0 });
    expect(view.seats).toHaveLength(8);
    expect(Object.keys(view.seats[0]!).sort()).toEqual(['alive', 'connected', 'controller', 'hp', 'kind', 'legend', 'level', 'name', 'orbs', 'publicBoard', 'rank', 'seatId']);
    // v15: unclaimed orbs show only as the rules' public count and tiers.
    for (const entry of view.seats) expect(Object.keys(entry.orbs!).sort()).toEqual(['count', 'tiers']);
    // `publicBoard` is the one public build (C5 + 2026-10-20 scouting); everything else stays private.
    const serialized = JSON.stringify({ ...view, seats: view.seats.map(({ publicBoard: _board, ...seat }) => seat) });
    for (const forbidden of ['rngState', 'seed', 'shop', 'units', 'gold', 'pendingChoice']) expect(serialized).not.toContain(forbidden);
    for (const forbidden of ['rngState', 'seed', 'shop', 'gold', 'pendingChoice', 'streak', 'xp', 'location', 'unit-', 'choiceId']) expect(JSON.stringify(view.seats.map(seat => seat.publicBoard))).not.toContain(forbidden);
    expect(view.opponentSeatId).toBeNull(); expect(view.ranking).toBeNull();
    expect(view.opponentCandidates).toEqual([]); // 1-2 is a PvE round
    expect(() => toPlayerView(room.state, 'ghost', 0)).toThrow(RangeError);
  });
  it('maps room phases to client phases and names the pvp opponent', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    expect(toPlayerView(room.state, 's0', 0).phase.kind).toBe('lobby');
    room.start();
    runUntil(room, clock, current => current.round === 4 && current.phase === 'preparation');
    // G1-P6: preparation names the candidates (seat order, alive, never me) and no opponent yet.
    const preparation = toPlayerView(room.state, 's0', clock.now());
    expect(preparation.opponentSeatId).toBeNull();
    expect(preparation.opponentCandidates).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
    clock.runNext();
    const view = toPlayerView(room.state, 's0', clock.now());
    expect(view.phase.kind).toBe('combat');
    expect(view.opponentSeatId).not.toBeNull(); expect(preparation.opponentCandidates).toContain(view.opponentSeatId);
    expect(view.opponentCandidates).toEqual([]);
    const back = toPlayerView(room.state, view.opponentSeatId!, clock.now());
    expect(back.opponentSeatId).toBe('s0');
    const replay = toCombatReplayFor(room.state, 's0');
    expect(replay).not.toBeNull();
    expect(replay!.replay.ticks.length).toBe(replay!.replay.terminal.tick + 1);
    expect(replay!.replay.ticks.every((frame, index) => frame.tick === index)).toBe(true);
    expect(toCombatReplayFor(room.state, 'ghost')).toBeNull();
  }, 20_000); // three PvE rounds tick by tick through the shared-pool wrapper (B5) before the first PvP, like its siblings
  it('publishes the final standings once the match ends', () => {
    const { room, clock } = makeRoom(new DamageResolver(seatId => seatId === 's5' ? 0 : 100, false));
    room.start(); clock.advance(1_000);
    expectUniqueRanking(room.state);
    const view = toPlayerView(room.state, 's5', clock.now());
    expect(view.phase.kind).toBe('ended'); expect(view.phase.endsAt).toBeNull();
    expect(view.ranking!.map(seat => seat.seatId)[0]).toBe('s5');
    expect(view.ranking!.map(seat => seat.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(view.seats.find(seat => seat.seatId === 's5')).toMatchObject({ hp: 100, alive: true, rank: 1 });
  });
});

describe('toPublicBoard (C5)', () => {
  it('shows my board and bench units with their item definitions, loose items and augments, never enemies, shop, gold, streak or ids', () => {
    const { room } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const base = room.state.seats[1]!.match;
    const [first, second] = Object.keys(ITEM_DEFINITIONS);
    const match = {
      ...base,
      preparation: { ...base.preparation, units: [
        ...base.preparation.units,
        { id: 'unit-90', definitionId: base.preparation.units[0]!.definitionId, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 5, row: 6 } } },
        { id: 'unit-91', definitionId: base.preparation.units[0]!.definitionId, team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } },
      ] },
      items: [
        { id: 'item-2', definitionId: second!, location: { kind: 'unit', unitId: 'unit-90', slot: 1 } },
        { id: 'item-1', definitionId: first!, location: { kind: 'unit', unitId: 'unit-90', slot: 0 } },
        { id: 'item-3', definitionId: first!, location: { kind: 'unit', unitId: 'unit-91', slot: 0 } },
        { id: 'item-4', definitionId: second!, location: { kind: 'inventory' } },
      ],
      augments: [{ definitionId: 'lineup', choiceId: 'choice-secret-1', acquiredRound: 5 }, { definitionId: 'backup', choiceId: 'choice-secret-2', acquiredRound: 12 }],
      streak: { kind: 'win', count: 4 },
      anomalyBinding: { definitionId: 'anomaly-public-test', unitId: 'unit-91', choiceId: 'choice-secret-3', boundRound: 20 },
    } as unknown as MatchState;
    const board = toPublicBoard(match);
    const deployed = base.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
    expect(board.units).toHaveLength(deployed.length + 1);
    expect(board.units.at(-1)).toEqual({ definitionId: base.preparation.units[0]!.definitionId, starLevel: 2, cell: { col: 5, row: 6 }, items: [first, second] });
    for (const unit of board.units) expect(Object.keys(unit).sort()).toEqual(['cell', 'definitionId', 'items', 'starLevel']);
    expect(Object.keys(board).sort()).toEqual(['augments', 'bench', 'looseItems', 'units']);
    const benched = base.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench');
    expect(board.bench).toHaveLength(benched.length + 1);
    expect(board.bench!.map(unit => unit.slot)).toEqual([...board.bench!.map(unit => unit.slot)].sort((a, b) => a - b));
    expect(board.bench!.find(unit => unit.slot === 0)).toEqual({ definitionId: base.preparation.units[0]!.definitionId, starLevel: 1, slot: 0, items: [first], anomaly: 'anomaly-public-test' });
    for (const unit of board.bench!) expect(Object.keys(unit).filter(key => key !== 'anomaly').sort()).toEqual(['definitionId', 'items', 'slot', 'starLevel']);
    expect([...board.units, ...board.bench!].filter(unit => 'anomaly' in unit)).toHaveLength(1);
    expect(board.looseItems).toEqual([second]);
    expect(board.augments).toEqual(['lineup', 'backup']);
    const text = JSON.stringify(board);
    for (const forbidden of ['unit-9', 'item-', 'choice-secret', 'acquiredRound', 'boundRound', 'unitId', 'streak', 'gold', 'shop', 'seed', 'rngState', 'pve-', 'enemy', 'inventory']) expect(text).not.toContain(forbidden);
  });
  it('marks a promoted 终极英雄 with effectiveStarLevel 4 only, never its sell gold, pool copies or countdown (V16-UI-251)', () => {
    const { room } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const base = room.state.seats[1]!.match, definitionId = base.preparation.units[0]!.definitionId;
    const hero = { id: 'unit-92', definitionId, team: 'player', starLevel: 3, location: { kind: 'board', cell: { col: 4, row: 6 } } } as const;
    const benched = { id: 'unit-93', definitionId, team: 'player', starLevel: 3, location: { kind: 'bench', slot: 1 } } as const;
    const promoted = (unitId: string, phase: string) => ({ ...base, preparation: { ...base.preparation, units: [...base.preparation.units, hero, benched] },
      d14: { choiceId: 'choice-secret-d14', anomalyId: 'ultimate-hero', originalUnit: hero, unitId, atOrdinal: 0, selectionPrefixLength: 1, phase, held: null } }) as unknown as MatchState;
    const onBoard = toPublicBoard(promoted('unit-92', 'promoted'));
    expect(onBoard.units.find(unit => unit.cell.col === 4 && unit.cell.row === 6)).toEqual({ definitionId, starLevel: 3, cell: { col: 4, row: 6 }, items: [], effectiveStarLevel: 4 });
    expect([...onBoard.units, ...onBoard.bench!].filter(unit => 'effectiveStarLevel' in unit)).toHaveLength(1);
    const onBench = toPublicBoard(promoted('unit-93', 'promoted'));
    expect(onBench.bench!.find(unit => unit.slot === 1)).toEqual({ definitionId, starLevel: 3, slot: 1, items: [], effectiveStarLevel: 4 });
    expect(JSON.stringify(toPublicBoard(promoted('unit-92', 'waiting')))).not.toContain('effectiveStarLevel');
    const text = JSON.stringify(onBoard);
    for (const forbidden of ['sellGold', 'poolCopies', 'remainingSettlements', 'phase', 'choice-secret', 'unit-9']) expect(text).not.toContain(forbidden);
  });
  it('rides on every seat of every view, so each player sees the same public board of a seat', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const a = toPlayerView(room.state, 's0', clock.now()), b = toPlayerView(room.state, 's3', clock.now());
    for (const seat of room.state.seats) {
      const fromA = a.seats.find(entry => entry.seatId === seat.seatId)!.publicBoard, fromB = b.seats.find(entry => entry.seatId === seat.seatId)!.publicBoard;
      expect(fromA).toEqual(fromB);
      expect(fromA).toEqual(toPublicBoard(seat.match));
    }
  });
});

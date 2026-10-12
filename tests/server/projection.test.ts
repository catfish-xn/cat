import { describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toCombatFrames, toPlayerView, toPublicBoard } from '../../src/server/room/projection';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import type { MatchState } from '../../src/simulation/match-types';
import { DamageResolver, expectUniqueRanking, makeRoom, runUntil } from './helpers';

describe('toPlayerView', () => {
  it('is a whitelist: no rule state, rng or other seats\' private data leaks', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const view = toPlayerView(room.state, 's1', clock.now());
    expect(Object.keys(view).sort()).toEqual(['fault', 'mySeatId', 'opponentSeatId', 'phase', 'ranking', 'seats']);
    expect(view.fault).toBeNull();
    expect(view.phase).toEqual({ kind: 'preparation', round: 1, roundName: '1-2', endsAt: 1_000, serverNow: 0 });
    expect(view.seats).toHaveLength(8);
    expect(Object.keys(view.seats[0]!).sort()).toEqual(['alive', 'connected', 'hp', 'kind', 'level', 'name', 'publicBoard', 'rank', 'seatId']);
    // `publicBoard.units` is the one public build list (C5); everything else stays private.
    const serialized = JSON.stringify({ ...view, seats: view.seats.map(({ publicBoard: _board, ...seat }) => seat) });
    for (const forbidden of ['rngState', 'seed', 'shop', 'units', 'gold', 'pendingChoice']) expect(serialized).not.toContain(forbidden);
    for (const forbidden of ['rngState', 'seed', 'shop', 'gold', 'pendingChoice', 'bench', 'xp', 'location', 'unit-']) expect(JSON.stringify(view.seats.map(seat => seat.publicBoard))).not.toContain(forbidden);
    expect(view.opponentSeatId).toBeNull(); expect(view.ranking).toBeNull();
    expect(() => toPlayerView(room.state, 'ghost', 0)).toThrow(RangeError);
  });
  it('maps room phases to client phases and names the pvp opponent', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    expect(toPlayerView(room.state, 's0', 0).phase.kind).toBe('lobby');
    room.start();
    runUntil(room, clock, current => current.round === 4 && current.phase === 'preparation');
    const view = toPlayerView(room.state, 's0', clock.now());
    expect(view.opponentSeatId).not.toBeNull(); expect(view.opponentSeatId).not.toBe('s0');
    const back = toPlayerView(room.state, view.opponentSeatId!, clock.now());
    expect(back.opponentSeatId).toBe('s0');
    clock.runNext();
    expect(toPlayerView(room.state, 's0', clock.now()).phase.kind).toBe('combat');
    const frames = toCombatFrames(room.state, 's0');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(frame => frame.events.every(event => 'tick' in event))).toBe(true);
    expect(toCombatFrames(room.state, 'ghost')).toEqual([]);
  }, 20_000); // three PvE rounds tick by tick through the shared-pool wrapper (B5) before the first PvP, like its siblings
  it('publishes the final standings once the match ends', () => {
    const { room, clock } = makeRoom(new DamageResolver(seatId => seatId === 's5' ? 0 : 100, 0));
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
  it('shows only my deployed units with their item definitions, never the bench, enemies, shop, gold or ids', () => {
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
    } as unknown as MatchState;
    const board = toPublicBoard(match);
    const deployed = base.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
    expect(board.units).toHaveLength(deployed.length + 1);
    expect(board.units.at(-1)).toEqual({ definitionId: base.preparation.units[0]!.definitionId, starLevel: 2, cell: { col: 5, row: 6 }, items: [first, second] });
    for (const unit of board.units) expect(Object.keys(unit).sort()).toEqual(['cell', 'definitionId', 'items', 'starLevel']);
    expect(Object.keys(board)).toEqual(['units']);
    const text = JSON.stringify(board);
    for (const forbidden of ['unit-9', 'item-', 'bench', 'gold', 'shop', 'seed', 'rngState', 'pve-', 'enemy', 'inventory']) expect(text).not.toContain(forbidden);
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

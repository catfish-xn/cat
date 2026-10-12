import { describe, expect, it } from 'vitest';
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { toCombatFrames, toPlayerView } from '../../src/server/room/projection';
import { DamageResolver, expectUniqueRanking, makeRoom, runUntil } from './helpers';

describe('toPlayerView', () => {
  it('is a whitelist: no rule state, rng or other seats\' private data leaks', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const view = toPlayerView(room.state, 's1', clock.now());
    expect(Object.keys(view).sort()).toEqual(['mySeatId', 'opponentSeatId', 'phase', 'ranking', 'seats']);
    expect(view.phase).toEqual({ kind: 'preparation', round: 1, roundName: '1-2', endsAt: 1_000, serverNow: 0 });
    expect(view.seats).toHaveLength(8);
    expect(Object.keys(view.seats[0]!).sort()).toEqual(['alive', 'connected', 'hp', 'kind', 'level', 'name', 'rank', 'seatId']);
    const serialized = JSON.stringify(view);
    for (const forbidden of ['rngState', 'seed', 'shop', 'units', 'gold', 'pendingChoice']) expect(serialized).not.toContain(forbidden);
    expect(view.opponentSeatId).toBeNull(); expect(view.ranking).toBeNull();
    expect(() => toPlayerView(room.state, 'ghost', 0)).toThrow(RangeError);
  });
  it('maps room phases to client phases and names the pvp opponent', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
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
  });
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

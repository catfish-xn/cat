import { describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toPlayerView } from '../../src/server/room/projection';
import type { RoomState } from '../../src/server/room/types';
import { makeRoom, runUntil } from './helpers';

const opponentOf = (state: RoomState, seatId: string): string | null => {
  const pairing = state.pairings.find(row => row.seatId === seatId);
  return pairing ? (pairing.opponent.kind === 'seat' ? pairing.opponent.seatId : pairing.opponent.sourceSeatId) : null;
};

describe('G1-P6 room: candidates in preparation, opponent at the freeze', () => {
  it('every frozen opponent was a shown candidate; only PvP rounds grow the history', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    const shown = new Map<number, Map<string, readonly string[]>>();
    const checked: number[] = [];
    let lastHistory = room.state.pairingHistory, lastRound = 0;
    room.subscribe(state => {
      if (state.roundKind === 'pvp' && state.phase === 'preparation') {
        const views = new Map(state.seats.filter(seat => seat.alive).map(seat => [seat.seatId, toPlayerView(state, seat.seatId, 0)] as const));
        for (const view of views.values()) {
          expect(view.opponentSeatId).toBeNull();
          expect(view.opponentCandidates!.length).toBeGreaterThanOrEqual(1);
          expect(view.opponentCandidates).not.toContain(view.mySeatId);
        }
        shown.set(state.round, new Map([...views].map(([seatId, view]) => [seatId, view.opponentCandidates!])));
      }
      if (state.pairings.length > 0 && !checked.includes(state.round)) {
        checked.push(state.round);
        const candidates = shown.get(state.round)!;
        for (const seat of state.seats.filter(candidate => candidate.alive)) {
          const opponent = opponentOf(state, seat.seatId);
          expect(candidates.get(seat.seatId)).toContain(opponent);
          expect(toPlayerView(state, seat.seatId, 0).opponentSeatId).toBe(opponent);
          expect(state.pairingHistory[seat.seatId]!.at(-1)).toBe(opponent);
        }
      }
      if (state.pairingHistory !== lastHistory) { expect(state.roundKind).toBe('pvp'); lastHistory = state.pairingHistory; }
      if (state.round !== lastRound) { lastRound = state.round; if (state.roundKind !== 'pvp') expect(state.opponentCandidates).toEqual({}); }
    });
    room.start();
    runUntil(room, clock, state => checked.length >= 4 || state.phase === 'ended', 5_000);
    expect(room.state.fault).toBeNull();
    expect(checked.length).toBeGreaterThanOrEqual(4);
    // After a few rounds somebody's candidates are narrower than "everybody else".
    expect([...shown.values()].some(round => [...round.values()].some(list => list.length < [...round.keys()].length - 1))).toBe(true);
  }, 60_000);

  it('a disconnect, a takeover and a resume leave the candidates unchanged (they live in the room state)', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.roundKind === 'pvp' && state.phase === 'preparation' && Object.keys(state.pairingHistory).length > 0, 2_000);
    const before = toPlayerView(room.state, 's0', clock.now()).opponentCandidates;
    expect(room.setConnected('s0', false)).toBe(true);
    expect(room.takeOver('s0')).toBe(true);
    expect(toPlayerView(room.state, 's0', clock.now()).opponentCandidates).toEqual(before);
    expect(room.setConnected('s0', true)).toBe(true);
    const after = toPlayerView(room.state, 's0', clock.now());
    expect(after.opponentCandidates).toEqual(before);
    expect(after.opponentSeatId).toBeNull();
    clock.runNext();
    expect(before).toContain(toPlayerView(room.state, 's0', clock.now()).opponentSeatId);
  }, 60_000);

  it('the same seed gives the same candidates and pairings', () => {
    const run = () => {
      const { room, clock } = makeRoom(new TwoSidedBattleResolver());
      const log: string[] = [];
      room.subscribe(state => { if (state.pairings.length > 0) log.push(JSON.stringify([state.round, state.opponentCandidates, state.pairings])); });
      room.start();
      runUntil(room, clock, state => log.length >= 3 || state.phase === 'ended', 5_000);
      room.dispose();
      return log;
    };
    expect(run()).toEqual(run());
  }, 60_000);
});

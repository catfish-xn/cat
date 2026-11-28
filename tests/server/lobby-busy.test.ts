/**
 * Lobby "对局正在进行" line (playtest 11-09): while a match holds the room the lobby view says so, and once every human
 * seat is disconnected it carries the time until the abandon watchdog frees the room, which the lobby counts down.
 */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Lobby } from '../../src/server/room/lobby';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { TIMINGS } from './helpers';

const ABANDON_MS = 3_000;

function makeLobby(abandonMs = ABANDON_MS) {
  const clock = new ManualClock();
  let changes = 0;
  const lobby = new Lobby({ clock, resolver: new TwoSidedBattleResolver(), seed: 42, timings: TIMINGS, bots: null,
    watchdog: { stallMs: 0, abandonMs }, onReleaseChange: () => { changes++; } });
  const joined = lobby.join('我'); if (!joined.ok) throw new Error(joined.reason);
  return { clock, lobby, seatId: joined.seatId, changes: () => changes };
}

describe('lobby busy view', () => {
  it('is null before a match and while the room is free again', () => {
    const { lobby } = makeLobby();
    expect(lobby.view(null).busy).toBeNull();
  });

  it('says a match holds the room, with the release countdown only while every human seat is gone', () => {
    const { clock, lobby, seatId, changes } = makeLobby();
    const started = lobby.start(); if (!started.ok) throw new Error(started.reason);
    const room = started.room;
    expect(lobby.view(null).busy).toEqual({ releaseInMs: null });
    expect(changes()).toBe(0);

    room.setConnected(seatId, false);
    expect(lobby.view(null).busy).toEqual({ releaseInMs: ABANDON_MS });
    expect(changes()).toBe(1);
    clock.advance(1_000);
    expect(lobby.view(null).busy).toEqual({ releaseInMs: ABANDON_MS - 1_000 });

    // A reconnect stands the watchdog down: still busy, no countdown.
    room.setConnected(seatId, true);
    expect(lobby.view(null).busy).toEqual({ releaseInMs: null });
    expect(changes()).toBe(2);

    room.setConnected(seatId, false);
    for (let guard = 0; room.state.phase !== 'ended' && guard < 1_000; guard++) clock.runNext();
    expect(room.state.fault).toMatchObject({ kind: 'abandoned' });
    expect(lobby.view(null).busy).toBeNull();
  });

  it('never counts down without an abandon watchdog', () => {
    const { lobby, seatId } = makeLobby(0);
    const started = lobby.start(); if (!started.ok) throw new Error(started.reason);
    started.room.setConnected(seatId, false);
    expect(lobby.view(null).busy).toEqual({ releaseInMs: null });
  });
});

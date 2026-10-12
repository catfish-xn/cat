import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Lobby } from '../../src/server/room/lobby';
import { DamageResolver, TIMINGS } from './helpers';

function makeLobby(queueTimeoutMs: number | null = null) {
  const clock = new ManualClock();
  const lobby = new Lobby({ clock, resolver: new DamageResolver(() => 0), seed: 42, timings: TIMINGS, queueTimeoutMs });
  return { lobby, clock };
}

describe('Lobby (single queue, no rooms)', () => {
  it('accepts eight players, refuses the ninth, and fills the rest with idle bots', () => {
    const { lobby } = makeLobby();
    const seats = Array.from({ length: 8 }, (_, index) => lobby.join(`p${index}`));
    expect(seats.every(result => result.ok)).toBe(true);
    expect(lobby.join('p8')).toEqual({ ok: false, reason: 'full' });
    expect(lobby.view(seats[0]!.ok ? seats[0]!.seatId : null)).toMatchObject({ capacity: 8, joined: true, canStart: true, error: null });
    const started = lobby.start();
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.room.state.seats).toHaveLength(8);
    expect(started.room.state.seats.every(seat => seat.kind === 'human')).toBe(true);
    expect(started.room.state.phase).not.toBe('waiting');
  });
  it('starts with one player and seven bots; bots never act and nobody joins mid-match', () => {
    const { lobby } = makeLobby();
    const me = lobby.join('我'); expect(me.ok).toBe(true);
    const started = lobby.start(); expect(started.ok).toBe(true);
    if (!started.ok) return;
    const seats = started.room.state.seats;
    expect(seats.map(seat => seat.kind)).toEqual(['human', 'bot', 'bot', 'bot', 'bot', 'bot', 'bot', 'bot']);
    expect(new Set(seats.map(seat => seat.seatId)).size).toBe(8);
    expect(seats.every(seat => seat.seatRevision === 0)).toBe(true);
    expect(lobby.join('late')).toEqual({ ok: false, reason: 'in-progress' });
    expect(lobby.start()).toEqual({ ok: false, reason: 'in-progress' });
    expect(lobby.view(null).queue).toEqual([]);
  });
  it('refuses to start empty and lets players leave', () => {
    const { lobby } = makeLobby();
    expect(lobby.start()).toEqual({ ok: false, reason: 'empty' });
    const a = lobby.join('a'); if (!a.ok) throw new Error('join');
    lobby.leave(a.seatId);
    expect(lobby.view(a.seatId).joined).toBe(false);
    expect(lobby.start()).toEqual({ ok: false, reason: 'empty' });
  });
  it('starts on the queue timeout without anyone pressing start', () => {
    const { lobby, clock } = makeLobby(5_000);
    lobby.join('a'); clock.advance(4_999);
    expect(lobby.room).toBeNull();
    clock.advance(1);
    expect(lobby.room).not.toBeNull();
    expect(lobby.room!.state.seats).toHaveLength(8);
  });
});

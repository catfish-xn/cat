/**
 * Contract §25 推送事件: a G2-3 hook failure (`mechanicFailed`) raised inside a server-originated transition goes out
 * with that seat's own state push, field for field, and to no other seat. The failure is forced through the rules'
 * academy hook, which every accepted rules step (here: the deadline auto-deployment) runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
const fault = vi.hoisted(() => ({ seatId: '' }));
vi.mock('../../src/simulation/g2-3-match-progress', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/simulation/g2-3-match-progress')>();
  return { ...real,
    grantG23Academy: (...args: Parameters<typeof real.grantG23Academy>) => args[0].multiplayer?.seatId === fault.seatId
      ? { state: args[0], events: [{ type: 'mechanicFailed' as const, hook: 'academy' as const, reason: 'invalid-mechanic-state' as const }] }
      : real.grantG23Academy(...args),
  };
});
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { seatPushEvents, toPlayerView } from '../../src/server/room/projection';
import type { RoomState, SeatState } from '../../src/server/room/types';
import { makeRoom, runUntil } from './helpers';

const seat = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
afterEach(() => { fault.seatId = ''; });

describe('mechanicFailed push (contract §25)', () => {
  it('pushes the failure with the own seat state only, and never in another seat\'s view', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 2 && state.phase === 'preparation');
    // s0 keeps a bench unit, so the preparation deadline runs a rules deployment for it.
    expect(seat(room.state, 's0').match.preparation.units.some(unit => unit.team === 'player' && unit.location.kind === 'bench')).toBe(true);
    fault.seatId = 's0';
    clock.runNext();
    const s0 = seat(room.state, 's0');
    const failed = seatPushEvents(s0).filter(event => event.type === 'mechanicFailed');
    expect(failed.length).toBeGreaterThan(0);
    for (const event of failed) expect(event).toEqual({ type: 'mechanicFailed', hook: 'academy', reason: 'invalid-mechanic-state', domain: 'match', eventSeq: expect.any(Number) });
    for (const other of room.state.seats.filter(candidate => candidate.seatId !== 's0')) {
      expect(seatPushEvents(other).some(event => event.type === 'mechanicFailed')).toBe(false);
      expect(JSON.stringify(toPlayerView(room.state, other.seatId, clock.now()))).not.toContain('mechanicFailed');
    }
  }, 30_000);
});

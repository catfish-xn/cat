/* Regression: the battle-start recorder's restore (a new Room with `current` assigned) of seed 20261014's round-23
 * checkpoint ended the room with `seat-stuck bot-4 augment-clock:invalid-pool`. The preparation start lives outside
 * RoomState, so the restored room measured the whole match as this preparation. The live room never faults here;
 * checkpoints now carry those fields (tests/server/room-checkpoint.ts). */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { BotDriver } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import type { RoomState } from '../../src/server/room/types';
import { captureRoomPrivate, restoreRoomPrivate, type RoomPrivate } from './room-checkpoint';

const SEED = 20261014, ROUND = 23;
type Seam = { current: RoomState; freezeAndResolve(): void };
const seam = (room: Room) => room as unknown as Seam;

describe('room checkpoint: seed 20261014 round 23', () => {
  it('restores the planning-freeze checkpoint into battle once the room fields outside state come along', () => {
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' as const : 'human' as const }));
    const options = (clock: ManualClock) => ({ ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed: SEED, clock, resolver: new TwoSidedBattleResolver(),
      combatStreaming: true, sliceTicks: 100, sliceMs: 20, sliceNow: () => 0, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
    const clock = new ManualClock(), room = new Room(seats, options(clock)), bots = new BotDriver(room, SEED);
    let checkpoint: { time: number; state: RoomState; roomPrivate: RoomPrivate } | undefined;
    const freeze = seam(room).freezeAndResolve.bind(room);
    seam(room).freezeAndResolve = () => {
      if (room.state.round === ROUND) checkpoint = { time: clock.now(), state: structuredClone(room.state), roomPrivate: captureRoomPrivate(room) };
      freeze();
    };
    try {
      room.start();
      for (let n = 0; !checkpoint && n < 400000; n++) {
        expect(room.state.fault).toBeNull();
        const human = room.state.seats[0]!;
        if (room.state.phase === 'preparation' && human.alive && human.match.phase === 'preparation')
          while (room.state.seats[0]!.match.gold >= 4 && room.state.seats[0]!.match.level < 10)
            expect(room.handle('seat-1', { type: 'buyXp' }).ok).toBe(true);
        expect(clock.fireNext()).toBe(true);
      }
      expect(room.state.fault).toBeNull(); // the live room froze this round without a fault
    } finally { bots.dispose(); room.dispose(); }
    const cp = checkpoint!;
    expect(cp.state.seats.filter(s => s.alive)).toHaveLength(7);
    const replay = (withRoomPrivate: boolean) => {
      const c = new ManualClock(cp.time), r = new Room(cp.state.seats, options(c));
      seam(r).current = structuredClone(cp.state);
      if (withRoomPrivate) restoreRoomPrivate(r, cp.roomPrivate);
      try {
        seam(r).freezeAndResolve();
        for (let n = 0; r.combatInitializationPending && n < 1000; n++) expect(c.fireNext()).toBe(true);
        return { phase: r.state.phase, fault: r.state.fault };
      } finally { r.dispose(); }
    };
    // The scenario is still exercised: state alone is not a faithful checkpoint for this round.
    expect(replay(false)).toEqual({ phase: 'ended', fault: { kind: 'seat-stuck', seatId: 'bot-4', reason: 'augment-clock:invalid-pool' } });
    expect(replay(true)).toEqual({ phase: 'battle', fault: null });
  }, 300_000);
});

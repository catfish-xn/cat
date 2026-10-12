import { expect, it } from 'vitest';
import { applyCombatReplayTick } from '../src/server-entry';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { toCombatReplayFor } from '../src/server/room/projection';
import { expectUniqueRanking, makeRoom } from './server/helpers';

it('SR-B7-01: seed42 eight-seat idle match generates every replay, including all wolves seats', () => {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  const rounds = new Set<number>(), wolves = new Set<string>();
  try {
    room.start();
    for (let timers = 0; timers < 20_000 && room.state.phase !== 'ended'; timers++) {
      const state = room.state;
      if (state.phase === 'battle' && state.roundKind !== 'supply' && !rounds.has(state.round)) {
        rounds.add(state.round);
        let count = 0;
        for (const seat of state.seats.filter(s => s.alive)) {
          const projected = toCombatReplayFor(state, seat.seatId);
          expect(projected, `${state.roundId}/${seat.seatId}`).not.toBeNull();
          const replay = projected!.replay;
          let view = replay.initial;
          for (const frame of replay.ticks) view = applyCombatReplayTick(view, frame);
          expect(view).toEqual(replay.terminal);
          if (state.roundId === '3-7') wolves.add(seat.seatId);
          count++;
        }
        expect(count).toBeGreaterThan(0);
      }
      if (!clock.runNext()) break;
    }
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toBeNull();
    expectUniqueRanking(room.state);
    expect(rounds.size).toBeGreaterThanOrEqual(30);
    expect(wolves.size).toBe(8);
  } finally { room.dispose(); }
}, 60_000);

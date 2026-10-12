import { expect } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import { Room, ROOM_TIMING_DEFAULTS, type RoomOptions } from '../../src/server/room/room';
import type { BattleInput, BattleResult, RoomState, SeatSpec } from '../../src/server/room/types';

export const SEATS: readonly SeatSpec[] = Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, name: `玩家 ${index}`, kind: index < 4 ? 'human' : 'bot' }));
export const TIMINGS = { preparationMs: 1_000, choiceMs: 500, settlementMs: 200, battleTailMs: 100, maxSettlementExtensions: 2 } as const;

/** Reports the given damage per seat and leaves the rule state untouched (one empty frame keeps a battle phase). */
export class DamageResolver implements BattleResolver {
  readonly inputs: BattleInput[] = [];
  constructor(private readonly damage: (seatId: string, input: BattleInput) => number, private readonly frames = 1) {}
  resolveBattle(input: BattleInput): BattleResult {
    this.inputs.push(input);
    return { battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: input.seats.map(seat => ({
      seatId: seat.seatId, state: seat.state, result: null, damage: this.damage(seat.seatId, input),
      frames: Array.from({ length: this.frames }, () => ({ state: seat.state, events: [] })),
    })) };
  }
}

export function makeRoom(resolver: BattleResolver = new PlaceholderBattleResolver(), overrides: Partial<RoomOptions> = {}) {
  const clock = overrides.clock ?? new ManualClock();
  const room = new Room(SEATS, { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, roomId: 'test-room', seed: 42, clock, resolver, ...overrides });
  return { room, clock: clock as ManualClock };
}

/** Fires timers one by one until the predicate holds; fails loudly instead of looping forever. */
export function runUntil(room: Room, clock: ManualClock, predicate: (state: RoomState) => boolean, maxTimers = 2_000): RoomState {
  for (let fired = 0; fired < maxTimers; fired++) {
    if (predicate(room.state)) return room.state;
    if (!clock.runNext()) break;
  }
  if (!predicate(room.state)) throw new Error(`room never reached the expected state (phase ${room.state.phase}, round ${room.state.round}, fault ${JSON.stringify(room.state.fault)})`);
  return room.state;
}

export function expectUniqueRanking(state: RoomState): void {
  expect(state.ranking).not.toBeNull();
  const ranks = state.ranking!.map(entry => entry.rank).sort((a, b) => a - b);
  expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(new Set(state.ranking!.map(entry => entry.seatId)).size).toBe(8);
  for (const seat of state.seats) expect(seat.rank).toBe(state.ranking!.find(entry => entry.seatId === seat.seatId)!.rank);
}

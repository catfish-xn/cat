import { expect } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import { Room, ROOM_TIMING_DEFAULTS, type RoomOptions } from '../../src/server/room/room';
import type { CombatState } from '../../src/simulation/combat-types';
import type { BattleInput, BattleResult, RoomState, SeatSpec } from '../../src/server/room/types';
import { readLootView } from '../../src/simulation/match';

export const SEATS: readonly SeatSpec[] = Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, name: `玩家 ${index}`, kind: index < 4 ? 'human' : 'bot' }));
export const TIMINGS = { preparationMs: 1_000, choiceMs: 500, settlementMs: 200, battleTailMs: 100, maxSettlementExtensions: 2 } as const;

/** A finished, unit-less combat: a battle only needs to exist for the room to open a battle phase (one replay tick). */
export function emptyCombat(state: { readonly preparation: { readonly board: CombatState['board'] } }): CombatState {
  return { board: state.preparation.board, units: [], tick: 0, maxTicks: 1200, status: 'finished', result: 'draw' };
}
/** Reports the given damage per seat and leaves the rule state untouched (an empty combat keeps a battle phase; `fights=false` skips it). */
export class DamageResolver implements BattleResolver {
  readonly inputs: BattleInput[] = [];
  constructor(private readonly damage: (seatId: string, input: BattleInput) => number, private readonly fights = true) {}
  resolveBattle(input: BattleInput): BattleResult {
    this.inputs.push(input);
    return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: input.seats.map(seat => ({
      seatId: seat.seatId, state: seat.state, result: null, damage: this.damage(seat.seatId, input),
      combat: this.fights ? { initial: emptyCombat(seat.state), terminal: emptyCombat(seat.state), events: [] } : null,
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

/**
 * v15: online rewards are orbs a seat claims itself (a player with `claimOrb`, a bot at its preparation entry through the
 * rules' helper). For room tests whose precondition is "the rewards arrived": while the room and the seat prepare, every
 * alive seat (or only `seatIds`) claims each unclaimed, unqueued orb through the room's own command, in orbId order.
 * Every claim must be accepted. Returns how many orbs were claimed.
 */
export function claimAllOrbs(room: Room, seatIds?: readonly string[]): number {
  if (room.state.phase !== 'preparation') return 0;
  let claimed = 0;
  for (const { seatId } of room.state.seats) {
    if (seatIds && !seatIds.includes(seatId)) continue;
    // An anvil stays in its orb while the bench is full (v22), so each orb is claimed at most once per call.
    const tried = new Set<string>();
    for (;;) {
      const seat = room.state.seats.find(candidate => candidate.seatId === seatId)!;
      if (!seat.alive || seat.match.phase !== 'preparation') break;
      const orb = (readLootView(seat.match).unclaimedOrbs ?? []).filter(candidate => !candidate.queued && !tried.has(candidate.orbId)).map(candidate => candidate.orbId).sort()[0];
      if (orb === undefined) break;
      tried.add(orb);
      const result = room.handle(seatId, { type: 'claimOrb', round: seat.match.round, orbId: orb });
      // v22: an orb holding an anvil stays put while the bench is full.
      if (!result.ok && (result as { reason?: unknown }).reason === 'bench-full') continue;
      expect(result, `${seatId} claims ${orb}`).toMatchObject({ ok: true });
      claimed++;
    }
  }
  return claimed;
}

/** runUntil, with every seat claiming its orbs (claimAllOrbs) whenever the room prepares, before the predicate is read. */
export function runUntilClaiming(room: Room, clock: ManualClock, predicate: (state: RoomState) => boolean, maxTimers = 2_000, seatIds?: readonly string[]): RoomState {
  for (let fired = 0; fired < maxTimers; fired++) {
    claimAllOrbs(room, seatIds);
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

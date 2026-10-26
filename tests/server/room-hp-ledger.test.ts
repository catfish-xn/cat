/**
 * The room's HP ledger (seat.hp, shown on SeatPublic) follows every rules heal between settlements in the same
 * publication, and only an explained one: an Upward Mobility level-up or a Crimson Pact skip receipt. Settlement then
 * checks HP strictly against that ledger.
 */
import { afterAll, afterEach, expect, it } from 'vitest';
import type { ClockHandle } from '../../src/server/room/clock';
import { ManualClock } from '../../src/server/room/clock';
import type { Room } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { explainedHp } from '../../src/simulation/player-hp';
import { batch2Values } from '../../src/simulation/content/augment-pool-batch2';
import { writeSeatMechanic, appendMechanicReceipt } from '../../src/simulation/seat-mechanics/state';
import { AUGMENT_ACQUISITION_LEVEL_KEY } from '../../src/simulation/augment-xp';
import { makeRoom, runUntil } from './helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

/** A ManualClock that also tells when its next timer is due, so a route can stop between two timers of one `runNext`. */
class SteppingClock extends ManualClock {
  private readonly dueAt = new Map<ClockHandle, number>();
  override schedule(at: number, fn: () => void): ClockHandle {
    const handle: ClockHandle = super.schedule(at, () => { this.dueAt.delete(handle); fn(); });
    this.dueAt.set(handle, at);
    return handle;
  }
  override cancel(handle: ClockHandle): void { this.dueAt.delete(handle); super.cancel(handle); }
  get nextAt(): number | undefined {
    let next: number | undefined;
    for (const at of this.dueAt.values()) if (next === undefined || at < next) next = at;
    return next;
  }
}
/**
 * helpers' `runUntil`, resumable between any two timers: the same timers fire in the same order and the predicate is read
 * at the same points (between two `runNext` calls), so a route split over several cases ends in the same state.
 * `advance` stops early (false) once `sliceLimit` battle slices (timers fired while the room is frozen) fired in all.
 */
class Route {
  private target: number | null = null;
  private runs = 0;
  slices = 0;
  constructor(readonly room: Room, readonly clock: SteppingClock, private readonly predicate: (state: RoomState) => boolean, private readonly maxTimers = 2_000) {}
  advance(sliceLimit = Infinity): boolean {
    const { room, clock } = this;
    for (;;) {
      if (this.target === null) {
        if (this.predicate(room.state)) return true;
        const next = clock.nextAt;
        if (this.runs >= this.maxTimers || next === undefined) throw new Error(`room never reached the expected state (phase ${room.state.phase}, round ${room.state.round}, fault ${JSON.stringify(room.state.fault)})`);
        this.target = next; this.runs++;
      }
      if (this.slices >= sliceLimit) return false;
      if (room.state.phase === 'frozen') this.slices++;
      clock.fireNext();
      const next = clock.nextAt;
      if (next === undefined || next > this.target) this.target = null;
    }
  }
}

/*
 * One room plays to round 4 (2-1, the first PvP round, augment choices open) once per file: the three PvE rounds before it
 * resolve 24 seat battles (~4.5 s), played two battle slices per case. A filtered case plays the earlier slices first.
 * The Upward Mobility case continues that room itself (it runs the clock); every other case needs only the room's
 * publication at that point, so it gets a fresh room of the same seed (never started, no timer armed) holding that
 * publication, written the same way `patch` writes one. Those cases never run the clock.
 */
const SLICES_PER_CASE = 2, ROUTE_CASES = 12;
let shared: { room: Room; clock: SteppingClock; route: Route; prepared?: RoomState } | undefined;
afterAll(() => { shared?.room.dispose(); shared = undefined; });
function sharedRoute() {
  if (shared) return shared;
  const clock = new SteppingClock();
  const { room } = makeRoom(new TwoSidedBattleResolver(), { clock });
  room.start();
  return shared = { room, clock, route: new Route(room, clock, state => state.round === 4 && state.phase === 'preparation') };
}
function roundFour(): RoomState {
  const run = sharedRoute();
  if (!run.prepared) { run.route.advance(); run.prepared = run.room.state; }
  return run.prepared;
}
const holderOf = (room: Room) => room as unknown as { current: RoomState; replace(next: RoomState): void };
/** The shared room itself at round 4 preparation (for the one case that plays on). */
function preparedRoom() {
  roundFour();
  const { room, clock } = shared!;
  return { room, clock, holder: holderOf(room) };
}
/** A fresh room holding the shared round-4 publication. */
function preparedFork() {
  const state = roundFour();
  const { room } = makeRoom(new TwoSidedBattleResolver());
  disposers.push(() => room.dispose());
  const holder = holderOf(room);
  holder.current = state;
  return { room, holder };
}
const seatOf = (state: RoomState, seatId: string) => state.seats.find(seat => seat.seatId === seatId)!;
function patch(holder: { current: RoomState }, seatId: string, edit: (match: MatchState) => MatchState, hp?: number) {
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId !== seatId ? seat : {
    ...seat, match: edit(seat.match), ...(hp === undefined ? {} : { hp }), seatRevision: seat.seatRevision + 1 }) };
}

for (let index = 1; index <= ROUTE_CASES; index++) it(`the shared room plays battle slices ${(index - 1) * SLICES_PER_CASE + 1}-${index * SLICES_PER_CASE} toward round 4`, () => {
  const { route } = sharedRoute();
  route.advance(index * SLICES_PER_CASE);
  expect(route.room.state.fault).toBeNull();
});

it('an Upward Mobility level-up bought through the room heals the ledger at once, and the next settlement stays strict', () => {
  const { room, clock, holder } = preparedRoom();
  patch(holder, 's0', match => writeSeatMechanic({ ...match, playerHp: 50, gold: 60,
    augments: [...match.augments, { definitionId: 'upward-mobility', choiceId: 'um', acquiredRound: match.round }] },
  AUGMENT_ACQUISITION_LEVEL_KEY, { um: match.level }), 50);
  const level = seatOf(room.state, 's0').match.level;
  while (seatOf(room.state, 's0').match.level === level) {
    const before = seatOf(room.state, 's0').match.gold;
    expect(room.handle('s0', { type: 'buyXp' })).toMatchObject({ ok: true });
    expect(before - seatOf(room.state, 's0').match.gold).toBe(3);
  }
  const seat = seatOf(room.state, 's0');
  expect([seat.match.playerHp, seat.hp]).toEqual([52, 52]);
  expect(room.state.fault).toBeNull();
  runUntil(room, clock, state => state.round === 5 || state.phase === 'ended');
  expect(room.state.fault).toBeNull();
});

it.each([['a rise', 5], ['a drop', -5]] as const)('%s in rules HP with no explained source faults the room (invalid-results) and leaves the ledger', (_label, delta) => {
  const { room, holder } = preparedFork();
  patch(holder, 's1', match => ({ ...match, playerHp: 50 }), 50);
  const faults: RoomState['fault'][] = [];
  room.subscribe(state => { if (state.fault) faults.push(state.fault); });
  holder.replace({ ...holder.current, seats: holder.current.seats.map(seat => seat.seatId !== 's1' ? seat : {
    ...seat, match: { ...seat.match, playerHp: 50 + delta }, seatRevision: seat.seatRevision + 1 }) });
  expect(room.state.fault).toMatchObject({ kind: 'invalid-results' });
  expect((room.state.fault as { detail: string }).detail).toContain('no explained source');
  expect(faults[0]).toEqual(room.state.fault);
  expect([seatOf(room.state, 's1').hp, seatOf(room.state, 's1').match.playerHp]).toEqual([50, 50]);
});

it('a seat command whose result carries an unexplained heal is refused to the caller, not reported ok', () => {
  const { room, holder } = preparedFork();
  // The command path itself must report the refusal: inject 7 HP no rule explains into the command's result.
  patch(holder, 's0', match => ({ ...match, playerHp: 50, gold: 60 }), 50);
  const internal = room as unknown as { withPendingResolved(r: { pool: unknown; state: MatchState; events: unknown[] }): unknown };
  const original = internal.withPendingResolved.bind(room);
  internal.withPendingResolved = (r) => original({ ...r, state: { ...r.state, playerHp: r.state.playerHp + 7 } });
  const result = room.handle('s0', { type: 'buyXp' });
  internal.withPendingResolved = original;
  expect(result).toMatchObject({ ok: false, reason: 'room-phase' });
  expect(room.state.fault).toMatchObject({ kind: 'invalid-results' });
  expect(seatOf(room.state, 's0').hp).toBe(50);
});

it('explainedHp: Crimson Pact heals only with a new skipped black-market receipt; levels heal only with Upward Mobility', () => {
  const base = { ...seatOf(roundFour(), 's2').match, playerHp: 60 };
  const pact = { ...base, augments: [...base.augments, { definitionId: 'crimson-pact', choiceId: 'cp', acquiredRound: base.round }] };
  const skipped = appendMechanicReceipt(pact, { receiptId: 'bm-1', round: pact.round, roundId: pact.roundDefinitionId, source: 'black-market',
    kind: 'choice', choiceKind: 'blackMarket', optionId: '@skip', skipped: true, price: 0, itemId: null, timedOut: false } as never);
  expect(explainedHp(pact, skipped)).toBe(60 + batch2Values('crimson-pact').Heal);
  expect(explainedHp(pact, pact)).toBe(60);
  expect(explainedHp(base, { ...base, level: base.level + 1 })).toBe(60);
  const um = { ...base, augments: [...base.augments, { definitionId: 'upward-mobility', choiceId: 'um', acquiredRound: base.round }] };
  expect(explainedHp(um, { ...um, level: um.level + 2 })).toBe(64);
  expect(explainedHp({ ...um, playerHp: 99 }, { ...um, playerHp: 99, level: um.level + 2 })).toBe(100);
});

it('selecting Risky Moves lowers the ledger by exactly its loss; any other drop with it faults the room', () => {
  for (const [hp, ok] of [[40, true], [39, false]] as const) {
    const { room, holder } = preparedFork();
    patch(holder, 's3', match => ({ ...match, playerHp: 60 }), 60);
    holder.replace({ ...holder.current, seats: holder.current.seats.map(seat => seat.seatId !== 's3' ? seat : {
      ...seat, match: { ...seat.match, playerHp: hp, augments: [...seat.match.augments, { definitionId: 'risky-moves', choiceId: 'rm', acquiredRound: seat.match.round }] }, seatRevision: seat.seatRevision + 1 }) });
    if (ok) { expect(room.state.fault).toBeNull(); expect(seatOf(room.state, 's3').hp).toBe(40); }
    else { expect(room.state.fault).toMatchObject({ kind: 'invalid-results' }); expect(seatOf(room.state, 's3').hp).toBe(60); }
    room.dispose();
  }
});

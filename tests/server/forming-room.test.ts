import { afterAll, expect, it } from 'vitest';
import type { ClockHandle } from '../../src/server/room/clock';
import { ManualClock } from '../../src/server/room/clock';
import type { Room } from '../../src/server/room/room';
import type { RoomState } from '../../src/server/room/types';
import { claimAllOrbs, makeRoom } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';

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
 * helpers' `runUntil` (with `claiming`: `runUntilClaiming`), resumable between any two timers: the same timers fire in the
 * same order and the claims and the predicate are read at the same points (between two `runNext` calls), so a route split
 * over several cases ends in the same state. `advance` stops early (false) once `sliceLimit` battle slices (timers fired
 * while the room is frozen, one seat battle each) fired in all.
 */
class Route {
  private target: number | null = null;
  private runs = 0;
  slices = 0;
  constructor(readonly room: Room, readonly clock: SteppingClock, private readonly predicate: (state: RoomState) => boolean,
    private readonly claiming: boolean, private readonly maxTimers = 2_000) {}
  advance(sliceLimit = Infinity): boolean {
    const { room, clock } = this;
    for (;;) {
      if (this.target === null) {
        if (this.claiming && this.runs < this.maxTimers) claimAllOrbs(room);
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
 * v23 batch 3: a seat picks Golemify online (a 3-2 card by its 14.24 stage tags) with pool conservation asserted on every
 * commit. The search plays a room per seed to 3-2 (~10 s for one seed) and the found room then plays on to 4-1 (~3 s), so
 * both routes run a few battle slices per case over one cached search; a filtered case plays the earlier slices first.
 * Public seed 4 / s4 offers Golemify directly in v25, so it is tried first; the other seeds stay
 * the fallback search in their order.
 */
const SEEDS = [4, ...Array.from({ length: 198 }, (_, index) => index + 1).filter(seed => seed !== 4)];
const SLICES_PER_CASE = 2, SEARCH_CASES = 32, PLAY_ON_CASES = 16;
type Search = { seedIndex: number; room: Room; route: Route; picker?: string; playOn?: Route };
let search: Search | undefined;
afterAll(() => { search?.room.dispose(); search = undefined; });
function openSeed(seedIndex: number): Search {
  const clock = new SteppingClock();
  const { room } = makeRoom(new TwoSidedBattleResolver(), { seed: SEEDS[seedIndex]!, assertPoolConservation: true, clock });
  room.start();
  return { seedIndex, room, route: new Route(room, clock, state => state.roundId === '3-2' && state.phase === 'preparation', true) };
}
/** Plays the search until a seat at 3-2 holds a Golemify offer (true) or `sliceLimit` slices of the current seed fired (false). */
function searchGolemify(sliceLimit = Infinity): boolean {
  for (search ??= openSeed(0); !search.picker;) {
    if (!search.route.advance(sliceLimit)) return false;
    const { room } = search;
    for (const s of room.state.seats.filter(s => s.alive)) {
      for (let slot = 0; slot < 3 && !s.match.pendingChoice!.offers.includes('golemify'); slot++) {
        const c = room.state.seats.find(x => x.seatId === s.seatId)!.match.pendingChoice!;
        if (c.offers.includes('golemify')) break;
        room.handle(s.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot });
      }
      const c = room.state.seats.find(x => x.seatId === s.seatId)!.match.pendingChoice!;
      if (c.offers.includes('golemify')) { search.picker = s.seatId; break; }
    }
    if (search.picker) return true;
    room.dispose();
    if (search.seedIndex + 1 >= SEEDS.length) throw new Error('no seat was offered Golemify');
    search = openSeed(search.seedIndex + 1);
  }
  return true;
}
let picked = false;
function pickGolemify(): { room: Room; picker: string } {
  searchGolemify();
  const { room, picker } = search as Search & { picker: string };
  if (picked) return { room, picker };
  picked = true;
  const before = room.state.seats.find(x => x.seatId === picker)!;
  const champions = before.match.preparation.units.filter(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon).map(u => u.id);
  expect(champions.length).toBeGreaterThan(0);
  const c = before.match.pendingChoice!;
  expect(room.handle(picker, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'golemify' })).toMatchObject({ ok: true });
  const after = room.state.seats.find(x => x.seatId === picker)!;
  expect(after.match.preparation.units.filter(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon)).toEqual([]);
  expect(after.match.preparation.units.filter(u => u.definitionId === 'augment-golem')).toHaveLength(1);
  expect(room.state.pool.holdings.filter(h => h.seatId === picker && champions.includes(h.unitId))).toEqual([]);
  return { room, picker };
}
/** The room settles the golem's fights with conservation checks on every commit, up to 4-1 (or the end). */
function playOn(sliceLimit = Infinity): boolean {
  pickGolemify();
  const s = search!;
  s.playOn ??= new Route(s.room, s.route.clock, state => state.roundId === '4-1' && state.phase === 'preparation' || state.phase === 'ended', false, 40_000);
  return s.playOn.advance(sliceLimit);
}

for (let index = 1; index <= SEARCH_CASES; index++) it(`Golemify online: the search plays battle slices ${(index - 1) * SLICES_PER_CASE + 1}-${index * SLICES_PER_CASE} toward a 3-2 Golemify offer`, () => {
  // Slices count per seed: a seed without the offer starts the next one, whose slices the remaining cases (or the pick) play.
  searchGolemify(index * SLICES_PER_CASE);
  expect(search!.room.state.fault).toBeNull();
});

it('Golemify online: the seat keeps only its golem and removed copies return to the pool', () => {
  pickGolemify();
});

for (let index = 1; index <= PLAY_ON_CASES; index++) it(`Golemify online: the room plays on, battle slices ${(index - 1) * SLICES_PER_CASE + 1}-${index * SLICES_PER_CASE} after the pick`, () => {
  playOn(index * SLICES_PER_CASE);
  expect(search!.room.state.fault).toBeNull();
});

it('Golemify online: the room plays on to 4-1 without a fault', () => {
  playOn();
  const end = search!.room.state;
  expect(end.fault).toBeNull();
  expect(end.roundId).toBe('4-1');
});

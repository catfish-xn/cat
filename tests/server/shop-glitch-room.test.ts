import { afterAll, describe, expect, it, vi } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { PER_ROUND_PREPARATION } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toSeatPrivateView } from '../../src/server/room/projection';
import * as shared from '../../src/simulation/shared-pool';
import { serializeMatch, restoreMatch } from '../../src/simulation/serialization';
import { shopGlitchShared } from '../fixtures/m5/oracle.g2.cjs';
import { conserved } from '../tp-helpers';
import { makeRoom, runUntil } from './helpers';

/** A busy event loop can deliver due callbacks together at the current injected clock time. */
class DelayedClock extends ManualClock {
  private deliveredAt: number | null = null;
  override now(): number { return this.deliveredAt ?? super.now(); }
  lateAdvance(ms: number): void {
    this.deliveredAt = super.now() + ms;
    try { super.advance(ms); } finally { this.deliveredAt = null; }
  }
}
const clock = new DelayedClock();
// Independent offer oracle search: seed 158 offers Shop Glitch to s1 and s3 at 2-1.
const { room } = makeRoom(new TwoSidedBattleResolver(), { seed: 158, clock, preparationMs: 31_000 });
const owners = ['s1', 's3'];
const seat = (id = owners[0]!) => room.state.seats.find(s => s.seatId === id)!;
const mine = () => seat().match;
let startedAt = 0;
const elapsed = () => clock.now() - startedAt;
afterAll(() => room.dispose());

function reach(roundId: string, targetRoom = room, targetClock = clock): void {
  for (let i = 0; i < 200; i++) {
    if (targetRoom.state.roundId === roundId && (roundId === '2-4' || targetRoom.state.phase === 'preparation')) return;
    if (targetRoom.state.phase === 'preparation') targetClock.lateAdvance(targetRoom.state.deadlineAt! - targetClock.now());
    else if (!targetClock.runNext()) break;
  }
  throw Error(`Did not reach ${roundId}: ${targetRoom.state.roundId}/${targetRoom.state.phase}, ${JSON.stringify(targetRoom.state.fault)}`);
}

/** Oracle gets only pre-step pool/RNG and test-owned times, never production refresh receipts. */
function advanceTo(target: number, late = false): void {
  const before = room.state;
  let expectedPool = before.pool;
  const expected = new Map();
  for (const owner of owners) {
    const match = before.seats.find(s => s.seatId === owner)!.match;
    const draw = shopGlitchShared(expectedPool, match, elapsed(), target);
    expected.set(owner, draw);
    expectedPool = { ...expectedPool, available: draw.available, shops: draw.shops };
  }
  if (late) clock.lateAdvance(target - elapsed()); else clock.advance(target - elapsed());
  for (const owner of owners) {
    const match = seat(owner).match, old = before.seats.find(s => s.seatId === owner)!.match;
    expect(match.shop).toEqual(expected.get(owner).shop);
    expect(match.rngState).toBe(expected.get(owner).rngState);
    expect(match.gold).toBe(old.gold);
    expect(match.seatMechanics?.seat['free-shop-rerolls']).toEqual(old.seatMechanics?.seat['free-shop-rerolls']);
  }
  expect(room.state.pool.available).toEqual(expectedPool.available);
  expect(room.state.pool.shops).toEqual(expectedPool.shops);
  expect(room.state.pool.holdings).toEqual(before.pool.holdings);
  expect(room.state.pool.pending).toEqual(before.pool.pending);
  expect(room.state.poolRevision).toBe(room.state.pool.revision);
  conserved(room.state.pool, room.state.seats.map(s => s.match));
  expect(room.state.fault).toBeNull();
}

it('starts a real room', () => { room.start(); });
for (const id of ['1-3', '1-4', '2-1']) it(`reaches initial ${id}`, () => { reach(id); });
it('selects the two offered augments through room.handle', () => {
  for (const id of owners) {
    const c = seat(id).match.pendingChoice!;
    expect(c.offers).toContain('shop-glitch');
    expect(room.handle(id, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'shop-glitch' })).toMatchObject({ ok: true });
  }
  const before = mine(); clock.lateAdvance(30_000);
  expect(mine().shop).toEqual(before.shop); expect(mine().rngState).toBe(before.rngState);
});
for (const id of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`reaches ${id} without timer draws during PvP or carousel`, () => {
  reach(id);
  expect(mine().shopHistory?.entries.filter(e => e.kind === 'draw' && e.cause === 'shop-glitch') ?? []).toHaveLength(0);
  if (id === '2-7') startedAt = clock.now();
});

it('publishes both shared shops atomically at 2500ms, even after a 2499ms connection publication', () => {
  advanceTo(2499);
  const before = room.state;
  expect(room.setConnected('s1', false)).toBe(true);
  const publications: typeof room.state[] = [];
  const stop = room.subscribe(state => {
    shared.assertSharedPoolConservation(state.pool, state.seats.map(s => s.match));
    publications.push(state);
  });
  try { advanceTo(2500); } finally { stop(); }
  expect(publications).toHaveLength(1);
  for (const id of owners) {
    const old = before.seats.find(s => s.seatId === id)!;
    expect(seat(id).match.shop.generation).toBe(old.match.shop.generation + 1);
    expect(seat(id).seatRevision).toBe(old.seatRevision + 1);
  }
  expect(seat().connected).toBe(false);
});

it('skips a locked boundary, keeps the lock and never makes up that missed refresh', () => {
  expect(room.handle('s1', { type: 'shopLock', locked: true, generation: mine().shop.generation })).toMatchObject({ ok: true });
  const locked = mine(); advanceTo(5000, true);
  expect(mine().shop).toEqual(locked.shop); expect(mine().rngState).toBe(locked.rngState);
  expect(room.handle('s1', { type: 'shopLock', locked: false, generation: mine().shop.generation })).toMatchObject({ ok: true });
  expect(mine().shop.generation).toBe(locked.shop.generation);
  advanceTo(7500); expect(mine().shop.generation).toBe(locked.shop.generation + 1);
});

it('keeps refreshing while disconnected and resumes without resetting the timer or replaying draws', () => {
  expect(room.takeOver('s1')).toBe(true);
  // This publication is queued before the clock's 10000ms sample, at exactly the same boundary.
  clock.schedule(startedAt + 10_000, () => { expect(room.setConnected('s3', false)).toBe(true); });
  advanceTo(10_000);
  const before = mine(), pool = room.state.pool, authority = room.augmentHistoryAuthority('s1');
  expect(room.setConnected('s1', true)).toBe(true);
  expect(seat().controller).toBe('human'); expect(mine()).toBe(before); expect(room.state.pool).toBe(pool);
  expect(toSeatPrivateView(mine()).shop).toEqual(before.shop);
  expect(shared.restoreSharedOrbSnapshot(pool, JSON.stringify(before), authority)).toEqual(before);
  clock.advance(0); expect(mine()).toBe(before); expect(room.state.pool).toBe(pool);
  clock.schedule(startedAt + 12_500, () => {
    // apply() consumes this boundary first; the already-due callback must keep subsequent sampling alive.
    expect(room.handle('s1', { type: 'shopLock', locked: false, generation: mine().shop.generation + 1 })).toMatchObject({ ok: true });
  });
  advanceTo(12_500);
});

it('round trips the room seat and pool together and continues exactly once from the saved clock', () => {
  const match = mine(), pool = room.state.pool, authority = room.augmentHistoryAuthority('s1');
  const decoded = JSON.parse(JSON.stringify({ pool, match }));
  for (const input of [match, JSON.stringify(match), decoded.match]) {
    const restored = shared.restoreSharedOrbSnapshot(decoded.pool, input, authority);
    expect(restored).toEqual(match);
    const same = shared.advanceSharedAugmentPreparationTime(decoded.pool, restored, elapsed());
    expect(same.ok).toBe(true); expect(same.state).toBe(restored); expect(same.pool).toBe(decoded.pool);
    const next = shared.advanceSharedAugmentPreparationTime(decoded.pool, restored, 15_000);
    const expected = shared.advanceSharedAugmentPreparationTime(pool, match, 15_000);
    expect(next).toEqual(expected);
    expect(next.state.shop).toEqual(shopGlitchShared(pool, match, elapsed(), 15_000).shop);
  }
  expect(() => shared.restoreSharedOrbSnapshot(pool, match)).toThrow('missing independent server authority');
  expect(() => shared.restoreSharedOrbSnapshot(pool, match, room.augmentHistoryAuthority('s3'))).toThrow();
  expect(() => restoreMatch(match)).toThrow(); expect(() => serializeMatch(match)).toThrow();
});

it.each([
  ['clock', (s: any) => { s.augmentHistory.facts.findLast((f: any) => f.kind === 'preparation-time').elapsedMs++; }],
  ['missing clock', (s: any) => { s.augmentHistory.facts.pop(); }],
  ['acquisition', (s: any) => { s.augmentHistory.facts[0].preparationElapsedMs++; }],
  ['shop generation', (s: any) => { s.shop.generation++; }],
  ['RNG', (s: any) => { s.rngState++; }],
  ['missing draw', (s: any) => { s.shopHistory.entries.pop(); }],
  ['gold', (s: any) => { s.gold++; }],
] as const)('rejects a forged %s with the original independent room authority', (_name, mutate) => {
  const bad = structuredClone(mine()), authority = room.augmentHistoryAuthority('s1'); mutate(bad);
  for (const input of [bad, JSON.stringify(bad)]) expect(() => shared.restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
});

it('rejects a mismatched pool and refuses stale snapshots against a later authority', () => {
  const before = mine(), authority = room.augmentHistoryAuthority('s1');
  const badPool = structuredClone(room.state.pool) as any;
  badPool.shops.find((s: any) => s.seatId === 's1').generation++;
  expect(() => shared.restoreSharedOrbSnapshot(badPool, before, authority)).toThrow();
  const oldPool = room.state.pool;
  advanceTo(15_000);
  expect(() => shared.restoreSharedOrbSnapshot(room.state.pool, before, authority)).toThrow();
  expect(() => shared.restoreSharedOrbSnapshot(oldPool, before, room.augmentHistoryAuthority('s1'))).toThrow();
});

for (const target of [17_500, 20_000, 22_500, 25_000, 27_500, 30_000]) it(`refreshes once at ${target}ms`, () => {
  advanceTo(target);
});
it('caps at twelve boundaries and stops after leaving preparation', () => {
  for (const id of owners) expect(seat(id).match.shopHistory!.entries.filter(e => e.kind === 'draw' && e.cause === 'shop-glitch')).toHaveLength(id === 's1' ? 11 : 12);
  advanceTo(30_999);
  const shops = owners.map(id => seat(id).match.shop);
  runUntil(room, clock, s => s.phase === 'battle');
  for (const [i, id] of owners.entries()) expect(seat(id).match.shop).toEqual(shops[i]);
  const facts = owners.map(id => seat(id).match.augmentHistory!.facts.filter(f => f.kind === 'preparation-time').length);
  clock.advance(100);
  for (const [i, id] of owners.entries()) expect(seat(id).match.augmentHistory!.facts.filter(f => f.kind === 'preparation-time')).toHaveLength(facts[i]!);
});

it('discards every staged seat and pool if a later seat clock transaction refuses', () => {
  reach('3-1');
  const before = room.state, actual = shared.advanceSharedAugmentPreparationTime;
  const staged: shared.SharedPoolResult[] = [];
  const spy = vi.spyOn(shared, 'advanceSharedAugmentPreparationTime').mockImplementation((pool, match, ms) => {
    if (match.sharedPool!.seatId === 's3') return { ok: false, pool, state: match, reason: 'stale-seat' };
    const result = actual(pool, match, ms); staged.push(result); return result;
  });
  const publications: typeof room.state[] = [];
  const stop = room.subscribe(s => publications.push(s));
  try { clock.advance(50); } finally { spy.mockRestore(); stop(); }
  expect(staged).toHaveLength(1); expect(staged[0]!.ok).toBe(true);
  expect(staged[0]!.pool).not.toBe(before.pool);
  expect(room.state.phase).toBe('ended');
  expect(room.state.fault).toEqual({ kind: 'seat-stuck', seatId: 's3', reason: 'augment-clock:stale-seat' });
  for (const published of publications) {
    expect(published.pool).toBe(before.pool); expect(published.poolRevision).toBe(before.poolRevision);
    for (const [i, value] of published.seats.entries()) {
      expect(value.match).toBe(before.seats[i]!.match); expect(value.seatRevision).toBe(before.seats[i]!.seatRevision);
    }
  }
  const ended = room.state; clock.advance(30_000); expect(room.state).toBe(ended);
});

for (const deliveryLag of [0, 5000]) describe(`default preparation, deadline delivery lag ${deliveryLag}ms`, () => {
const deadlineClock = new DelayedClock();
const deadlineRoom = makeRoom(new TwoSidedBattleResolver(), {
  seed: 158, clock: deadlineClock, preparationMs: PER_ROUND_PREPARATION,
}).room;
afterAll(() => deadlineRoom.dispose());
it('starts a room with the existing per-round preparation durations', () => { deadlineRoom.start(); });
for (const id of ['1-3', '1-4', '2-1']) it(`reaches default-duration ${id}`, () => { reach(id, deadlineRoom, deadlineClock); });
it('acquires Shop Glitch in the default-duration room', () => {
  for (const id of owners) {
    const c = deadlineRoom.state.seats.find(s => s.seatId === id)!.match.pendingChoice!;
    expect(c.offers).toContain('shop-glitch');
    expect(deadlineRoom.handle(id, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'shop-glitch' })).toMatchObject({ ok: true });
  }
});
for (const id of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`reaches default-duration ${id}`, () => { reach(id, deadlineRoom, deadlineClock); });
it('includes the 20000ms refresh atomically before the preparation deadline freezes every seat', () => {
  expect(deadlineRoom.state.deadlineAt! - deadlineClock.now()).toBe(20_000);
  deadlineClock.lateAdvance(19_999);
  const before = deadlineRoom.state;
  let expectedPool = before.pool;
  const expected = new Map<string, ReturnType<typeof shopGlitchShared>>();
  for (const id of owners) {
    const draw = shopGlitchShared(expectedPool, before.seats.find(s => s.seatId === id)!.match, 19_999, 20_000);
    expected.set(id, draw);
    expectedPool = { ...expectedPool, available: draw.available, shops: draw.shops };
  }
  const frozen: typeof before[] = [];
  const stop = deadlineRoom.subscribe(state => { if (state.phase === 'frozen') frozen.push(state); });
  try {
    if (deliveryLag) deadlineClock.lateAdvance(1 + deliveryLag);
    else deadlineClock.advance(1);
  } finally { stop(); }
  expect(frozen.length).toBeGreaterThan(0);
  for (const snapshot of frozen) {
    expect(snapshot.pool.available).toEqual(expectedPool.available);
    expect(snapshot.pool.shops).toEqual(expectedPool.shops);
    conserved(snapshot.pool, snapshot.seats.map(s => s.match));
    for (const id of owners) {
      const match = snapshot.seats.find(s => s.seatId === id)!.match;
      expect(match.shop).toEqual(expected.get(id)!.shop);
      expect(match.rngState).toBe(expected.get(id)!.rngState);
      expect(match.shopHistory!.entries.filter(e => e.kind === 'draw' && e.cause === 'shop-glitch')).toHaveLength(8);
    }
  }
  expect(deadlineRoom.state.fault).toBeNull();
  expect(deadlineRoom.state.phase).toBe('battle');
});
});

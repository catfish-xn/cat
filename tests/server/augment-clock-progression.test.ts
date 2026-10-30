import { afterAll, expect, it } from 'vitest';
import { nextShopGlitchPreparationTime } from '../../src/simulation/augment-pool-batch5-h1';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { conserved } from '../tp-helpers';
import { makeRoom, runUntil } from './helpers';

// No socket or wall clock: exercise the same bounded timer driver as the whole-match routes.
// v26 D5 pool (7953c99a): real 2-1 draw with Shop Glitch for s1 is now seed 42 (was 26).
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 42, preparationMs: 31_000 });
const owner = () => room.state.seats.find(s => s.seatId === 's1')!;
afterAll(() => room.dispose());

it('starts the room', () => { room.start(); });
for (const roundId of ['1-3', '1-4', '2-1']) it(`reaches ${roundId}`, () => {
  runUntil(room, clock, s => s.roundId === roundId && s.phase === 'preparation', 400);
});
it('acquires Shop Glitch through the real room command at 2-1', () => {
  const c = owner().match.pendingChoice!;
  expect(c.offers).toContain('shop-glitch');
  expect(room.handle('s1', { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'shop-glitch' })).toMatchObject({ ok: true });
});

it('leaves the 50000ms PvP preparation within the original 400-timer budget', () => {
  const deadline = room.state.deadlineAt!;
  const shop = owner().match.shop;
  runUntil(room, clock, s => s.roundId === '2-2' && s.phase === 'preparation', 400);
  expect(clock.now()).toBeGreaterThanOrEqual(deadline);
  expect(room.state.fault).toBeNull();
  const samples = owner().match.augmentHistory!.facts.filter(f => f.kind === 'preparation-time' && f.roundId === '2-1');
  expect(samples).toHaveLength(2); // First observation and the deadline; no recurring PvP polling.
  expect(owner().match.shop.generation).toBe(shop.generation + 1); // Only the natural next-round shop.
});

it('does not restart idle PvP polling on connection publications or commands', () => {
  const deadline = room.state.deadlineAt!;
  clock.advance(50);
  for (const connected of [false, true, false, true]) expect(room.setConnected('s1', connected)).toBe(true);
  expect(room.handle('s1', { type: 'shopLock', locked: false, generation: owner().match.shop.generation })).toMatchObject({ ok: true });
  expect(clock.runNext()).toBe(true);
  expect(clock.now()).toBe(deadline);
  expect(room.state.phase).toBe('battle');
  expect(room.state.fault).toBeNull();
});

for (const roundId of ['2-3', '2-4', '2-5', '2-6', '2-7']) it(`reaches ${roundId} without idle sampling`, () => {
  runUntil(room, clock, s => s.roundId === roundId && (roundId === '2-4' || s.phase === 'preparation'), 400);
});
it('uses domain boundaries, including locked shops, and stops scheduling after the last refresh', () => {
  const match = owner().match;
  const snapshot = structuredClone(match);
  for (const [elapsed, next] of [[0, 2500], [2499, 2500], [2500, 5000], [29_999, 30_000], [30_000, null], [31_000, null]] as const) {
    expect(nextShopGlitchPreparationTime(match, elapsed)).toBe(next);
    expect(nextShopGlitchPreparationTime({ ...match, shop: { ...match.shop, locked: true } }, elapsed)).toBe(next);
  }
  expect(nextShopGlitchPreparationTime({ ...match, round: 11 }, 0)).toBeNull(); // 3-1: PvP.
  expect(nextShopGlitchPreparationTime({ ...match, augments: [] }, 0)).toBeNull();
  expect(match).toEqual(snapshot);
  const deadline = room.state.deadlineAt!;
  clock.advance(30_000);
  expect(owner().match.shopHistory!.entries.filter(e => e.kind === 'draw' && e.cause === 'shop-glitch')).toHaveLength(12);
  // The only next wakeup is the phase deadline, which still records its final observation and freezes.
  expect(clock.runNext()).toBe(true);
  expect(clock.now()).toBe(deadline);
  expect(room.state.phase).toBe('battle');
  expect(room.state.fault).toBeNull();
  conserved(room.state.pool, room.state.seats.map(s => s.match));
});

/**
 * Test-only stand-in for the rules' carousel (G1-P7) until the contract's exports land: it lists units on slots and
 * marks who took which, but awards nothing (seat states and the pool stay the same references), so every room test of
 * the carousel phase checks orchestration only: release order, gates, automatic picks, close and the views.
 */
import { readRoundInfo } from '../../src/simulation/round-selectors';
import type { CarouselAutoCause, CarouselRules, CarouselSchedule, CarouselSlot } from '../../src/server/room/carousel';

interface FakeCarousel { readonly slots: readonly CarouselSlot[] }
export interface FakeCarouselLog { readonly seatId: string; readonly slot: number; readonly cause: CarouselAutoCause | 'player' }

export function fakeCarousel(roundIds: readonly string[], schedule: CarouselSchedule = { firstBatchMs: 0, batchIntervalMs: 1_000, tailMs: 2_000 }, slotCount = 9) {
  const log: FakeCarouselLog[] = [];
  const take = (carousel: FakeCarousel, seatId: string, slot: number): FakeCarousel => ({ slots: carousel.slots.map(entry => entry.slot === slot ? { ...entry, pickedBy: seatId } : entry) });
  const rules: CarouselRules = {
    opensCarousel: state => roundIds.includes(readRoundInfo(state).roundId),
    schedule: () => schedule,
    create: ({ pool, rngState }) => ({ ok: true, pool, rngState, carousel: { slots: Array.from({ length: slotCount }, (_, slot) => ({ slot, definitionId: 'irelia', starLevel: 1, items: ['bf-sword'], pickedBy: null })) } satisfies FakeCarousel }),
    pick: ({ pool, carousel, state, seatId, slot }) => {
      const current = carousel as FakeCarousel;
      if (current.slots.some(entry => entry.pickedBy === seatId)) return { ok: false, reason: 'carousel-already-picked' };
      const target = current.slots.find(entry => entry.slot === slot);
      if (!target) return { ok: false, reason: 'carousel-unknown-slot' };
      if (target.pickedBy !== null) return { ok: false, reason: 'carousel-slot-taken' };
      log.push({ seatId, slot, cause: 'player' });
      return { ok: true, pool, state, carousel: take(current, seatId, slot), events: [] };
    },
    autoPick: ({ pool, carousel, state, seatId, cause }) => {
      const current = carousel as FakeCarousel;
      if (current.slots.some(entry => entry.pickedBy === seatId)) return { ok: false, reason: 'carousel-already-picked' };
      const free = current.slots.find(entry => entry.pickedBy === null);
      if (!free) return { ok: false, reason: 'carousel-closed' };
      log.push({ seatId, slot: free.slot, cause });
      return { ok: true, pool, state, carousel: take(current, seatId, free.slot), events: [] };
    },
    slots: carousel => (carousel as FakeCarousel).slots,
  };
  return { rules, log };
}

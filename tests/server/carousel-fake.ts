/**
 * Test-only stand-in for the rules' carousel (G1-P7, MATCH_CONTRACT "P7 共享选秀规则 API") until the exports land. It
 * follows the contract's observable behaviour that the room depends on: the release order and times are the rules'
 * (HP ascending, seat index on a tie, pairs; 1-1 everyone at once), `pick` checks closed → already-picked → released
 * (`seat-locked`) → slot range → taken, the carousel closes once every participant picked, and `advance` only moves logical
 * time. It awards nothing (seat states and the pool stay the same references), so these tests check orchestration only.
 */
import type { MatchState } from '../../src/simulation/match-types';
import { readRoundInfo } from '../../src/simulation/round-selectors';
import type { SharedPoolState } from '../../src/server-entry';
import type { CarouselGrant, CarouselPublic, CarouselRules } from '../../src/server/room/carousel';

/** Like the contract's CarouselState, the carousel carries the pool it was decided on. */
type FakeState = CarouselPublic & { readonly pool: SharedPoolState };
export interface FakeCarouselLog { readonly seatId: string; readonly slot: number; readonly auto: boolean; readonly elapsedMs: number }
export interface FakeTiming { readonly arrivalMs: number; readonly pairMs: number; readonly tailMs: number }
export const FAKE_TIMING: FakeTiming = { arrivalMs: 1_000, pairMs: 1_000, tailMs: 2_000 };

/**
 * `rounds` maps the roundId the rules report for a seat's state to the carousel it opens ('1-2' → '1-1' stands for the
 * opening marker on the first round entry). `hpOf` gives the participants' HP (the rules read it from the Match states).
 */
export function fakeCarousel(rounds: Readonly<Record<string, string>>, timing: FakeTiming = FAKE_TIMING, hpOf: (state: MatchState) => number = state => state.playerHp) {
  const log: FakeCarouselLog[] = [];
  const opened = new Set<string>();
  const take = (state: FakeState, seatId: string, slot: number): FakeState => {
    const slots = state.slots.map(entry => entry.slot === slot ? { ...entry, pickedBy: seatId } : entry);
    const done = state.releaseOrder.every(id => slots.some(entry => entry.pickedBy === id));
    return { ...state, slots, revision: state.revision + 1, status: done ? 'closed' : 'open' };
  };
  const grant = (state: FakeState, match: MatchState, seatId: string, slot: number, auto: boolean): CarouselGrant => {
    log.push({ seatId, slot, auto, elapsedMs: state.elapsedMs });
    return { ok: true, carousel: take(state, seatId, slot), pool: state.pool, state: match, events: [] };
  };
  const rules: CarouselRules = {
    carouselRound: state => {
      const id = rounds[readRoundInfo(state).roundId] ?? null;
      return id !== null && !opened.has(id) ? id : null;
    },
    create: ({ pool, roundId, seats }) => {
      if (opened.has(roundId)) return { ok: false, reason: 'carousel-exists' };
      opened.add(roundId);
      const order = seats.map((seat, index) => ({ seatId: seat.seatId, index, hp: hpOf(seat.state) })).sort((a, b) => a.hp - b.hp || a.index - b.index).map(seat => seat.seatId);
      const together = roundId === '1-1';
      const releaseAtMs = Object.fromEntries(order.map((seatId, index) => [seatId, timing.arrivalMs + (together ? 0 : Math.floor(index / 2) * timing.pairMs)]));
      const last = Math.max(...Object.values(releaseAtMs));
      const state: FakeState = { pool, id: `pool:carousel:${roundId}`, roundId, revision: 0, status: 'open', releaseOrder: order, releaseAtMs, elapsedMs: 0, deadlineMs: last + timing.tailMs,
        slots: Array.from({ length: 9 }, (_, slot) => ({ slot, definitionId: 'irelia', itemId: 'bf-sword', pickedBy: null })) };
      return { ok: true, carousel: state, pool };
    },
    advance: (carousel, elapsedMs) => {
      const state = carousel as FakeState;
      if (elapsedMs < state.elapsedMs) return { ok: false, reason: 'invalid-time' };
      return { ok: true, carousel: { ...state, elapsedMs, revision: state.revision + 1 }, pool: state.pool };
    },
    pick: ({ carousel, state: match, seatId, slot }) => {
      const state = carousel as FakeState;
      if (state.status === 'closed') return { ok: false, reason: 'carousel-closed' };
      if (!state.releaseOrder.includes(seatId)) return { ok: false, reason: 'unknown-seat' };
      if (state.slots.some(entry => entry.pickedBy === seatId)) return { ok: false, reason: 'already-picked' };
      if (state.releaseAtMs[seatId]! > state.elapsedMs) return { ok: false, reason: 'seat-locked' };
      const target = state.slots.find(entry => entry.slot === slot);
      if (!target) return { ok: false, reason: 'invalid-slot' };
      if (target.pickedBy !== null) return { ok: false, reason: 'slot-taken' };
      return grant(state, match, seatId, slot, false);
    },
    autoPick: ({ carousel, state: match, seatId }) => {
      const state = carousel as FakeState;
      if (state.status === 'closed') return { ok: false, reason: 'carousel-closed' };
      if (state.slots.some(entry => entry.pickedBy === seatId)) return { ok: false, reason: 'already-picked' };
      const free = state.slots.find(entry => entry.pickedBy === null)!;
      return grant(state, match, seatId, free.slot, true);
    },
    view: carousel => carousel as FakeState,
    receiptId: (carousel, seatId) => (carousel as FakeState).slots.some(entry => entry.pickedBy === seatId) ? `${(carousel as FakeState).id}:${seatId}` : null,
  };
  return { rules, log };
}

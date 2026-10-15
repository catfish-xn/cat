/**
 * G1-P7 shared carousel (选秀): what the room needs from the rules, and the room's own release schedule.
 *
 * The rules own the carousel itself (S13_RULES_GAP §11, MATCH_CONTRACT / MULTIPLAYER_CONTRACT): which units and items
 * stand on it, the shared-pool deduction, the pick and its unique receipt, the automatic pick and every refusal. The
 * room only orchestrates: when a carousel opens, who is released when (HP low to high, in batches), which seats are
 * picked for automatically (bots, a bot-controlled or disconnected seat when its batch opens, everyone left at the end).
 * `CarouselRules` is that boundary; the room never looks inside the rules' carousel state (`unknown` here).
 */
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import type { SharedPoolState } from '../../server-entry';
import type { CarouselBatchView, CarouselSlotView } from '../protocol';

/**
 * Refusals of the rules' carousel pick, passed to the client verbatim. Placeholder until the contract's failure enum
 * lands (S13_RULES_GAP §11); the binding then re-exports that enum here.
 */
export type CarouselFailure = 'carousel-slot-taken' | 'carousel-already-picked' | 'carousel-unknown-slot' | 'carousel-not-participant' | 'carousel-closed';
/** Why the room asks for an automatic pick; the rules may pick differently per cause (contract bot strategy). */
export type CarouselAutoCause = 'bot' | 'disconnected' | 'timeout';
export type CarouselTransaction =
  | { readonly ok: true; readonly pool: SharedPoolState; readonly carousel: unknown; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly reason: CarouselFailure };
export type CarouselCreation =
  | { readonly ok: true; readonly pool: SharedPoolState; readonly carousel: unknown; readonly rngState: number }
  | { readonly ok: false; readonly reason: string };
/** One unit standing on the carousel as the rules list it; copied verbatim into the view. */
export type CarouselSlot = Omit<CarouselSlotView, 'pickedBy'> & { readonly pickedBy: string | null };

/** Release timing of one carousel; durations in room-clock milliseconds. */
export interface CarouselSchedule {
  /** Seats freed together (TFT x-4: two at a time); a value ≥ the alive count frees everyone at once. */
  readonly batchSize: number;
  /** From the carousel opening to the first batch. */
  readonly firstBatchMs: number;
  /** Between two batches. */
  readonly batchIntervalMs: number;
  /** From the last batch to the close, when every seat still without a unit gets one automatically. */
  readonly tailMs: number;
}

export interface CarouselRules {
  /** Whether this round opens with a shared carousel, read from a seat's state at round entry (all alive seats agree). */
  opensCarousel(state: MatchState): boolean;
  /** Release timing of the carousel of `roundId`. */
  schedule(roundId: string): CarouselSchedule;
  /** Builds the round's carousel from the shared pool and the room rng; nothing is published on a refusal. */
  create(input: { readonly pool: SharedPoolState; readonly roundId: string; readonly rngState: number; readonly seats: readonly MatchState[] }): CarouselCreation;
  /** A seat takes the unit on `slot`; the rules check the slot, the seat and the receipt. */
  pick(input: { readonly pool: SharedPoolState; readonly carousel: unknown; readonly state: MatchState; readonly seatId: string; readonly slot: number }): CarouselTransaction;
  /** The rules choose for the seat (bot strategy, disconnection, the close). */
  autoPick(input: { readonly pool: SharedPoolState; readonly carousel: unknown; readonly state: MatchState; readonly seatId: string; readonly cause: CarouselAutoCause }): CarouselTransaction;
  /** The units standing on the carousel, in slot order, with the seat that took each. */
  slots(carousel: unknown): readonly CarouselSlot[];
}

/** The carousel of the current round as the room keeps it; everything a view needs is already copied out of the rules' state. */
export interface RoomCarousel {
  readonly carouselId: string;
  readonly roundId: string;
  /** The rules' own carousel state; opaque to the room. */
  readonly rules: unknown;
  readonly slots: readonly CarouselSlot[];
  readonly batches: readonly CarouselBatchView[];
  readonly openBatches: number;
  readonly endsAt: number;
  /** Seats that hold their carousel unit, by seat id → slot. */
  readonly picks: Readonly<Record<string, number>>;
}

/**
 * Release order (room-owned, V2: lowest HP picks first): alive seats by authoritative HP ascending, fixed seat index on a
 * tie, cut into batches of `batchSize` opening `batchIntervalMs` apart after `firstBatchMs`. Pure.
 */
export function planCarouselBatches(seats: readonly { readonly seatId: string; readonly index: number; readonly hp: number }[], schedule: CarouselSchedule, openedAt: number):
  { readonly batches: readonly CarouselBatchView[]; readonly endsAt: number } {
  const order = [...seats].sort((a, b) => a.hp - b.hp || a.index - b.index).map(seat => seat.seatId);
  const size = Math.max(1, Math.trunc(schedule.batchSize));
  const batches: CarouselBatchView[] = [];
  for (let at = 0; at < order.length; at += size) batches.push({ seatIds: order.slice(at, at + size), opensAt: openedAt + schedule.firstBatchMs + batches.length * schedule.batchIntervalMs });
  const last = batches.at(-1)?.opensAt ?? openedAt + schedule.firstBatchMs;
  return { batches, endsAt: last + schedule.tailMs };
}

/** Whether `seatId` is in a batch that already opened. */
export function carouselReleased(carousel: RoomCarousel, seatId: string): boolean {
  return carousel.batches.slice(0, carousel.openBatches).some(batch => batch.seatIds.includes(seatId));
}

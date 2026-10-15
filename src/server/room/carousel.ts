/**
 * G1-P7 shared carousel (选秀): the boundary between the room and the rules' carousel (MATCH_CONTRACT "P7 共享选秀规则 API",
 * MULTIPLAYER_CONTRACT §21, S13_RULES_GAP §11).
 *
 * The rules own everything about the carousel: the units and items on its slots, the shared-pool reservations, the release
 * order and release times (`releaseOrder`, `releaseAtMs`, `deadlineMs`), whether a seat may pick, the pick and its grant,
 * the automatic pick and every refusal. The room only orchestrates: it opens the carousel at round entry, turns its clock
 * into the rules' logical `elapsedMs`, asks for automatic picks at the contract's moments (a bot-controlled seat when it is
 * released, every seat still without a unit at the deadline, in `releaseOrder`), and keeps the phase until the deadline
 * (user decision, option B). `CarouselRules` is implemented by the binding over the contract exports; the room never looks
 * inside the rules' state (`unknown`).
 */
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import type { SharedPoolState } from '../../server-entry';
import type { CarouselSlotView } from '../protocol';

/**
 * The contract's failure enum (MATCH_CONTRACT P7 `CarouselFailure`), forwarded verbatim, plus the room's `stale-carousel`
 * (MULTIPLAYER_CONTRACT §21.1: the command named another carouselId or revision). Re-exported from the rules once implemented.
 */
export type CarouselFailure =
  | 'invalid-pool' | 'invalid-round' | 'invalid-rng'
  | 'invalid-participants' | 'pool-exhausted' | 'carousel-exists'
  | 'invalid-carousel' | 'carousel-closed' | 'unknown-seat'
  | 'seat-eliminated' | 'seat-locked' | 'already-picked'
  | 'invalid-slot' | 'slot-taken' | 'invalid-time'
  | 'receipt-mismatch' | 'stale-pool' | 'invalid-match'
  | 'stale-carousel';

/** Why the room asks for an automatic pick (logs and tests; the rules' auto pick takes no cause). */
export type CarouselAutoCause = 'bot' | 'disconnected' | 'timeout';

/** The public part of the rules' carousel state (§21.1), copied field by field into every view. */
export interface CarouselPublic {
  readonly id: string;
  readonly roundId: string;
  readonly revision: number;
  readonly status: 'open' | 'closed';
  readonly slots: readonly CarouselSlotView[];
  readonly releaseOrder: readonly string[];
  readonly releaseAtMs: Readonly<Record<string, number>>;
  readonly elapsedMs: number;
  readonly deadlineMs: number;
}

/** One committed rules transaction: the carousel, the pool it carries and (for a pick) the seat that received the grant. */
export type CarouselStep =
  | { readonly ok: true; readonly carousel: unknown; readonly pool: SharedPoolState }
  | { readonly ok: false; readonly reason: CarouselFailure };
export type CarouselGrant =
  | { readonly ok: true; readonly carousel: unknown; readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly reason: CarouselFailure };

export interface CarouselRules {
  /**
   * The carousel this round entry opens, or null: '1-1' at the first round entry (the opening marker), '2-4'…'6-4' at those
   * rounds. Read from a seat's state; the room asks every alive seat and opens only when all agree.
   */
  carouselRound(state: MatchState): string | null;
  /** `prepareCarouselParticipants` on the alive seats, then `createCarousel(pool, roundId, rng)`; one publication. */
  create(input: { readonly pool: SharedPoolState; readonly roundId: string; readonly roomSeed: number; readonly seats: readonly { readonly seatId: string; readonly state: MatchState }[] }): CarouselStep;
  /** `advanceCarousel(state, elapsedMs)`: monotone logical time from the room clock. */
  advance(carousel: unknown, elapsedMs: number): CarouselStep;
  /** `pickFromCarousel` then `grantCarouselPick` for this seat as one transaction; a failed grant discards the pick. */
  pick(input: { readonly carousel: unknown; readonly state: MatchState; readonly seatId: string; readonly slot: number }): CarouselGrant;
  /** `autoPickFromCarousel` then `grantCarouselPick`, same transaction rule. */
  autoPick(input: { readonly carousel: unknown; readonly state: MatchState; readonly seatId: string }): CarouselGrant;
  /** Public part of the state (§21.1). */
  view(carousel: unknown): CarouselPublic;
  /** This seat's own receipt id once it picked; null before. */
  receiptId(carousel: unknown, seatId: string): string | null;
}

/** The carousel of the current round as the room keeps it. */
export interface RoomCarousel {
  /** The rules' own state; opaque to the room. */
  readonly rules: unknown;
  /** Public copy of it after the last transaction. */
  readonly view: CarouselPublic;
  /** Room clock at logical time 0: `elapsedMs` is `now - startedAt`. */
  readonly startedAt: number;
  /** Receipt id of each seat that holds its carousel unit. */
  readonly receipts: Readonly<Record<string, string>>;
}

/** The slot this seat took, from the public slots; null before it picked. */
export function carouselPickedSlot(view: CarouselPublic, seatId: string): number | null {
  return view.slots.find(slot => slot.pickedBy === seatId)?.slot ?? null;
}
/** Whether the rules' schedule has released this seat at the carousel's current logical time. */
export function carouselReleased(view: CarouselPublic, seatId: string): boolean {
  const at = view.releaseAtMs[seatId];
  return at !== undefined && at <= view.elapsedMs;
}

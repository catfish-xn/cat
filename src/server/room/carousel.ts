/**
 * G1-P7 shared carousel (选秀): the room's binding of the rules' carousel (MATCH_CONTRACT "P7 共享选秀规则 API",
 * MULTIPLAYER_CONTRACT §21, S13_RULES_GAP §11).
 *
 * The rules own everything about the carousel: the units and items on its slots, the shared-pool reservations, the release
 * order and release times (`releaseOrder`, `releaseAtMs`, `deadlineMs`), whether a seat may pick, the pick and its grant,
 * the automatic pick, the x-4 economy at the close and every refusal. The room only orchestrates: it opens the carousel at
 * round entry, turns its clock into the rules' logical `elapsedMs`, asks for automatic picks at the contract's moments (a
 * bot-controlled seat when it is released, every seat still without a unit at the deadline, in `releaseOrder`), and keeps
 * the phase until the deadline plus the departure (option B: never closed early).
 *
 * `CarouselRules` is exactly the contract's exports (§21.4–21.5), bound once here; the room calls nothing else of the rules
 * for the carousel and never computes a slot, a cost or a pool count itself.
 */
import {
  advanceCarousel, autoPickCarouselForSeat, completeCarouselForSeat, createCarousel, createCarouselMatch, listCarouselSlots, opensCarousel,
  pickCarouselForSeat, prepareCarouselParticipants, releaseCarouselParticipant, resolvePendingCarouselUnits, sellPendingCarouselUnit,
  type CarouselEvent, type CarouselFailure as RulesCarouselFailure, type CarouselRoundId, type CarouselState, type HeldCarouselUnit,
} from '../../server-entry';
import type { MatchEvent, MatchState } from '../../simulation/match-types';

/**
 * The rules' carousel transactions the room uses (MULTIPLAYER_CONTRACT §21.4–21.5), bound to the contract exports.
 * `releaseCarouselParticipant` has no call site. MULTIPLAYER_CONTRACT §21.5 says an elimination must not bypass it while a
 * carousel is active; the room's current reading (pending a contract clarification, docs/UI_REQUESTS.md:916) is that it
 * is therefore needed only then, and the room eliminates only at a round settlement, after the carousel phase has closed.
 * Those later eliminations use `releaseSeatOnElimination`, which returns the seat's holdings but leaves `carouselReceipts`
 * alone: the dead seat's receipts stay `granted`. Pinned in tests/server/carousel-room.test.ts.
 */
export const CAROUSEL_RULES_BINDING = {
  createCarouselMatch, opensCarousel, prepareCarouselParticipants, createCarousel, advanceCarousel, pickCarouselForSeat, autoPickCarouselForSeat,
  completeCarouselForSeat, releaseCarouselParticipant, resolvePendingCarouselUnits, sellPendingCarouselUnit, listCarouselSlots,
} as const;
export type CarouselRules = typeof CAROUSEL_RULES_BINDING;

/**
 * The contract's failure enum (MATCH_CONTRACT P7 `CarouselFailure`), forwarded verbatim, plus the room's `stale-carousel`
 * (MULTIPLAYER_CONTRACT §21.1: the command named another carouselId or revision).
 */
export type CarouselFailure = RulesCarouselFailure | 'stale-carousel';

/** Why the room asks for an automatic pick; passed to the rules' `autoPickCarouselForSeat` as is. */
export type CarouselAutoCause = 'bot' | 'disconnected' | 'timeout';

/**
 * One entry of the room's carousel ledger (`RoomState.carouselLedger`, kept for the whole match): every event one carousel
 * transaction returned (creation, a pick and its grant, the close, an x-4 completion), with the seat it was for.
 */
export interface CarouselLedgerEntry { readonly carouselId: string; readonly seatId: string | null; readonly events: readonly (CarouselEvent | MatchEvent)[] }

/** The carousel of the current round as the room keeps it; published with the pool and the seats it was decided against. */
export interface RoomCarousel {
  /** The rules' own state. `state.pool` is the room's pool while the carousel phase runs. */
  readonly state: CarouselState;
  /** Room clock at logical 0: `elapsedMs` is `now - startedAt`, capped at the deadline. */
  readonly startedAt: number;
  /** Seats the room picked for, and why (the client says "自动选取"). */
  readonly auto: Readonly<Record<string, CarouselAutoCause>>;
}

/**
 * The carousel a seat's state opens at this round entry, or null. Only the rules' `opensCarousel` decides (P7-1: the five
 * x-4 rounds, MATCH_CONTRACT "P7-1 正式修订"); the carousel then runs on the seat's own round.
 */
export function carouselRoundOf(rules: CarouselRules, state: MatchState): CarouselRoundId | null {
  return rules.opensCarousel(state) ? state.roundDefinitionId as CarouselRoundId : null;
}
/**
 * P7-1 holding slot (临时位): the units of this seat the rules keep without a place because its bench and board were both
 * full (`carousel.heldCarouselUnits`, the canonical field; MULTIPLAYER_CONTRACT §21.6). Empty without carousel metadata.
 */
export function heldCarouselUnits(state: MatchState): readonly HeldCarouselUnit[] { return state.carousel?.heldCarouselUnits ?? []; }
/** Whether the rules' schedule has released this seat at the carousel's current logical time. */
export function carouselReleased(state: CarouselState, seatId: string): boolean {
  const at = state.releaseAtMs[seatId];
  return at !== undefined && at <= state.elapsedMs;
}
/** The slot this seat took; null before it picked (or when its card was released). */
export function carouselPickedSlot(state: CarouselState, seatId: string): number | null {
  const receipt = state.receipts.find(candidate => candidate.seatId === seatId && candidate.status !== 'released');
  return receipt ? receipt.slot : null;
}

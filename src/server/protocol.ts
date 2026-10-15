/**
 * Shared client/server protocol types (work order C3). Pure types and constants, no
 * implementation: the room (src/server/room), the local in-browser client and the UI
 * (src/rendering/online) all import these shapes from here, so there is exactly one copy.
 * See docs/UI_REQUESTS.md "八人联机界面数据需求" and docs/MULTIPLAYER_RENOVATION_V2.md §5.
 * No rule, gold, RNG or outcome is ever computed from these on the client.
 */
import type { UnitLocation } from '../simulation/units';
import type { ConsumableFailure, ConsumableTarget } from '../server-entry';
export type { ConsumableFailure, ConsumableTarget };

export const ROOM_CAPACITY = 8;
export const ROOM_PROTOCOL_VERSION = 1;

/**
 * Server-side room phases (V2 §3.2). `awaiting-settlement` (B3): a two-sided PvP round has produced
 * its settlement proposals and waits for the rules' commit entry (T3); until T3 lands the room
 * faults there with `settlement-unavailable`.
 */
export type RoomPhase = 'waiting' | 'carousel' | 'preparation' | 'choice' | 'frozen' | 'battle' | 'awaiting-settlement' | 'settlement' | 'ended';
export type SeatKind = 'human' | 'bot';
/**
 * Who issues this seat's commands right now (B6): its human player, a fill-in bot (`kind: 'bot'`, for the whole
 * match), or a bot that took over a human seat whose player has been disconnected too long (`takeover`, revoked
 * the moment the player resumes). Exactly one controller at any time.
 */
export type SeatController = 'human' | 'bot' | 'takeover';

/* ---------------- views the server publishes to one seat ---------------- */

export interface SeatPublic {
  readonly seatId: string;
  readonly name: string;
  readonly kind: SeatKind;
  readonly hp: number;
  readonly level: number;
  readonly alive: boolean;
  /** Final rank once decided (1 = winner); null while the match runs. */
  readonly rank: number | null;
  readonly connected: boolean;
  readonly controller: SeatController;
  /**
   * What everyone may see of this seat's build (TFT: click a player to look at their board), work order C5.
   * Only units deployed on the board, with the items they hold. Never the bench, shop, gold, XP or RNG.
   * Optional so older views and tests stay valid; the room always fills it.
   */
  readonly publicBoard?: PublicBoard;
}
export interface PublicBoardUnit {
  readonly definitionId: string;
  readonly starLevel: number;
  /** Cell on the owner's own board, in the owner's orientation (their deployment rows at the bottom). */
  readonly cell: { readonly col: number; readonly row: number };
  /** Item definition ids held by the unit, in slot order. */
  readonly items: readonly string[];
}
export interface PublicBoard { readonly units: readonly PublicBoardUnit[] }
/**
 * C15: one of MY units in my battle replay. The replay names units by their battle ids (contract §10.2); this pair
 * says which of my own units a battle id stands for, so the client can show that unit's equipment without
 * parsing the id. Only my seat's `unit` entries are sent; the opponent's ids and every item/augment/anomaly entry stay on the server.
 */
export interface ReplayUnitId { readonly combatId: string; readonly originalId: string }
/** Phase as the client sees it: `frozen` and `battle` both show as `combat`, `waiting` as `lobby`. G1-P7 adds `carousel`. */
export type PlayerViewPhaseKind = 'lobby' | 'preparation' | 'choice' | 'carousel' | 'combat' | 'settlement' | 'ended';

/* ---------------- G1-P7 shared carousel (选秀) ---------------- */

/** One unit standing on the carousel, with the items it carries (definition ids, in the rules' order). */
export interface CarouselSlotView {
  /** Slot index the rules gave it; the `carouselPick` command names it. */
  readonly slot: number;
  readonly definitionId: string;
  readonly starLevel: number;
  readonly items: readonly string[];
  /** Seat that took it (shown to everyone, as on the TFT carousel); null while it still stands. */
  readonly pickedBy: string | null;
}
/** One release group: the seats it frees (lowest HP first, as the rules ordered them) and when it opens. */
export interface CarouselBatchView {
  readonly seatIds: readonly string[];
  /** Server clock (ms) at which this batch may pick. */
  readonly opensAt: number;
}
/**
 * The carousel of the current round, the same for every seat apart from `canPick`/`myPick`. Everything here is copied
 * from the rules' carousel state and the room's schedule; the client decides nothing (who is released, what is left).
 */
export interface CarouselView {
  readonly carouselId: string;
  readonly roundName: string;
  readonly slots: readonly CarouselSlotView[];
  /** Release order, first batch first. */
  readonly batches: readonly CarouselBatchView[];
  /** Batches released so far (0 before the first opens). */
  readonly openBatches: number;
  /** Server clock (ms) at which the carousel closes and every seat without a unit gets one automatically. */
  readonly endsAt: number;
  /** My seat is released, alive and has not picked yet. */
  readonly canPick: boolean;
  /** Slot my seat took (by hand or automatically); null until then. */
  readonly myPick: number | null;
}
export interface PlayerViewPhase {
  readonly kind: PlayerViewPhaseKind;
  readonly round: number;
  readonly roundName: string;
  /** Server clock (ms) at which the phase ends, or null when no deadline applies. */
  readonly endsAt: number | null;
  /** Server clock (ms) when this view was produced; the client derives the countdown from the pair. */
  readonly serverNow: number;
}
/** Why a room ended abnormally; `detail` is already human-readable text chosen by the server. */
export type PlayerViewFaultKind = 'resolver-error' | 'invalid-results' | 'seat-stuck' | 'phase-mismatch' | 'settlement-unavailable' | 'stalled' | 'abandoned' | 'carousel-error';
export interface PlayerViewFault { readonly kind: PlayerViewFaultKind; readonly detail: string }
export interface PlayerView {
  readonly mySeatId: string;
  readonly seats: readonly SeatPublic[];
  readonly phase: PlayerViewPhase;
  /**
   * Seat this player fights (or fought) this round; null for PvE/supply rounds and, since G1-P6, during the choice and
   * preparation of a PvP round: the real opponent is drawn when the round freezes.
   */
  readonly opponentSeatId: string | null;
  /**
   * G1-P6: during the choice and preparation of a PvP round, the seats this player may fight (seat order, alive, never
   * me); `opponentSeatId` is always one of them once drawn. Empty otherwise. Optional so older views stay valid; the room
   * always fills it.
   */
  readonly opponentCandidates?: readonly string[];
  /** G1-P7: the shared carousel while the room is in its carousel phase; null or absent otherwise. */
  readonly carousel?: CarouselView | null;
  /** Full ranking once the match ended normally. */
  readonly ranking: readonly SeatPublic[] | null;
  /** Set when the room ended abnormally (then `ranking` stays null). */
  readonly fault: PlayerViewFault | null;
}
export interface QueueEntry { readonly name: string; readonly kind: SeatKind; readonly me: boolean }
export interface LobbyView {
  readonly queue: readonly QueueEntry[];
  readonly capacity: number;
  readonly joined: boolean;
  readonly canStart: boolean;
  readonly error: string | null;
}
/*
 * Combat is computed on the server; a seat receives its battle as one compact `replay` message
 * (contract §14.2, `CombatReplay` of src/server-entry) and plays it back at tick pace. It is not a
 * MatchState: economy, shop and settlement arrive separately as my private seat view.
 */

/* ---------------- commands a seat may send ---------------- */

/**
 * Every command maps 1:1 to a public command of src/simulation/match.ts; the room adds nothing. `useConsumable`
 * (contract §18.3): `consumableId` is the tool instance id, never a definition id or a count; the rules decide everything.
 */
export type ClientCommand =
  | { readonly type: 'useConsumable'; readonly consumableId: string; readonly target: ConsumableTarget }
  | { readonly type: 'deploy'; readonly unitId: string; readonly target: UnitLocation }
  | { readonly type: 'buy'; readonly slot: number; readonly generation: number }
  | { readonly type: 'sell'; readonly unitId: string }
  | { readonly type: 'shopLock'; readonly locked: boolean; readonly generation: number }
  | { readonly type: 'reroll' }
  | { readonly type: 'buyXp' }
  | { readonly type: 'combine'; readonly a: string; readonly b: string }
  | { readonly type: 'equip'; readonly itemId: string; readonly unitId: string; readonly slot: number }
  | { readonly type: 'choose'; readonly choiceId: string; readonly generation: number; readonly definitionId: string }
  | { readonly type: 'anomalyTarget'; readonly choiceId: string; readonly generation: number; readonly unitId: string }
  | { readonly type: 'anomalyReroll'; readonly choiceId: string; readonly generation: number };
export type ConsumableCommand = Extract<ClientCommand, { type: 'useConsumable' }>;
/**
 * G1-P7: take the unit on carousel slot `slot`. Not a seat command of match.ts: the room hands it to the rules' shared
 * carousel pick, which decides everything (release, slot still free, the unit and its items). Kept out of ClientCommand so
 * the bot policy and its helpers, which map ClientCommand 1:1 to match.ts, are unchanged.
 */
export interface CarouselPickCommand { readonly type: 'carouselPick'; readonly slot: number }
/** Every command a seat may send over the wire: the match.ts commands (§18.8) plus the carousel pick (G1-P7). */
export type WireCommand = ClientCommand | CarouselPickCommand;

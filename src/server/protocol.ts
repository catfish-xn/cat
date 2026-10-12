/**
 * Shared client/server protocol types (work order C3). Pure types and constants, no
 * implementation: the room (src/server/room), the local in-browser client and the UI
 * (src/rendering/online) all import these shapes from here, so there is exactly one copy.
 * See docs/UI_REQUESTS.md "八人联机界面数据需求" and docs/MULTIPLAYER_RENOVATION_V2.md §5.
 * No rule, gold, RNG or outcome is ever computed from these on the client.
 */
import type { CombatState, LedgerCombatEvent } from '../simulation/combat-types';
import type { UnitLocation } from '../simulation/units';

export const ROOM_CAPACITY = 8;
export const ROOM_PROTOCOL_VERSION = 1;

/**
 * Server-side room phases (V2 §3.2). `awaiting-settlement` (B3): a two-sided PvP round has produced
 * its settlement proposals and waits for the rules' commit entry (T3); until T3 lands the room
 * faults there with `settlement-unavailable`.
 */
export type RoomPhase = 'waiting' | 'preparation' | 'choice' | 'frozen' | 'battle' | 'awaiting-settlement' | 'settlement' | 'ended';
export type SeatKind = 'human' | 'bot';

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
/** Phase as the client sees it: `frozen` and `battle` both show as `combat`, `waiting` as `lobby`. */
export type PlayerViewPhaseKind = 'lobby' | 'preparation' | 'choice' | 'combat' | 'settlement' | 'ended';
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
export type PlayerViewFaultKind = 'resolver-error' | 'invalid-results' | 'seat-stuck' | 'phase-mismatch' | 'settlement-unavailable';
export interface PlayerViewFault { readonly kind: PlayerViewFaultKind; readonly detail: string }
export interface PlayerView {
  readonly mySeatId: string;
  readonly seats: readonly SeatPublic[];
  readonly phase: PlayerViewPhase;
  /** Seat this player fights (or fought) this round; null for PvE/supply rounds. */
  readonly opponentSeatId: string | null;
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
/**
 * Combat is computed on the server; the client only plays these frames back at tick pace.
 * A frame is battle view data (B3, contract §10.6 item 3): the CombatState after one tick and the
 * ledger events of that tick, from my seat's point of view (my units are `player`, bottom half).
 * It is not a MatchState: economy, shop and settlement arrive separately as my authoritative state.
 */
export interface CombatFrame { readonly state: CombatState; readonly events: readonly LedgerCombatEvent[] }

/* ---------------- commands a seat may send ---------------- */

/** Every command maps 1:1 to a public command of src/simulation/match.ts; the room adds nothing. */
export type ClientCommand =
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

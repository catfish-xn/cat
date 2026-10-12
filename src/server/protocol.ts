/**
 * Types shared by the server and the browser client (pure types, no implementation).
 *
 * Moved here from src/server/room/types.ts for work order B2 (step 1 of C3). Until C3 lands,
 * src/rendering/online/protocol.ts still carries a structurally identical copy; when the two
 * meet, C3's layout wins and the rendering file becomes `export * from '../../server/protocol'`.
 * The network message envelopes live in src/server/net/messages.ts.
 */
import type { LedgerCombatEvent } from '../simulation/combat-types';
import type { MatchState } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';

export const ROOM_CAPACITY = 8;

export type SeatKind = 'human' | 'bot';
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
}
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
export interface PlayerView {
  readonly mySeatId: string;
  readonly seats: readonly SeatPublic[];
  readonly phase: PlayerViewPhase;
  /** Seat this player fights (or fought) this round; null for PvE/supply rounds. */
  readonly opponentSeatId: string | null;
  /** Full ranking once the match ended. */
  readonly ranking: readonly SeatPublic[] | null;
}
export interface QueueEntry { readonly name: string; readonly kind: SeatKind; readonly me: boolean }
export interface LobbyView {
  readonly queue: readonly QueueEntry[];
  readonly capacity: number;
  readonly joined: boolean;
  readonly canStart: boolean;
  readonly error: string | null;
}
/** Combat is computed on the server; the client only plays these frames back. */
export interface CombatFrame { readonly state: MatchState; readonly events: readonly LedgerCombatEvent[] }

/** A player's intent. The actor is the seat bound to the connection, never a field of the command. */
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

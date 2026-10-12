/**
 * Client-facing view of an online match. These are the fields the UI needs from the
 * server; the real transport (T5) must deliver the same shapes. See docs/UI_REQUESTS.md
 * "八人联机界面数据需求". No rule, gold, RNG or outcome is computed on the client.
 */
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';
import type { UnitLocation } from '../../simulation/units';

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
export type RoomPhaseKind = 'lobby' | 'preparation' | 'choice' | 'combat' | 'settlement' | 'ended';
export interface RoomPhase {
  readonly kind: RoomPhaseKind;
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
  readonly phase: RoomPhase;
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

export interface ClientListeners {
  lobby(view: LobbyView): void;
  view(view: PlayerView): void;
  /** Authoritative private state for my seat outside combat. */
  state(state: MatchState): void;
  /** One finished battle's frames, to be played back at tick pace. */
  combat(frames: readonly CombatFrame[]): void;
}
/** What the UI talks to. The fake in-memory implementation lives in fake-server.ts. */
export interface GameClient {
  readonly transport: 'fake' | 'websocket';
  listen(listeners: ClientListeners): () => void;
  joinQueue(name: string): void;
  leaveQueue(): void;
  startMatch(): void;
  /** In-memory fake answers synchronously; a network client will answer with a pending receipt (T8). */
  send(command: ClientCommand): MatchCommandResult;
  /** Lobby again after a finished match. */
  reset(): void;
  dispose(): void;
}

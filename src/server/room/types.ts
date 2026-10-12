/**
 * Room state machine types (pipeline B, work order B1).
 *
 * Field layout follows docs/MULTIPLAYER_RENOVATION_V2.md §3.2 and docs/MULTIPLAYER_CONTRACT.md §2.
 * Every number is an integer. The room never computes a rule: each seat keeps its own
 * MatchState and only the public commands of src/simulation/match.ts change it.
 *
 * Authority: `SeatState.hp` is the room's authoritative HP; `MatchState.playerHp` is a
 * derived mirror that the placeholder resolver keeps equal by construction (see
 * battle-resolver.ts). Clients never read the mirror.
 */
import type { MatchCommandResult, MatchEvent, MatchFailure, MatchState } from '../../simulation/match-types';
import type { CombatResult } from '../../simulation/combat-types';
import { ROOM_CAPACITY, ROOM_PROTOCOL_VERSION, type ClientCommand, type RoomPhase, type SeatKind } from '../protocol';

// Shared with the client: one copy lives in src/server/protocol.ts (C3).
export { ROOM_CAPACITY, ROOM_PROTOCOL_VERSION };
export type { RoomPhase, SeatKind, PlayerView, PlayerViewPhase, PlayerViewPhaseKind, PlayerViewFault, PlayerViewFaultKind, SeatPublic, QueueEntry, LobbyView, CombatFrame, ClientCommand } from '../protocol';
export type RoundKind = 'pvp' | 'pve' | 'supply';

export interface SeatSpec { readonly seatId: string; readonly name: string; readonly kind: SeatKind }

export interface SeatState {
  readonly seatId: string;
  /** Fixed seat order; the last tie-break of the ranking rule. */
  readonly index: number;
  readonly name: string;
  readonly kind: SeatKind;
  readonly connected: boolean;
  /** Authoritative HP (truncated at 0). */
  readonly hp: number;
  readonly alive: boolean;
  /** Final rank (1 = winner) once decided; null while still playing. */
  readonly rank: number | null;
  readonly eliminatedRound: number | null;
  /** Bumps on every accepted command or settlement that touched this seat. */
  readonly seatRevision: number;
  /** Private rule state of this seat; only src/simulation/match.ts commands change it. */
  readonly match: MatchState;
  readonly seed: number;
}

/** An opponent is either a real seat or the frozen mirror of another survivor (V2 D6). */
export type Opponent =
  | { readonly kind: 'seat'; readonly seatId: string }
  | { readonly kind: 'mirror'; readonly sourceSeatId: string };
export interface Pairing { readonly battleId: string; readonly seatId: string; readonly opponent: Opponent }

export interface BattleSeatInput { readonly seatId: string; readonly state: MatchState }
/** Frozen by the room at the preparation deadline; immutable once handed to the resolver. */
export interface BattleInput {
  readonly battleId: string;
  readonly roomId: string;
  readonly round: number;
  readonly roundId: string;
  readonly roundKind: RoundKind;
  /** roomRevision at freeze time; results from another revision are stale. */
  readonly roomRevision: number;
  /** One seat for pve/supply/mirror battles, two for a real pairing. */
  readonly seats: readonly BattleSeatInput[];
  /** Set when `seats[0]` fights the frozen copy of another survivor; the source is not a participant. */
  readonly mirrorOf: BattleSeatInput | null;
}
export interface BattleFrame { readonly state: MatchState; readonly events: readonly MatchEvent[] }
export interface BattleSeatOutcome {
  readonly seatId: string;
  /** Seat state after its battle, as produced by the rules; the room stores it verbatim. */
  readonly state: MatchState;
  readonly result: CombatResult | 'supply' | null;
  /** Untruncated HP damage decided by the rules (>= 0); the room subtracts it. */
  readonly damage: number;
  readonly frames: readonly BattleFrame[];
}
export interface BattleResult {
  readonly battleId: string;
  readonly round: number;
  readonly roomRevision: number;
  readonly outcomes: readonly BattleSeatOutcome[];
}

export interface SettledSeat {
  readonly seatId: string;
  readonly hpBefore: number;
  readonly damage: number;
  /** hpBefore - damage, not truncated; first tie-break of the ranking rule. */
  readonly hpAfterRaw: number;
  readonly hpAfter: number;
  readonly match: MatchState;
}
export interface RankEntry { readonly seatId: string; readonly rank: number }
/** One commit per round; `settlementId` is the idempotency key. */
export interface RoundSettlement {
  readonly settlementId: string;
  readonly round: number;
  readonly roundId: string;
  readonly results: readonly BattleResult[];
  readonly seats: readonly SettledSeat[];
  readonly eliminated: readonly RankEntry[];
  /** Full final ranking when this settlement ends the match. */
  readonly finalRanking: readonly RankEntry[] | null;
}

export type RoomFault =
  | { readonly kind: 'resolver-error'; readonly battleId: string; readonly message: string }
  | { readonly kind: 'invalid-results'; readonly detail: string }
  | { readonly kind: 'seat-stuck'; readonly seatId: string; readonly reason: string }
  | { readonly kind: 'phase-mismatch'; readonly detail: string };

export interface RoomState {
  readonly roomId: string;
  readonly protocolVersion: typeof ROOM_PROTOCOL_VERSION;
  readonly phase: RoomPhase;
  readonly round: number;
  readonly roundId: string;
  readonly roundName: string;
  readonly roundKind: RoundKind | null;
  /** Room clock time at which the current phase ends; null when nothing is scheduled. */
  readonly deadlineAt: number | null;
  readonly seats: readonly SeatState[];
  /** PvP pairings of the current round, decided at round entry. */
  readonly pairings: readonly Pairing[];
  /** Results of the current round; cleared on round entry. */
  readonly battles: readonly BattleResult[];
  /** settlementIds already committed, in order. */
  readonly settlements: readonly string[];
  /** Final ranking, best first; null until the match ends normally. */
  readonly ranking: readonly RankEntry[] | null;
  readonly fault: RoomFault | null;
  readonly roomRevision: number;
  /** Room-owned lcg32-v1 state: seat seeds and pairings draw from here. */
  readonly rngState: number;
  /** Shared card pool version. Reserved for TP; stays 0 until the shared pool lands. */
  readonly poolRevision: number;
}

/** A seat command is exactly the shared ClientCommand; the room dispatches it to src/simulation/match.ts. */
export type SeatCommand = ClientCommand;

export type RoomFailure = 'unknown-seat' | 'seat-eliminated' | 'room-phase';
export type RoomCommandResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[]; readonly seatRevision: number; readonly roomRevision: number }
  | { readonly ok: false; readonly reason: RoomFailure | MatchFailure; readonly state: MatchState | null };
export type { MatchCommandResult };

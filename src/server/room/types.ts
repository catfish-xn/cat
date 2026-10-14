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
// Rules types of the two-sided battle entry (T2) and the settlement receipt (T3); aliased so the room's scheduling envelope keeps its own names.
import type { BattleResult as RulesBattleResult, CombatReplayInput, RoundSettlementReceipt, SharedPoolFailure, SharedPoolState, SideProposal } from '../../server-entry';
import { ROOM_CAPACITY, ROOM_PROTOCOL_VERSION, type ConsumableFailure, type WireCommand, type RoomPhase, type SeatController, type SeatKind } from '../protocol';

// Shared with the client: one copy lives in src/server/protocol.ts (C3).
export { ROOM_CAPACITY, ROOM_PROTOCOL_VERSION };
export type { RoomPhase, SeatKind, SeatController, PlayerView, PlayerViewPhase, PlayerViewPhaseKind, PlayerViewFault, PlayerViewFaultKind, SeatPublic, QueueEntry, LobbyView, ClientCommand } from '../protocol';
export type { RulesBattleResult, RoundSettlementReceipt, SideProposal, SharedPoolFailure, SharedPoolState };
export type RoundKind = 'pvp' | 'pve' | 'supply';
/**
 * How PvP results are accepted. `two-sided` (default, B4): the real two-sided battle (T2) runs once per
 * pairing and every real participant's proposal is committed through the rules' receipt entry (T3) in
 * one atomic round publication. `placeholder` (tests only): PvP results are B1-style per-seat outcomes
 * from an injected resolver and the room subtracts their `damage` itself; every seat still runs in the
 * rules' multiplayer mode, so the stock PlaceholderBattleResolver cannot fight a PvP round there.
 */
export type PvpMode = 'placeholder' | 'two-sided';

export interface SeatSpec { readonly seatId: string; readonly name: string; readonly kind: SeatKind }

export interface SeatState {
  readonly seatId: string;
  /** Fixed seat order; the last tie-break of the ranking rule. */
  readonly index: number;
  readonly name: string;
  readonly kind: SeatKind;
  readonly connected: boolean;
  /** Current controller (B6); a fill-in bot seat is always `bot`, a human seat is `human` or temporarily `takeover`. */
  readonly controller: SeatController;
  /**
   * Control generation: bumps on every controller change of this seat. A bot step carries the generation it was
   * decided under and the room refuses it once the generation moved on (a takeover revoked by a resume).
   */
  readonly controlEpoch: number;
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
  /**
   * Events of the room's own transaction that produced `seatRevision` (automatic deployment at the deadline, the round
   * settlement with its post-battle merges); the server sends them with that state push. Ignored once the seat moved on.
   */
  readonly serverEvents?: { readonly seatRevision: number; readonly events: readonly MatchEvent[] };
}

/** An opponent is either a real seat or the frozen mirror of another survivor (V2 D6). */
export type Opponent =
  | { readonly kind: 'seat'; readonly seatId: string }
  | { readonly kind: 'mirror'; readonly sourceSeatId: string };
export interface Pairing { readonly battleId: string; readonly seatId: string; readonly opponent: Opponent }

export interface BattleSeatInput { readonly seatId: string; readonly state: MatchState }
/** Default two-sided step budget (contract §10.3: the engine stops at 1200 ticks; 1201 covers the last step). */
export const DEFAULT_BATTLE_MAX_STEPS = 1201;
/**
 * Scheduling envelope, frozen by the room at the preparation deadline and immutable once handed to the
 * resolver. Distinct from the rules' BattleInput (T2), which the resolver compiles from it.
 */
export interface BattleInput {
  readonly battleId: string;
  readonly roomId: string;
  readonly round: number;
  readonly roundId: string;
  readonly roundKind: RoundKind;
  /** roomRevision at freeze time; results from another revision are stale. */
  readonly roomRevision: number;
  /** Explicit uint32 combat seed, drawn from the room rng when the pairings are frozen; a retry keeps it (§10.6 item 1). */
  readonly battleSeed: number;
  /** Step budget handed to the two-sided entry; exhausting it is a failure, never a fake draw. */
  readonly maxSteps: number;
  /** One seat for pve/supply/mirror battles, two for a real pairing. These are the real participants (§10.6 item 4). */
  readonly seats: readonly BattleSeatInput[];
  /** Set when `seats[0]` fights the frozen copy of another survivor; the source is not a participant. */
  readonly mirrorOf: BattleSeatInput | null;
}
/**
 * One seat's own rules combat as the replay projection needs it (contract §14.2, PvE): the CombatState right
 * after start, the finished CombatState and the complete ledger including tick 0. No per-tick states are kept.
 */
export type SeatCombat = CombatReplayInput;
export interface BattleSeatOutcome {
  readonly seatId: string;
  /** Seat state after its battle, as produced by the rules; the room stores it verbatim. */
  readonly state: MatchState;
  readonly result: CombatResult | 'supply' | null;
  /** Untruncated HP damage decided by the rules (>= 0); the room subtracts it. */
  readonly damage: number;
  /** The combat this seat fought, or null when the round had none (supply, already settled). */
  readonly combat: SeatCombat | null;
}
/** B1 shape: each seat's own single-player combat, already settled by the rules (placeholder PvP, PvE, supply). */
export interface PlaceholderBattleResult {
  readonly kind: 'placeholder';
  readonly battleId: string;
  readonly round: number;
  readonly roomRevision: number;
  readonly outcomes: readonly BattleSeatOutcome[];
  /**
   * Shared pool after this battle's seats ran through the rules' pool wrapper (§12.4); absent when the
   * resolver did not touch the pool (its outcomes then must not have awarded or moved any unit).
   */
  readonly pool?: SharedPoolState;
}
/**
 * B3 shape (contract §10.6 item 2): one real two-sided battle and its two uncommitted proposals.
 * Nothing in here is settled: no HP, income, growth or round record changes until T3 commits.
 */
export interface TwoSidedBattleResult {
  readonly kind: 'two-sided';
  readonly battleId: string;
  readonly round: number;
  readonly roomRevision: number;
  /** Real participating seats (one for a mirror battle); the mirror source is never listed. */
  readonly participants: readonly string[];
  readonly battle: RulesBattleResult;
  readonly proposals: { readonly a: SideProposal; readonly b: SideProposal };
}
export type BattleResult = PlaceholderBattleResult | TwoSidedBattleResult;

export interface SettledSeat {
  readonly seatId: string;
  readonly hpBefore: number;
  readonly damage: number;
  /** hpBefore - damage, not truncated; first tie-break of the ranking rule (§11.5). */
  readonly hpAfterRaw: number;
  /** Authoritative HP after the round: the rules' `playerHp` of the staged state (§11.3 item 4). */
  readonly hpAfter: number;
  /** Staged rule state (T3 receipt applied, or the rules' own PvE/supply settlement); published only with the whole round. */
  readonly match: MatchState;
  /** Receipt handed to the rules for a two-sided round; null for PvE/supply and placeholder results. */
  readonly receipt: RoundSettlementReceipt | null;
  /** Events the rules produced for this seat's commit, published together with the state. */
  readonly events: readonly MatchEvent[];
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
  /**
   * Shared pool published with this round (§12.4): the round's battles chained through it, then every seat the
   * rules eliminated this round released with `releaseSeatOnElimination` (after the ranking, before the next refresh).
   */
  readonly pool: SharedPoolState;
  /** Pool and seat revisions the plan was made on; a commit after any of them moved is refused as stale (§15.2). */
  readonly basis: { readonly poolRevision: number; readonly seatRevisions: Readonly<Record<string, number>> };
}

export type RoomFault =
  /** `reason` is the resolver's stable code when it has one (e.g. a BattleValidationError reason); `message` is free text. */
  | { readonly kind: 'resolver-error'; readonly battleId: string; readonly message: string; readonly reason?: string }
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
  /** Combat seeds of the current round by battleId, drawn with the pairings; a retry reuses them. */
  readonly battleSeeds: Readonly<Record<string, number>>;
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
  /**
   * Server-only shared card pool (contract §12, B5). Every seat's MatchState is bound to it; the room replaces it only
   * together with the seat state(s) of the same rules transaction. Never projected to a client.
   */
  readonly pool: SharedPoolState;
  /** `pool.revision` of the published pool, copied, never computed (§12.4 SR-B1-05). */
  readonly poolRevision: number;
}

/** A seat command is any wire command (ClientCommand plus the draft useConsumable); the room dispatches it to the rules. */
export type SeatCommand = WireCommand;

/**
 * `seat-controlled`: a player command reached a human seat a bot took over (B6); `control-revoked`: a bot step
 * decided under an older control generation (the player resumed in between, or the seat is not bot-controlled).
 */
export type RoomFailure = 'unknown-seat' | 'seat-eliminated' | 'room-phase' | 'seat-controlled' | 'control-revoked';
export type RoomCommandResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[]; readonly seatRevision: number; readonly roomRevision: number }
  /** `SharedPoolFailure` includes every MatchFailure plus the pool's own reasons (pool-empty, empty-slot, ...). */
  | { readonly ok: false; readonly reason: RoomFailure | MatchFailure | SharedPoolFailure | ConsumableFailure; readonly state: MatchState | null };
export type { MatchCommandResult };

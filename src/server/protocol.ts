/**
 * Shared client/server protocol types (work order C3). Pure types and constants, no
 * implementation: the room (src/server/room), the local in-browser client and the UI
 * (src/rendering/online) all import these shapes from here, so there is exactly one copy.
 * See docs/UI_REQUESTS.md "八人联机界面数据需求" and docs/MULTIPLAYER_RENOVATION_V2.md §5.
 * No rule, gold, RNG or outcome is ever computed from these on the client.
 */
import type { UnitLocation } from '../simulation/units';
import type { ConsumableFailure, ConsumableTarget, ItemSummonOrigin, OrbTier, PrivateSeatView, RoundEconomyPreview, RoundEconomyPreviewOutcome } from '../server-entry';
export type { ConsumableFailure, ConsumableTarget, RoundEconomyPreview, RoundEconomyPreviewOutcome };

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
   * Board and bench units with the items and anomaly they hold, unequipped items and owned augments (2026-10-20 scouting).
   * Never the shop, gold, XP, streak, pending choices or RNG. Optional so older views and tests stay valid; the room always fills it.
   */
  readonly publicBoard?: PublicBoard;
  /**
   * v15: this seat's unclaimed orbs as everyone may see them, the rules' `readPublicOrbSummary` copied field by field:
   * how many and of which tiers. Never their ids, rounds, contents, receipts or whether one is queued. Optional like
   * `publicBoard`; the room always fills it.
   */
  readonly orbs?: PublicOrbSummary;
}
export interface PublicOrbSummary { readonly count: number; readonly tiers: readonly OrbTier[] }
export interface PublicBoardUnit {
  readonly definitionId: string;
  readonly starLevel: number;
  /** Cell on the owner's own board, in the owner's orientation (their deployment rows at the bottom). */
  readonly cell: { readonly col: number; readonly row: number };
  /** Item definition ids held by the unit, in slot order. */
  readonly items: readonly string[];
  /**
   * G2-4b (contract §26): set on a movable preparation summon (兹若特传送门's 虚空生物) standing where the rules place it.
   * `starLevel` is its stage appearance. Not a champion: no trait, no avatar, no items; the holder and item instance stay private.
   */
  readonly summon?: true;
  /** 2026-10-20 scouting: the anomaly (异常) definition id bound to this unit; omitted when it has none. */
  readonly anomaly?: string;
  /** V16-UI-251: 4 on a promoted 终极英雄 (physically still 3★, `starLevel` stays 3); omitted otherwise. */
  readonly effectiveStarLevel?: 4;
}
/** A unit on the owner's bench (2026-10-20 scouting): same fields as a board unit, a bench slot instead of a cell. */
export interface PublicBenchUnit {
  readonly definitionId: string;
  readonly starLevel: number;
  readonly slot: number;
  /** Item definition ids held by the unit, in slot order. */
  readonly items: readonly string[];
  /** The anomaly (异常) definition id bound to this unit; omitted when it has none. */
  readonly anomaly?: string;
  /** V16-UI-251: 4 on a promoted 终极英雄; omitted otherwise. */
  readonly effectiveStarLevel?: 4;
}
export interface PublicBoard {
  readonly units: readonly PublicBoardUnit[];
  /** Bench units by slot. Optional so older views stay valid; the room always fills it. */
  readonly bench?: readonly PublicBenchUnit[];
  /** Item definition ids not held by any unit (the item bench), in the owner's item order. */
  readonly looseItems?: readonly string[];
  /** Augment definition ids the seat owns, in the order acquired. Offers and rerolls stay private. */
  readonly augments?: readonly string[];
}
/**
 * C15: one of MY units in my battle replay. The replay names units by their battle ids (contract §10.2); this pair
 * says which of my own units a battle id stands for, so the client can show that unit's equipment without
 * parsing the id. Only my seat's `unit` entries are sent; the opponent's ids and every item/augment/anomaly entry stay on the server.
 */
export interface ReplayUnitId { readonly combatId: string; readonly originalId: string }
/**
 * My seat's private state as the `state` message carries it: the rules' whitelist projection (contract §14.1) plus
 * `economyPreview` (SR-G5-02, §14.4), the rules' `previewRoundEconomy` of the same state, copied as returned. Set in
 * preparation and during my battle; null in choice, settlement, supply rounds, game over and once eliminated. `gold`
 * is the gold it was computed on; `ifWin`/`ifLoss` are the interest, victory gold, streak gold and streak after the
 * settlement of this round would credit if that gold and streak stay as they are (a PvP draw settles as `ifLoss`).
 * Base income, drops, XP and HP are not part of it. The client shows it as given and never recomputes it.
 */
export type SeatStateView = PrivateSeatView & { readonly economyPreview: RoundEconomyPreview | null; readonly itemSummons: readonly ItemSummonView[] };
/**
 * G2-4b (contract §26): one of my movable preparation summons (兹若特传送门's 虚空生物), the rules' `readItemSummons` of the
 * same state, field by field. Not an asset: no bench slot, population, sale or equipment. `unit.location` is where the rules
 * place it this preparation (the saved cell, or the nearest free one); the client draws it there and only sends
 * `moveItemSummon` with `itemInstanceId`. Stage stats are not part of it and are never computed on the client.
 */
export interface ItemSummonView {
  readonly kind: ItemSummonOrigin['kind'];
  readonly ownerId: string;
  readonly itemInstanceId: string;
  readonly unit: Pick<ItemSummonOrigin['unit'], 'id' | 'definitionId' | 'team' | 'starLevel' | 'location'>;
}
/** Phase as the client sees it: `frozen` and `battle` both show as `combat`, `waiting` as `lobby`. G1-P7 adds `carousel`. */
export type PlayerViewPhaseKind = 'lobby' | 'preparation' | 'choice' | 'carousel' | 'combat' | 'settlement' | 'ended';

/* ---------------- G1-P7 shared carousel (选秀), MULTIPLAYER_CONTRACT §21.1 ---------------- */

/** One unit standing on the carousel with what it carries; the same for every seat (`listCarouselSlots`, field by field). */
export interface CarouselSlotView {
  /** Slot index (0–8); the `carousel-pick` command names it. */
  readonly slot: number;
  readonly definitionId: string;
  readonly starLevel: number;
  /** Item definition ids the unit carries (one component, or one completed item from 5-4). */
  readonly items: readonly string[];
  /** Seat that took it; null while it still stands. */
  readonly pickedBy: string | null;
}
/**
 * The carousel of the current round (§21.1 public projection) plus this seat's own part. Every field is copied from the
 * rules' carousel state; times are the rules' logical milliseconds since the carousel opened, `startedAt` is the server
 * clock at logical 0 so the client can count down. The client decides nothing (who is released, what is left).
 */
export interface CarouselView {
  readonly id: string;
  readonly roundId: string;
  readonly roundName: string;
  readonly revision: number;
  readonly status: 'open' | 'closed';
  readonly slots: readonly CarouselSlotView[];
  /** Release order frozen at creation (lowest HP first, seat index on a tie). */
  readonly releaseOrder: readonly string[];
  /** Logical ms at which each seat may pick. */
  readonly releaseAtMs: Readonly<Record<string, number>>;
  readonly elapsedMs: number;
  /** Logical ms at which every seat still without a unit is picked for; the phase ends there (option B). */
  readonly deadlineMs: number;
  /** Server clock (ms) at logical 0. */
  readonly startedAt: number;
  /** My seat is released, alive and has not picked yet. */
  readonly eligible: boolean;
  /** Slot my seat took (by hand or automatically); null until then. */
  readonly pickedSlot: number | null;
  readonly receiptId: string | null;
  /** Seats the server picked for (a bot, a disconnected player, or nobody clicked by the deadline). */
  readonly autoPicked: readonly string[];
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
  /** v15 (AUGMENT-CARD-REROLL): rerolls only the card at `optionIndex` (0..2) of the pending augment choice; each card once. */
  | { readonly type: 'rerollAugment'; readonly choiceId: string; readonly generation: number; readonly optionIndex: number }
  | { readonly type: 'anomalyReroll'; readonly choiceId: string; readonly generation: number };
export type ConsumableCommand = Extract<ClientCommand, { type: 'useConsumable' }>;
/**
 * G1-P7 (MULTIPLAYER_CONTRACT §21.1): take the unit on carousel slot `slot` of carousel `carouselId` as seen at `revision`
 * (another id or revision is `stale-carousel`). The seat is the connection's. Not a match.ts seat command: the room hands it
 * to the rules' pick and grant, which decide everything. Kept out of ClientCommand so the bot policy and its helpers,
 * which map ClientCommand 1:1 to match.ts, are unchanged.
 */
export interface CarouselPickCommand { readonly type: 'carousel-pick'; readonly carouselId: string; readonly revision: number; readonly slot: number }
/**
 * G2-4b (contract §26): move my preparation summon of item instance `itemInstanceId` (兹若特传送门's 虚空生物) to `cell`
 * of my deployment rows; the room hands it to the rules' `moveItemSummon`, which decides everything. Kept out of
 * ClientCommand for the same reason as the carousel pick: the bot policy never moves a summon.
 */
export interface MoveItemSummonCommand { readonly type: 'moveItemSummon'; readonly itemInstanceId: string; readonly cell: { readonly col: number; readonly row: number } }
/**
 * v15 (LOOT-ORB-CLAIM, MULTIPLAYER_CONTRACT §claimOrb): claim the whole unclaimed orb `orbId` of my seat (`unclaimedOrbs` of my
 * private view; it may come from an earlier round). `round` is the round I act in. The room hands it as is to the rules'
 * shared-pool `claimOrb`, which decide everything: in preparation, choice and settlement it is claimed at once, during my
 * battle (or under the PvP roster lock) it is only queued (`queued: true`) and settled after the battle. Kept out of
 * ClientCommand like the carousel pick: bots claim through the rules' `claimBotPreparationOrbs`, never through the policy.
 */
export interface ClaimOrbCommand { readonly type: 'claimOrb'; readonly round: number; readonly orbId: string }
/** Every command a seat may send over the wire: the match.ts commands (§18.8), the carousel pick (G1-P7), the summon move (G2-4b) and the orb claim (v15). */
export type WireCommand = ClientCommand | CarouselPickCommand | MoveItemSummonCommand | ClaimOrbCommand;

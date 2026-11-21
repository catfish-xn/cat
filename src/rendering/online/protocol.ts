/**
 * Client-facing view of an online match. The shapes themselves live in src/server/protocol.ts
 * (one copy shared with the room); this file only adds the in-browser client interface the UI
 * talks to. See docs/UI_REQUESTS.md "八人联机界面数据需求". No rule, gold, RNG or outcome is
 * computed on the client.
 */
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import type { ReceiptFailure, SeatNotice } from '../../server/net/messages';
import type { WireCommand, LittleLegendId, LobbyView, PlayerView, ReplayUnitId } from '../../server/protocol';
import type { CombatReplay } from '../../server-entry';
import type { LegendWalk, LegendWalkRequest } from '../../server/legend-motion';

export * from '../../server/protocol';

/** A network client cannot answer at once: the command is sent and waits for its receipt. */
export interface PendingCommand { readonly ok: 'pending'; readonly commandId: number }
export type ClientSendResult = MatchCommandResult | PendingCommand;

/** Commands of mine the server applied since the previous state push, in order. */
export interface ConfirmedCommand { readonly commandId: number; readonly events: readonly MatchEvent[] }
/** A pending command the server refused; nothing changed locally. `retry`: the refusal was about a stale view, try again. */
export interface RefusedCommand { readonly commandId: number; readonly reason: ReceiptFailure; readonly retry: boolean }

/** Connection health of a network client; in-memory clients never report it. */
export type ConnectionStatus =
  /** `reclaimed`: this resume took my seat back from the bot that played it while I was away (B6). */
  | { readonly kind: 'online'; readonly reclaimed?: true }
  | { readonly kind: 'reconnecting'; readonly attempt: number; readonly delayMs: number }
  /** Another tab or device resumed this seat; this client stops sending. */
  | { readonly kind: 'superseded' }
  /** The server no longer knows this seat (queue drop, server restart, expired token): back to matchmaking. */
  | { readonly kind: 'seat-lost' };

export interface ClientListeners {
  lobby(view: LobbyView): void;
  view(view: PlayerView): void;
  /**
   * My seat outside combat, as a display MatchState built from the server's private seat view (B7): server-only
   * fields are placeholders (see seat-view-adapter.ts); `confirmed` lists my commands this push confirms; `serverEvents`
   * are the server's own events behind this state (T10: deadline auto-deployment, post-battle merges).
   */
  state(state: MatchState, confirmed?: readonly ConfirmedCommand[], serverEvents?: readonly MatchEvent[]): void;
  /**
   * My finished battle of this round as a compact replay (contract §14.2), played back at tick pace (C6). `unitIds` (C15)
   * says which battle id is which of my units, so their equipment can be shown; empty for PvE or when the push had none.
   */
  replay(replay: CombatReplay, unitIds?: readonly ReplayUnitId[]): void;
  /**
   * D11 live bank: the battle of the last `replay` changed while it plays (a gold change fed a live run of it); this is
   * the whole revised replay. Playback goes on from where it is.
   */
  replayRevised?(replay: CombatReplay): void;
  refused?(refusal: RefusedCommand): void;
  /** These commands lost receipt tracking; release pending UI without assuming whether the server applied them. */
  interrupted?(commandIds: readonly number[]): void;
  /** v15: an orb claim held while the round was frozen was refused by the rules at battle entry (its receipt was ok). */
  notice?(notice: SeatNotice): void;
  connection?(status: ConnectionStatus): void;
  /** A little-legend walk the room took (any seat); `serverNow` is the server clock when it was sent. */
  legend?(walk: LegendWalk, serverNow: number): void;
  /** The battle of the seat I watch (`watch`), from its point of view: the start, then the whole revised replay on each update. */
  watched?(seatId: string, replay: CombatReplay): void;
}
/** What the UI talks to: the real room run in-browser (local-room-client.ts) or the game server over a socket (ws-client.ts). */
export interface GameClient {
  readonly transport: 'local-room' | 'websocket';
  listen(listeners: ClientListeners): () => void;
  /** `legend`: the little legend picked in the lobby (cosmetic); omitted means `default`. */
  joinQueue(name: string, legend?: LittleLegendId): void;
  leaveQueue(): void;
  startMatch(): void;
  /**
   * In-memory clients answer synchronously. A network client answers `pending`: the local state does
   * not change until the receipt and the state push that follows it (or a `refused` callback).
   */
  send(command: WireCommand): ClientSendResult;
  /** My legend's walk to the room (no receipt); false when it was not sent or the local room refused it. */
  walk?(request: LegendWalkRequest): boolean;
  /** Watch another seat's battles (null: stop); kept across a reconnect. In-browser rooms have none. */
  watch?(seatId: string | null): void;
  /** Lobby again after a finished match. */
  reset(): void;
  dispose(): void;
}

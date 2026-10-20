/**
 * Client-facing view of an online match. The shapes themselves live in src/server/protocol.ts
 * (one copy shared with the room); this file only adds the in-browser client interface the UI
 * talks to. See docs/UI_REQUESTS.md "八人联机界面数据需求". No rule, gold, RNG or outcome is
 * computed on the client.
 */
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import type { ReceiptFailure } from '../../server/net/messages';
import type { WireCommand, LobbyView, PlayerView, ReplayUnitId } from '../../server/protocol';
import type { CombatReplay } from '../../server-entry';

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
  refused?(refusal: RefusedCommand): void;
  connection?(status: ConnectionStatus): void;
}
/** What the UI talks to: the real room run in-browser (local-room-client.ts) or the game server over a socket (ws-client.ts). */
export interface GameClient {
  readonly transport: 'local-room' | 'websocket';
  listen(listeners: ClientListeners): () => void;
  joinQueue(name: string): void;
  leaveQueue(): void;
  startMatch(): void;
  /**
   * In-memory clients answer synchronously. A network client answers `pending`: the local state does
   * not change until the receipt and the state push that follows it (or a `refused` callback).
   */
  send(command: WireCommand): ClientSendResult;
  /** Lobby again after a finished match. */
  reset(): void;
  dispose(): void;
}

/**
 * Client-facing view of an online match. The shapes themselves live in src/server/protocol.ts
 * (one copy shared with the room); this file only adds the in-browser client interface the UI
 * talks to. See docs/UI_REQUESTS.md "八人联机界面数据需求". No rule, gold, RNG or outcome is
 * computed on the client.
 */
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';
import type { ClientCommand, CombatFrame, LobbyView, PlayerView } from '../../server/protocol';

export * from '../../server/protocol';

export interface ClientListeners {
  lobby(view: LobbyView): void;
  view(view: PlayerView): void;
  /** Authoritative private state for my seat outside combat. */
  state(state: MatchState): void;
  /** One finished battle's frames, to be played back at tick pace. */
  combat(frames: readonly CombatFrame[]): void;
}
/** What the UI talks to: the real room run in-browser (local-room-client.ts), the legacy fake (fake-server.ts) or, later, a socket. */
export interface GameClient {
  readonly transport: 'local-room' | 'fake' | 'websocket';
  listen(listeners: ClientListeners): () => void;
  joinQueue(name: string): void;
  leaveQueue(): void;
  startMatch(): void;
  /** In-memory clients answer synchronously; a network client will answer with a pending receipt (T8). */
  send(command: ClientCommand): MatchCommandResult;
  /** Lobby again after a finished match. */
  reset(): void;
  dispose(): void;
}

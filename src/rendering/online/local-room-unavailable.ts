/**
 * Stand-in for local-room-client.ts in production builds (vite.config.ts `localRoomOff`): the in-tab room
 * (src/server/room) is not bundled, so `?mode=online` without `server=ws` opens the lobby with a notice
 * instead of a room. dev and `VITE_LOCAL_ROOM=1` builds keep the real client.
 */
import { createMatch } from '../../simulation/match';
import type { MatchCommandResult } from '../../simulation/match-types';
import { LOCAL_ROOM_DEFAULTS, type LocalRoomOptions } from './local-room-options';
import { ROOM_CAPACITY, type ClientListeners, type GameClient, type LobbyView } from './protocol';

export const LOCAL_ROOM_UNAVAILABLE = '本站没有联机服务器，不能在这里开联机对局。请改用单机模式（去掉网址里的 mode=online），或连接到联机服务器（网址加上 server=ws）。';
const VIEW: LobbyView = { queue: [], capacity: ROOM_CAPACITY, joined: false, canStart: false, error: LOCAL_ROOM_UNAVAILABLE };

export class LocalRoomClient implements GameClient {
  readonly transport = 'local-room' as const;
  private listeners: ClientListeners | null = null;
  constructor(private readonly options: LocalRoomOptions = LOCAL_ROOM_DEFAULTS) {}
  listen(listeners: ClientListeners): () => void {
    this.listeners = listeners; listeners.lobby(VIEW);
    return () => { if (this.listeners === listeners) this.listeners = null; };
  }
  joinQueue(): void { this.listeners?.lobby(VIEW); }
  leaveQueue(): void { this.listeners?.lobby(VIEW); }
  startMatch(): void { this.listeners?.lobby(VIEW); }
  send(): MatchCommandResult { return { ok: false, state: createMatch(this.options.seed), reason: 'wrong-phase' }; }
  reset(): void { this.listeners?.lobby(VIEW); }
  dispose(): void { this.listeners = null; }
}

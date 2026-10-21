/**
 * Stand-in for local-room-client.ts in production builds (vite.config.ts `localRoomOff`): the in-tab room
 * (src/server/room) is not bundled, so `?mode=online` without `server=ws` opens the lobby with a notice
 * instead of a room. dev and `VITE_LOCAL_ROOM=1` builds keep the real client.
 */
import { createMatch } from '../../simulation/match';
import type { MatchCommandResult } from '../../simulation/match-types';
import { LOCAL_ROOM_DEFAULTS, type LocalRoomOptions } from './local-room-options';
import { type ClientListeners, type GameClient, type LobbyView } from './protocol';

export const LOCAL_ROOM_UNAVAILABLE = '本站没有联机服务器。在线对战请打开测试服网址；单机请去掉网址里的 mode=online。';
// capacity 0: there is no queue here, so the lobby leaves out its queue line (lobby.ts).
const VIEW: LobbyView = { queue: [], capacity: 0, joined: false, canStart: false, error: LOCAL_ROOM_UNAVAILABLE };

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

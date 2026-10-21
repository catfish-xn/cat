/**
 * GameClient over the game server's WebSocket (work order C4, docs/UI_REQUESTS.md "联机客户端消息说明（B2）").
 * The browser speaks exactly the B2 messages of src/server/net/messages.ts; nothing here decides a rule,
 * a deadline or an outcome.
 *
 * - Commands are pending until their receipt: `send` answers `{ ok: 'pending' }`, the local state only
 *   changes when the server pushes the next `state` (which then carries the confirmed commands), and a
 *   refusal changes nothing.
 * - Consecutive commands are pipelined: the n-th in flight carries seatRevision = base + n - 1. A stale
 *   view (`seat-revision-mismatch`, `stale-round`, `resync-required`) is reported once the next state has
 *   arrived (or nothing else is in flight); nothing is resent automatically.
 * - The seat token lives in localStorage under a key per server address (C7), so closing the tab and opening
 *   the same address again, or a second tab of it, resumes the seat (the server then supersedes the older tab).
 *   It is cleared once the match ended or the server revoked the seat (a lobby push while seated in a room).
 *   After a dropped connection the client reconnects with 1s/2s/4s/8s/10s backoff and `resume{token}`; the
 *   server's snapshot (view → state → replay) restores the screen. A queued seat is lost with its connection
 *   (B2 rule), so it returns to matchmaking.
 * - Heartbeat: once the server has sent a `heartbeat` on this socket, a silence of HEARTBEAT_MISSED intervals counts as a
 *   dead connection (a network that drops without a close never fires onclose); the socket is dropped and the usual
 *   reconnect and resume follow. A server without heartbeat never arms this.
 *
 * No DOM dependency besides the injectable WebSocket/storage/timers, so tests drive it under Node.
 */
import { createMatch } from '../../simulation/match';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import {
  NET_PROTOCOL_VERSION, readReplayUnitIds, type ClientMessage, type ReceiptFailure, type ReceiptMessage, type ServerMessage,
} from '../../server/net/messages';
import type { CombatReplay } from '../../presentation/combat-display';
import type {
  WireCommand, ClientListeners, ClientSendResult, ConfirmedCommand, ConnectionStatus, GameClient, LittleLegendId, LobbyView, PlayerView, SeatStateView,
} from './protocol';
import { ROOM_DEFAULT_LEGEND } from './protocol';
import { toDisplayMatch } from './seat-view-adapter';
import type { LegendWalkRequest } from '../../server/legend-motion';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Timers = { set(callback: () => void, ms: number): unknown; clear(handle: unknown): void };
type Raw = ClientMessage extends infer M ? M extends ClientMessage ? Omit<M, 'protocolVersion' | 'commandId'> : never : never;
type ReplayMessage = Extract<ServerMessage, { type: 'replay' }>;
type ReplayTailMessage = Extract<ServerMessage, { type: 'replay-tail' }>;

export interface WsClientOptions {
  readonly url: string;
  /** Where the seat token is kept; the browser passes localStorage. null keeps it in memory only. */
  readonly storage?: StorageLike | null;
  readonly createSocket?: (url: string) => WebSocket;
  readonly timers?: Timers;
  /** Reconnect delays in ms; the last one repeats. */
  readonly backoffMs?: readonly number[];
  readonly log?: (line: string) => void;
}
export const RECONNECT_BACKOFF_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 10_000];
/** Heartbeat intervals without any message before the client gives the socket up. */
export const HEARTBEAT_MISSED = 3;
/** Close code the client uses for a socket it gave up on (4xxx: application range). */
export const HEARTBEAT_TIMEOUT_CLOSE = 4000;
export const TOKEN_STORAGE_KEY = 'hex-online-seat';
/** One stored seat per game server: `hex-online-seat:<ws url>`. */
export function tokenStorageKey(url: string): string { return `${TOKEN_STORAGE_KEY}:${url}`; }
/** Refusals that only mean "your view was stale": the player retries after the next state. */
const RETRY_REASONS: ReadonlySet<ReceiptFailure> = new Set(['seat-revision-mismatch', 'stale-round', 'resync-required']);

const LOBBY_ERRORS: Partial<Record<ReceiptFailure, string>> = {
  full: '对局已满（8 人），请等待本局结束',
  'in-progress': '对局正在进行，请等待本局结束',
  'already-joined': '已在队列中',
  empty: '队列为空',
  'not-queued': '不在队列中，请重新匹配',
  'not-authenticated': '连接已重置，请重新匹配',
  'rate-limited': '操作过快，请稍后再试',
  'unsupported-protocol': '客户端版本过旧，请刷新页面',
};
/** WebSocket.OPEN, without touching the global (absent in some test environments). */
const SOCKET_OPEN = 1;
const LOBBY_PHASE_VIEW: PlayerView = { mySeatId: '', seats: [], phase: { kind: 'lobby', round: 0, roundName: '', endsAt: null, serverNow: 0 }, opponentSeatId: null, ranking: null, fault: null };

/** `ws(s)://<host>/ws` of the page, or `?ws=` when given. */
export function defaultWsUrl(location: Pick<Location, 'protocol' | 'host'>, override: string | null): string {
  if (override) return override;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

interface Inflight { readonly type: ClientMessage['type'] }
interface StoredSeat { readonly url: string; readonly token: string }

export class WsGameClient implements GameClient {
  readonly transport = 'websocket' as const;
  private readonly storage: StorageLike | null;
  private readonly createSocket: (url: string) => WebSocket;
  private readonly timers: Timers;
  private readonly backoff: readonly number[];
  private readonly log: (line: string) => void;
  private listeners: ClientListeners | null = null;
  private socket: WebSocket | null = null;
  private reconnectTimer: unknown = null;
  /** Liveness deadline of the current socket; armed only after its first heartbeat. */
  private livenessTimer: unknown = null;
  private livenessMs: number | null = null;
  private attempt = 0;
  private disposed = false;
  private superseded = false;
  private status: ConnectionStatus | null = null;
  /** This socket carries my seat (joined or resumed on it); the greeting lobby of a fresh socket comes before that. */
  private bound = false;

  private token: string | null;
  private seatId: string | null = null;
  private roomId: string | null = null;
  private round = 0;
  /** seatRevision of the latest `state` and highest seatRevision an applied receipt reported. */
  private stateRevision = -1;
  private appliedRevision = -1;
  private nextCommandId = 1;
  private readonly inflight = new Map<number, Inflight>();
  private confirmed: (ConfirmedCommand & { seatRevision: number })[] = [];
  private deferredRetries: { commandId: number; reason: ReceiptFailure }[] = [];
  private lastReplayKey = '';
  /** The replay behind `lastReplayKey`, as revised so far (D11 live bank). */
  private lastReplay: CombatReplay | null = null;

  private lobbyView: LobbyView | null = null;
  private lobbyError: string | null = null;
  private lastView: PlayerView | null = null;
  private lastState: MatchState | null = null;

  constructor(readonly options: WsClientOptions) {
    this.storage = options.storage ?? null;
    this.createSocket = options.createSocket ?? (url => new WebSocket(url));
    this.timers = options.timers ?? { set: (callback, ms) => setTimeout(callback, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };
    this.backoff = options.backoffMs ?? RECONNECT_BACKOFF_MS;
    this.log = options.log ?? (() => {});
    this.token = this.readToken();
    this.connect();
  }

  /* ---------------- GameClient ---------------- */

  listen(listeners: ClientListeners): () => void {
    this.listeners = listeners;
    if (this.lobbyView) this.emitLobby();
    if (this.lastState) listeners.state(this.lastState);
    if (this.lastView) listeners.view(this.lastView);
    if (this.status) listeners.connection?.(this.status);
    return () => { if (this.listeners === listeners) this.listeners = null; };
  }
  joinQueue(name: string, legend?: LittleLegendId): void {
    if (this.seatId !== null && this.roomId === null) return;
    this.lobbyError = null;
    // The default legend is not sent, so a server from before little legends still accepts the join.
    this.post({ type: 'join', name: name.trim().slice(0, 24) || '玩家', ...(legend && legend !== ROOM_DEFAULT_LEGEND ? { legend } : {}) });
  }
  leaveQueue(): void { if (this.seatId !== null && this.roomId === null) this.post({ type: 'leaveQueue' }); }
  startMatch(): void { if (this.seatId !== null && this.roomId === null) this.post({ type: 'start' }); }

  send(command: WireCommand): ClientSendResult {
    const refused = { ok: false as const, state: this.lastState ?? createMatch(), reason: 'wrong-phase' as const };
    if (!this.ready || this.roomId === null || this.stateRevision < 0) return refused;
    const ahead = [...this.inflight.values()].filter(entry => entry.type === 'command').length;
    const seatRevision = Math.max(this.stateRevision, this.appliedRevision) + ahead;
    const commandId = this.post({ type: 'command', roomId: this.roomId, round: this.round, seatRevision, command });
    return commandId === null ? refused : { ok: 'pending', commandId };
  }

  /** After a finished match: forget the seat and reconnect fresh so the server sends the lobby again. */
  reset(): void {
    this.forgetSeat();
    this.lastView = null; this.lastState = null; this.lastReplayKey = ''; this.lastReplay = null; this.lobbyError = null;
    this.listeners?.view({ ...LOBBY_PHASE_VIEW, phase: { ...LOBBY_PHASE_VIEW.phase } });
    this.restart();
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.cancelReconnect(); this.cancelLiveness();
    const socket = this.socket; this.socket = null;
    if (socket) { this.detachSocket(socket); socket.close(1000, 'client closed'); }
    this.listeners = null;
  }

  /* ---------------- debug / tests ---------------- */

  get connection(): ConnectionStatus | null { return this.status; }
  get pendingCount(): number { return this.inflight.size; }
  get currentSeatId(): string | null { return this.seatId; }
  get hasToken(): boolean { return this.token !== null; }
  /** A walk has no receipt: it is not in flight and never retried (the room's `legend` push shows what it took). */
  walk(request: LegendWalkRequest): boolean {
    if (!this.ready || !this.bound || this.roomId === null) return false;
    this.socket!.send(JSON.stringify({ type: 'walk', roomId: this.roomId, ...request, protocolVersion: NET_PROTOCOL_VERSION, commandId: this.nextCommandId++ }));
    return true;
  }
  private get ready(): boolean { return !this.disposed && !this.superseded && this.socket !== null && this.socket.readyState === SOCKET_OPEN; }

  /* ---------------- outbound ---------------- */

  private post(raw: Raw): number | null {
    if (!this.ready) return null;
    const commandId = this.nextCommandId++;
    this.inflight.set(commandId, { type: raw.type });
    this.socket!.send(JSON.stringify({ ...raw, protocolVersion: NET_PROTOCOL_VERSION, commandId }));
    return commandId;
  }

  /* ---------------- connection ---------------- */

  private connect(): void {
    if (this.disposed || this.superseded) return;
    let socket: WebSocket;
    try { socket = this.createSocket(this.options.url); }
    catch (error) { this.log(`connect failed: ${String(error)}`); this.scheduleReconnect(); return; }
    this.socket = socket; this.bound = false;
    this.cancelLiveness(); this.livenessMs = null;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      if (this.token) this.post({ type: 'resume', token: this.token });
      else this.setStatus({ kind: 'online' });
    };
    socket.onmessage = event => { if (this.socket === socket) { this.armLiveness(socket); this.receive(String(event.data)); } };
    socket.onclose = event => { if (this.socket === socket) this.closed(event.code); };
    socket.onerror = () => { /* followed by close */ };
  }
  private detachSocket(socket: WebSocket): void { socket.onopen = null; socket.onmessage = null; socket.onclose = null; socket.onerror = null; }
  /** Drops the current socket (if any) without the reconnect bookkeeping and opens a new one at once. */
  private restart(): void {
    this.cancelReconnect(); this.cancelLiveness();
    const socket = this.socket; this.socket = null;
    if (socket) { this.detachSocket(socket); socket.close(1000, 'reset'); }
    this.clearInflight();
    this.connect();
  }
  private closed(code: number): void {
    this.socket = null;
    this.cancelLiveness();
    this.clearInflight();
    if (this.disposed || this.superseded) return;
    this.log(`connection closed (${code})`);
    if (this.seatId !== null && this.roomId === null) {
      // B2: a queued seat is given up with its connection; the token no longer resumes it.
      this.forgetSeat();
      this.lobbyError = '连接中断，已退出队列，请重新匹配';
      this.emitLobby();
      this.setStatus({ kind: 'seat-lost' });
    }
    this.scheduleReconnect();
  }
  private scheduleReconnect(): void {
    if (this.disposed || this.superseded || this.reconnectTimer !== null) return;
    const delayMs = this.backoff[Math.min(this.attempt, this.backoff.length - 1)]!;
    this.attempt += 1;
    this.setStatus({ kind: 'reconnecting', attempt: this.attempt, delayMs });
    this.reconnectTimer = this.timers.set(() => { this.reconnectTimer = null; this.connect(); }, delayMs);
  }
  /** Any message proves the socket alive; the deadline restarts from it. */
  private armLiveness(socket: WebSocket): void {
    if (this.livenessMs === null) return;
    this.cancelLiveness();
    this.livenessTimer = this.timers.set(() => { this.livenessTimer = null; this.livenessLost(socket); }, this.livenessMs);
  }
  private cancelLiveness(): void { if (this.livenessTimer !== null) { this.timers.clear(this.livenessTimer); this.livenessTimer = null; } }
  private livenessLost(socket: WebSocket): void {
    if (this.socket !== socket || this.disposed || this.superseded) return;
    this.log(`no message for ${this.livenessMs} ms; dropping the connection`);
    this.detachSocket(socket);
    try { socket.close(HEARTBEAT_TIMEOUT_CLOSE, 'heartbeat timeout'); } catch { /* already closing */ }
    this.closed(HEARTBEAT_TIMEOUT_CLOSE);
  }
  private cancelReconnect(): void { if (this.reconnectTimer !== null) { this.timers.clear(this.reconnectTimer); this.reconnectTimer = null; } }
  private clearInflight(): void { this.inflight.clear(); this.confirmed = []; this.deferredRetries = []; }

  /* ---------------- inbound ---------------- */

  private receive(text: string): void {
    let message: ServerMessage;
    try { message = JSON.parse(text) as ServerMessage; }
    catch { this.log('server sent invalid JSON'); return; }
    switch (message.type) {
      case 'lobby':
        // On a socket bound to my seat in a room, a lobby push means the server revoked it (a new match started).
        if (this.bound && this.roomId !== null) { this.forgetSeat(); this.lastView = null; this.lastState = null; this.lastReplayKey = ''; this.lastReplay = null; }
        this.lobbyView = message.view; this.emitLobby(); return;
      case 'view': return this.onView(message.roomId, message.view);
      case 'state': return this.onState(message.roomId, message.round, message.seatRevision, message.state, message.events ?? []);
      case 'replay': return this.onReplay(message);
      case 'replay-tail': return this.onReplayTail(message);
      case 'receipt': return this.onReceipt(message);
      case 'error': return this.onError(message.code, message.message);
      case 'heartbeat': return this.onHeartbeat(message.intervalMs);
      case 'notice': if (message.roomId === this.roomId) this.listeners?.notice?.(message.notice); return;
      case 'legend': if (message.roomId === this.roomId) this.listeners?.legend?.(message.walk, message.serverNow); return;
    }
  }
  /** The first beat arms the liveness deadline (armLiveness already ran for this message, so arm it now). */
  private onHeartbeat(intervalMs: unknown): void {
    if (typeof intervalMs !== 'number' || !Number.isFinite(intervalMs) || intervalMs <= 0) return;
    const first = this.livenessMs === null;
    this.livenessMs = intervalMs * HEARTBEAT_MISSED;
    if (first && this.socket) this.armLiveness(this.socket);
  }
  private onView(roomId: string, view: PlayerView): void {
    this.roomId = roomId;
    // The match is over: the token resumes nothing worth coming back to; the ranking stays on screen.
    if (view.phase.kind === 'ended' && this.token !== null) this.writeToken(null);
    this.round = Math.max(this.round, view.phase.round);
    this.lastView = view;
    this.listeners?.view(view);
  }
  /** The server sends my seat as the rules' private view (B7); the UI gets a display-only MatchState of it. */
  private onState(roomId: string, round: number, seatRevision: number, view: SeatStateView, serverEvents: readonly MatchEvent[]): void {
    const state = toDisplayMatch(view);
    this.roomId = roomId; this.round = round; this.stateRevision = seatRevision; this.lastState = state;
    const confirmed = this.confirmed.filter(entry => entry.seatRevision <= seatRevision);
    this.confirmed = this.confirmed.filter(entry => entry.seatRevision > seatRevision);
    this.listeners?.state(state, confirmed.map(({ commandId, events }) => ({ commandId, events })), serverEvents);
    this.flushRetries();
  }
  /** My battle as a compact replay (B7/C6). A resume snapshot repeats the battle already played; show it only once. */
  private onReplay(message: ReplayMessage): void {
    const key = `${message.roomId}:${message.round}:${message.battleId}`;
    if (key === this.lastReplayKey) {
      // A resume snapshot of a battle a live run revised since it was first sent: take the revision, keep playing.
      if (this.lastReplay && JSON.stringify(this.lastReplay) !== JSON.stringify(message.replay)) { this.lastReplay = message.replay; this.listeners?.replayRevised?.(message.replay); }
      return;
    }
    this.lastReplayKey = key; this.lastReplay = message.replay;
    // A missing or malformed id list only costs the equipment icons of this replay (C15), never the battle.
    this.listeners?.replay(message.replay, readReplayUnitIds((message as { unitIds?: unknown }).unitIds) ?? []);
  }
  /** D11 live bank: the records of my current battle from `fromTick` on changed; anything else is stale and dropped. */
  private onReplayTail(message: ReplayTailMessage): void {
    const last = this.lastReplay;
    if (!last || `${message.roomId}:${message.round}:${message.battleId}` !== this.lastReplayKey || !Number.isInteger(message.fromTick)
      || message.fromTick < 0 || message.fromTick > last.ticks.length || !Array.isArray(message.ticks)) return;
    const revised: CombatReplay = { initial: last.initial, ticks: [...last.ticks.slice(0, message.fromTick), ...message.ticks], terminal: message.terminal };
    this.lastReplay = revised;
    this.listeners?.replayRevised?.(revised);
  }
  private onReceipt(receipt: ReceiptMessage): void {
    const entry = this.inflight.get(receipt.commandId);
    this.inflight.delete(receipt.commandId);
    if (receipt.ok) {
      const result = receipt.result;
      switch (result.kind) {
        case 'joined':
          this.seatId = result.seatId; this.roomId = null; this.bound = true; this.writeToken(result.token);
          this.lobbyError = null; this.emitLobby();
          break;
        case 'left': this.forgetSeat(); this.emitLobby(); break;
        case 'started': break; // the room's first view/state follow
        case 'resumed':
          this.seatId = result.seatId; this.roomId = result.roomId; this.bound = true;
          this.nextCommandId = Math.max(this.nextCommandId, result.lastCommandId + 1);
          this.setStatus(result.reclaimed ? { kind: 'online', reclaimed: true } : { kind: 'online' });
          break;
        case 'applied':
        case 'consumable-used':
          this.appliedRevision = Math.max(this.appliedRevision, result.seatRevision);
          this.confirmed.push({ commandId: receipt.commandId, events: result.events, seatRevision: result.seatRevision });
          break;
      }
      this.flushRetries();
      return;
    }
    const type = entry?.type ?? null;
    if (type === 'resume' || receipt.reason === 'invalid-token') {
      this.forgetSeat();
      this.lastView = null; this.lastState = null; this.lastReplayKey = ''; this.lastReplay = null;
      this.lobbyError = '上一局已结束或凭证失效，请重新匹配';
      this.setStatus({ kind: 'seat-lost' });
      this.setStatus({ kind: 'online' });
      this.emitLobby();
      return;
    }
    if (type === 'command') {
      if (RETRY_REASONS.has(receipt.reason)) this.deferredRetries.push({ commandId: receipt.commandId, reason: receipt.reason });
      else this.listeners?.refused?.({ commandId: receipt.commandId, reason: receipt.reason, retry: false });
      this.flushRetries();
      return;
    }
    this.log(`refused ${type ?? 'message'} ${receipt.commandId}: ${receipt.reason}${receipt.detail ? ` (${receipt.detail})` : ''}`);
    this.lobbyError = LOBBY_ERRORS[receipt.reason] ?? `请求被拒绝：${receipt.reason}`;
    this.emitLobby();
  }
  /** Stale-view refusals wait for the next state, unless nothing else is in flight that could bring one. */
  private flushRetries(): void {
    if (!this.deferredRetries.length) return;
    const waiting = this.confirmed.length > 0 || [...this.inflight.values()].some(entry => entry.type === 'command');
    if (waiting) return;
    const retries = this.deferredRetries; this.deferredRetries = [];
    for (const retry of retries) this.listeners?.refused?.({ ...retry, retry: true });
  }
  private onError(code: string, text: string): void {
    this.log(`server error ${code}: ${text}`);
    if (code === 'session-superseded') {
      this.superseded = true; this.cancelReconnect(); this.clearInflight();
      this.setStatus({ kind: 'superseded' });
      return;
    }
    if (code === 'rate-limited') {
      // The dropped message gets no receipt; forget what is in flight so later commands carry a sane revision.
      this.inflight.clear();
      this.lobbyError = LOBBY_ERRORS['rate-limited']!; this.emitLobby();
    }
  }

  /* ---------------- helpers ---------------- */

  private setStatus(status: ConnectionStatus): void {
    if (this.status?.kind === status.kind && status.kind !== 'reconnecting' && !(status.kind === 'online' && status.reclaimed)) return;
    this.status = status;
    this.listeners?.connection?.(status);
  }
  private emitLobby(): void {
    const base = this.lobbyView ?? { queue: [], capacity: 8, joined: false, canStart: false, error: null };
    // The server's lobby view only knows this connection's seat; a seat we just gave up is not joined.
    const joined = base.joined && this.seatId !== null;
    this.listeners?.lobby({ ...base, joined, canStart: base.canStart && joined, error: this.lobbyError ?? base.error });
  }
  private forgetSeat(): void {
    this.seatId = null; this.roomId = null; this.round = 0; this.stateRevision = -1; this.appliedRevision = -1;
    this.writeToken(null);
  }
  private readToken(): string | null {
    try {
      const raw = this.storage?.getItem(tokenStorageKey(this.options.url));
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredSeat;
      return stored.url === this.options.url && typeof stored.token === 'string' ? stored.token : null;
    } catch { return null; }
  }
  private writeToken(token: string | null): void {
    this.token = token;
    try {
      if (token === null) this.storage?.removeItem(tokenStorageKey(this.options.url));
      else this.storage?.setItem(tokenStorageKey(this.options.url), JSON.stringify({ url: this.options.url, token } satisfies StoredSeat));
    } catch { /* storage unavailable: the seat lives as long as this page */ }
  }
}

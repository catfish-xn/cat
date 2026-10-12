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
 * - The seat token lives in sessionStorage only. After a dropped connection the client reconnects with
 *   1s/2s/4s/8s/10s backoff and `resume{token}`; the server's snapshot (view → state → combat) restores
 *   the screen. A queued seat is lost with its connection (B2 rule), so it returns to matchmaking.
 *
 * No DOM dependency besides the injectable WebSocket/storage/timers, so tests drive it under Node.
 */
import { createMatch } from '../../simulation/match';
import type { MatchState } from '../../simulation/match-types';
import {
  NET_PROTOCOL_VERSION, type ClientMessage, type ReceiptFailure, type ReceiptMessage, type ServerMessage,
} from '../../server/net/messages';
import type {
  ClientCommand, ClientListeners, ClientSendResult, CombatFrame, ConfirmedCommand, ConnectionStatus, GameClient, LobbyView, PlayerView,
} from './protocol';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Timers = { set(callback: () => void, ms: number): unknown; clear(handle: unknown): void };
type Raw = ClientMessage extends infer M ? M extends ClientMessage ? Omit<M, 'protocolVersion' | 'commandId'> : never : never;
type CombatMessage = Extract<ServerMessage, { type: 'combat' }>;

export interface WsClientOptions {
  readonly url: string;
  /** Where the seat token is kept; the browser passes sessionStorage. null keeps it in memory only. */
  readonly storage?: StorageLike | null;
  readonly createSocket?: (url: string) => WebSocket;
  readonly timers?: Timers;
  /** Reconnect delays in ms; the last one repeats. */
  readonly backoffMs?: readonly number[];
  readonly log?: (line: string) => void;
}
export const RECONNECT_BACKOFF_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 10_000];
export const TOKEN_STORAGE_KEY = 'hex-online-seat';
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
  private attempt = 0;
  private disposed = false;
  private superseded = false;
  private status: ConnectionStatus | null = null;

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
  private combatParts: { key: string; frames: CombatFrame[]; next: number } | null = null;
  private lastCombatKey = '';

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
  joinQueue(name: string): void {
    if (this.seatId !== null && this.roomId === null) return;
    this.lobbyError = null;
    this.post({ type: 'join', name: name.trim().slice(0, 24) || '玩家' });
  }
  leaveQueue(): void { if (this.seatId !== null && this.roomId === null) this.post({ type: 'leaveQueue' }); }
  startMatch(): void { if (this.seatId !== null && this.roomId === null) this.post({ type: 'start' }); }

  send(command: ClientCommand): ClientSendResult {
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
    this.lastView = null; this.lastState = null; this.lastCombatKey = ''; this.lobbyError = null;
    this.listeners?.view({ ...LOBBY_PHASE_VIEW, phase: { ...LOBBY_PHASE_VIEW.phase } });
    this.restart();
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.cancelReconnect();
    const socket = this.socket; this.socket = null;
    if (socket) { this.detachSocket(socket); socket.close(1000, 'client closed'); }
    this.listeners = null;
  }

  /* ---------------- debug / tests ---------------- */

  get connection(): ConnectionStatus | null { return this.status; }
  get pendingCount(): number { return this.inflight.size; }
  get currentSeatId(): string | null { return this.seatId; }
  get hasToken(): boolean { return this.token !== null; }
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
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      if (this.token) this.post({ type: 'resume', token: this.token });
      else this.setStatus({ kind: 'online' });
    };
    socket.onmessage = event => { if (this.socket === socket) this.receive(String(event.data)); };
    socket.onclose = event => { if (this.socket === socket) this.closed(event.code); };
    socket.onerror = () => { /* followed by close */ };
  }
  private detachSocket(socket: WebSocket): void { socket.onopen = null; socket.onmessage = null; socket.onclose = null; socket.onerror = null; }
  /** Drops the current socket (if any) without the reconnect bookkeeping and opens a new one at once. */
  private restart(): void {
    this.cancelReconnect();
    const socket = this.socket; this.socket = null;
    if (socket) { this.detachSocket(socket); socket.close(1000, 'reset'); }
    this.clearInflight();
    this.connect();
  }
  private closed(code: number): void {
    this.socket = null;
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
  private cancelReconnect(): void { if (this.reconnectTimer !== null) { this.timers.clear(this.reconnectTimer); this.reconnectTimer = null; } }
  private clearInflight(): void { this.inflight.clear(); this.confirmed = []; this.deferredRetries = []; this.combatParts = null; }

  /* ---------------- inbound ---------------- */

  private receive(text: string): void {
    let message: ServerMessage;
    try { message = JSON.parse(text) as ServerMessage; }
    catch { this.log('server sent invalid JSON'); return; }
    switch (message.type) {
      case 'lobby': this.lobbyView = message.view; this.emitLobby(); return;
      case 'view': return this.onView(message.roomId, message.view);
      case 'state': return this.onState(message.roomId, message.round, message.seatRevision, message.state);
      case 'combat': return this.onCombat(message);
      case 'receipt': return this.onReceipt(message);
      case 'error': return this.onError(message.code, message.message);
    }
  }
  private onView(roomId: string, view: PlayerView): void {
    this.roomId = roomId;
    this.round = Math.max(this.round, view.phase.round);
    this.lastView = view;
    this.listeners?.view(view);
  }
  private onState(roomId: string, round: number, seatRevision: number, state: MatchState): void {
    this.roomId = roomId; this.round = round; this.stateRevision = seatRevision; this.lastState = state;
    const confirmed = this.confirmed.filter(entry => entry.seatRevision <= seatRevision);
    this.confirmed = this.confirmed.filter(entry => entry.seatRevision > seatRevision);
    this.listeners?.state(state, confirmed.map(({ commandId, events }) => ({ commandId, events })));
    this.flushRetries();
  }
  private onCombat(message: CombatMessage): void {
    const key = `${message.roomId}:${message.round}:${message.battleId}`;
    let frames: readonly CombatFrame[] = message.frames;
    if (message.total !== undefined && message.part !== undefined) {
      if (message.part === 1) this.combatParts = { key, frames: [], next: 1 };
      const parts = this.combatParts;
      if (!parts || parts.key !== key || parts.next !== message.part) { this.log(`combat part ${message.part}/${message.total} out of order`); this.combatParts = null; return; }
      parts.frames.push(...message.frames); parts.next += 1;
      if (message.part < message.total) return;
      frames = parts.frames; this.combatParts = null;
    }
    // A resume snapshot repeats the battle already played; show it only once.
    if (key === this.lastCombatKey) return;
    this.lastCombatKey = key;
    this.listeners?.combat(frames);
  }
  private onReceipt(receipt: ReceiptMessage): void {
    const entry = this.inflight.get(receipt.commandId);
    this.inflight.delete(receipt.commandId);
    if (receipt.ok) {
      const result = receipt.result;
      switch (result.kind) {
        case 'joined':
          this.seatId = result.seatId; this.roomId = null; this.writeToken(result.token);
          this.lobbyError = null; this.emitLobby();
          break;
        case 'left': this.forgetSeat(); this.emitLobby(); break;
        case 'started': break; // the room's first view/state follow
        case 'resumed':
          this.seatId = result.seatId; this.roomId = result.roomId;
          this.nextCommandId = Math.max(this.nextCommandId, result.lastCommandId + 1);
          this.setStatus({ kind: 'online' });
          break;
        case 'applied':
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
      this.lastView = null; this.lastState = null; this.lastCombatKey = '';
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
    if (this.status?.kind === status.kind && status.kind !== 'reconnecting') return;
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
      const raw = this.storage?.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredSeat;
      return stored.url === this.options.url && typeof stored.token === 'string' ? stored.token : null;
    } catch { return null; }
  }
  private writeToken(token: string | null): void {
    this.token = token;
    try {
      if (token === null) this.storage?.removeItem(TOKEN_STORAGE_KEY);
      else this.storage?.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ url: this.options.url, token } satisfies StoredSeat));
    } catch { /* storage unavailable: the seat lives as long as this page */ }
  }
}

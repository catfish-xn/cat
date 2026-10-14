/**
 * Single-room WebSocket game server (work order B2). One Lobby, at most one running Room, one
 * WriteQueue: every inbound message is parsed, authenticated, deduped, version-checked and only
 * then handed to Room.handle, strictly in arrival order. Each connection receives its own
 * PlayerView, its own private seat view (the rules' `toPrivateSeatView`, never the MatchState) and
 * its own battle (one compact replay per round); nobody receives another seat's shop. This is the
 * only server file that imports ws.
 *
 * Processing order per message (V2 §5.1): parse & field validation → identity and seat →
 * commandId dedupe → room / round / seatRevision → rules (Room.handle) → record receipt → push.
 */
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { startBattleJob, type BattleJob, type BattleResolver } from '../room/battle-resolver';
import { TwoSidedBattleResolver } from '../room/two-sided-resolver';
import type { Clock, ClockHandle } from '../room/clock';
import { Lobby } from '../room/lobby';
import { consumableReceiptEvents, seatPushEvents, startReplayWarmup, toCombatReplayFor, toPlayerView, toSeatPrivateView, type ReplayWarmup } from '../room/projection';
import type { Room, RoomRetained, RoomTimings } from '../room/room';
import type { RoomState } from '../room/types';
import { DEFAULT_DEDUPE_WINDOW } from './dedupe';
import {
  commandContent, parseClientMessage, type ClientMessage, type CommandMessage, type ErrorCode, type ReceiptFailure, type ReceiptMessage,
  type ReceiptResult, type ServerMessage,
} from './messages';
import { SessionRegistry, digestOf, type SeatSession } from './session';
import { WriteQueue } from './write-queue';

export interface ConnectionLimits {
  /** Largest accepted text frame; ws closes the connection with 1009 above it. */
  readonly maxMessageBytes: number;
  /** Messages accepted per connection per `rateWindowMs` of the injected clock. */
  readonly maxMessagesPerWindow: number;
  readonly rateWindowMs: number;
  /** Superseded connections are closed this long after their replacement resumed. */
  readonly supersededCloseMs: number;
  readonly dedupeWindow: number;
}
export const LIMIT_DEFAULTS: ConnectionLimits = { maxMessageBytes: 16 * 1024, maxMessagesPerWindow: 60, rateWindowMs: 1_000, supersededCloseMs: 1_000, dedupeWindow: DEFAULT_DEDUPE_WINDOW };

export interface GameServerOptions {
  /** 0 picks a free port; read it back from `GameServer.port`. */
  readonly port: number;
  readonly host?: string;
  readonly clock: Clock;
  readonly seed: number;
  readonly resolver?: BattleResolver;
  readonly roomId?: string;
  readonly timings?: Partial<RoomTimings>;
  readonly queueTimeoutMs?: number | null;
  readonly limits?: Partial<ConnectionLimits>;
  /** Bot steps spacing, disconnect takeover switch (off by default, P2) and delay (B6); steps always run as tasks of the server's write queue. */
  readonly bots?: { readonly stepMs?: number; readonly takeover?: boolean; readonly takeoverMs?: number };
  /** Battle delivery (B7): `both` by default until the client plays replays (C6). */
  /** Combat ticks resolved per write-queue slice after a preparation deadline (B8); see RoomOptions.sliceTicks. */
  readonly sliceTicks?: number;
  readonly log?: (line: string) => void;
}

export interface GameServer {
  readonly port: number;
  readonly lobby: Lobby;
  readonly room: Room | null;
  readonly connectionCount: number;
  /** Messages the write queue has run (inbound messages + pushes); tests use it to prove serial processing. */
  readonly processed: number;
  /** What the server holds across matches (B8): credentials, their dedupe windows and the current room's own leftovers. */
  readonly retained: ServerRetained;
  close(): Promise<void>;
}

export interface ServerRetained {
  readonly sessions: number;
  readonly dedupeEntries: number;
  readonly connections: number;
  readonly room: RoomRetained | null;
}
/** Default combat ticks per resolution slice: a few tens of milliseconds of rules work between two queue turns. */
export const DEFAULT_SLICE_TICKS = 100;

/**
 * Resolver wrapper (B8, §19): once a battle's job finished, the following slices build the replays its attended seats
 * will be pushed, as resumable replay tasks advanced by the same tick budget, so the re-execution behind a replay never
 * runs inside the push of the whole round nor in one long slice. The result is unchanged.
 */
function withReplayWarmup(inner: BattleResolver, seats: () => Iterable<string>): BattleResolver {
  return {
    resolveBattle: (input, pool) => inner.resolveBattle(input, pool),
    startBattle(input, pool): BattleJob {
      const job = startBattleJob(inner, input, pool);
      let finished: ReturnType<BattleJob['advance']> = null, warmup: ReplayWarmup | null = null;
      return {
        advance(maxTicks) {
          if (finished) {
            warmup ??= startReplayWarmup(finished, seats());
            return warmup.advance(maxTicks) ? finished : null;
          }
          finished = job.advance(maxTicks);
          return null;
        },
      };
    },
  };
}

/** Close codes the server uses; 4xxx is the application range of RFC 6455. */
export const CLOSE_CODES = { superseded: 4001, serverClosing: 4002 } as const;

interface Connection {
  readonly id: number;
  readonly socket: WebSocket;
  session: SeatSession | null;
  /** Epoch this connection was bound with; a resume elsewhere leaves it behind. */
  epoch: number;
  open: boolean;
  windowStart: number;
  windowCount: number;
  sentRoomRevision: number;
  sentSeatRevision: number;
  sentCombatKey: string;
  closeHandle: ClockHandle | null;
}

const fail = (commandId: number, reason: ReceiptFailure, detail: string | null = null): ReceiptMessage => ({ type: 'receipt', commandId, ok: false, reason, detail });
const done = (commandId: number, result: ReceiptResult): ReceiptMessage => ({ type: 'receipt', commandId, ok: true, result });

export function createGameServer(options: GameServerOptions): Promise<GameServer> {
  const limits: ConnectionLimits = { ...LIMIT_DEFAULTS, ...options.limits };
  const log = options.log ?? (() => {});
  const clock = options.clock;
  const queue = new WriteQueue(error => log(`task failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`));
  const sessions = new SessionRegistry(limits.dedupeWindow);
  const connections = new Map<number, Connection>();
  let room: Room | null = null;
  let unsubscribeRoom: (() => void) | null = null;
  let nextConnectionId = 1;
  let closing = false;

  // Every room deadline and resolution slice runs as a write-queue task, like an inbound message: the single writer
  // is explicit, and messages that arrived during a slice run before the next slice (B8).
  const roomClock: Clock = {
    now: () => clock.now(),
    schedule: (at, fn) => clock.schedule(at, () => queue.push(fn)),
    cancel: handle => clock.cancel(handle),
  };
  const resolver = options.resolver ?? new TwoSidedBattleResolver();
  const lobby = new Lobby({
    clock: roomClock, sliceTicks: options.sliceTicks ?? DEFAULT_SLICE_TICKS, seed: options.seed,
    resolver: withReplayWarmup(resolver, () => attendedSeats()), roomId: options.roomId, timings: options.timings,
    queueTimeoutMs: options.queueTimeoutMs ?? null, onStart: opened => attachRoom(opened),
    // Bot steps and takeovers fire on the clock; each one becomes a task of the single write queue (§13.3 item 2).
    bots: { ...options.bots, enqueue: task => queue.push(task) },
  });

  /** Seats a connection currently holds; only they are pushed a replay. */
  function attendedSeats(): Set<string> {
    const seats = new Set<string>();
    for (const conn of connections.values()) if (conn.session) seats.add(conn.session.seatId);
    return seats;
  }

  /* ---------------- outbound ---------------- */

  function send(conn: Connection, message: ServerMessage): void {
    if (!conn.open || conn.socket.readyState !== conn.socket.OPEN) return;
    conn.socket.send(JSON.stringify(message));
  }
  function sendError(conn: Connection, code: ErrorCode, message: string, commandId: number | null = null): void {
    send(conn, { type: 'error', code, message, commandId });
  }
  function lobbyViewFor(conn: Connection) { return lobby.view(conn.session && conn.session.roomId === null ? conn.session.seatId : null); }
  function broadcastLobby(): void {
    for (const conn of connections.values()) if (conn.session === null || conn.session.roomId === null) send(conn, { type: 'lobby', view: lobbyViewFor(conn) });
  }

  /**
   * Sends this connection whatever of its room it has not seen yet: view, then private seat view, then its battle.
   * Every path (first snapshot, increments, resume, the fault snapshot) goes through here, so the seat's state
   * only ever leaves as `toPrivateSeatView`. An eliminated seat keeps view and replay; its last state is the one
   * of the round that eliminated it.
   */
  function pushRoom(conn: Connection, state: RoomState): void {
    const session = conn.session;
    if (!session || session.roomId !== state.roomId) return;
    const seat = state.seats.find(candidate => candidate.seatId === session.seatId);
    if (!seat) return;
    if (conn.sentRoomRevision !== state.roomRevision) {
      conn.sentRoomRevision = state.roomRevision;
      send(conn, { type: 'view', roomId: state.roomId, roomRevision: state.roomRevision, view: toPlayerView(state, seat.seatId, clock.now()) });
    }
    const receivesState = seat.alive || seat.eliminatedRound === state.round;
    if (receivesState && conn.sentSeatRevision !== seat.seatRevision) {
      conn.sentSeatRevision = seat.seatRevision;
      const events = seatPushEvents(seat);
      send(conn, { type: 'state', roomId: state.roomId, round: state.round, seatRevision: seat.seatRevision, state: toSeatPrivateView(seat.match), ...(events.length ? { events } : {}) });
    }
    const battle = state.battles.find(candidate => candidate.kind === 'two-sided' ? candidate.participants.includes(seat.seatId) : candidate.outcomes.some(outcome => outcome.seatId === seat.seatId));
    if (battle) {
      const key = `${state.round}:${battle.battleId}`;
      if (conn.sentCombatKey !== key) {
        conn.sentCombatKey = key;
        // A replay failure is a server fault (§14.2): logged, never turned into a result; settlement still follows.
        let replay: ReturnType<typeof toCombatReplayFor> = null;
        try { replay = toCombatReplayFor(state, seat.seatId); }
        catch (error) { log(`replay of ${battle.battleId} failed: ${error instanceof Error ? error.message : String(error)}`); }
        if (replay) send(conn, { type: 'replay', roomId: state.roomId, round: state.round, battleId: replay.battleId, replay: replay.replay, unitIds: replay.unitIds });
      }
    }
  }
  function pushAll(state: RoomState): void { for (const conn of connections.values()) pushRoom(conn, state); }

  function attachRoom(opened: Room): void {
    unsubscribeRoom?.();
    room = opened;
    const roomId = opened.state.roomId;
    const seated = new Set(opened.state.seats.map(seat => seat.seatId));
    // Credentials of a finished match die with it: a seat id that is not in the new room has no session.
    for (const session of [...sessions]) {
      if (seated.has(session.seatId)) { session.roomId = roomId; continue; }
      const holder = session.connection as Connection | null;
      if (holder) { holder.session = null; holder.epoch = 0; }
      sessions.revoke(session.seatId);
    }
    // A listener may fire inside Room.handle (same queue task): defer the push so the receipt leaves first.
    unsubscribeRoom = opened.subscribe(state => queue.push(() => pushAll(state)));
    for (const conn of connections.values()) {
      const session = conn.session;
      if (!session) continue;
      conn.sentRoomRevision = -1; conn.sentSeatRevision = -1; conn.sentCombatKey = '';
      if (!conn.open) opened.setConnected(session.seatId, false);
    }
    // Queued behind the current task (the "start" receipt) when a player started it; immediate on a queue timeout.
    queue.push(() => { pushAll(opened.state); broadcastLobby(); });
  }

  /** A seat is live only while its room runs; sessions of an ended match may queue again. */
  function sessionLocked(session: SeatSession): boolean {
    if (session.roomId === null) return true; // queued
    return room !== null && session.roomId === room.state.roomId && room.state.phase !== 'ended';
  }

  /* ---------------- inbound ---------------- */

  function handleJoin(conn: Connection, message: ClientMessage & { type: 'join' }): void {
    if (conn.session && sessionLocked(conn.session)) return send(conn, fail(message.commandId, 'already-joined'));
    if (conn.session) { sessions.revoke(conn.session.seatId); conn.session.connection = null; conn.session = null; }
    const joined = lobby.join(message.name);
    if (!joined.ok) return send(conn, fail(message.commandId, joined.reason));
    const { token, session } = sessions.issue(joined.seatId);
    bind(conn, session);
    const receipt = done(message.commandId, { kind: 'joined', seatId: joined.seatId, token, connectionEpoch: session.connectionEpoch });
    session.dedupe.record(message.commandId, digestOf(commandContent(message)), receipt);
    send(conn, receipt);
    log(`seat ${joined.seatId} joined as "${message.name}" (connection ${conn.id})`);
    broadcastLobby();
  }

  /** commandId dedupe for a seated connection: replays, refuses or runs `compute` and records its receipt. */
  function deduped(conn: Connection, session: SeatSession, message: ClientMessage, compute: () => ReceiptMessage): void {
    const digest = digestOf(commandContent(message));
    const verdict = session.dedupe.check(message.commandId, digest);
    if (verdict.kind === 'replay') return send(conn, verdict.receipt);
    if (verdict.kind === 'conflict') return send(conn, fail(message.commandId, 'commandId-conflict', 'this commandId was already used for a different command'));
    if (verdict.kind === 'expired') return send(conn, fail(message.commandId, 'resync-required', `commandId is older than the last ${session.dedupe.retention} commands; resynchronise and use a new id`));
    const receipt = compute();
    session.dedupe.record(message.commandId, digest, receipt);
    send(conn, receipt);
  }

  function handleLeaveQueue(conn: Connection, message: ClientMessage & { type: 'leaveQueue' }): void {
    const session = conn.session;
    if (!session) return send(conn, fail(message.commandId, 'not-authenticated'));
    deduped(conn, session, message, () => {
      if (session.roomId !== null || !lobby.queued.some(entry => entry.seatId === session.seatId)) return fail(message.commandId, 'not-queued');
      lobby.leave(session.seatId);
      sessions.revoke(session.seatId);
      session.connection = null; conn.session = null;
      broadcastLobby();
      return done(message.commandId, { kind: 'left' });
    });
  }

  function handleStart(conn: Connection, message: ClientMessage & { type: 'start' }): void {
    const session = conn.session;
    if (!session) return send(conn, fail(message.commandId, 'not-authenticated'));
    deduped(conn, session, message, () => {
      if (session.roomId !== null || !lobby.queued.some(entry => entry.seatId === session.seatId)) return fail(message.commandId, 'not-queued');
      const started = lobby.start(); // onStart → attachRoom pushes the first snapshot to every seated connection
      if (!started.ok) return fail(message.commandId, started.reason);
      log(`room ${started.room.state.roomId} started by ${session.seatId}`);
      return done(message.commandId, { kind: 'started', roomId: started.room.state.roomId });
    });
  }

  function handleResume(conn: Connection, message: ClientMessage & { type: 'resume' }): void {
    const resumed = sessions.resume(message.token);
    if (!resumed.ok) return send(conn, fail(message.commandId, 'invalid-token'));
    const session = resumed.session;
    const previous = session.connection as Connection | null;
    if (previous && previous !== conn) detach(previous, 'superseded');
    if (conn.session && conn.session !== session) {
      // This connection switches seats: the seat it leaves behind is now unattended.
      conn.session.connection = null;
      if (conn.session.roomId !== null) room?.setConnected(conn.session.seatId, false);
    }
    bind(conn, session);
    const current = room;
    const inRoom = current !== null && session.roomId === current.state.roomId;
    // A resume revokes a bot takeover at once (B6); the receipt tells the player their seat was handed back.
    const reclaimed = inRoom && current.state.seats.some(seat => seat.seatId === session.seatId && seat.controller === 'takeover');
    if (inRoom) current.setConnected(session.seatId, true);
    send(conn, done(message.commandId, { kind: 'resumed', seatId: session.seatId, roomId: session.roomId, connectionEpoch: session.connectionEpoch, lastCommandId: session.dedupe.highestSeen, ...(reclaimed ? { reclaimed: true as const } : {}) }));
    // Snapshot first (view → state → combat), increments follow through the room listener.
    if (inRoom) pushRoom(conn, current.state); else send(conn, { type: 'lobby', view: lobbyViewFor(conn) });
    log(`seat ${session.seatId} resumed on connection ${conn.id} (epoch ${session.connectionEpoch})`);
  }

  function handleCommand(conn: Connection, message: CommandMessage): void {
    const { commandId } = message;
    const session = conn.session;
    if (!session || conn.epoch !== session.connectionEpoch) return send(conn, fail(commandId, 'not-authenticated'));
    const current = room;
    if (!current || session.roomId !== current.state.roomId) return send(conn, fail(commandId, 'no-room'));
    if (message.roomId !== current.state.roomId) return send(conn, fail(commandId, 'wrong-room'));
    deduped(conn, session, message, () => {
      const state = current.state;
      const seat = state.seats.find(candidate => candidate.seatId === session.seatId);
      if (!seat) return fail(commandId, 'unknown-seat');
      if (message.round !== state.round) return fail(commandId, 'stale-round', `room is at round ${state.round}`);
      if (message.seatRevision !== seat.seatRevision) return fail(commandId, 'seat-revision-mismatch', `seat is at revision ${seat.seatRevision}`);
      const result = current.handle(session.seatId, message.command);
      if (!result.ok) return fail(commandId, result.reason);
      // §18.8 03: a tool use answers with its own receipt kind and only the whitelisted operation events.
      return message.command.type === 'useConsumable'
        ? done(commandId, { kind: 'consumable-used', seatRevision: result.seatRevision, roomRevision: result.roomRevision, events: consumableReceiptEvents(result.events) })
        : done(commandId, { kind: 'applied', seatRevision: result.seatRevision, roomRevision: result.roomRevision, events: result.events });
    });
  }

  function dispatch(conn: Connection, message: ClientMessage): void {
    switch (message.type) {
      case 'join': return handleJoin(conn, message);
      case 'leaveQueue': return handleLeaveQueue(conn, message);
      case 'start': return handleStart(conn, message);
      case 'resume': return handleResume(conn, message);
      case 'command': return handleCommand(conn, message);
    }
  }

  function withinRate(conn: Connection): boolean {
    const now = clock.now();
    if (now - conn.windowStart >= limits.rateWindowMs) { conn.windowStart = now; conn.windowCount = 0; }
    conn.windowCount += 1;
    return conn.windowCount <= limits.maxMessagesPerWindow;
  }

  function onMessage(conn: Connection, data: RawData, isBinary: boolean): void {
    if (!conn.open) return;
    if (!withinRate(conn)) return sendError(conn, 'rate-limited', `more than ${limits.maxMessagesPerWindow} messages per ${limits.rateWindowMs} ms`);
    if (isBinary) return sendError(conn, 'invalid-json', 'binary frames are not accepted');
    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok) {
      if (parsed.commandId !== null) return send(conn, fail(parsed.commandId, parsed.code === 'invalid-json' ? 'invalid-message' : parsed.code, parsed.detail));
      return sendError(conn, parsed.code, parsed.detail);
    }
    dispatch(conn, parsed.message);
  }

  /* ---------------- connection lifecycle ---------------- */

  function bind(conn: Connection, session: SeatSession): void {
    conn.session = session;
    conn.epoch = session.connectionEpoch;
    session.connection = conn;
    conn.sentRoomRevision = -1; conn.sentSeatRevision = -1; conn.sentCombatKey = '';
  }

  /** The connection loses its seat but may stay open: `superseded` tells it why and closes it after a grace period. */
  function detach(conn: Connection, reason: 'superseded' | 'closed'): void {
    const session = conn.session;
    if (session && session.connection === conn) session.connection = null;
    conn.session = null;
    if (reason === 'superseded' && conn.open) {
      sendError(conn, 'session-superseded', 'another connection resumed this seat');
      if (conn.closeHandle === null) conn.closeHandle = clock.schedule(clock.now() + limits.supersededCloseMs, () => { conn.closeHandle = null; conn.socket.close(CLOSE_CODES.superseded, 'superseded'); });
    }
  }

  function onClose(conn: Connection): void {
    if (!conn.open) return;
    conn.open = false;
    if (conn.closeHandle !== null) { clock.cancel(conn.closeHandle); conn.closeHandle = null; }
    connections.delete(conn.id);
    const session = conn.session;
    if (session && session.connection === conn) {
      if (session.roomId === null) {
        // Queue drop: the seat is given up (there is no "connected" flag before a match).
        lobby.leave(session.seatId); sessions.revoke(session.seatId); session.connection = null;
        broadcastLobby();
      } else {
        session.connection = null;
        room?.setConnected(session.seatId, false); // seat, assets, pairings and rank stay; the token still resumes it
      }
    }
    conn.session = null;
    log(`connection ${conn.id} closed`);
  }

  function onConnection(socket: WebSocket): void {
    if (closing) { socket.close(CLOSE_CODES.serverClosing, 'server closing'); return; }
    const conn: Connection = { id: nextConnectionId++, socket, session: null, epoch: 0, open: true, windowStart: clock.now(), windowCount: 0, sentRoomRevision: -1, sentSeatRevision: -1, sentCombatKey: '', closeHandle: null };
    connections.set(conn.id, conn);
    socket.on('message', (data, isBinary) => queue.push(() => onMessage(conn, data, isBinary)));
    socket.on('close', () => queue.push(() => onClose(conn)));
    socket.on('error', error => log(`connection ${conn.id} error: ${error.message}`));
    queue.push(() => send(conn, { type: 'lobby', view: lobbyViewFor(conn) }));
    log(`connection ${conn.id} opened`);
  }

  /* ---------------- listen ---------------- */

  return new Promise<GameServer>((resolve, reject) => {
    // permessage-deflate (C4): seat views and replay keyframes repeat almost entirely, so they compress well.
    // Context takeover stays on (the default) so consecutive states compress against each other.
    const wss = new WebSocketServer({ port: options.port, host: options.host, maxPayload: limits.maxMessageBytes, perMessageDeflate: { threshold: 1024 } });
    wss.once('error', reject);
    wss.on('connection', onConnection);
    wss.once('listening', () => {
      const address = wss.address();
      const port = typeof address === 'object' && address !== null ? address.port : options.port;
      wss.off('error', reject);
      wss.on('error', error => log(`server error: ${error.message}`));
      resolve({
        get port() { return port; },
        get lobby() { return lobby; },
        get room() { return room; },
        get connectionCount() { return connections.size; },
        get processed() { return queue.completed; },
        get retained(): ServerRetained {
          let dedupeEntries = 0;
          for (const session of sessions) dedupeEntries += session.dedupe.size;
          return { sessions: sessions.size, dedupeEntries, connections: connections.size, room: room?.retained ?? null };
        },
        close: () => new Promise<void>(resolveClose => {
          closing = true;
          for (const conn of connections.values()) { conn.open = false; conn.socket.close(CLOSE_CODES.serverClosing, 'server closing'); }
          unsubscribeRoom?.(); unsubscribeRoom = null;
          lobby.dispose();
          wss.close(() => resolveClose());
        }),
      });
    });
  });
}

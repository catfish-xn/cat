/**
 * Single-room WebSocket game server (work order B2). One Lobby, at most one running Room, one
 * WriteQueue: every inbound message is parsed, authenticated, deduped, version-checked and only
 * then handed to Room.handle, strictly in arrival order. Each connection receives its own
 * PlayerView, its own private seat view (the rules' `toPrivateSeatView`, never the MatchState) and
 * its own battle (one compact replay per round); nobody receives another seat's shop. This is the
 * only server file that imports ws.
 *
 * G3: the same port also answers plain HTTP `GET /healthz` (any path ending in /healthz, so a reverse proxy may mount it
 * under its WebSocket prefix) with the build identity and the live counts, and every log line is a structured record
 * (src/server/log.ts). A room that ends with a fault releases its credentials and the queue is open again.
 *
 * Processing order per message (V2 §5.1): parse & field validation → identity and seat →
 * commandId dedupe → room / round / seatRevision → rules (Room.handle) → record receipt → push.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { textLogger, type Logger } from '../log';
import { PlaceholderBattleResolver, startBattleJob, type BattleJob, type BattleResolver, type ReplayCapture } from '../room/battle-resolver';
import { TwoSidedBattleResolver } from '../room/two-sided-resolver';
import { replayTail } from '../room/live-bank';
import type { CombatReplay } from '../../server-entry';
import type { Clock, ClockHandle } from '../room/clock';
import type { CarouselRules } from '../room/carousel';
import { Lobby, type LobbyWatchdog } from '../room/lobby';
import { consumableReceiptEvents, mirrorReplayTick, seatPushEvents, startReplaySpotCheck, startReplayWarmup, toCombatReplayFor, toPlayerFault, toPlayerView, toSeatPrivateView, type ReplayWarmup } from '../room/projection';
import { SLICE_STEP_TICKS, type Room, type RoomRetained, type RoomTimings } from '../room/room';
import { ROOM_CAPACITY, ROOM_PROTOCOL_VERSION, type BattleResult, type RoomPhase, type RoomState } from '../room/types';
import { DEFAULT_DEDUPE_WINDOW } from './dedupe';
import {
  NET_PROTOCOL_VERSION, commandContent, parseClientMessage, type ClientMessage, type CommandMessage, type ErrorCode, type ReceiptFailure, type ReceiptMessage,
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
  /** First-pass replay spot check cadence in rounds that captured a battle; SPOT_CHECK_EVERY_ROUNDS by default. */
  readonly spotCheckEveryRounds?: number;
  /** Wall budget of one resolution slice in ms (RoomOptions.sliceMs); default DEFAULT_SLICE_MS, `null` slices by ticks only. */
  readonly sliceMs?: number | null;
  /**
   * Event-loop delay report every this many ms (`loop.lag`: max and p99 since the last report); off when omitted or
   * null. main.ts turns it on; it reads Node's event-loop histogram, so tests on a manual clock leave it off.
   */
  readonly loopLagReportMs?: number | null;
  /** Structured log sink (G3); main.ts writes JSON lines. Takes precedence over `log`. */
  readonly logger?: Logger;
  /** Older one-line text sink, still accepted (scripts/loadtest-room.cjs). */
  readonly log?: (line: string) => void;
  /** Stall / abandon watchdog of every room (G3, Lobby); off when omitted. */
  readonly watchdog?: LobbyWatchdog | null;
  /** Build identity reported by /healthz; main.ts fills it from the environment and the rules' digests. */
  readonly build?: BuildInfo;
  /** G1-P7: the rules' shared carousel (`CAROUSEL_RULES_BINDING`), forwarded to every room; main.ts turns it on. */
  readonly carousel?: CarouselRules;
  /** Process figures for /healthz (main.ts reads them from Node); null fields when omitted. */
  readonly processStats?: () => { readonly uptimeSec: number; readonly rssBytes: number };
  /**
   * Connection heartbeat on the injected clock: every `intervalMs` each open connection gets a WebSocket ping and a
   * `heartbeat` message; one that has sent nothing (no pong, no message) for `timeoutMs` is terminated, which frees
   * the connection but keeps its seat exactly like any other close (the token still resumes it). Off when omitted;
   * main.ts turns it on.
   */
  readonly heartbeat?: HeartbeatOptions | null;
}

export interface HeartbeatOptions { readonly intervalMs: number; readonly timeoutMs: number }
export const HEARTBEAT_DEFAULTS: HeartbeatOptions = { intervalMs: 10_000, timeoutMs: 25_000 };

export interface BuildInfo {
  /** Full git commit the running bundle was built from, or "unknown". */
  readonly sha: string;
  readonly contentDigest: string;
  readonly lootReplayDigest: string;
}

/** Body of `GET /healthz` (G3). Counts and identifiers only: no names, credentials or seat state. */
export interface HealthReport {
  readonly status: 'ok';
  readonly sha: string;
  readonly contentDigest: string;
  readonly lootReplayDigest: string;
  readonly netProtocol: number;
  readonly roomProtocol: number;
  /** The current (or last) room; null before the first match. */
  readonly room: {
    readonly roomId: string; readonly phase: RoomPhase; readonly round: number; readonly roundName: string;
    /** RoomFault kind when the room ended abnormally. */
    readonly fault: string | null;
    readonly humans: number; readonly humansConnected: number; readonly alive: number;
  } | null;
  /** Seats (queued or seated) whose credential is bound to an open connection right now. */
  readonly seatsOnline: number;
  readonly queue: number;
  readonly capacity: number;
  readonly connections: number;
  readonly uptimeSec: number | null;
  readonly rssBytes: number | null;
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
  /** What `GET /healthz` answers right now. */
  health(): HealthReport;
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
/** First-pass replay spot check: one captured battle every this many rounds that captured one (user choice 2026-10-19). */
export const SPOT_CHECK_EVERY_ROUNDS = 4;
/**
 * Default wall budget of one slice: late-round ticks cost several milliseconds each, so 100 of them could hold the
 * single writer for hundreds of milliseconds and every command queued behind them waited as long.
 */
export const DEFAULT_SLICE_MS = 20;
/** A write-queue task (room slice, deadline, push) taking longer than this is logged as `task.slow`. */
export const SLOW_TASK_MS = 50;
/** At most one `task.slow` line per task kind this often; it counts the slow tasks since the last line and their longest. */
export const SLOW_TASK_LOG_EVERY_MS = 10_000;
/** A `loop.lag` report whose largest delay reaches this is a warning; below it the report is debug. */
export const LOOP_LAG_WARN_MS = 100;

/**
 * Resolver wrapper (B8, §19): once a battle's job finished, the following slices build the replays its attended seats
 * will be pushed, as resumable replay tasks advanced by the same tick budget, so the re-execution behind a replay never
 * runs inside the push of the whole round nor in one long slice. The result is unchanged. A replay the rules already
 * recorded during the first pass is in the cache, so the warm-up skips it; only uncaptured battles (an injected
 * resolver, a seat that connected after its battle started) are still re-run here.
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
  /** The battle result and replay behind the last `replay` (or `replay-tail`) this connection was sent. */
  sentCombat: { readonly battle: BattleResult; readonly replay: CombatReplay } | null;
  closeHandle: ClockHandle | null;
  /** Clock time of the last pong or message from the peer (heartbeat). */
  lastSeen: number;
}

const fail = (commandId: number, reason: ReceiptFailure, detail: string | null = null): ReceiptMessage => ({ type: 'receipt', commandId, ok: false, reason, detail });
const done = (commandId: number, result: ReceiptResult): ReceiptMessage => ({ type: 'receipt', commandId, ok: true, result });

export function createGameServer(options: GameServerOptions): Promise<GameServer> {
  const limits: ConnectionLimits = { ...LIMIT_DEFAULTS, ...options.limits };
  const heartbeat = options.heartbeat ?? null;
  if (heartbeat !== null && !(Number.isSafeInteger(heartbeat.intervalMs) && heartbeat.intervalMs > 0 && Number.isSafeInteger(heartbeat.timeoutMs) && heartbeat.timeoutMs > heartbeat.intervalMs)) {
    return Promise.reject(new RangeError(`heartbeat expects positive integer intervalMs < timeoutMs, got ${JSON.stringify(heartbeat)}`));
  }
  const log: Logger = options.logger ?? (options.log ? textLogger(options.log) : () => {});
  const clock = options.clock;
  const queue = new WriteQueue(error => log('error', 'task.failed', { roomId: room?.state.roomId, error: error instanceof Error ? error.stack ?? error.message : String(error) }));
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
    schedule: (at, fn) => clock.schedule(at, () => queue.push(() => timed('room', fn))),
    cancel: handle => clock.cancel(handle),
  };
  /**
   * Runs one write-queue task and notes it when it held the single writer (and the event loop) past SLOW_TASK_MS.
   * Throttled per task kind, so sustained blocking does not add a log line per task on top of it.
   */
  const slowTasks = new Map<string, { count: number; longestMs: number; loggedAt: number }>();
  function timed(task: string, fn: () => void): void {
    const started = clock.now();
    try { fn(); } finally {
      const now = clock.now(), ms = now - started;
      if (ms >= SLOW_TASK_MS) {
        const slow = slowTasks.get(task) ?? { count: 0, longestMs: 0, loggedAt: -Infinity };
        slow.count++; slow.longestMs = Math.max(slow.longestMs, ms); slowTasks.set(task, slow);
      }
      flushSlowTasks(now, false);
    }
  }
  /** Logs every kind with slow tasks pending whose window ran out (any kind with some pending when `all`: closing). */
  function flushSlowTasks(now: number, all: boolean): void {
    for (const [task, slow] of slowTasks) {
      if (slow.count === 0 || (!all && now - slow.loggedAt < SLOW_TASK_LOG_EVERY_MS)) continue;
      log('warn', 'task.slow', { task, count: slow.count, longestMs: Math.round(slow.longestMs), roomId: room?.state.roomId, round: room?.state.round, phase: room?.state.phase });
      slow.count = 0; slow.longestMs = 0; slow.loggedAt = now;
    }
  }
  // First-pass capture (MULTIPLAYER_CONTRACT): a battle with a human or connected seat records its replay frames while it
  // is computed, so no push re-runs it. Bot-only battles are never pushed and record nothing. An injected resolver
  // (tests, fault injection) captures nothing; its replays are still built by the warm-up below, as before.
  const captureReplay: ReplayCapture = seatIds => {
    const attended = attendedSeats();
    return seatIds.some(seatId => attended.has(seatId) || room?.state.seats.some(seat => seat.seatId === seatId && seat.kind === 'human'));
  };
  const resolver = options.resolver ?? new TwoSidedBattleResolver(new PlaceholderBattleResolver({ captureReplay }), { captureReplay });
  const sliceTicks = options.sliceTicks ?? DEFAULT_SLICE_TICKS;
  const sliceMs = options.sliceMs === null ? null : options.sliceMs ?? DEFAULT_SLICE_MS;
  const spotCheckEvery = options.spotCheckEveryRounds ?? SPOT_CHECK_EVERY_ROUNDS;
  const lobby = new Lobby({
    clock: roomClock, sliceTicks,
    ...(sliceMs === null ? {} : { sliceMs }), seed: options.seed,
    resolver: withReplayWarmup(resolver, () => attendedSeats()), roomId: options.roomId, timings: options.timings,
    queueTimeoutMs: options.queueTimeoutMs ?? null, onStart: opened => attachRoom(opened), onEnd: ended => onRoomEnd(ended), watchdog: options.watchdog ?? null,
    ...(options.carousel ? { carousel: options.carousel } : {}),
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
      const sent = conn.sentCombatKey === key ? conn.sentCombat : null;
      // D11 live bank: a live run replaced the battle already sent; only the records that changed follow.
      if (conn.sentCombatKey !== key || (sent && sent.battle !== battle)) {
        conn.sentCombatKey = key;
        // A replay failure is a server fault (§14.2): logged, never turned into a result; settlement still follows.
        let replay: ReturnType<typeof toCombatReplayFor> = null;
        try { replay = toCombatReplayFor(state, seat.seatId); }
        catch (error) { log('error', 'replay.failed', { roomId: state.roomId, seatId: seat.seatId, round: state.round, battleId: battle.battleId, error: error instanceof Error ? error.message : String(error) }); }
        if (replay && sent) {
          conn.sentCombat = { battle, replay: replay.replay };
          const tail = replayTail(sent.replay, replay.replay);
          if (tail) send(conn, { type: 'replay-tail', roomId: state.roomId, round: state.round, battleId: replay.battleId, ...tail });
        } else if (replay) {
          conn.sentCombat = { battle, replay: replay.replay };
          send(conn, { type: 'replay', roomId: state.roomId, round: state.round, battleId: replay.battleId, replay: replay.replay, unitIds: replay.unitIds });
        }
      }
    }
  }
  /**
   * D11 live bank: a battle's live run produced frames that differ from the replay its seats were pushed. Each seat that
   * holds that replay gets the changed records (side B mirrored, as its replay was); only public view frames leave.
   */
  function pushLive(opened: Room, battleId: string): void {
    const state = opened.state, frames = opened.liveFrames(battleId);
    const battle = state.battles.find(candidate => candidate.battleId === battleId);
    if (!frames || !battle || battle.kind !== 'two-sided') return;
    const key = `${state.round}:${battleId}`;
    for (const conn of connections.values()) {
      const seatId = conn.session?.roomId === state.roomId ? conn.session.seatId : null;
      const sent = conn.sentCombatKey === key ? conn.sentCombat : null;
      if (!seatId || !sent || !battle.participants.includes(seatId)) continue;
      const rows = sent.replay.initial.board.rows;
      const ticks = battle.battle.b.seatId === seatId ? frames.ticks.map(frame => mirrorReplayTick(frame, rows)) : frames.ticks;
      const revised: CombatReplay = { ...sent.replay, ticks: [...sent.replay.ticks.slice(0, frames.fromTick), ...ticks] };
      const tail = replayTail(sent.replay, revised);
      conn.sentCombat = { battle: sent.battle, replay: revised };
      if (tail) send(conn, { type: 'replay-tail', roomId: state.roomId, round: state.round, battleId, ...tail });
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
    // One log record per phase entry (G3), never per command or tick; the room already entered its first phase.
    let lastPhase = '';
    const logPhase = (state: RoomState) => {
      const phaseKey = `${state.round}:${state.phase}`;
      if (phaseKey !== lastPhase) { lastPhase = phaseKey; log('info', 'room.phase', { roomId: state.roomId, round: state.round, roundName: state.roundName, phase: state.phase }); }
    };
    const unsubscribeState = opened.subscribe(state => { logPhase(state); scheduleSpotCheck(opened, state); queue.push(() => timed('push', () => pushAll(state))); });
    const unsubscribeLive = opened.subscribeLive(battleId => queue.push(() => pushLive(opened, battleId)));
    const unsubscribeNotices = opened.subscribeNotices(notice => {
      log('warn', 'orb.claim-refused', { roomId, seatId: notice.seatId, round: notice.round, orbId: notice.orbId, reason: notice.reason });
      // Queued like a publication, so it leaves after the battle-entry state the refusal was decided on.
      queue.push(() => {
        for (const conn of connections.values()) if (conn.session?.seatId === notice.seatId && conn.session.roomId === roomId)
          send(conn, { type: 'notice', roomId, round: notice.round, notice: { kind: 'orb-claim-refused', orbId: notice.orbId, reason: notice.reason } });
      });
    });
    // Little-legend walks go to every seat of the room, after the publication they were decided on.
    const unsubscribeWalks = opened.subscribeWalks(walk => queue.push(() => {
      for (const conn of connections.values()) if (conn.session?.roomId === roomId) send(conn, { type: 'legend', roomId, serverNow: clock.now(), walk });
    }));
    unsubscribeRoom = () => { unsubscribeState(); unsubscribeLive(); unsubscribeNotices(); unsubscribeWalks(); };
    for (const conn of connections.values()) {
      const session = conn.session;
      if (!session) continue;
      conn.sentRoomRevision = -1; conn.sentSeatRevision = -1; conn.sentCombatKey = ''; conn.sentCombat = null;
      if (!conn.open) opened.setConnected(session.seatId, false);
    }
    // Queued behind the current task (the "start" receipt) when a player started it; immediate on a queue timeout.
    queue.push(() => { pushAll(opened.state); broadcastLobby(); });
    log('info', 'room.started', { roomId, humans: opened.state.seats.filter(seat => seat.kind === 'human').length, bots: opened.state.seats.filter(seat => seat.kind === 'bot').length });
    logPhase(opened.state);
  }

  /**
   * Background spot check of first-pass replays (user decisions 2026-10-19): once a round's battles are published, every
   * SPOT_CHECK_EVERY_ROUNDS-th round that captured a battle has one of them re-run by the rules (`startCombatReplay`) in
   * write-queue slices and compared with the frames the seats were pushed. A mismatch never touches the round or its settlement: it is logged with the room, round, battle,
   * seed, seats and first differing frame, and every later round of that room is then checked in full.
   */
  let audit = { room: null as Room | null, round: -1, all: false, eligible: 0 };
  function scheduleSpotCheck(owner: Room, state: RoomState): void {
    if (audit.room !== owner) audit = { room: owner, round: -1, all: false, eligible: 0 };
    if (state.phase !== 'battle' || audit.round === state.round) return;
    audit.round = state.round;
    const check = startReplaySpotCheck(state.battles, state.round, audit.all, state.battleSeeds);
    if (!check) return;
    // Rounds that captured a battle count; the 1st, 5th, 9th … of them are checked (all of them after a mismatch).
    if (audit.eligible++ % spotCheckEvery !== 0 && !audit.all) return;
    let slices = 0, longestMs = 0;
    const slice = () => {
      // A replaced room or a closing server drops the check; an ended room still finishes its last round's check.
      if (room !== owner || closing) return;
      // Like a resolution slice (Room.advanceSlice): `sliceTicks` at once, or, with `sliceMs`, steps of
      // SLICE_STEP_TICKS until the wall budget runs out, so late-round re-runs and comparisons never hold the writer long.
      const started = clock.now();
      let results: ReturnType<typeof check.advance> = null;
      if (sliceMs === null) results = check.advance(sliceTicks);
      else for (let spent = 0, deadline = started + sliceMs; !results && spent < sliceTicks && clock.now() < deadline; spent += SLICE_STEP_TICKS) results = check.advance(SLICE_STEP_TICKS);
      slices++; longestMs = Math.max(longestMs, clock.now() - started);
      if (!results) { roomClock.schedule(clock.now(), slice); return; }
      log('debug', 'replay.spot-check-slices', { roomId: state.roomId, round: state.round, slices, longestMs: Math.round(longestMs) });
      for (const result of results) {
        if (result.firstDifference === null) { log('debug', 'replay.spot-check', { roomId: state.roomId, round: state.round, battleId: result.battleId }); continue; }
        audit.all = true;
        log('error', 'replay.spot-check-failed', { roomId: state.roomId, round: state.round, roundName: state.roundName, battleId: result.battleId,
          battleSeed: result.battleSeed, seats: result.seatIds.join(','), firstDifference: result.firstDifference });
      }
    };
    roomClock.schedule(clock.now(), slice);
  }

  /**
   * G3: the lobby reports a room that reached `ended` (inside the room's publication, so the work is queued). A normal
   * end keeps its credentials: a player who reconnects still sees the ranking, and the next start revokes them. A
   * fault (rules/resolver error, stall, every player gone) also hands every seat its last view, then revokes the
   * room's credentials at once: the queue is open again, and a reconnect with an old token is told to queue again.
   */
  function onRoomEnd(ended: Room): void {
    const state = ended.state;
    const fault = state.fault;
    log(fault ? 'warn' : 'info', 'room.ended', { roomId: state.roomId, round: state.round, roundName: state.roundName, result: fault ? 'fault' : 'ranking',
      fault: fault?.kind, detail: fault ? toPlayerFault(fault).detail : undefined });
    if (!fault) return;
    queue.push(() => {
      if (room !== ended) return;
      pushAll(ended.state);
      let revoked = 0;
      for (const session of [...sessions]) {
        if (session.roomId !== state.roomId) continue;
        const holder = session.connection as Connection | null;
        if (holder) { holder.session = null; holder.epoch = 0; }
        sessions.revoke(session.seatId); revoked++;
      }
      log('info', 'room.released', { roomId: state.roomId, revokedSessions: revoked });
      broadcastLobby();
    });
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
    const joined = lobby.join(message.name, message.legend);
    if (!joined.ok) return send(conn, fail(message.commandId, joined.reason));
    const { token, session } = sessions.issue(joined.seatId);
    bind(conn, session);
    const receipt = done(message.commandId, { kind: 'joined', seatId: joined.seatId, token, connectionEpoch: session.connectionEpoch });
    session.dedupe.record(message.commandId, digestOf(commandContent(message)), receipt);
    send(conn, receipt);
    log('info', 'seat.joined', { seatId: joined.seatId, connection: conn.id, queue: lobby.queued.length });
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
      log('info', 'queue.start', { roomId: started.room.state.roomId, seatId: session.seatId });
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
    if (inRoom) {
      pushRoom(conn, current.state);
      for (const walk of current.walks) send(conn, { type: 'legend', roomId: current.state.roomId, serverNow: clock.now(), walk });
    } else send(conn, { type: 'lobby', view: lobbyViewFor(conn) });
    log('info', 'seat.resumed', { roomId: session.roomId ?? undefined, seatId: session.seatId, connection: conn.id, epoch: session.connectionEpoch, reclaimed });
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

  /** A walk answers nothing: a refusal is dropped, a walk taken reaches everyone as `legend` (room.walkLegend). */
  function handleWalk(conn: Connection, message: ClientMessage & { type: 'walk' }): void {
    const session = conn.session, current = room;
    if (!session || conn.epoch !== session.connectionEpoch || !current || session.roomId !== current.state.roomId || message.roomId !== current.state.roomId) return;
    const { type: _type, protocolVersion: _version, commandId: _id, roomId: _room, ...request } = message;
    current.walkLegend(session.seatId, request);
  }

  function dispatch(conn: Connection, message: ClientMessage): void {
    switch (message.type) {
      case 'join': return handleJoin(conn, message);
      case 'leaveQueue': return handleLeaveQueue(conn, message);
      case 'start': return handleStart(conn, message);
      case 'resume': return handleResume(conn, message);
      case 'command': return handleCommand(conn, message);
      case 'walk': return handleWalk(conn, message);
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
    conn.lastSeen = clock.now();
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
    conn.sentRoomRevision = -1; conn.sentSeatRevision = -1; conn.sentCombatKey = ''; conn.sentCombat = null;
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
    log('debug', 'connection.closed', { connection: conn.id, seatId: session?.seatId });
  }

  function onConnection(socket: WebSocket): void {
    if (closing) { socket.close(CLOSE_CODES.serverClosing, 'server closing'); return; }
    const conn: Connection = { id: nextConnectionId++, socket, session: null, epoch: 0, open: true, windowStart: clock.now(), windowCount: 0, sentRoomRevision: -1, sentSeatRevision: -1, sentCombatKey: '', sentCombat: null, closeHandle: null, lastSeen: clock.now() };
    connections.set(conn.id, conn);
    socket.on('message', (data, isBinary) => queue.push(() => onMessage(conn, data, isBinary)));
    socket.on('pong', () => { conn.lastSeen = clock.now(); });
    socket.on('close', () => queue.push(() => onClose(conn)));
    socket.on('error', error => log('warn', 'connection.error', { connection: conn.id, error: error.message }));
    queue.push(() => send(conn, { type: 'lobby', view: lobbyViewFor(conn) }));
    log('debug', 'connection.opened', { connection: conn.id });
  }

  /* ---------------- heartbeat ---------------- */

  let heartbeatHandle: ClockHandle | null = null;
  function scheduleHeartbeat(): void {
    if (heartbeat === null || closing) return;
    heartbeatHandle = clock.schedule(clock.now() + heartbeat.intervalMs, () => { heartbeatHandle = null; queue.push(beat); });
  }
  /** A peer gone silent (pulled cable, sleeping laptop) never sends a close; terminating it runs the usual onClose. */
  function beat(): void {
    if (closing) return;
    const now = clock.now();
    for (const conn of connections.values()) {
      if (!conn.open) continue;
      if (now - conn.lastSeen >= heartbeat!.timeoutMs) {
        log('info', 'connection.timeout', { connection: conn.id, seatId: conn.session?.seatId, silentMs: now - conn.lastSeen });
        conn.socket.terminate();
        continue;
      }
      if (conn.socket.readyState !== conn.socket.OPEN) continue;
      try { conn.socket.ping(); } catch { /* closing; the close event follows */ }
      send(conn, { type: 'heartbeat', intervalMs: heartbeat!.intervalMs });
    }
    scheduleHeartbeat();
  }

  /* ---------------- event-loop delay ---------------- */

  // Node's own histogram of how late the event loop ran its timers: a long synchronous block between two slices shows
  // up here even when no single write-queue task was slow (pushes and heartbeats wait behind it all the same).
  const loopLagMs = options.loopLagReportMs ?? null;
  const loopDelay = loopLagMs === null ? null : monitorEventLoopDelay({ resolution: 10 });
  let loopLagHandle: ClockHandle | null = null;
  function scheduleLoopLag(): void {
    if (loopDelay === null || loopLagMs === null || closing) return;
    loopLagHandle = clock.schedule(clock.now() + loopLagMs, () => {
      loopLagHandle = null;
      const maxMs = loopDelay.max / 1e6, p99Ms = loopDelay.percentile(99) / 1e6;
      loopDelay.reset();
      flushSlowTasks(clock.now(), false);
      log(maxMs >= LOOP_LAG_WARN_MS ? 'warn' : 'debug', 'loop.lag', { maxMs: Math.round(maxMs), p99Ms: Math.round(p99Ms), queueDepth: queue.depth,
        roomId: room?.state.roomId, round: room?.state.round, phase: room?.state.phase });
      scheduleLoopLag();
    });
  }

  /* ---------------- health (G3) ---------------- */

  const build: BuildInfo = options.build ?? { sha: 'unknown', contentDigest: 'unknown', lootReplayDigest: 'unknown' };
  function health(): HealthReport {
    const state = room?.state ?? null;
    const humans = state?.seats.filter(seat => seat.kind === 'human') ?? [];
    let seatsOnline = 0;
    for (const conn of connections.values()) if (conn.open && conn.session) seatsOnline++;
    const stats = options.processStats?.() ?? null;
    return {
      status: 'ok', sha: build.sha, contentDigest: build.contentDigest, lootReplayDigest: build.lootReplayDigest,
      netProtocol: NET_PROTOCOL_VERSION, roomProtocol: ROOM_PROTOCOL_VERSION,
      room: state && {
        roomId: state.roomId, phase: state.phase, round: state.round, roundName: state.roundName, fault: state.fault?.kind ?? null,
        humans: humans.length, humansConnected: humans.filter(seat => seat.connected).length, alive: state.seats.filter(seat => seat.alive).length,
      },
      seatsOnline, queue: lobby.queued.length, capacity: ROOM_CAPACITY, connections: connections.size,
      uptimeSec: stats ? stats.uptimeSec : null, rssBytes: stats ? stats.rssBytes : null,
    };
  }
  /** Plain HTTP on the game port: `/healthz` (CORS-open, so the page can show the server build), 426 for anything else. */
  function onHttp(request: IncomingMessage, response: ServerResponse): void {
    const path = (request.url ?? '/').split('?')[0]!;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS' };
    if (path === '/healthz' || path.endsWith('/healthz')) {
      if (request.method === 'OPTIONS') { response.writeHead(204, cors); response.end(); return; }
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { ...cors, allow: 'GET, HEAD, OPTIONS' }); response.end(); return; }
      const body = JSON.stringify(health());
      response.writeHead(200, { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    response.writeHead(426, { 'content-type': 'text/plain; charset=utf-8', upgrade: 'websocket' });
    response.end('Upgrade Required');
  }

  /* ---------------- listen ---------------- */

  return new Promise<GameServer>((resolve, reject) => {
    const http = createServer(onHttp);
    // permessage-deflate (C4): seat views and replay keyframes repeat almost entirely, so they compress well.
    // Context takeover stays on (the default) so consecutive states compress against each other.
    const wss = new WebSocketServer({ server: http, maxPayload: limits.maxMessageBytes, perMessageDeflate: { threshold: 1024 } });
    wss.on('connection', onConnection);
    wss.on('error', error => log('error', 'server.error', { error: error.message }));
    // A failed listen (port taken) resolves nothing the caller could close: release what was built here.
    const failed = (error: Error) => { closing = true; lobby.dispose(); wss.close(); reject(error); };
    http.once('error', failed);
    http.listen(options.port, options.host, () => {
      const address = http.address();
      const port = typeof address === 'object' && address !== null ? address.port : options.port;
      http.off('error', failed);
      scheduleHeartbeat(); // only once listening: a failed listen leaves no timer behind
      loopDelay?.enable(); scheduleLoopLag();
      http.on('error', error => log('error', 'server.error', { error: error.message }));
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
        health,
        close: () => new Promise<void>(resolveClose => {
          closing = true;
          if (heartbeatHandle !== null) { clock.cancel(heartbeatHandle); heartbeatHandle = null; }
          if (loopLagHandle !== null) { clock.cancel(loopLagHandle); loopLagHandle = null; }
          loopDelay?.disable();
          flushSlowTasks(clock.now(), true);
          for (const conn of connections.values()) {
            // onClose skips a connection marked closed, so a pending superseded close is cancelled here.
            if (conn.closeHandle !== null) { clock.cancel(conn.closeHandle); conn.closeHandle = null; }
            conn.open = false; conn.socket.close(CLOSE_CODES.serverClosing, 'server closing');
          }
          unsubscribeRoom?.(); unsubscribeRoom = null;
          lobby.dispose();
          wss.close(() => { http.close(() => resolveClose()); http.closeIdleConnections(); });
        }),
      });
    });
  });
}

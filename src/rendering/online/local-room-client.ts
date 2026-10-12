/**
 * GameClient backed by the real room state machine (src/server/room) running inside this
 * browser tab, on the real clock. This is the default `?mode=online` transport until the
 * network layer (B2/C4) exists: the same Lobby/Room/projection code the server will run,
 * with my seat as the only human and seven idle bot seats (B1 `Lobby.start()`).
 *
 * The client is a thin adapter: commands go to `room.handle()` unchanged and come back
 * unchanged; everything the UI sees is the room's own whitelisted projection. Nothing here
 * decides a rule, a deadline or an outcome. It imports only the room's public surface.
 */
import { createMatch } from '../../simulation/match';
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';
import {
  Lobby, PlaceholderBattleResolver, RealClock, TwoSidedBattleResolver, toCombatFrames, toPlayerView,
  type BattleInput, type BattleResolver, type BattleResult, type Clock, type JoinResult, type PvpMode, type Room, type RoomState, type RoomTimings,
} from '../../server/room';
import type { ClientCommand, ClientListeners, GameClient, LobbyView, PlayerView } from './protocol';

export interface LocalRoomOptions {
  readonly seed: number;
  readonly preparationMs: number;
  readonly choiceMs: number;
  readonly settlementMs: number;
  readonly myName: string;
  /** Debug only (`?faultAt=N`): the resolver throws on round N so the room's fault path can be seen in the UI. */
  readonly faultAtRound: number | null;
  /** `two-sided` (default): real PvP through T2/T3. `placeholder` is the B1 test path (`?pvp=placeholder`). */
  readonly pvpMode: PvpMode;
  /** Injectable for tests; the browser uses the real clock. */
  readonly clock?: Clock;
}
export const LOCAL_ROOM_DEFAULTS: LocalRoomOptions = { seed: 42, preparationMs: 30_000, choiceMs: 30_000, settlementMs: 6_000, myName: '玩家', faultAtRound: null, pvpMode: 'two-sided' };

const JOIN_ERRORS: Record<Exclude<JoinResult, { ok: true }>['reason'], string> = {
  full: '对局已满（8 人），请等待本局结束',
  'in-progress': '对局正在进行，请等待本局结束',
  'already-joined': '已在队列中',
};
const LOBBY_PHASE_VIEW: PlayerView = { mySeatId: '', seats: [], phase: { kind: 'lobby', round: 0, roundName: '', endsAt: null, serverNow: 0 }, opponentSeatId: null, ranking: null, fault: null };

/** Debug wrapper: identical to the inner resolver except that it throws on one chosen round. */
class FaultInjectingResolver implements BattleResolver {
  constructor(private readonly inner: BattleResolver, private readonly round: number) {}
  resolveBattle(input: BattleInput): BattleResult {
    if (input.round === this.round) throw new Error(`调试参数 faultAt=${this.round} 注入的战斗异常`);
    return this.inner.resolveBattle(input);
  }
}

export class LocalRoomClient implements GameClient {
  readonly transport = 'local-room' as const;
  private readonly clock: Clock;
  private readonly ownsClock: RealClock | null;
  private readonly lobby: Lobby;
  private listeners: ClientListeners | null = null;
  private mySeatId: string | null = null;
  private room: Room | null = null;
  private unsubscribeRoom: (() => void) | null = null;
  private error: string | null = null;
  /** Last MatchState handed to the UI (by push or as a command result), to push each state once. */
  private emittedMatch: MatchState | null = null;
  /** Round whose battle frames were already pushed. */
  private emittedBattleRound = 0;
  private flushQueued = false;
  private inCommand = false;
  private disposed = false;

  constructor(private readonly options: LocalRoomOptions = LOCAL_ROOM_DEFAULTS) {
    this.ownsClock = options.clock ? null : new RealClock();
    this.clock = options.clock ?? this.ownsClock!;
    const timings: Partial<RoomTimings> = { preparationMs: options.preparationMs, choiceMs: options.choiceMs, settlementMs: options.settlementMs };
    const placeholder = new PlaceholderBattleResolver();
    const base: BattleResolver = options.pvpMode === 'two-sided' ? new TwoSidedBattleResolver(placeholder) : placeholder;
    const resolver = options.faultAtRound === null ? base : new FaultInjectingResolver(base, options.faultAtRound);
    this.lobby = new Lobby({ clock: this.clock, resolver, seed: options.seed, timings, roomId: 'local-room', pvpMode: options.pvpMode });
  }

  /** Test/debug access to the room the client is driving. */
  get currentRoom(): Room | null { return this.room; }

  listen(listeners: ClientListeners): () => void {
    this.listeners = listeners; this.emitLobby();
    if (this.room) { const match = this.myMatch(); if (match) { this.emittedMatch = match; listeners.state(match); } listeners.view(this.view(this.room.state)); }
    return () => { if (this.listeners === listeners) this.listeners = null; };
  }

  joinQueue(name: string): void {
    if (this.room && this.room.state.phase !== 'ended') return;
    if (this.mySeatId !== null && this.lobby.view(this.mySeatId).joined) return;
    const joined = this.lobby.join(name.trim() || this.options.myName);
    if (!joined.ok) { this.error = JOIN_ERRORS[joined.reason]; this.emitLobby(); return; }
    this.error = null; this.mySeatId = joined.seatId; this.emitLobby();
  }
  leaveQueue(): void {
    if (this.room && this.room.state.phase !== 'ended') return;
    if (this.mySeatId !== null) this.lobby.leave(this.mySeatId);
    this.mySeatId = null; this.error = null; this.emitLobby();
  }
  startMatch(): void {
    if (this.mySeatId === null || !this.lobby.view(this.mySeatId).joined) return;
    const started = this.lobby.start();
    if (!started.ok) { this.error = started.reason === 'in-progress' ? JOIN_ERRORS['in-progress'] : '队列为空'; this.emitLobby(); return; }
    this.error = null;
    this.attach(started.room);
    this.emitLobby();
    this.flush();
  }
  reset(): void {
    this.detach();
    this.mySeatId = null; this.error = null; this.emittedMatch = null; this.emittedBattleRound = 0;
    this.emitLobby(); this.listeners?.view({ ...LOBBY_PHASE_VIEW, phase: { ...LOBBY_PHASE_VIEW.phase, serverNow: this.clock.now() } });
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.detach(); this.lobby.dispose(); this.ownsClock?.dispose(); this.listeners = null;
  }

  /** Forwarded to the room unchanged; a refusal comes back unchanged and changes nothing. */
  send(command: ClientCommand): MatchCommandResult {
    const room = this.room, seatId = this.mySeatId;
    if (!room || seatId === null) return { ok: false, state: this.emittedMatch ?? createMatch(this.options.seed), reason: 'wrong-phase' };
    this.inCommand = true;
    try {
      const result = room.handle(seatId, command);
      if (!result.ok) {
        // Room-level refusals (seat/phase) are not MatchFailures; the UI shows them as a phase refusal.
        const reason = result.reason === 'unknown-seat' || result.reason === 'seat-eliminated' || result.reason === 'room-phase' ? 'wrong-phase' : result.reason;
        return { ok: false, state: result.state ?? this.emittedMatch ?? createMatch(this.options.seed), reason };
      }
      this.emittedMatch = result.state;
      return { ok: true, state: result.state, events: result.events };
    } finally { this.inCommand = false; }
  }

  /* ---------------- room → listeners ---------------- */

  private attach(room: Room): void {
    this.detach();
    this.room = room; this.emittedMatch = null; this.emittedBattleRound = 0;
    this.unsubscribeRoom = room.subscribe(() => this.queueFlush());
  }
  private detach(): void {
    this.unsubscribeRoom?.(); this.unsubscribeRoom = null;
    // The lobby owns and disposes the room when the next one starts; an ended room keeps its ranking visible until then.
    this.room = null;
  }
  private myMatch(): MatchState | null {
    const seat = this.room?.state.seats.find(candidate => candidate.seatId === this.mySeatId);
    return seat ? seat.match : null;
  }
  /** The room notifies on every internal replace; one phase transition can be several. Coalesce per microtask. */
  private queueFlush(): void {
    if (this.flushQueued || this.disposed) return;
    this.flushQueued = true;
    queueMicrotask(() => { this.flushQueued = false; if (!this.disposed) this.flush(); });
  }
  private flush(): void {
    const room = this.room, listeners = this.listeners;
    if (!room || !listeners || this.mySeatId === null) return;
    const state = room.state;
    const match = this.myMatch();
    if (match && match !== this.emittedMatch && !this.inCommand) { this.emittedMatch = match; listeners.state(match); }
    if ((state.phase === 'battle' || state.phase === 'frozen') && state.battles.length > 0 && state.round !== this.emittedBattleRound) {
      // Frames are combat view data; the settled MatchState follows as a state push once the room commits.
      const frames = toCombatFrames(state, this.mySeatId);
      this.emittedBattleRound = state.round;
      if (frames.length > 0) listeners.combat(frames);
    }
    listeners.view(this.view(state));
  }
  private view(state: RoomState): PlayerView { return toPlayerView(state, this.mySeatId!, this.clock.now()); }
  private emitLobby(): void {
    const base = this.lobby.view(this.mySeatId);
    const view: LobbyView = { ...base, error: this.error };
    this.listeners?.lobby(view);
  }
}

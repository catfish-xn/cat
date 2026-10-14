/**
 * Bot scheduler (pipeline B, work order B6, contract §13.3). Drives every bot-controlled seat of one Room:
 * fill-in bots (`controller: 'bot'`) for the whole match and, only when `takeover` is on, human seats a bot took
 * over after their player stayed disconnected for `takeoverMs` (`controller: 'takeover'`, revoked by the room the
 * moment the player resumes). By default (P2, TFT behaviour) a disconnected seat does nothing: no bot plays it,
 * its board still fights with whatever it had.
 *
 * The driver decides nothing about the game. Each step reads the seat's committed MatchState, asks the T7
 * policy `decideBotAction` for exactly one intention and hands it to `Room.handleBot`, which runs the same
 * gate and the same rules dispatch as a player command (shared-pool transactions for buy/sell/reroll/shopLock/
 * choose, plain public commands for the rest). Deadlines, timeouts, battles, settlement and round advance stay
 * with the room; `done` only ends the seat's attempts.
 *
 * Steps are spread over the phase on the injected clock (`stepMs` apart, the first one staggered by seat) and
 * every step runs as one task of the caller's single-writer queue (`enqueue`).
 */
import { BOT_MAX_STEPS, decideBotAction, type BotContext } from '../../server-entry';
import { nextRandom } from '../../simulation/rng';
import type { Clock, ClockHandle } from './clock';
import type { Room } from './room';
import { ROOM_CAPACITY, type ClientCommand, type RoomFailure, type RoomState, type SeatController, type SeatState } from './types';

export interface BotDriverOptions {
  /** Delay between two steps of one seat (ms of the room clock). */
  readonly stepMs: number;
  /**
   * Whether a bot takes over a human seat whose player stays disconnected (B6). Off by default (P2): like TFT, a
   * disconnected seat does nothing and its board still fights. The B6 takeover path only runs when this is true.
   */
  readonly takeover: boolean;
  /** How long a human seat stays disconnected before a bot takes it over (only when `takeover` is on). */
  readonly takeoverMs: number;
  /** Per-seat, per-round attempt budget handed to the policy; capped by BOT_MAX_STEPS. */
  readonly maxSteps: number;
  /** Single-writer queue of the caller (the network server's WriteQueue); runs the task at once by default. */
  readonly enqueue?: (task: () => void) => void;
  /** Observation hook (tests, logs): one record per executed intention or `done`. */
  readonly onStep?: (record: BotStepRecord) => void;
}
export const BOT_DRIVER_DEFAULTS: BotDriverOptions = { stepMs: 300, takeover: false, takeoverMs: 60_000, maxSteps: BOT_MAX_STEPS };

export interface BotStepRecord {
  readonly seatId: string;
  readonly round: number;
  /** Room phase the step was decided and issued in (always preparation or choice). */
  readonly phase: RoomState['phase'];
  readonly controller: SeatController;
  readonly controlEpoch: number;
  /** Attempts of this seat in this round after the step (a `done` does not count). */
  readonly stepsTaken: number;
  readonly action: ClientCommand | 'done';
  /** Null for `done`. */
  readonly ok: boolean | null;
  readonly reason: string | null;
}

type Failure = NonNullable<BotContext['lastFailure']>;

/** What the driver keeps per seat; nothing here is game state. */
interface SeatBrain {
  /** Explicit lcg32-v1 policy stream (§13.1), independent of every Match and room stream; kept across takeovers. */
  rng: number;
  roundKey: string;
  stepsTaken: number;
  lastFailure: Failure | null;
  /** A failure or an exhausted budget ends the seat's attempts until the next round. */
  closed: boolean;
  /** Phase entry in which the policy answered `done`; a later entry of the same round (a post-battle choice) asks again. */
  doneEntry: number;
  /** Pending step: a clock handle, or 'queued' once it fired and waits in the caller's queue. */
  step: ClockHandle | 'queued' | null;
  /** Control generation the pending step was scheduled under. */
  stepEpoch: number;
  /** Phase entry the step counter below belongs to. */
  stepEntry: number;
  /** Steps taken in that phase entry; the first one is staggered by seat. */
  entrySteps: number;
  takeover: ClockHandle | 'queued' | null;
}

/** Room phases in which a seat may act, and the seat phases the policy is asked about in each (§13.3 item 2). */
function operable(room: RoomState, seat: SeatState): boolean {
  if (!seat.alive) return false;
  if (room.phase === 'preparation') return seat.match.phase === 'preparation' || seat.match.phase === 'choice';
  if (room.phase === 'choice') return seat.match.phase === 'choice';
  return false;
}
const botControlled = (seat: SeatState): boolean => seat.controller === 'bot' || seat.controller === 'takeover';
const running = (room: RoomState): boolean => room.phase !== 'waiting' && room.phase !== 'ended';

/** Per-seat policy seed derived from the room seed and the fixed seat index; draws nothing from the room's own stream. */
export function deriveBotRng(roomSeed: number, seatIndex: number): number {
  return nextRandom((roomSeed ^ Math.imul(seatIndex + 1, 0x9e3779b9) ^ 0x6b6f7462) >>> 0).word;
}

export class BotDriver {
  private readonly options: BotDriverOptions;
  private readonly brains = new Map<string, SeatBrain>();
  private readonly unsubscribe: () => void;
  private readonly enqueue: (task: () => void) => void;
  private lastPhase: RoomState['phase'] | null = null;
  /** Counts entries into an operable room phase (choice before preparation, preparation, a post-battle choice). */
  private entry = 0;
  private disposed = false;

  constructor(private readonly room: Room, private readonly roomSeed: number, options: Partial<BotDriverOptions> = {}) {
    this.options = { ...BOT_DRIVER_DEFAULTS, ...options };
    if (!Number.isSafeInteger(this.options.stepMs) || this.options.stepMs < 1) throw new RangeError('stepMs must be a positive integer');
    if (!Number.isSafeInteger(this.options.takeoverMs) || this.options.takeoverMs < 0) throw new RangeError('takeoverMs must be a non-negative integer');
    if (!Number.isSafeInteger(this.options.maxSteps) || this.options.maxSteps < 0) throw new RangeError('maxSteps must be a non-negative integer');
    this.enqueue = this.options.enqueue ?? (task => task());
    // Listeners fire inside room transactions: they only (re)arm clock timers, never call the room back.
    this.unsubscribe = room.subscribe(state => this.sync(state));
    this.sync(room.state);
  }

  private get clock(): Clock { return this.room.clock; }

  /** Stops every pending step and takeover; the room keeps running on its own deadlines. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    for (const brain of this.brains.values()) { this.cancelStep(brain); this.cancelTakeover(brain); }
  }

  /** Test/debug view of one seat's driver bookkeeping. */
  inspect(seatId: string): { readonly rng: number; readonly stepsTaken: number; readonly lastFailure: Failure | null; readonly closed: boolean; readonly pending: boolean; readonly takeoverPending: boolean } | null {
    const brain = this.brains.get(seatId);
    return brain ? { rng: brain.rng, stepsTaken: brain.stepsTaken, lastFailure: brain.lastFailure, closed: brain.closed, pending: brain.step !== null, takeoverPending: brain.takeover !== null } : null;
  }

  private brainFor(seat: SeatState): SeatBrain {
    let brain = this.brains.get(seat.seatId);
    if (!brain) {
      brain = { rng: deriveBotRng(this.roomSeed, seat.index), roundKey: '', stepsTaken: 0, lastFailure: null, closed: false, doneEntry: -1, step: null, stepEpoch: -1, stepEntry: -1, entrySteps: 0, takeover: null };
      this.brains.set(seat.seatId, brain);
    }
    return brain;
  }

  /** Brings timers in line with the published room state. Idempotent; safe to call on every publication. */
  private sync(state: RoomState): void {
    if (this.disposed) return;
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      if (state.phase === 'preparation' || state.phase === 'choice') this.entry++;
    }
    const roundKey = `${state.round}:${state.roundId}`;
    for (const seat of state.seats) {
      const brain = this.brainFor(seat);
      // The per-round budget and the failure feedback survive phase changes, takeovers and resumes; only a new round clears them (§13.3 item 4).
      if (brain.roundKey !== roundKey) { brain.roundKey = roundKey; brain.stepsTaken = 0; brain.lastFailure = null; brain.closed = false; brain.doneEntry = -1; }
      this.syncTakeover(state, seat, brain);
      const wanted = running(state) && botControlled(seat) && operable(state, seat) && !brain.closed && brain.doneEntry !== this.entry;
      if (!wanted) { this.cancelStep(brain); continue; }
      if (brain.step !== null && brain.stepEpoch === seat.controlEpoch) continue;
      this.cancelStep(brain);
      if (brain.stepEntry !== this.entry) { brain.stepEntry = this.entry; brain.entrySteps = 0; }
      this.scheduleStep(seat, brain);
    }
  }

  private syncTakeover(state: RoomState, seat: SeatState, brain: SeatBrain): void {
    const due = this.options.takeover && running(state) && seat.kind === 'human' && seat.alive && !seat.connected && seat.controller === 'human';
    if (!due) { this.cancelTakeover(brain); return; }
    if (brain.takeover !== null) return;
    const seatId = seat.seatId;
    brain.takeover = this.clock.schedule(this.clock.now() + this.options.takeoverMs, () => {
      brain.takeover = 'queued';
      this.enqueue(() => {
        if (brain.takeover !== 'queued') return;
        brain.takeover = null;
        if (this.disposed) return;
        // The room re-checks disconnected / alive / human-controlled / running; a resume in between makes this a no-op.
        this.room.takeOver(seatId);
      });
    });
  }

  private scheduleStep(seat: SeatState, brain: SeatBrain): void {
    // Spread the first step of a phase entry over one step interval by seat index, then one step per interval.
    const stagger = brain.entrySteps === 0 ? Math.floor(seat.index * this.options.stepMs / ROOM_CAPACITY) : 0;
    const epoch = seat.controlEpoch, entry = this.entry, seatId = seat.seatId;
    brain.stepEpoch = epoch;
    brain.step = this.clock.schedule(this.clock.now() + this.options.stepMs + stagger, () => {
      brain.step = 'queued';
      this.enqueue(() => {
        if (brain.step !== 'queued') return;
        brain.step = null;
        if (this.disposed) return;
        this.step(seatId, epoch, entry);
        this.sync(this.room.state);
      });
    });
  }

  /** One policy call and at most one rules command, inside one queue task (§13.3 items 2–4). */
  private step(seatId: string, epoch: number, entry: number): void {
    const state = this.room.state;
    const seat = state.seats.find(candidate => candidate.seatId === seatId);
    if (!seat) return;
    const brain = this.brainFor(seat);
    // Re-check under the queue: still this seat's operable phase, still the control generation the step was armed under.
    if (entry !== this.entry || seat.controlEpoch !== epoch || !running(state) || !botControlled(seat) || !operable(state, seat) || brain.closed) return;
    const context: BotContext = {
      difficulty: 'basic', stepsTaken: brain.stepsTaken, maxSteps: this.options.maxSteps,
      self: { seatId: seat.seatId, hp: seat.hp, round: seat.match.round },
      ...(brain.lastFailure ? { lastFailure: brain.lastFailure } : {}),
    };
    const decision = decideBotAction(seat.match, context, brain.rng);
    brain.rng = decision.rng;
    if (decision.action === 'done') {
      brain.doneEntry = this.entry;
      // A failure or the spent budget closes the round; a plain `done` only ends this phase entry.
      if (brain.lastFailure || brain.stepsTaken >= Math.min(this.options.maxSteps, BOT_MAX_STEPS)) brain.closed = true;
      this.record(state, seat, brain, 'done', null, null);
      return;
    }
    const action = decision.action;
    brain.stepsTaken++; brain.entrySteps++;
    const result = this.room.handleBot(seatId, epoch, action);
    if (result.ok) { this.record(state, seat, brain, action, true, null); return; }
    const reason = result.reason;
    // Control loss is not a rules answer for the policy: the seat is someone else's now and the step simply ends.
    if (!isControlRefusal(reason)) brain.lastFailure = { action, reason };
    this.record(state, seat, brain, action, false, reason);
  }

  /** `state`/`seat` are the snapshot the step was decided on, not the room after the command. */
  private record(state: RoomState, seat: SeatState, brain: SeatBrain, action: ClientCommand | 'done', ok: boolean | null, reason: string | null): void {
    this.options.onStep?.({ seatId: seat.seatId, round: seat.match.round, phase: state.phase, controller: seat.controller, controlEpoch: seat.controlEpoch, stepsTaken: brain.stepsTaken, action, ok, reason });
  }

  private cancelStep(brain: SeatBrain): void {
    if (typeof brain.step === 'number') this.clock.cancel(brain.step);
    brain.step = null;
  }
  private cancelTakeover(brain: SeatBrain): void {
    if (typeof brain.takeover === 'number') this.clock.cancel(brain.takeover);
    brain.takeover = null;
  }
}

function isControlRefusal(reason: string): reason is Extract<RoomFailure, 'control-revoked' | 'seat-controlled'> {
  return reason === 'control-revoked' || reason === 'seat-controlled';
}

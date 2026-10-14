/**
 * The single match queue (user decision 2–3): no rooms, no invite codes, no host. Any
 * queued player may start; a queue timeout may start too; the ninth join is refused and
 * empty seats are filled with bots. Every room the lobby opens gets one BotDriver (B6): it plays
 * the fill-in bots and takes over human seats whose player stays disconnected.
 */
import type { BattleResolver } from './battle-resolver';
import { BotDriver, type BotDriverOptions } from './bot-driver';
import type { Clock, ClockHandle } from './clock';
import { Room, ROOM_TIMING_DEFAULTS, type RoomTimings } from './room';
import { ROOM_CAPACITY, type LobbyView, type PvpMode, type SeatSpec } from './types';

export interface LobbyOptions {
  readonly clock: Clock;
  readonly resolver: BattleResolver;
  readonly seed: number;
  readonly roomId?: string;
  readonly timings?: Partial<RoomTimings>;
  /** Starts the match this long after the first join; null waits for an explicit start. */
  readonly queueTimeoutMs?: number | null;
  readonly botNames?: readonly string[];
  /** Forwarded to every Room this lobby opens; see PvpMode (default `placeholder`). */
  readonly pvpMode?: PvpMode;
  /** Test/debug fixtures only: forwarded to every Room as `poolCapacities` (§12.2); production omits it. */
  readonly poolCapacities?: Readonly<Record<string, number>>;
  /** Forwarded to every Room as `sliceTicks` (B8). */
  readonly sliceTicks?: number;
  /**
   * Bot scheduling of every opened room (B6); defaults to BOT_DRIVER_DEFAULTS. `null` leaves bot seats idle and never
   * takes a seat over (room-mechanics tests only).
   */
  readonly bots?: Partial<BotDriverOptions> | null;
  /** Called once per opened room, after its first round began (explicit start or queue timeout). */
  readonly onStart?: (room: Room) => void;
}
export type JoinResult = { readonly ok: true; readonly seatId: string } | { readonly ok: false; readonly reason: 'full' | 'in-progress' | 'already-joined' };
export type StartResult = { readonly ok: true; readonly room: Room } | { readonly ok: false; readonly reason: 'empty' | 'in-progress' };

const DEFAULT_BOT_NAMES = ['机器人 1', '机器人 2', '机器人 3', '机器人 4', '机器人 5', '机器人 6', '机器人 7'];

export class Lobby {
  private queue: SeatSpec[] = [];
  private current: Room | null = null;
  private driver: BotDriver | null = null;
  private timer: ClockHandle | null = null;
  private serial = 0;
  constructor(private readonly options: LobbyOptions) {}

  get room(): Room | null { return this.current; }
  get bots(): BotDriver | null { return this.driver; }
  get queued(): readonly SeatSpec[] { return this.queue; }
  private get inProgress(): boolean { return this.current !== null && this.current.state.phase !== 'ended'; }

  join(name: string): JoinResult {
    if (this.inProgress) return { ok: false, reason: 'in-progress' };
    if (this.queue.length >= ROOM_CAPACITY) return { ok: false, reason: 'full' };
    const seatId = `seat-${++this.serial}`;
    this.queue.push({ seatId, name: name.trim() || seatId, kind: 'human' });
    const timeout = this.options.queueTimeoutMs ?? null;
    if (timeout !== null && this.timer === null) this.timer = this.options.clock.schedule(this.options.clock.now() + timeout, () => { this.timer = null; this.start(); });
    return { ok: true, seatId };
  }
  leave(seatId: string): void {
    if (this.inProgress) return;
    this.queue = this.queue.filter(entry => entry.seatId !== seatId);
    if (this.queue.length === 0) this.clearTimer();
  }
  /** Fills the remaining seats with bots and opens the room; the queue empties. */
  start(): StartResult {
    if (this.inProgress) return { ok: false, reason: 'in-progress' };
    if (this.queue.length === 0) return { ok: false, reason: 'empty' };
    this.clearTimer();
    const names = this.options.botNames ?? DEFAULT_BOT_NAMES;
    const bots: SeatSpec[] = Array.from({ length: ROOM_CAPACITY - this.queue.length }, (_, index) => ({ seatId: `bot-${index + 1}`, name: names[index] ?? `机器人 ${index + 1}`, kind: 'bot' }));
    const seats = [...this.queue, ...bots];
    this.queue = [];
    this.disposeRoom();
    this.current = new Room(seats, { ...ROOM_TIMING_DEFAULTS, ...this.options.timings, roomId: this.options.roomId ?? 'room-1', seed: this.options.seed, clock: this.options.clock, resolver: this.options.resolver, ...(this.options.pvpMode ? { pvpMode: this.options.pvpMode } : {}),
      ...(this.options.poolCapacities ? { poolCapacities: this.options.poolCapacities } : {}), ...(this.options.sliceTicks ? { sliceTicks: this.options.sliceTicks } : {}) });
    // The driver subscribes before the first round opens so it sees the first phase entry.
    if (this.options.bots !== null) this.driver = new BotDriver(this.current, this.options.seed, this.options.bots ?? {});
    this.current.start();
    this.options.onStart?.(this.current);
    return { ok: true, room: this.current };
  }
  view(seatId: string | null): LobbyView {
    const joined = seatId !== null && this.queue.some(entry => entry.seatId === seatId);
    return { queue: this.queue.map(entry => ({ name: entry.name, kind: entry.kind, me: entry.seatId === seatId })), capacity: ROOM_CAPACITY, joined, canStart: joined && !this.inProgress, error: null };
  }
  dispose(): void { this.clearTimer(); this.disposeRoom(); }
  private disposeRoom(): void { this.driver?.dispose(); this.driver = null; this.current?.dispose(); }
  private clearTimer(): void { if (this.timer !== null) { this.options.clock.cancel(this.timer); this.timer = null; } }
}

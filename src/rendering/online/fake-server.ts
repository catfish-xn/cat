/**
 * In-memory stand-in for the T4/T5 server so the online UI can be built and tested
 * before the real one exists. It drives MY seat with the real rules engine (same public
 * commands MatchSession uses) and fakes the other seven seats' public numbers with a
 * seeded sequence. It is a mock: it decides nothing a real server would not, and it is
 * deleted when src/server/ lands. Every "mock fallback" is marked below.
 */
import { COMBAT_TICK_MS } from '../../simulation/combat';
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import {
  buyUnit, buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly, rerollShop,
  selectAnomalyTarget, selectChoice, sellUnit, setShopLock, startMatchCombat, stepMatch,
} from '../../simulation/match';
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';
import { readRoundInfo } from '../../simulation/round-selectors';
import { nextRandom } from '../../simulation/rng';
import {
  ROOM_CAPACITY, type ClientCommand, type ClientListeners, type CombatFrame, type GameClient, type LobbyView,
  type PlayerView, type QueueEntry, type RoomPhase, type SeatPublic,
} from './protocol';

export interface FakeServerOptions {
  readonly seed: number;
  /** Preparation countdown; TFT uses ~30 s, tests shorten it. */
  readonly preparationMs: number;
  readonly choiceMs: number;
  readonly settlementMs: number;
  readonly myName: string;
  /** Starting HP of the fake seats; lower it in tests to reach the ranking quickly. */
  readonly botHp: number;
}
export const FAKE_DEFAULTS: FakeServerOptions = { seed: 42, preparationMs: 30_000, choiceMs: 30_000, settlementMs: 6_000, myName: '玩家', botHp: 100 };

interface Seat { seatId: string; name: string; kind: SeatPublic['kind']; hp: number; level: number; alive: boolean; rank: number | null; connected: boolean }
const BOT_NAMES = ['机器人·赵', '机器人·钱', '机器人·孙', '机器人·李', '机器人·周', '机器人·吴', '机器人·郑'];

export class FakeServer implements GameClient {
  readonly transport = 'fake' as const;
  private listeners: ClientListeners | null = null;
  private queue: QueueEntry[] = [];
  private error: string | null = null;
  private seats: Seat[] = [];
  private match: MatchState | null = null;
  private phase: RoomPhase = { kind: 'lobby', round: 0, roundName: '', endsAt: null, serverNow: 0 };
  private opponent: string | null = null;
  private ranking: SeatPublic[] | null = null;
  private timer: number | null = null;
  private botRng = 0;
  private disposed = false;
  constructor(private readonly options: FakeServerOptions = FAKE_DEFAULTS) { this.botRng = options.seed >>> 0; }

  private now() { return performance.now(); }
  listen(listeners: ClientListeners): () => void {
    this.listeners = listeners; this.emitLobby();
    if (this.match) { listeners.state(this.match); this.emitView(); }
    return () => { if (this.listeners === listeners) this.listeners = null; };
  }
  get myQueueEntry() { return this.queue.find(entry => entry.me) ?? null; }

  joinQueue(name: string): void {
    if (this.match || this.myQueueEntry) return;
    if (this.queue.length >= ROOM_CAPACITY) { this.error = `对局已满（${ROOM_CAPACITY} 人），请等待本局结束`; this.emitLobby(); return; }
    this.error = null; this.queue.push({ name: name.trim() || this.options.myName, kind: 'human', me: true }); this.emitLobby();
  }
  /** Debug only: pretend another friend clicked 匹配, to see the list fill and the 9th-player error. */
  addFakeFriend(): void {
    if (this.match) return;
    if (this.queue.length >= ROOM_CAPACITY) { this.error = `对局已满（${ROOM_CAPACITY} 人），第 ${ROOM_CAPACITY + 1} 位玩家被拒绝`; this.emitLobby(); return; }
    this.error = null; this.queue.push({ name: `好友 ${this.queue.filter(entry => !entry.me).length + 1}`, kind: 'human', me: false }); this.emitLobby();
  }
  leaveQueue(): void { if (this.match) return; this.queue = this.queue.filter(entry => !entry.me); this.error = null; this.emitLobby(); }
  startMatch(): void {
    if (this.match || !this.myQueueEntry) return;
    const humans = this.queue.map((entry, index): Seat => ({ seatId: entry.me ? 'me' : `human-${index}`, name: entry.name, kind: 'human', hp: 100, level: 1, alive: true, rank: null, connected: true }));
    const bots = BOT_NAMES.slice(0, ROOM_CAPACITY - humans.length).map((name, index): Seat => ({ seatId: `bot-${index}`, name, kind: 'bot', hp: this.options.botHp, level: 1, alive: true, rank: null, connected: true }));
    this.seats = [...humans, ...bots];
    this.match = createMatch(this.options.seed);
    this.ranking = null;
    this.emitLobby(); this.listeners?.state(this.match); this.enterPhase();
  }
  reset(): void { this.clearTimer(); this.match = null; this.seats = []; this.queue = []; this.error = null; this.ranking = null; this.opponent = null;
    this.phase = { kind: 'lobby', round: 0, roundName: '', endsAt: null, serverNow: this.now() }; this.emitLobby(); this.emitView(); }
  dispose(): void { this.disposed = true; this.clearTimer(); this.listeners = null; }

  send(command: ClientCommand): MatchCommandResult {
    const state = this.match;
    if (!state || this.phase.kind === 'combat' || this.phase.kind === 'ended') return { ok: false, state: state ?? createMatch(this.options.seed), reason: 'wrong-phase' };
    const result = this.apply(state, command);
    if (!result.ok) return result;
    this.match = result.state; this.listeners?.state(result.state);
    if (this.roomKindFor(result.state) !== this.phase.kind) this.enterPhase();
    return result;
  }
  private apply(state: MatchState, command: ClientCommand): MatchCommandResult {
    switch (command.type) {
      case 'deploy': return deployMatchUnit(state, command.unitId, command.target);
      case 'buy': return buyUnit(state, command.slot, command.generation);
      case 'sell': return sellUnit(state, command.unitId);
      case 'shopLock': return setShopLock(state, command.locked, command.generation);
      case 'reroll': return rerollShop(state);
      case 'buyXp': return buyXp(state);
      case 'combine': return combineItems(state, command.a, command.b);
      case 'equip': return equipItem(state, command.itemId, command.unitId, command.slot);
      case 'choose': return selectChoice(state, command.choiceId, command.generation, command.definitionId);
      case 'anomalyTarget': return selectAnomalyTarget(state, command.choiceId, command.generation, command.unitId);
      case 'anomalyReroll': return rerollAnomaly(state, command.choiceId, command.generation);
    }
  }

  private roomKindFor(state: MatchState): RoomPhase['kind'] {
    return state.phase === 'gameOver' ? 'ended' : state.phase;
  }
  /** Enter the room phase matching the engine phase and arm its deadline. */
  private enterPhase(extendMs = 0) {
    const state = this.match!; const round = readRoundInfo(state);
    const kind = this.roomKindFor(state);
    const duration = kind === 'preparation' ? this.options.preparationMs : kind === 'choice' ? this.options.choiceMs : kind === 'settlement' ? this.options.settlementMs : null;
    if (kind === 'preparation') this.opponent = round.kind === 'pvp' ? this.pickOpponent() : null;
    this.setPhase({ kind, round: state.round, roundName: round.displayName, endsAt: duration === null ? null : this.now() + duration + extendMs, serverNow: this.now() });
    if (kind === 'ended') this.finish();
  }
  private setPhase(phase: RoomPhase) {
    this.phase = phase; this.clearTimer();
    if (phase.endsAt !== null) this.timer = window.setTimeout(() => this.deadline(), Math.max(0, phase.endsAt - this.now()));
    this.emitView();
  }
  private deadline() {
    this.timer = null; if (this.disposed || !this.match) return;
    const state = this.match;
    if (this.phase.kind === 'preparation') return this.runCombat(state);
    if (this.phase.kind === 'settlement') {
      const next = nextRound(state, state.round);
      // Mock fallback: a settlement the player must still act on (unclaimed loot) just waits a little longer.
      if (!next.ok) return this.enterPhase(5_000);
      this.match = next.state; this.listeners?.state(next.state); return this.enterPhase();
    }
    if (this.phase.kind === 'choice') {
      // Mock fallback: the real server defines the timeout choice (docs/UI_REQUESTS.md); here the first offer wins.
      const pending = state.pendingChoice;
      const picked = pending === null ? null : pending.step === 'offer' ? selectChoice(state, pending.choiceId, pending.generation, pending.offers[0]!)
        : selectAnomalyTarget(state, pending.choiceId, pending.generation, state.preparation.units[0]?.id ?? '');
      if (!picked || !picked.ok) return this.enterPhase(5_000);
      this.match = picked.state; this.listeners?.state(picked.state); return this.enterPhase();
    }
    if (this.phase.kind === 'combat') return this.afterCombat();
  }
  private runCombat(state: MatchState) {
    const start = startMatchCombat(state);
    // Mock fallback: an un-startable lineup is given more time instead of a server-side default.
    if (!start.ok) return this.enterPhase(5_000);
    const frames: CombatFrame[] = [{ state: start.state, events: combatEvents(start.events) }];
    let current = start.state;
    while (current.phase === 'combat') { const step = stepMatch(current); current = step.state; frames.push({ state: current, events: combatEvents(step.events) }); }
    this.match = current;
    if (start.state.phase !== 'combat') { this.listeners?.state(current); return this.afterCombat(); }
    this.listeners?.combat(frames);
    const round = readRoundInfo(state);
    this.setPhase({ kind: 'combat', round: state.round, roundName: round.displayName, endsAt: this.now() + frames.length * COMBAT_TICK_MS + 800, serverNow: this.now() });
  }
  private afterCombat() {
    const state = this.match!; const round = readRoundInfo(state);
    // Fake public numbers for the other seats: a seeded sequence, nothing a rule decides.
    for (const seat of this.seats) {
      if (seat.seatId === 'me' || !seat.alive) continue;
      const draw = nextRandom(this.botRng); this.botRng = draw.state;
      const high = draw.word >>> 16; // low LCG bits cycle; use the high half
      const loss = round.kind === 'supply' ? 0 : round.kind === 'pvp' ? high % 15 : high % 4;
      seat.hp = Math.max(0, seat.hp - loss); seat.level = Math.min(9, 1 + Math.floor(state.round / 3));
    }
    const me = this.seats.find(seat => seat.seatId === 'me')!; me.hp = Math.max(0, state.playerHp); me.level = state.level;
    this.assignEliminations();
    this.listeners?.state(state);
    if (!me.alive || this.seats.filter(seat => seat.alive).length <= 1) return this.finish();
    this.enterPhase();
  }
  private assignEliminations() {
    const dying = this.seats.filter(seat => seat.alive && seat.hp <= 0).sort((a, b) => a.hp - b.hp);
    let alive = this.seats.filter(seat => seat.alive).length;
    for (const seat of dying) { seat.alive = false; seat.rank = alive; alive--; }
  }
  private finish() {
    this.clearTimer();
    const alive = this.seats.filter(seat => seat.alive).sort((a, b) => b.hp - a.hp);
    alive.forEach((seat, index) => { seat.rank = index + 1; });
    this.ranking = [...this.seats].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map(publicSeat);
    this.phase = { ...this.phase, kind: 'ended', endsAt: null, serverNow: this.now() };
    this.emitView();
  }
  private pickOpponent(): string | null {
    const others = this.seats.filter(seat => seat.alive && seat.seatId !== 'me');
    if (!others.length) return null;
    const draw = nextRandom(this.botRng); this.botRng = draw.state;
    return others[(draw.word >>> 16) % others.length]!.seatId;
  }
  private clearTimer() { if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; } }
  private emitLobby() {
    const view: LobbyView = { queue: [...this.queue], capacity: ROOM_CAPACITY, joined: this.myQueueEntry !== null, canStart: this.myQueueEntry !== null && !this.match, error: this.error };
    this.listeners?.lobby(view);
  }
  private emitView() {
    const view: PlayerView = { mySeatId: 'me', seats: this.seats.map(publicSeat), phase: { ...this.phase, serverNow: this.now() }, opponentSeatId: this.opponent, ranking: this.ranking };
    this.listeners?.view(view);
  }
}
function publicSeat(seat: Seat): SeatPublic { return { seatId: seat.seatId, name: seat.name, kind: seat.kind, hp: seat.hp, level: seat.level, alive: seat.alive, rank: seat.rank, connected: seat.connected }; }
function combatEvents(events: readonly { readonly type: string }[]): LedgerCombatEvent[] { return events.filter((event): event is LedgerCombatEvent => 'tick' in event); }

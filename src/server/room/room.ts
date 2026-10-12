/**
 * Eight-seat room state machine (pipeline B, work order B1). Pure TypeScript: no network,
 * no real clock, no ambient randomness. The room owns seat order, phases, deadlines, pairings,
 * the one-shot round settlement and the ranking; every rule (gold, shop, combat, damage)
 * comes from src/simulation/match.ts through its public commands or from the injected
 * BattleResolver.
 */
import {
  buyUnit, buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly, rerollShop,
  selectAnomalyTarget, selectChoice, sellUnit, setShopLock,
} from '../../simulation/match';
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';
import { nextRandom, validateSeed } from '../../simulation/rng';
import { readRoundInfo } from '../../simulation/round-selectors';
import type { BattleResolver } from './battle-resolver';
import { firstOfferFallback, resolvePendingChoices, type ChoiceFallback } from './choice-fallback';
import type { Clock, ClockHandle } from './clock';
import { findPairing, planPairings } from './pairing';
import {
  ROOM_CAPACITY, ROOM_PROTOCOL_VERSION, type BattleInput, type BattleResult, type RankEntry, type RoomCommandResult, type RoomFault,
  type RoomPhase, type RoomState, type RoundSettlement, type SeatCommand, type SeatSpec, type SeatState, type SettledSeat,
} from './types';

export interface RoomTimings {
  readonly preparationMs: number;
  readonly choiceMs: number;
  readonly settlementMs: number;
  /** Playback allowance added after the longest battle's frames. */
  readonly battleTailMs: number;
  /** Settlement deadlines re-armed for a seat the rules refuse to advance before the room faults. */
  readonly maxSettlementExtensions: number;
}
export interface RoomOptions extends RoomTimings {
  readonly roomId: string;
  readonly seed: number;
  readonly clock: Clock;
  readonly resolver: BattleResolver;
  readonly choiceFallback?: ChoiceFallback;
}
export const ROOM_TIMING_DEFAULTS: RoomTimings = { preparationMs: 30_000, choiceMs: 30_000, settlementMs: 6_000, battleTailMs: 800, maxSettlementExtensions: 3 };

export type CommitFailure = 'duplicate-settlement' | 'stale-round' | 'wrong-phase' | 'invalid-settlement';
export type CommitResult = { readonly ok: true; readonly state: RoomState } | { readonly ok: false; readonly reason: CommitFailure; readonly state: RoomState };
export type PlanResult = { readonly ok: true; readonly settlement: RoundSettlement } | { readonly ok: false; readonly detail: string };

const CHOICE_COMMANDS: ReadonlySet<SeatCommand['type']> = new Set(['choose', 'anomalyTarget', 'anomalyReroll']);

/** Pure dispatch to the public rules commands; the room adds nothing. */
export function applySeatCommand(state: MatchState, command: SeatCommand): MatchCommandResult {
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

export class Room {
  private current: RoomState;
  private timer: ClockHandle | null = null;
  private pendingSettlement: RoundSettlement | null = null;
  private extensions = 0;
  private readonly listeners = new Set<(state: RoomState) => void>();
  private readonly fallback: ChoiceFallback;

  constructor(seats: readonly SeatSpec[], private readonly options: RoomOptions) {
    if (seats.length !== ROOM_CAPACITY) throw new RangeError(`a room has exactly ${ROOM_CAPACITY} seats`);
    if (new Set(seats.map(seat => seat.seatId)).size !== seats.length) throw new RangeError('duplicate seat id');
    validateSeed(options.seed);
    this.fallback = options.choiceFallback ?? firstOfferFallback;
    let rngState = options.seed >>> 0;
    const seatStates = seats.map((spec, index): SeatState => {
      const draw = nextRandom(rngState); rngState = draw.state;
      const match = createMatch(draw.word);
      return { seatId: spec.seatId, index, name: spec.name, kind: spec.kind, connected: spec.kind === 'human', hp: match.playerHp,
        alive: true, rank: null, eliminatedRound: null, seatRevision: 0, match, seed: draw.word };
    });
    this.current = { roomId: options.roomId, protocolVersion: ROOM_PROTOCOL_VERSION, phase: 'waiting', round: 0, roundId: '', roundName: '', roundKind: null,
      deadlineAt: null, seats: seatStates, pairings: [], battles: [], settlements: [], ranking: null, fault: null, roomRevision: 0, rngState, poolRevision: 0 };
  }

  get state(): RoomState { return this.current; }
  get clock(): Clock { return this.options.clock; }
  subscribe(listener: (state: RoomState) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose(): void { this.clearTimer(); this.listeners.clear(); }

  /** waiting → first round. */
  start(): void {
    if (this.current.phase !== 'waiting') return;
    this.enterRound();
  }

  /** Phase and seat gate only; the rules decide everything else and a refusal changes nothing. */
  handle(seatId: string, command: SeatCommand): RoomCommandResult {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat) return { ok: false, reason: 'unknown-seat', state: null };
    if (!seat.alive) return { ok: false, reason: 'seat-eliminated', state: seat.match };
    const phase = this.current.phase;
    const allowed = phase === 'preparation' || (phase === 'choice' && CHOICE_COMMANDS.has(command.type));
    if (!allowed) return { ok: false, reason: 'wrong-phase', state: seat.match };
    const result = applySeatCommand(seat.match, command);
    if (!result.ok) return result;
    const seatRevision = seat.seatRevision + 1;
    this.replaceSeats(this.current.seats.map(candidate => candidate.seatId === seatId ? { ...candidate, match: result.state, seatRevision } : candidate));
    if (phase === 'choice' && !this.aliveSeats().some(candidate => candidate.match.phase === 'choice')) { this.clearTimer(); this.afterChoiceWindow(); }
    return { ok: true, state: result.state, events: result.events, seatRevision, roomRevision: this.current.roomRevision };
  }

  /* ---------------- settlement ---------------- */

  /** Builds this round's settlement from a full set of results without touching the room. */
  planSettlement(results: readonly BattleResult[]): PlanResult {
    const state = this.current;
    const alive = this.aliveSeats();
    const outcomes = new Map<string, { readonly damage: number; readonly match: MatchState }>();
    for (const result of results) {
      if (result.round !== state.round) return { ok: false, detail: `result ${result.battleId} is for round ${result.round}, room is at ${state.round}` };
      for (const outcome of result.outcomes) {
        if (outcomes.has(outcome.seatId)) return { ok: false, detail: `seat ${outcome.seatId} reported twice` };
        if (!Number.isInteger(outcome.damage) || outcome.damage < 0) return { ok: false, detail: `seat ${outcome.seatId} damage ${outcome.damage} is not a non-negative integer` };
        if (outcome.state.round !== state.round) return { ok: false, detail: `seat ${outcome.seatId} state is at round ${outcome.state.round}` };
        outcomes.set(outcome.seatId, { damage: outcome.damage, match: outcome.state });
      }
    }
    for (const seat of alive) if (!outcomes.has(seat.seatId)) return { ok: false, detail: `seat ${seat.seatId} has no result` };
    for (const seatId of outcomes.keys()) if (!alive.some(seat => seat.seatId === seatId)) return { ok: false, detail: `seat ${seatId} is not alive` };
    const seats: SettledSeat[] = alive.map(seat => {
      const outcome = outcomes.get(seat.seatId)!;
      const hpAfterRaw = seat.hp - outcome.damage;
      return { seatId: seat.seatId, hpBefore: seat.hp, damage: outcome.damage, hpAfterRaw, hpAfter: Math.max(0, hpAfterRaw), match: outcome.match };
    });
    const byId = new Map(state.seats.map(seat => [seat.seatId, seat] as const));
    const index = (settled: SettledSeat) => byId.get(settled.seatId)!.index;
    // 建议规则（V2 D7），待 T3/T4 合同定稿：同轮淘汰按扣血后未截断 HP → 轮前 HP → 席位序号（小者在前）破同分；
    // 名次由本轮全部结果批量决定，与结果到达顺序无关。
    const dying = seats.filter(seat => seat.hpAfter === 0)
      .sort((a, b) => a.hpAfterRaw - b.hpAfterRaw || a.hpBefore - b.hpBefore || index(b) - index(a));
    const survivors = seats.filter(seat => seat.hpAfter > 0)
      .sort((a, b) => b.hpAfter - a.hpAfter || b.hpBefore - a.hpBefore || index(a) - index(b));
    let rank = alive.length;
    const eliminated: RankEntry[] = dying.map(seat => ({ seatId: seat.seatId, rank: rank-- }));
    // 加时（V2 D3）尚未实现：目录末轮结算后按存活者 HP 定名次，待 T3/T4 合同定稿后替换。
    const catalogEnds = seats.some(seat => readRoundInfo(seat.match).isFinal);
    const ends = survivors.length <= 1 || catalogEnds;
    const finalRanking = ends ? [
      ...survivors.map((seat, position) => ({ seatId: seat.seatId, rank: position + 1 })),
      ...eliminated,
      ...state.seats.filter(seat => !seat.alive).map(seat => ({ seatId: seat.seatId, rank: seat.rank! })),
    ].sort((a, b) => a.rank - b.rank) : null;
    return { ok: true, settlement: { settlementId: `${state.roomId}:round-${state.round}`, round: state.round, roundId: state.roundId, results, seats, eliminated, finalRanking } };
  }

  /** Applies HP loss, eliminations and ranking once; a repeated settlementId changes nothing. */
  commitSettlement(settlement: RoundSettlement): CommitResult {
    const state = this.current;
    if (state.settlements.includes(settlement.settlementId)) return { ok: false, reason: 'duplicate-settlement', state };
    if (state.phase !== 'frozen' && state.phase !== 'battle') return { ok: false, reason: 'wrong-phase', state };
    if (settlement.round !== state.round || settlement.settlementId !== `${state.roomId}:round-${state.round}`) return { ok: false, reason: 'stale-round', state };
    const alive = this.aliveSeats();
    if (settlement.seats.length !== alive.length || alive.some(seat => !settlement.seats.some(settled => settled.seatId === seat.seatId))) return { ok: false, reason: 'invalid-settlement', state };
    const settled = new Map(settlement.seats.map(seat => [seat.seatId, seat] as const));
    const ranks = new Map<string, number>(settlement.eliminated.map(entry => [entry.seatId, entry.rank]));
    for (const entry of settlement.finalRanking ?? []) ranks.set(entry.seatId, entry.rank);
    const seats = state.seats.map((seat): SeatState => {
      const outcome = settled.get(seat.seatId);
      if (!outcome) return seat;
      const rank = ranks.get(seat.seatId) ?? null;
      const stillAlive = outcome.hpAfter > 0;
      return { ...seat, hp: outcome.hpAfter, alive: stillAlive, rank, eliminatedRound: stillAlive ? null : settlement.round, match: outcome.match, seatRevision: seat.seatRevision + 1 };
    });
    this.replace({ ...state, seats, settlements: [...state.settlements, settlement.settlementId], ranking: settlement.finalRanking });
    return { ok: true, state: this.current };
  }

  /* ---------------- phase machine ---------------- */

  private aliveSeats(): readonly SeatState[] { return this.current.seats.filter(seat => seat.alive); }

  private enterRound(): void {
    const alive = this.aliveSeats();
    const info = readRoundInfo(alive[0]!.match);
    const state = this.current;
    const pvp = info.kind === 'pvp';
    const plan = pvp ? planPairings(alive.map(seat => seat.seatId), state.rngState, `${state.roomId}:r${info.ordinal}`) : { pairings: [], rngState: state.rngState };
    this.extensions = 0; this.pendingSettlement = null;
    this.replace({ ...state, round: info.ordinal, roundId: info.roundId, roundName: info.displayName, roundKind: info.kind, pairings: plan.pairings, rngState: plan.rngState, battles: [] });
    if (alive.some(seat => seat.match.phase === 'choice')) this.setPhase('choice', this.options.choiceMs);
    else this.afterChoiceWindow();
  }

  /** Every alive seat has left the choice phase: decide what the round needs next. */
  private afterChoiceWindow(): void {
    const alive = this.aliveSeats();
    const committed = this.current.settlements.includes(`${this.current.roomId}:round-${this.current.round}`);
    if (committed) return this.setPhase('settlement', this.options.settlementMs);
    if (alive.every(seat => seat.match.phase === 'preparation')) return this.setPhase('preparation', this.options.preparationMs);
    // A supply round settles inside the choice itself; the rules left nothing to fight.
    if (alive.every(seat => seat.match.phase === 'settlement' || seat.match.phase === 'gameOver')) return this.freezeAndResolve();
    this.fail({ kind: 'phase-mismatch', detail: alive.map(seat => `${seat.seatId}:${seat.match.phase}`).join(',') });
  }

  private applyFallbacks(): boolean {
    for (const seat of this.aliveSeats()) {
      if (seat.match.phase !== 'choice') continue;
      const outcome = resolvePendingChoices(seat.match, this.fallback);
      this.replaceSeats(this.current.seats.map(candidate => candidate.seatId === seat.seatId ? { ...candidate, match: outcome.state, seatRevision: candidate.seatRevision + 1 } : candidate));
      if (!outcome.ok) { this.fail({ kind: 'seat-stuck', seatId: seat.seatId, reason: outcome.reason }); return false; }
    }
    return true;
  }

  /** Preparation deadline: freeze every seat, resolve every battle, keep the settlement for the battle deadline. */
  private freezeAndResolve(): void {
    this.setPhase('frozen', null);
    if (!this.applyFallbacks()) return;
    const inputs = this.buildInputs();
    const results: BattleResult[] = [];
    for (const input of inputs) {
      try { results.push(this.options.resolver.resolveBattle(input)); }
      catch (error) { return this.fail({ kind: 'resolver-error', battleId: input.battleId, message: error instanceof Error ? error.message : String(error) }); }
    }
    const plan = this.planSettlement(results);
    if (!plan.ok) return this.fail({ kind: 'invalid-results', detail: plan.detail });
    this.pendingSettlement = plan.settlement;
    this.replace({ ...this.current, battles: results });
    const longest = Math.max(0, ...results.flatMap(result => result.outcomes.map(outcome => outcome.frames.length)));
    if (longest === 0) return this.commitPending();
    const tickMs = this.aliveSeats()[0]!.match.tickMs;
    this.setPhase('battle', longest * tickMs + this.options.battleTailMs);
  }

  private buildInputs(): readonly BattleInput[] {
    const state = this.current;
    const alive = this.aliveSeats();
    const seatInput = (seat: SeatState) => ({ seatId: seat.seatId, state: seat.match });
    const base = { roomId: state.roomId, round: state.round, roundId: state.roundId, roundKind: state.roundKind ?? 'pve', roomRevision: state.roomRevision };
    if (state.roundKind !== 'pvp' || state.pairings.length === 0) {
      return alive.map(seat => ({ ...base, battleId: `${state.roomId}:r${state.round}:${seat.seatId}`, seats: [seatInput(seat)], mirrorOf: null }));
    }
    const inputs: BattleInput[] = [];
    const seen = new Set<string>();
    for (const seat of alive) {
      if (seen.has(seat.seatId)) continue;
      const pairing = findPairing(state.pairings, seat.seatId);
      if (!pairing) throw new Error(`seat ${seat.seatId} has no pairing`);
      seen.add(seat.seatId);
      if (pairing.opponent.kind === 'mirror') {
        const source = alive.find(candidate => candidate.seatId === (pairing.opponent as { sourceSeatId: string }).sourceSeatId)!;
        inputs.push({ ...base, battleId: pairing.battleId, seats: [seatInput(seat)], mirrorOf: seatInput(source) });
      } else {
        const other = alive.find(candidate => candidate.seatId === (pairing.opponent as { seatId: string }).seatId)!;
        seen.add(other.seatId);
        inputs.push({ ...base, battleId: pairing.battleId, seats: [seatInput(seat), seatInput(other)], mirrorOf: null });
      }
    }
    return inputs;
  }

  private commitPending(): void {
    const settlement = this.pendingSettlement;
    this.pendingSettlement = null;
    if (settlement) {
      const commit = this.commitSettlement(settlement);
      if (!commit.ok && commit.reason !== 'duplicate-settlement') return this.fail({ kind: 'invalid-results', detail: commit.reason });
    }
    if (this.current.ranking) return this.setPhase('ended', null);
    if (this.aliveSeats().some(seat => seat.match.phase === 'choice')) return this.setPhase('choice', this.options.choiceMs);
    this.setPhase('settlement', this.options.settlementMs);
  }

  /** Settlement deadline: advance every alive seat with the public nextRound command. */
  private advanceRound(): void {
    if (!this.applyFallbacks()) return;
    const advanced: SeatState[] = [];
    for (const seat of this.current.seats) {
      if (!seat.alive) { advanced.push(seat); continue; }
      const next = nextRound(seat.match, seat.match.round);
      if (!next.ok) {
        if (this.extensions < this.options.maxSettlementExtensions) { this.extensions++; return this.setPhase('settlement', this.options.settlementMs); }
        return this.fail({ kind: 'seat-stuck', seatId: seat.seatId, reason: next.reason });
      }
      advanced.push({ ...seat, match: next.state, seatRevision: seat.seatRevision + 1 });
    }
    this.replaceSeats(advanced);
    this.enterRound();
  }

  private onDeadline(): void {
    this.timer = null;
    switch (this.current.phase) {
      case 'preparation': return this.freezeAndResolve();
      case 'choice': if (this.applyFallbacks()) this.afterChoiceWindow(); return;
      case 'battle': return this.commitPending();
      case 'settlement': return this.advanceRound();
      default: return;
    }
  }

  private fail(fault: RoomFault): void {
    this.pendingSettlement = null;
    this.replace({ ...this.current, fault });
    this.setPhase('ended', null);
  }

  private setPhase(phase: RoomPhase, durationMs: number | null): void {
    this.clearTimer();
    const deadlineAt = durationMs === null ? null : this.options.clock.now() + durationMs;
    this.replace({ ...this.current, phase, deadlineAt });
    if (deadlineAt !== null) this.timer = this.options.clock.schedule(deadlineAt, () => this.onDeadline());
  }
  private clearTimer(): void { if (this.timer !== null) { this.options.clock.cancel(this.timer); this.timer = null; } }
  private replaceSeats(seats: readonly SeatState[]): void { this.replace({ ...this.current, seats }); }
  private replace(next: RoomState): void {
    this.current = { ...next, roomRevision: this.current.roomRevision + 1 };
    for (const listener of this.listeners) listener(this.current);
  }
}

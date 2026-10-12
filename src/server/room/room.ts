/**
 * Eight-seat room state machine (pipeline B, work orders B1–B4, B7). Pure TypeScript: no network,
 * no real clock, no ambient randomness. The room owns seat order, phases, deadlines, pairings,
 * the one-shot round publication and the ranking; every rule (gold, shop, combat, damage,
 * income, growth) comes from src/simulation through its public commands, the injected
 * BattleResolver and the T3 receipt entry `applyRoundSettlement` (contract §11.3).
 */
import {
  buyUnit, buyXp, combineItems, createMatch, deployMatchUnit, equipItem, rerollAnomaly, rerollShop,
  selectAnomalyTarget, selectChoice, sellUnit, setShopLock,
} from '../../simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import { nextRandom, validateSeed } from '../../simulation/rng';
import { readRoundInfo } from '../../simulation/round-selectors';
import {
  advanceMultiplayerRound, applyRoundSettlement, claimOrDiscardLoot, enableMultiplayerSettlement, forfeitPendingChoice, needsAnomalyRecruitment, ROUND_SETTLEMENT_VERSION,
  type RoundSettlementReceipt, type SideProposal,
} from '../../server-entry';
import { BattleResolveError, type BattleResolver } from './battle-resolver';
import type { Clock, ClockHandle } from './clock';
import { findPairing, planPairings } from './pairing';
import {
  DEFAULT_BATTLE_MAX_STEPS, ROOM_CAPACITY, ROOM_PROTOCOL_VERSION, type BattleInput, type BattleResult, type PvpMode, type RankEntry,
  type RoomCommandResult, type RoomFault, type RoomPhase, type RoomState, type RoundSettlement, type SeatCommand, type SeatSpec, type SeatState, type SettledSeat,
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
  /** How PvP results are accepted; `two-sided` by default (B4). See PvpMode. */
  readonly pvpMode?: PvpMode;
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

/* ---------------- timeouts (§11.4) ---------------- */

/** Which deadline passed; decides which rules timeout commands apply. */
export type TimeoutStage = 'choice' | 'preparation' | 'settlement';
export type TimeoutOutcome =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: string };
const MAX_TIMEOUT_STEPS = 8;

/**
 * Resolves one seat's pending decisions with the rules' timeout commands, in the contract's order:
 * current choice (first offer) → earned loot claimed or discarded → later choices → (nextRound by the
 * caller). Each step is a public command; a refusal is reported, never forced or worked around.
 */
export function resolveSeatTimeouts(match: MatchState, stage: TimeoutStage): TimeoutOutcome {
  let current = match;
  const events: MatchEvent[] = [];
  let lootClaimed = false;
  for (let step = 0; step < MAX_TIMEOUT_STEPS; step++) {
    if (current.phase === 'choice' && current.pendingChoice) {
      const pending = current.pendingChoice;
      const result = forfeitPendingChoice(current, current.round, pending.choiceId, pending.generation);
      if (!result.ok) return { ok: false, state: current, reason: `forfeit:${result.reason}` };
      current = result.state; events.push(...result.events); continue;
    }
    if (stage === 'settlement' && current.phase === 'settlement' && !lootClaimed) {
      lootClaimed = true;
      const result = claimOrDiscardLoot(current, current.round);
      if (!result.ok) return { ok: false, state: current, reason: `loot:${result.reason}` };
      current = result.state; events.push(...result.events); continue;
    }
    if (stage === 'preparation' && current.phase === 'preparation' && needsAnomalyRecruitment(current)) {
      // An anomaly node with no own unit has no legal first target: the rules skip it and the seat fights empty.
      const result = forfeitPendingChoice(current, current.round, null, null);
      if (!result.ok) return { ok: false, state: current, reason: `forfeit:${result.reason}` };
      current = result.state; events.push(...result.events); continue;
    }
    return { ok: true, state: current, events };
  }
  return current.phase === 'choice' ? { ok: false, state: current, reason: 'timeout-steps-exhausted' } : { ok: true, state: current, events };
}

export class Room {
  private current: RoomState;
  private timer: ClockHandle | null = null;
  private pendingSettlement: RoundSettlement | null = null;
  /** Envelopes frozen at the preparation deadline of the current round; results are checked against them (§11.3 item 2). */
  private frozenInputs: readonly BattleInput[] = [];
  private extensions = 0;
  private readonly listeners = new Set<(state: RoomState) => void>();
  private readonly pvpMode: PvpMode;

  constructor(seats: readonly SeatSpec[], private readonly options: RoomOptions) {
    if (seats.length !== ROOM_CAPACITY) throw new RangeError(`a room has exactly ${ROOM_CAPACITY} seats`);
    if (new Set(seats.map(seat => seat.seatId)).size !== seats.length) throw new RangeError('duplicate seat id');
    validateSeed(options.seed);
    this.pvpMode = options.pvpMode ?? 'two-sided';
    let rngState = options.seed >>> 0;
    const seatStates = seats.map((spec, index): SeatState => {
      const draw = nextRandom(rngState); rngState = draw.state;
      // Server mode from the first state on (§11.1): PvP never settles through the single-player path.
      const enabled = enableMultiplayerSettlement(createMatch(draw.word), spec.seatId);
      if (!enabled.ok) throw new RangeError(`seat ${spec.seatId}: ${enabled.reason}`);
      const match = enabled.state;
      return { seatId: spec.seatId, index, name: spec.name, kind: spec.kind, connected: spec.kind === 'human', hp: match.playerHp,
        alive: true, rank: null, eliminatedRound: null, seatRevision: 0, match, seed: draw.word };
    });
    this.current = { roomId: options.roomId, protocolVersion: ROOM_PROTOCOL_VERSION, phase: 'waiting', round: 0, roundId: '', roundName: '', roundKind: null,
      deadlineAt: null, seats: seatStates, pairings: [], battleSeeds: {}, battles: [], settlements: [], ranking: null, fault: null, roomRevision: 0, rngState, poolRevision: 0 };
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

  /**
   * Connection bookkeeping for the network layer (B2): a dropped or resumed socket changes only the
   * public `connected` flag. Assets, pairings and ranks stay (V2 D8); seatRevision does not move
   * because no command or settlement touched the seat.
   */
  setConnected(seatId: string, connected: boolean): boolean {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat || seat.kind !== 'human') return false;
    if (seat.connected === connected) return true;
    this.replaceSeats(this.current.seats.map(candidate => candidate.seatId === seatId ? { ...candidate, connected } : candidate));
    return true;
  }

  /* ---------------- settlement (§11.3) ---------------- */

  /**
   * Builds this round's settlement from a full set of results without touching the room: every result is
   * checked against the frozen envelope, every real seat is staged exactly once (two-sided seats through
   * `applyRoundSettlement` on a private copy of the seat map, PvE/supply seats from the rules' own
   * settled state), and any failure discards the whole stage. Pure: calling it again with the same
   * results and the same room state is the retry the contract asks for, with the same seeds.
   */
  planSettlement(results: readonly BattleResult[]): PlanResult {
    const state = this.current;
    const alive = this.aliveSeats();
    const byId = new Map(state.seats.map(seat => [seat.seatId, seat] as const));
    const envelopes = new Map(this.frozenInputs.map(input => [input.battleId, input] as const));
    const staged = new Map<string, SettledSeat>();
    const stage = (settled: SettledSeat): string | null => {
      if (staged.has(settled.seatId)) return `seat ${settled.seatId} reported twice`;
      if (!alive.some(seat => seat.seatId === settled.seatId)) return `seat ${settled.seatId} is not alive`;
      if (settled.match.round !== state.round) return `seat ${settled.seatId} state is at round ${settled.match.round}`;
      staged.set(settled.seatId, settled); return null;
    };
    for (const result of results) {
      if (result.round !== state.round) return { ok: false, detail: `result ${result.battleId} is for round ${result.round}, room is at ${state.round}` };
      const envelope = envelopes.get(result.battleId);
      if (!envelope) return { ok: false, detail: `battle ${result.battleId} was not frozen this round` };
      if (result.roomRevision !== envelope.roomRevision) return { ok: false, detail: `battle ${result.battleId} is from revision ${result.roomRevision}, frozen at ${envelope.roomRevision}` };
      const frozenSeats = envelope.seats.map(seat => seat.seatId);
      if (result.kind === 'two-sided') {
        if (this.pvpMode !== 'two-sided' || envelope.roundKind !== 'pvp') return { ok: false, detail: `battle ${result.battleId} is two-sided but the room runs pvpMode=${this.pvpMode} on a ${envelope.roundKind} round` };
        if (result.participants.length !== frozenSeats.length || result.participants.some(seatId => !frozenSeats.includes(seatId))) return { ok: false, detail: `battle ${result.battleId} participants differ from the frozen envelope` };
        if (result.battle.battleId !== result.battleId || result.battle.roundId !== state.roundId || result.battle.battleSeed !== envelope.battleSeed) return { ok: false, detail: `battle ${result.battleId} rules result does not match the frozen envelope` };
        for (const seatId of result.participants) {
          const seat = byId.get(seatId);
          if (!seat) return { ok: false, detail: `unknown seat ${seatId}` };
          const proposal = [result.proposals.a, result.proposals.b].find(candidate => candidate.seatId === seatId);
          if (!proposal) return { ok: false, detail: `battle ${result.battleId} has no proposal for seat ${seatId}` };
          if (!proposal.settlementEligible) return { ok: false, detail: `seat ${seatId} proposal is not eligible` };
          const receipt = buildReceipt(state.roomId, envelope, proposal, result.battle.terminal.tick, result.battle.events.length);
          const applied = applyRoundSettlement(seat.match, receipt);
          if (!applied.ok) return { ok: false, detail: `seat ${seatId}: ${applied.reason}` };
          if (applied.state.playerHp !== Math.max(0, seat.hp - proposal.damage)) return { ok: false, detail: `seat ${seatId}: rules HP ${applied.state.playerHp} disagrees with the room HP ${seat.hp} - ${proposal.damage}` };
          const problem = stage({ seatId, hpBefore: seat.hp, damage: proposal.damage, hpAfterRaw: seat.hp - proposal.damage, hpAfter: applied.state.playerHp, match: applied.state, receipt, events: applied.events });
          if (problem) return { ok: false, detail: problem };
        }
      } else {
        if (envelope.roundKind === 'pvp' && this.pvpMode !== 'placeholder') return { ok: false, detail: `battle ${result.battleId} is a placeholder result on a PvP round in pvpMode=${this.pvpMode}` };
        if (result.outcomes.length !== frozenSeats.length || result.outcomes.some(outcome => !frozenSeats.includes(outcome.seatId))) return { ok: false, detail: `battle ${result.battleId} outcomes differ from the frozen envelope` };
        for (const outcome of result.outcomes) {
          const seat = byId.get(outcome.seatId);
          if (!seat) return { ok: false, detail: `unknown seat ${outcome.seatId}` };
          if (!Number.isInteger(outcome.damage) || outcome.damage < 0) return { ok: false, detail: `seat ${outcome.seatId} damage ${outcome.damage} is not a non-negative integer` };
          // The rules settled this seat themselves (PvE/supply): their HP is authoritative and must agree with the room's. A
          // placeholder outcome that left the state unsettled (test resolvers) is subtracted by the room as in B1.
          const settledByRules = outcome.state.roundResults.at(-1)?.round === state.round;
          const expected = Math.max(0, seat.hp - outcome.damage);
          if (settledByRules && outcome.state.playerHp !== expected) return { ok: false, detail: `seat ${outcome.seatId}: rules HP ${outcome.state.playerHp} disagrees with the room HP ${seat.hp} - ${outcome.damage}` };
          const problem = stage({ seatId: outcome.seatId, hpBefore: seat.hp, damage: outcome.damage, hpAfterRaw: seat.hp - outcome.damage, hpAfter: expected, match: outcome.state, receipt: null, events: [] });
          if (problem) return { ok: false, detail: problem };
        }
      }
    }
    for (const seat of alive) if (!staged.has(seat.seatId)) return { ok: false, detail: `seat ${seat.seatId} has no result` };
    const seats = alive.map(seat => staged.get(seat.seatId)!);
    const index = (settled: SettledSeat) => byId.get(settled.seatId)!.index;
    // §11.5 ranking key: untruncated HP after damage (desc) → HP before the round (desc) → fixed seat index (asc);
    // the whole round ranks at once, independent of result arrival order.
    const dying = seats.filter(seat => seat.hpAfter === 0)
      .sort((a, b) => a.hpAfterRaw - b.hpAfterRaw || a.hpBefore - b.hpBefore || index(b) - index(a));
    const survivors = seats.filter(seat => seat.hpAfter > 0)
      .sort((a, b) => b.hpAfter - a.hpAfter || b.hpBefore - a.hpBefore || index(a) - index(b));
    let rank = alive.length;
    const eliminated: RankEntry[] = dying.map(seat => ({ seatId: seat.seatId, rank: rank-- }));
    // The match ends only when at most one seat survives; survivors of the catalog's final round go to overtime (§11.5),
    // which `advanceMultiplayerRound` generates as `overtime-N` until at most one seat is left.
    const ends = survivors.length <= 1;
    const finalRanking = ends ? [
      ...survivors.map((seat, position) => ({ seatId: seat.seatId, rank: position + 1 })),
      ...eliminated,
      ...state.seats.filter(seat => !seat.alive).map(seat => ({ seatId: seat.seatId, rank: seat.rank! })),
    ].sort((a, b) => a.rank - b.rank) : null;
    return { ok: true, settlement: { settlementId: `${state.roomId}:round-${state.round}`, round: state.round, roundId: state.roundId, results, seats, eliminated, finalRanking } };
  }

  /** Publishes the staged round once: HP from the staged states, eliminations and ranking; a repeated settlementId changes nothing. */
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
    // One explicit combat seed per battle, frozen with the pairings: a resolver retry reuses it (§10.6 item 1).
    const battleIds = plan.pairings.length > 0 ? [...new Set(plan.pairings.map(pairing => pairing.battleId))] : alive.map(seat => `${state.roomId}:r${info.ordinal}:${seat.seatId}`);
    let rngState = plan.rngState;
    const battleSeeds: Record<string, number> = {};
    for (const battleId of battleIds) { const draw = nextRandom(rngState); rngState = draw.state; battleSeeds[battleId] = draw.word >>> 0; }
    this.extensions = 0; this.pendingSettlement = null; this.frozenInputs = [];
    this.replace({ ...state, round: info.ordinal, roundId: info.roundId, roundName: info.displayName, roundKind: info.kind, pairings: plan.pairings, rngState, battleSeeds, battles: [] });
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
    if (alive.every(seat => seat.match.phase === 'settlement')) return this.freezeAndResolve();
    this.fail({ kind: 'phase-mismatch', detail: alive.map(seat => `${seat.seatId}:${seat.match.phase}`).join(',') });
  }

  /** Runs the rules' timeout commands for every alive seat (§11.4); a refusal is a seat-stuck fault. */
  private applyTimeouts(stage: TimeoutStage): boolean {
    for (const seat of this.aliveSeats()) {
      const outcome = resolveSeatTimeouts(seat.match, stage);
      if (outcome.state !== seat.match) this.replaceSeats(this.current.seats.map(candidate => candidate.seatId === seat.seatId ? { ...candidate, match: outcome.state, seatRevision: candidate.seatRevision + 1 } : candidate));
      if (!outcome.ok) { this.fail({ kind: 'seat-stuck', seatId: seat.seatId, reason: outcome.reason }); return false; }
    }
    return true;
  }

  /** Preparation deadline: timeouts, then freeze every seat, resolve every battle and stage the settlement for the battle deadline. */
  private freezeAndResolve(): void {
    this.setPhase('frozen', null);
    if (!this.applyTimeouts('preparation')) return;
    this.frozenInputs = this.buildInputs();
    const results: BattleResult[] = [];
    for (const input of this.frozenInputs) {
      try { results.push(this.options.resolver.resolveBattle(input)); }
      catch (error) {
        // Any rules refusal or resolver error drops the whole round: no partial proposal or outcome is adopted.
        const message = error instanceof Error ? error.message : String(error);
        return this.fail(error instanceof BattleResolveError ? { kind: 'resolver-error', battleId: input.battleId, message, reason: error.reason } : { kind: 'resolver-error', battleId: input.battleId, message });
      }
    }
    const plan = this.planSettlement(results);
    if (!plan.ok) return this.fail({ kind: 'invalid-results', detail: plan.detail });
    this.pendingSettlement = plan.settlement;
    this.replace({ ...this.current, battles: results });
    const longest = Math.max(0, ...results.flatMap(result => result.kind === 'placeholder' ? result.outcomes.map(outcome => outcome.frames.length) : [result.frames.length]));
    if (longest === 0) return this.commitPending();
    const tickMs = this.aliveSeats()[0]!.match.tickMs;
    this.setPhase('battle', longest * tickMs + this.options.battleTailMs);
  }

  private buildInputs(): readonly BattleInput[] {
    const state = this.current;
    const alive = this.aliveSeats();
    const seatInput = (seat: SeatState) => ({ seatId: seat.seatId, state: seat.match });
    const seed = (battleId: string): number => {
      const value = state.battleSeeds[battleId];
      if (value === undefined) throw new Error(`battle ${battleId} has no frozen seed`);
      return value;
    };
    const base = { roomId: state.roomId, round: state.round, roundId: state.roundId, roundKind: state.roundKind ?? 'pve', roomRevision: state.roomRevision, maxSteps: DEFAULT_BATTLE_MAX_STEPS };
    if (state.roundKind !== 'pvp' || state.pairings.length === 0) {
      return alive.map(seat => { const battleId = `${state.roomId}:r${state.round}:${seat.seatId}`; return { ...base, battleId, battleSeed: seed(battleId), seats: [seatInput(seat)], mirrorOf: null }; });
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
        inputs.push({ ...base, battleId: pairing.battleId, battleSeed: seed(pairing.battleId), seats: [seatInput(seat)], mirrorOf: seatInput(source) });
      } else {
        const other = alive.find(candidate => candidate.seatId === (pairing.opponent as { seatId: string }).seatId)!;
        seen.add(other.seatId);
        inputs.push({ ...base, battleId: pairing.battleId, battleSeed: seed(pairing.battleId), seats: [seatInput(seat), seatInput(other)], mirrorOf: null });
      }
    }
    return inputs;
  }

  /** Battle deadline: publish the staged round, then decide what follows (§11.3 item 5). */
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

  /**
   * Settlement deadline: loot timeouts, then advance every alive seat with the rules' multiplayer entry (§11.5):
   * catalog rounds as nextRound, and after the catalog's final round `overtime-N` PvP rounds while two or more survive.
   */
  private advanceRound(): void {
    if (!this.applyTimeouts('settlement')) return;
    const advanced: SeatState[] = [];
    for (const seat of this.current.seats) {
      if (!seat.alive) { advanced.push(seat); continue; }
      const next = advanceMultiplayerRound(seat.match, seat.match.round);
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
      case 'choice': if (this.applyTimeouts('choice')) this.afterChoiceWindow(); return;
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

/** §11.3 receipt: a trusted hand-over built from the frozen envelope and the rules' own proposal, never from a client. */
function buildReceipt(roomId: string, envelope: BattleInput, proposal: SideProposal, combatTicks: number, combatEventCount: number): RoundSettlementReceipt {
  return {
    version: ROUND_SETTLEMENT_VERSION,
    settlementId: JSON.stringify([roomId, envelope.round, proposal.seatId]),
    battleId: envelope.battleId, seatId: proposal.seatId,
    round: envelope.round, roundId: envelope.roundId,
    settlementEligible: proposal.settlementEligible, result: proposal.result,
    damage: proposal.damage, baseDamage: proposal.baseDamage, opposingSurvivors: proposal.opposingSurvivors,
    growth: proposal.growth, combatTicks, combatEventCount,
  };
}

/**
 * Eight-seat room state machine (pipeline B, work orders B1–B7). Pure TypeScript: no network,
 * no real clock, no ambient randomness. The room owns seat order, phases, deadlines, pairings,
 * the one-shot round publication and the ranking; every rule (gold, shop, combat, damage,
 * income, growth, the shared card pool) comes from src/simulation through its public commands,
 * the TP shared-pool transactions (contract §12), the injected BattleResolver and the T3
 * receipt entry `applyRoundSettlement` (contract §11.3).
 */
import {
  buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly, selectAnomalyTarget,
} from '../../simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import { nextRandom, validateSeed } from '../../simulation/rng';
import { readRoundInfo } from '../../simulation/round-selectors';
import {
  applyRoundSettlement, assertSharedPoolConservation, buySharedUnit, createSharedPool, initializeSharedSeat, needsAnomalyRecruitment, nextSharedRound,
  refreshSharedShops, releaseSeatOnElimination, rerollSharedShop, ROUND_SETTLEMENT_VERSION, runSharedMatchCommand, sellSharedUnit, setSharedShopLock,
  type RoundSettlementReceipt, type SharedPoolFailure, type SharedPoolState, type SideProposal,
} from '../../server-entry';
import { BattleResolveError, startBattleJob, type BattleJob, type BattleResolver } from './battle-resolver';
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
  /** Playback allowance added after the longest battle's replay (also covers the client's opening transition). */
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
  /**
   * Re-checks `assertSharedPoolConservation(pool, every seat state)` before every publication (B5 item 6). On by
   * default (tests); production may turn it off. The rules' own transactions check their seat either way.
   */
  readonly assertPoolConservation?: boolean;
  /** Test fixtures only (§12.2): partial per-hero capacities, unspecified heroes have 0. Production omits it (official sizes). */
  readonly poolCapacities?: Readonly<Record<string, number>>;
  /**
   * Combat ticks resolved per clock slice after the preparation deadline (B8). The frozen round is resolved in slices
   * scheduled on the room clock, so a server can serve other messages in between; default: one slice per battle.
   */
  readonly sliceTicks?: number;
}
export const ROOM_TIMING_DEFAULTS: RoomTimings = { preparationMs: 30_000, choiceMs: 30_000, settlementMs: 6_000, battleTailMs: 800, maxSettlementExtensions: 3 };

export type CommitFailure = 'duplicate-settlement' | 'stale-round' | 'wrong-phase' | 'invalid-settlement';
export type CommitResult = { readonly ok: true; readonly state: RoomState } | { readonly ok: false; readonly reason: CommitFailure; readonly state: RoomState };
export type PlanResult = { readonly ok: true; readonly settlement: RoundSettlement } | { readonly ok: false; readonly detail: string };
/** What a room still holds besides its published state; every count is 0 once it ended or was disposed (B8). */
export interface RoomRetained {
  readonly timers: number;
  readonly listeners: number;
  readonly frozenInputs: number;
  readonly pendingSettlement: boolean;
  readonly resolving: boolean;
}

/** The frozen round being resolved slice by slice: battles run in envelope order, each on the pool the previous one left (§12.4). */
interface Resolution {
  readonly results: BattleResult[];
  pool: SharedPoolState;
  job: BattleJob | null;
}

const CHOICE_COMMANDS: ReadonlySet<SeatCommand['type']> = new Set(['choose', 'anomalyTarget', 'anomalyReroll']);

/** One seat transaction: on success the pool and the seat state are published together; on failure both are the input references. */
export type SeatCommandOutcome =
  | { readonly ok: true; readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly pool: SharedPoolState; readonly state: MatchState; readonly reason: SharedPoolFailure };

/**
 * Pure dispatch to the rules; the room adds nothing. Shop commands and choices (which may award a unit) go through the
 * TP shared-pool transactions (§12.4); commands that move no unit between owners stay on the plain public commands.
 */
export function applySeatCommand(pool: SharedPoolState, state: MatchState, command: SeatCommand): SeatCommandOutcome {
  const plain = (result: MatchCommandResult): SeatCommandOutcome => result.ok
    ? { ok: true, pool, state: result.state, events: result.events } : { ok: false, pool, state: result.state, reason: result.reason };
  switch (command.type) {
    case 'deploy': return plain(deployMatchUnit(state, command.unitId, command.target));
    case 'buy': return buySharedUnit(pool, state, command.slot, command.generation);
    case 'sell': return sellSharedUnit(pool, state, command.unitId);
    case 'shopLock': return setSharedShopLock(pool, state, command.locked, command.generation);
    // The wire command has no generation (protocol unchanged); under the single-writer queue the seat's current shop is the expected one.
    case 'reroll': return rerollSharedShop(pool, state, state.shop.generation);
    case 'buyXp': return plain(buyXp(state));
    case 'combine': return plain(combineItems(state, command.a, command.b));
    case 'equip': return plain(equipItem(state, command.itemId, command.unitId, command.slot));
    case 'choose': return runSharedMatchCommand(pool, state, { type: 'choose', choiceId: command.choiceId, generation: command.generation, definitionId: command.definitionId });
    case 'anomalyTarget': return plain(selectAnomalyTarget(state, command.choiceId, command.generation, command.unitId));
    case 'anomalyReroll': return plain(rerollAnomaly(state, command.choiceId, command.generation));
  }
}

/* ---------------- timeouts (§11.4) ---------------- */

/** Which deadline passed; decides which rules timeout commands apply. */
export type TimeoutStage = 'choice' | 'preparation' | 'settlement';
/** `pool`/`state` are the last accepted pair, also on failure (earlier steps of the seat stay accepted). */
export type TimeoutOutcome =
  | { readonly ok: true; readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly pool: SharedPoolState; readonly state: MatchState; readonly reason: string };
const MAX_TIMEOUT_STEPS = 8;

/**
 * Resolves one seat's pending decisions with the rules' timeout commands, in the contract's order:
 * current choice (first offer) → earned loot claimed or discarded → later choices → (the round advance by
 * the caller). Each step is the shared-pool wrapper of a public command (§12.4: a first offer or a claim may
 * award a unit); a refusal is reported, never forced or worked around.
 */
export function resolveSeatTimeouts(match: MatchState, pool: SharedPoolState, stage: TimeoutStage): TimeoutOutcome {
  let current = match, latest = pool;
  const events: MatchEvent[] = [];
  let lootClaimed = false;
  for (let step = 0; step < MAX_TIMEOUT_STEPS; step++) {
    if (current.phase === 'choice' && current.pendingChoice) {
      const pending = current.pendingChoice;
      const result = runSharedMatchCommand(latest, current, { type: 'timeoutChoice', round: current.round, choiceId: pending.choiceId, generation: pending.generation });
      if (!result.ok) return { ok: false, pool: latest, state: current, reason: `forfeit:${result.reason}` };
      current = result.state; latest = result.pool; events.push(...result.events); continue;
    }
    if (stage === 'settlement' && current.phase === 'settlement' && !lootClaimed) {
      lootClaimed = true;
      const result = runSharedMatchCommand(latest, current, { type: 'claimLoot', round: current.round });
      if (!result.ok) return { ok: false, pool: latest, state: current, reason: `loot:${result.reason}` };
      current = result.state; latest = result.pool; events.push(...result.events); continue;
    }
    if (stage === 'preparation' && current.phase === 'preparation' && needsAnomalyRecruitment(current)) {
      // An anomaly node with no own unit has no legal first target: the rules skip it and the seat fights empty.
      const result = runSharedMatchCommand(latest, current, { type: 'timeoutChoice', round: current.round, choiceId: null, generation: null });
      if (!result.ok) return { ok: false, pool: latest, state: current, reason: `forfeit:${result.reason}` };
      current = result.state; latest = result.pool; events.push(...result.events); continue;
    }
    return { ok: true, pool: latest, state: current, events };
  }
  return current.phase === 'choice' ? { ok: false, pool: latest, state: current, reason: 'timeout-steps-exhausted' } : { ok: true, pool: latest, state: current, events };
}

export class Room {
  private current: RoomState;
  private timer: ClockHandle | null = null;
  private pendingSettlement: RoundSettlement | null = null;
  /** Envelopes frozen at the preparation deadline of the current round; results are checked against them (§11.3 item 2). */
  private frozenInputs: readonly BattleInput[] = [];
  /** Unpublished pool the current round's battles chained through (§12.4); published only with the round. */
  private resolvedPool: SharedPoolState | null = null;
  private resolution: Resolution | null = null;
  private disposed = false;
  private extensions = 0;
  private readonly listeners = new Set<(state: RoomState) => void>();
  private readonly pvpMode: PvpMode;
  private readonly checkConservation: boolean;

  constructor(seats: readonly SeatSpec[], private readonly options: RoomOptions) {
    if (seats.length !== ROOM_CAPACITY) throw new RangeError(`a room has exactly ${ROOM_CAPACITY} seats`);
    if (new Set(seats.map(seat => seat.seatId)).size !== seats.length) throw new RangeError('duplicate seat id');
    validateSeed(options.seed);
    this.pvpMode = options.pvpMode ?? 'two-sided';
    this.checkConservation = options.assertPoolConservation ?? true;
    // §12.2 opening, in order: create the pool → import eight unpublished `createMatch(seed)` openings by the fixed seat
    // index 0–7 (this also enables the server mode of §11.1) → one fair first refresh → publish once. Any refusal
    // throws before anything is published, so the whole proposal is discarded.
    let rngState = options.seed >>> 0;
    let pool = createSharedPool(options.roomId, options.seed >>> 0, options.poolCapacities ? { capacities: options.poolCapacities } : {});
    const imported = seats.map((spec, index) => {
      const draw = nextRandom(rngState); rngState = draw.state;
      const joined = initializeSharedSeat(pool, createMatch(draw.word), spec.seatId, index);
      if (!joined.ok) throw new RangeError(`seat ${spec.seatId}: ${joined.reason}`);
      pool = joined.pool;
      return { spec, index, seed: draw.word, match: joined.state };
    });
    const opened = refreshSharedShops(pool, imported.map(seat => seat.match), 1);
    if (!opened.ok) throw new RangeError(`shared pool opening: ${opened.reason}`);
    const seatStates = imported.map(({ spec, index, seed }, position): SeatState => {
      const match = opened.states[position]!;
      return { seatId: spec.seatId, index, name: spec.name, kind: spec.kind, connected: spec.kind === 'human', controller: spec.kind === 'bot' ? 'bot' : 'human', controlEpoch: 0, hp: match.playerHp,
        alive: true, rank: null, eliminatedRound: null, seatRevision: 0, match, seed };
    });
    const initial: RoomState = { roomId: options.roomId, protocolVersion: ROOM_PROTOCOL_VERSION, phase: 'waiting', round: 0, roundId: '', roundName: '', roundKind: null,
      deadlineAt: null, seats: seatStates, pairings: [], battleSeeds: {}, battles: [], settlements: [], ranking: null, fault: null, roomRevision: 0, rngState,
      pool: opened.pool, poolRevision: opened.pool.revision };
    this.assertConserved(initial);
    this.current = initial;
  }

  get state(): RoomState { return this.current; }
  get clock(): Clock { return this.options.clock; }
  subscribe(listener: (state: RoomState) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  /**
   * Releases everything the room holds besides its last published state: the deadline or resolution timer, listeners,
   * the frozen envelopes and staged results. A disposed room never publishes again. Idempotent.
   */
  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.listeners.clear();
    this.releaseRound();
  }
  get retained(): RoomRetained {
    return { timers: this.timer === null ? 0 : 1, listeners: this.listeners.size, frozenInputs: this.frozenInputs.length, pendingSettlement: this.pendingSettlement !== null,
      resolving: this.resolution !== null };
  }

  /** waiting → first round. */
  start(): void {
    if (this.current.phase !== 'waiting') return;
    this.enterRound();
  }

  /**
   * Phase and seat gate only; the rules decide everything else and a refusal changes nothing. A human seat a bot took
   * over refuses its player's commands until the player resumes (one controller at a time, B6). Fill-in bot seats have
   * no session, so no player command reaches them; server-side callers may still drive them here directly.
   */
  handle(seatId: string, command: SeatCommand): RoomCommandResult {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat) return { ok: false, reason: 'unknown-seat', state: null };
    if (seat.controller === 'takeover') return { ok: false, reason: 'seat-controlled', state: seat.match };
    return this.apply(seat, command);
  }

  /**
   * Bot entry (B6, contract §13.3): the same gate and the same rules dispatch as a player command, accepted only while
   * the seat is bot-controlled under exactly `controlEpoch`. A takeover revoked by a resume (or any controller change)
   * makes every step decided before it fail with `control-revoked`, without touching the seat.
   */
  handleBot(seatId: string, controlEpoch: number, command: SeatCommand): RoomCommandResult {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat) return { ok: false, reason: 'unknown-seat', state: null };
    if (seat.controller === 'human' || seat.controlEpoch !== controlEpoch) return { ok: false, reason: 'control-revoked', state: seat.match };
    return this.apply(seat, command);
  }

  private apply(seat: SeatState, command: SeatCommand): RoomCommandResult {
    const seatId = seat.seatId;
    if (!seat.alive) return { ok: false, reason: 'seat-eliminated', state: seat.match };
    const phase = this.current.phase;
    const allowed = !this.disposed && (phase === 'preparation' || (phase === 'choice' && CHOICE_COMMANDS.has(command.type)));
    if (!allowed) return { ok: false, reason: 'wrong-phase', state: seat.match };
    const result = applySeatCommand(this.current.pool, seat.match, command);
    // A refusal publishes nothing: pool, poolRevision, seat state and seatRevision stay the same references.
    if (!result.ok) return { ok: false, reason: result.reason, state: result.state };
    const seatRevision = seat.seatRevision + 1;
    this.commitSeat(seatId, result.state, result.pool);
    if (phase === 'choice' && !this.aliveSeats().some(candidate => candidate.match.phase === 'choice')) { this.clearTimer(); this.afterChoiceWindow(); }
    return { ok: true, state: result.state, events: result.events, seatRevision, roomRevision: this.current.roomRevision };
  }

  /**
   * Connection bookkeeping for the network layer (B2): a dropped or resumed socket changes only the
   * public `connected` flag. Assets, pairings and ranks stay (V2 D8); seatRevision does not move
   * because no command or settlement touched the seat. A resume also revokes a bot takeover at once
   * (B6): the controller goes back to `human` under a new control generation.
   */
  setConnected(seatId: string, connected: boolean): boolean {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat || seat.kind !== 'human') return false;
    const reclaim = connected && seat.controller === 'takeover';
    if (seat.connected === connected && !reclaim) return true;
    this.replaceSeats(this.current.seats.map(candidate => candidate.seatId !== seatId ? candidate
      : reclaim ? { ...candidate, connected, controller: 'human', controlEpoch: candidate.controlEpoch + 1 } : { ...candidate, connected }));
    return true;
  }

  /**
   * Hands a disconnected human seat to a bot (B6 takeover). The seat keeps its MatchState, pool holdings, assets and
   * receipts; nothing is recreated. Refused (false) unless the seat is a human seat that is alive, disconnected and
   * still under human control in a running room. When to call it is the bot driver's decision (its takeover delay).
   */
  takeOver(seatId: string): boolean {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat || seat.kind !== 'human' || seat.connected || !seat.alive || seat.controller !== 'human') return false;
    if (this.current.phase === 'waiting' || this.current.phase === 'ended') return false;
    this.replaceSeats(this.current.seats.map(candidate => candidate.seatId === seatId ? { ...candidate, controller: 'takeover', controlEpoch: candidate.controlEpoch + 1 } : candidate));
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
  planSettlement(results: readonly BattleResult[], pool: SharedPoolState = this.resolvedPool ?? this.current.pool): PlanResult {
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
    let seats = alive.map(seat => staged.get(seat.seatId)!);
    // The staged states must be exactly the ones the chained pool knows (a resolver that awarded a unit outside the pool fails here).
    const unbalanced = conservationProblem(pool, seats.map(seat => seat.match));
    if (unbalanced) return { ok: false, detail: `shared pool: ${unbalanced}` };
    const index = (settled: SettledSeat) => byId.get(settled.seatId)!.index;
    // §11.5 ranking key: untruncated HP after damage (desc) → HP before the round (desc) → fixed seat index (asc);
    // the whole round ranks at once, independent of result arrival order.
    const dying = seats.filter(seat => seat.hpAfter === 0)
      .sort((a, b) => a.hpAfterRaw - b.hpAfterRaw || a.hpBefore - b.hpBefore || index(b) - index(a));
    const survivors = seats.filter(seat => seat.hpAfter > 0)
      .sort((a, b) => b.hpAfter - a.hpAfter || b.hpBefore - a.hpBefore || index(a) - index(b));
    let rank = alive.length;
    const eliminated: RankEntry[] = dying.map(seat => ({ seatId: seat.seatId, rank: rank-- }));
    // §12.4: after this round's ranking and before the next natural refresh, every seat the rules eliminated returns its
    // shop, holdings and pending rewards to the pool once. A repeated release is refused by the rules and ignored. A
    // seat only the room zeroed (a test placeholder outcome the rules never settled) is not eliminated by the rules and
    // keeps its pool seat; the next refresh then refuses the round (incomplete-seats) instead of the room guessing.
    let released = pool;
    for (const entry of eliminated) {
      const seat = seats.find(candidate => candidate.seatId === entry.seatId)!;
      if (seat.match.multiplayer?.status !== 'eliminated') continue;
      const release = releaseSeatOnElimination(released, seat.match);
      if (!release.ok) { if (release.reason === 'duplicate-release') continue; return { ok: false, detail: `seat ${seat.seatId} pool release: ${release.reason}` }; }
      released = release.pool;
      seats = seats.map(candidate => candidate === seat ? { ...seat, match: release.state, events: [...seat.events, ...release.events] } : candidate);
    }
    // The match ends only when at most one seat survives; survivors of the catalog's final round go to overtime (§11.5).
    const ends = survivors.length <= 1;
    const finalRanking = ends ? [
      ...survivors.map((seat, position) => ({ seatId: seat.seatId, rank: position + 1 })),
      ...eliminated,
      ...state.seats.filter(seat => !seat.alive).map(seat => ({ seatId: seat.seatId, rank: seat.rank! })),
    ].sort((a, b) => a.rank - b.rank) : null;
    return { ok: true, settlement: { settlementId: `${state.roomId}:round-${state.round}`, round: state.round, roundId: state.roundId, results, seats, eliminated, finalRanking, pool: released } };
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
    this.replace({ ...state, seats, pool: settlement.pool, poolRevision: settlement.pool.revision, settlements: [...state.settlements, settlement.settlementId], ranking: settlement.finalRanking });
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
    this.extensions = 0; this.releaseRound();
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

  /** Runs the rules' timeout commands for every alive seat (§11.4), one seat transaction after the other on the latest pool; a refusal is a seat-stuck fault. */
  private applyTimeouts(stage: TimeoutStage): boolean {
    for (const seat of this.aliveSeats()) {
      const outcome = resolveSeatTimeouts(seat.match, this.current.pool, stage);
      if (outcome.state !== seat.match) this.commitSeat(seat.seatId, outcome.state, outcome.pool);
      if (!outcome.ok) { this.fail({ kind: 'seat-stuck', seatId: seat.seatId, reason: outcome.reason }); return false; }
    }
    return true;
  }

  /**
   * Preparation deadline: timeouts, then freeze every seat and resolve every battle. Resolution runs in clock slices
   * (B8): the inputs are frozen here and nothing else of the room changes until the last battle finished, when the
   * settlement is staged for the battle deadline. Commands meanwhile meet the `frozen` phase and are refused.
   */
  private freezeAndResolve(): void {
    this.setPhase('frozen', null);
    if (!this.applyTimeouts('preparation')) return;
    this.frozenInputs = this.buildInputs();
    // §12.4: one unpublished proposal for the whole round; a battle that awards a unit hands its pool to the next battle.
    this.resolution = { results: [], pool: this.current.pool, job: null };
    this.scheduleSlice();
  }

  private scheduleSlice(): void {
    const clock = this.options.clock;
    this.timer = clock.schedule(clock.now(), () => { this.timer = null; this.resolveSlice(); });
  }

  /** One slice: advance the current battle by at most `sliceTicks`; the next slice is scheduled until every battle finished. */
  private resolveSlice(): void {
    const resolution = this.resolution;
    if (this.disposed || !resolution || this.current.phase !== 'frozen') return;
    const input = this.frozenInputs[resolution.results.length]!;
    try {
      resolution.job ??= startBattleJob(this.options.resolver, input, resolution.pool);
      const result = resolution.job.advance(this.options.sliceTicks ?? Number.POSITIVE_INFINITY);
      if (result) {
        resolution.results.push(result); resolution.job = null;
        if (result.kind === 'placeholder' && result.pool) resolution.pool = result.pool;
      }
    }
    catch (error) {
      // Any rules refusal or resolver error drops the whole round: no partial proposal or outcome is adopted.
      const message = error instanceof Error ? error.message : String(error);
      return this.fail(error instanceof BattleResolveError ? { kind: 'resolver-error', battleId: input.battleId, message, reason: error.reason } : { kind: 'resolver-error', battleId: input.battleId, message });
    }
    if (resolution.results.length < this.frozenInputs.length) return this.scheduleSlice();
    this.resolution = null;
    this.stageResolved(resolution.results, resolution.pool);
  }

  private stageResolved(results: readonly BattleResult[], pool: SharedPoolState): void {
    this.resolvedPool = pool;
    const plan = this.planSettlement(results, pool);
    if (!plan.ok) return this.fail({ kind: 'invalid-results', detail: plan.detail });
    this.pendingSettlement = plan.settlement;
    this.replace({ ...this.current, battles: results });
    // Playback runs one tick record per tick, 0..terminal (contract §14.2): terminal.tick + 1 records per battle.
    const ticks = (combat: { readonly terminal: { readonly tick: number } } | null) => combat === null ? 0 : combat.terminal.tick + 1;
    const longest = Math.max(0, ...results.flatMap(result => result.kind === 'placeholder' ? result.outcomes.map(outcome => ticks(outcome.combat)) : [ticks(result.battle)]));
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
   * Settlement deadline: loot timeouts, then advance every alive seat in one `nextSharedRound` batch (§12.3: it returns
   * every unlocked shop before generating any new one, in the rotating seat order). The batch is all-or-nothing.
   */
  private advanceRound(): void {
    if (!this.applyTimeouts('settlement')) return;
    const alive = this.aliveSeats();
    const batch = nextSharedRound(this.current.pool, alive.map(seat => seat.match), alive[0]!.match.round);
    if (!batch.ok) {
      if (this.extensions < this.options.maxSettlementExtensions) { this.extensions++; return this.setPhase('settlement', this.options.settlementMs); }
      // Name the seat the rules refuse to advance on its own (a dry run, nothing is published); the batch reason stays the rules' code.
      const stuck = alive.find(seat => !nextRound(seat.match, seat.match.round).ok) ?? alive[0]!;
      return this.fail({ kind: 'seat-stuck', seatId: stuck.seatId, reason: batch.reason });
    }
    const advanced = new Map(alive.map((seat, position) => [seat.seatId, batch.states[position]!] as const));
    this.replace({ ...this.current, pool: batch.pool, poolRevision: batch.pool.revision,
      seats: this.current.seats.map(seat => { const match = advanced.get(seat.seatId); return match ? { ...seat, match, seatRevision: seat.seatRevision + 1 } : seat; }) });
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
    this.releaseRound();
    this.replace({ ...this.current, fault });
    this.setPhase('ended', null);
  }

  private setPhase(phase: RoomPhase, durationMs: number | null): void {
    this.clearTimer();
    const deadlineAt = durationMs === null ? null : this.options.clock.now() + durationMs;
    if (phase === 'ended') {
      // An ended room keeps only what its last view and replay need (the rules' battle results, terminals and ledgers);
      // the frozen envelopes and staged results of the round go.
      this.releaseRound();
      return this.replace({ ...this.current, phase, deadlineAt });
    }
    this.replace({ ...this.current, phase, deadlineAt });
    if (deadlineAt !== null) this.timer = this.options.clock.schedule(deadlineAt, () => this.onDeadline());
  }
  /** Forgets the current round's frozen envelopes, the resolution in progress and the staged settlement. */
  private releaseRound(): void { this.pendingSettlement = null; this.frozenInputs = []; this.resolvedPool = null; this.resolution = null; }
  private clearTimer(): void { if (this.timer !== null) { this.options.clock.cancel(this.timer); this.timer = null; } }
  private replaceSeats(seats: readonly SeatState[]): void { this.replace({ ...this.current, seats }); }
  /** Publishes one seat transaction: its state and the pool it was decided against, together (§12.1). */
  private commitSeat(seatId: string, match: MatchState, pool: SharedPoolState): void {
    this.replace({ ...this.current, pool, poolRevision: pool.revision,
      seats: this.current.seats.map(candidate => candidate.seatId === seatId ? { ...candidate, match, seatRevision: candidate.seatRevision + 1 } : candidate) });
  }
  private replace(next: RoomState): void {
    if (this.disposed) return;
    const published = { ...next, roomRevision: this.current.roomRevision + 1 };
    // Phase/deadline/connection-only publications carry the same pool and seats references: nothing to re-check.
    if (published.pool !== this.current.pool || published.seats !== this.current.seats) this.assertConserved(published);
    this.current = published;
    for (const listener of this.listeners) listener(this.current);
  }
  /** B5 item 6: the published pool balances against every seat it binds; throws before anything is published. */
  private assertConserved(state: RoomState): void {
    if (!this.checkConservation) return;
    if (state.poolRevision !== state.pool.revision) throw new Error(`poolRevision ${state.poolRevision} is not pool.revision ${state.pool.revision}`);
    assertSharedPoolConservation(state.pool, state.seats.map(seat => seat.match));
  }
}

/** The rules' conservation check as a value: null when balanced, else its reason (never used as protocol text). */
function conservationProblem(pool: SharedPoolState, states: readonly MatchState[]): string | null {
  try { assertSharedPoolConservation(pool, states); return null; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
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

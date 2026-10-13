/**
 * Eight-seat room state machine (pipeline B, work orders B1–B7). Pure TypeScript: no network,
 * no real clock, no ambient randomness. The room owns seat order, phases, deadlines, pairings,
 * the one-shot round publication and the ranking; every rule (gold, shop, combat, damage,
 * income, growth, the shared card pool) comes from src/simulation through its public commands,
 * the TP shared-pool transactions (contract §12), the injected BattleResolver and the T3
 * receipt entry, applied through the shared `settleRound` wrapper on the latest live seat (contract §11.3, §15.3).
 * T10 (§15): operations stay open through battle/choice/settlement; the preparation deadline auto-deploys human
 * seats, freezes the inputs and locks (PvP) or starts (PvE) the live seats.
 */
import {
  buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly, selectAnomalyTarget,
} from '../../simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import { nextRandom, validateSeed } from '../../simulation/rng';
import { readRoundInfo } from '../../simulation/round-selectors';
import {
  assertSharedPoolConservation, autoDeployToCap, buySharedUnit, lockMatchCombatRoster, createSharedPool, initializeSharedSeat, needsAnomalyRecruitment, nextSharedRound,
  refreshSharedShops, releaseSeatOnElimination, rerollSharedShop, ROUND_SETTLEMENT_VERSION, runSharedMatchCommand, sellSharedUnit, setSharedShopLock,
  type RoundSettlementReceipt, type SharedPoolFailure, type SharedPoolState, type SideProposal,
} from '../../server-entry';
import { BattleResolveError, startBattleJob, type BattleJob, type BattleResolver } from './battle-resolver';
import type { BattleSeatOutcome } from './types';
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

/** `stale-seat`: a seat or the pool changed after the plan was made; plan again on the latest live states. */
export type CommitFailure = 'duplicate-settlement' | 'stale-round' | 'stale-seat' | 'wrong-phase' | 'invalid-settlement';
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

/** Contract §15.2: operations and choices the room passes to the rules, by room phase; the rules then check the seat's own phase and target (§15.1). */
const OPS: readonly SeatCommand['type'][] = ['buy', 'sell', 'reroll', 'buyXp', 'shopLock', 'deploy', 'combine', 'equip'];
const CHOICES: readonly SeatCommand['type'][] = ['choose', 'anomalyTarget', 'anomalyReroll'];
export const ROOM_COMMAND_GATE: Readonly<Record<RoomPhase, ReadonlySet<SeatCommand['type']>>> = {
  waiting: new Set(), preparation: new Set([...OPS, ...CHOICES]), choice: new Set([...OPS, ...CHOICES]),
  // The deadline, the automatic deployment and the freeze are one boundary no command may interleave with.
  frozen: new Set(), battle: new Set(OPS), 'awaiting-settlement': new Set(OPS), settlement: new Set(OPS), ended: new Set(),
};
/** Upper bound of rules steps when the room finishes a live PvE battle itself (the engine stops at 1200 ticks). */
const LIVE_COMBAT_MAX_STEPS = 5_000;

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
  /** Pool and live seats as the freeze published them (§15.4); a settlement may adopt the resolver's states only while both are unchanged. */
  private lockedPool: SharedPoolState | null = null;
  /** Deadline deployments staged during `frozen`, published with the locks at battle entry. */
  private deployed: ReadonlyMap<string, { readonly match: MatchState; readonly events: readonly MatchEvent[] }> = new Map();
  private lockedSeats: ReadonlyMap<string, MatchState> = new Map();
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
    const allowed = !this.disposed && ROOM_COMMAND_GATE[phase].has(command.type);
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
   * Builds this round's settlement from a full set of results without touching the room: every result is checked
   * against the frozen envelope, then every alive seat is settled exactly once, in seat order, on its LATEST live
   * state and the latest pool (contract §15.2): two-sided seats through the shared `settleRound` wrapper with the
   * receipt; PvE seats whose live battle is still running are finished by the rules' shared `step`. The resolver's
   * own pre-battle states are only adopted when nothing changed since the freeze (then they are exactly what the live
   * run gives). Any failure discards the whole stage. Pure: calling it again with the same results and room is the
   * retry the contract asks for, with the same seeds.
   */
  planSettlement(results: readonly BattleResult[], resolverPool: SharedPoolState = this.resolvedPool ?? this.current.pool): PlanResult {
    return this.plan(this.current, results, resolverPool, this.untouchedSinceFreeze());
  }

  /** planSettlement on a given room state: the published one, or the battle-entry state about to be published. */
  private plan(state: RoomState, results: readonly BattleResult[], resolverPool: SharedPoolState, untouched: boolean): PlanResult {
    const alive = state.seats.filter(seat => seat.alive);
    const byId = new Map(state.seats.map(seat => [seat.seatId, seat] as const));
    const envelopes = new Map(this.frozenInputs.map(input => [input.battleId, input] as const));
    type Job = { readonly kind: 'receipt'; readonly receipt: RoundSettlementReceipt; readonly damage: number }
      | { readonly kind: 'outcome'; readonly outcome: BattleSeatOutcome; readonly frozen: MatchState | null };
    const jobs = new Map<string, Job>();
    const queue = (seatId: string, job: Job): string | null => {
      if (jobs.has(seatId)) return `seat ${seatId} reported twice`;
      if (!alive.some(seat => seat.seatId === seatId)) return `seat ${seatId} is not alive`;
      jobs.set(seatId, job); return null;
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
          if (!byId.has(seatId)) return { ok: false, detail: `unknown seat ${seatId}` };
          const proposal = [result.proposals.a, result.proposals.b].find(candidate => candidate.seatId === seatId);
          if (!proposal) return { ok: false, detail: `battle ${result.battleId} has no proposal for seat ${seatId}` };
          if (!proposal.settlementEligible) return { ok: false, detail: `seat ${seatId} proposal is not eligible` };
          const problem = queue(seatId, { kind: 'receipt', receipt: buildReceipt(state.roomId, envelope, proposal, result.battle.terminal.tick, result.battle.events.length), damage: proposal.damage });
          if (problem) return { ok: false, detail: problem };
        }
      } else {
        if (envelope.roundKind === 'pvp' && this.pvpMode !== 'placeholder') return { ok: false, detail: `battle ${result.battleId} is a placeholder result on a PvP round in pvpMode=${this.pvpMode}` };
        if (result.outcomes.length !== frozenSeats.length || result.outcomes.some(outcome => !frozenSeats.includes(outcome.seatId))) return { ok: false, detail: `battle ${result.battleId} outcomes differ from the frozen envelope` };
        for (const outcome of result.outcomes) {
          if (!byId.has(outcome.seatId)) return { ok: false, detail: `unknown seat ${outcome.seatId}` };
          if (!Number.isInteger(outcome.damage) || outcome.damage < 0) return { ok: false, detail: `seat ${outcome.seatId} damage ${outcome.damage} is not a non-negative integer` };
          const problem = queue(outcome.seatId, { kind: 'outcome', outcome, frozen: envelope.seats.find(seat => seat.seatId === outcome.seatId)?.state ?? null });
          if (problem) return { ok: false, detail: problem };
        }
      }
    }
    for (const seat of alive) if (!jobs.has(seat.seatId)) return { ok: false, detail: `seat ${seat.seatId} has no result` };
    // Nothing moved since the freeze: the resolver ran exactly the live seats, so its states and pool chain are the live result.
    let pool = untouched ? resolverPool : state.pool;
    let seats: SettledSeat[] = [];
    // Fixed seat order, independent of result arrival order: each seat's transaction runs on the pool the previous one left.
    for (const seat of alive) {
      const job = jobs.get(seat.seatId)!;
      const settled = (match: MatchState, damage: number, receipt: RoundSettlementReceipt | null, events: readonly MatchEvent[]): SettledSeat =>
        ({ seatId: seat.seatId, hpBefore: seat.hp, damage, hpAfterRaw: seat.hp - damage, hpAfter: Math.max(0, seat.hp - damage), match, receipt, events });
      if (job.kind === 'receipt') {
        const applied = runSharedMatchCommand(pool, seat.match, { type: 'settleRound', receipt: job.receipt });
        if (!applied.ok) return { ok: false, detail: `seat ${seat.seatId}: ${applied.reason}` };
        if (applied.state.playerHp !== Math.max(0, seat.hp - job.damage)) return { ok: false, detail: `seat ${seat.seatId}: rules HP ${applied.state.playerHp} disagrees with the room HP ${seat.hp} - ${job.damage}` };
        pool = applied.pool; seats.push(settled(applied.state, job.damage, job.receipt, applied.events));
        continue;
      }
      const { outcome } = job;
      // The rules settled this seat themselves (PvE/supply): their HP is authoritative and must agree with the room's. A
      // placeholder outcome that left the state unsettled (test resolvers) is subtracted by the room as in B1.
      const settledByRules = outcome.state.roundResults.at(-1)?.round === state.round;
      const expected = Math.max(0, seat.hp - outcome.damage);
      if (settledByRules && outcome.state.playerHp !== expected) return { ok: false, detail: `seat ${seat.seatId}: rules HP ${outcome.state.playerHp} disagrees with the room HP ${seat.hp} - ${outcome.damage}` };
      if (untouched) { seats.push(settled(outcome.state, outcome.damage, null, [])); continue; }
      if (seat.match.phase === 'combat') {
        if (!settledByRules) return { ok: false, detail: `seat ${seat.seatId}: an unsettled placeholder outcome cannot settle a live battle` };
        const finished = finishLiveCombat(pool, seat.match);
        if (!finished.ok) return { ok: false, detail: `seat ${seat.seatId}: ${finished.reason}` };
        if (finished.state.playerHp !== expected) return { ok: false, detail: `seat ${seat.seatId}: live HP ${finished.state.playerHp} disagrees with the resolved battle ${seat.hp} - ${outcome.damage}` };
        pool = finished.pool; seats.push(settled(finished.state, outcome.damage, null, finished.events));
        continue;
      }
      // No live battle (supply, or a state the resolver left as it was): the live seat itself is the settled state.
      if (outcome.state !== job.frozen) return { ok: false, detail: `seat ${seat.seatId} changed after the freeze but its battle was not run on the live state` };
      seats.push(settled(seat.match, outcome.damage, null, []));
    }
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
    return { ok: true, settlement: { settlementId: `${state.roomId}:round-${state.round}`, round: state.round, roundId: state.roundId, results, seats, eliminated, finalRanking, pool: released,
      basis: { poolRevision: state.poolRevision, seatRevisions: Object.fromEntries(alive.map(seat => [seat.seatId, seat.seatRevision])) } } };
  }

  /** Publishes the staged round once: HP from the staged states, eliminations and ranking; a repeated settlementId changes nothing. */
  commitSettlement(settlement: RoundSettlement): CommitResult {
    const state = this.current;
    if (state.settlements.includes(settlement.settlementId)) return { ok: false, reason: 'duplicate-settlement', state };
    if (state.phase !== 'frozen' && state.phase !== 'battle') return { ok: false, reason: 'wrong-phase', state };
    if (settlement.round !== state.round || settlement.settlementId !== `${state.roomId}:round-${state.round}`) return { ok: false, reason: 'stale-round', state };
    const alive = this.aliveSeats();
    if (settlement.seats.length !== alive.length || alive.some(seat => !settlement.seats.some(settled => settled.seatId === seat.seatId))) return { ok: false, reason: 'invalid-settlement', state };
    // Planned on other live states (a command landed in between): publishing it would overwrite that command (§15.2).
    if (settlement.basis.poolRevision !== state.poolRevision || alive.some(seat => settlement.basis.seatRevisions[seat.seatId] !== seat.seatRevision)) return { ok: false, reason: 'stale-seat', state };
    const settled = new Map(settlement.seats.map(seat => [seat.seatId, seat] as const));
    const ranks = new Map<string, number>(settlement.eliminated.map(entry => [entry.seatId, entry.rank]));
    for (const entry of settlement.finalRanking ?? []) ranks.set(entry.seatId, entry.rank);
    const seats = state.seats.map((seat): SeatState => {
      const outcome = settled.get(seat.seatId);
      if (!outcome) return seat;
      const rank = ranks.get(seat.seatId) ?? null;
      const stillAlive = outcome.hpAfter > 0;
      return { ...seat, hp: outcome.hpAfter, alive: stillAlive, rank, eliminatedRound: stillAlive ? null : settlement.round, match: outcome.match, seatRevision: seat.seatRevision + 1,
        serverEvents: { seatRevision: seat.seatRevision + 1, events: outcome.events } };
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
    // §15.4: deploy every human seat up to its cap, freeze every input on the deployed states, then lock the live seats.
    // Staged only: the deployments, locks and starts are published together at battle entry (§15.4 item 4), so a
    // refused battle or receipt leaves every seat exactly as the deadline found it.
    const deployed = this.autoDeploy();
    if (!deployed) return;
    this.deployed = deployed;
    this.frozenInputs = this.buildInputs(deployed);
    // §12.4: one unpublished proposal for the whole round; a battle that awards a unit hands its pool to the next battle.
    this.resolution = { results: [], pool: this.current.pool, job: null };
    this.scheduleSlice();
  }

  /** Staged `autoDeployToCap` of every alive human seat in preparation; nothing is published yet. A refusal faults the round. */
  private autoDeploy(): ReadonlyMap<string, { readonly match: MatchState; readonly events: readonly MatchEvent[] }> | null {
    const staged = new Map<string, { readonly match: MatchState; readonly events: readonly MatchEvent[] }>();
    for (const seat of this.aliveSeats()) {
      if (seat.kind !== 'human' || seat.match.phase !== 'preparation') continue;
      const result = autoDeployToCap(seat.match);
      if (!result.ok) { this.fail({ kind: 'seat-stuck', seatId: seat.seatId, reason: `auto-deploy:${result.reason}` }); return null; }
      if (result.state !== seat.match) staged.set(seat.seatId, { match: result.state, events: result.events });
    }
    return staged;
  }

  /**
   * After every input is frozen: PvP seats get the rules' combat roster lock (§15.3), PvE seats start their real
   * battle through the shared wrapper (§15.4 item 3). One publication carries the deployments, locks and starts;
   * later operations act on these live seats, never on the frozen inputs.
   */
  private lockedRoom(deployed: ReadonlyMap<string, { readonly match: MatchState; readonly events: readonly MatchEvent[] }>): RoomState | null {
    const kind = this.current.roundKind;
    let pool = this.current.pool;
    const locked = new Map<string, { readonly match: MatchState; readonly events: readonly MatchEvent[] }>();
    for (const seat of this.aliveSeats()) {
      const staged = deployed.get(seat.seatId);
      let match = staged?.match ?? seat.match;
      if (match.phase === 'preparation' && kind === 'pvp') {
        const result = lockMatchCombatRoster(match);
        if (!result.ok) { this.fail({ kind: 'seat-stuck', seatId: seat.seatId, reason: `lock:${result.reason}` }); return null; }
        match = result.state;
      } else if (match.phase === 'preparation' && kind === 'pve') {
        const started = runSharedMatchCommand(pool, match, { type: 'startCombat' });
        if (!started.ok) {
          this.fail({ kind: 'resolver-error', battleId: `${this.current.roomId}:r${this.current.round}:${seat.seatId}`, message: `seat ${seat.seatId}: ${started.reason}`, reason: started.reason });
          return null;
        }
        match = started.state; pool = started.pool;
      }
      if (match !== seat.match) locked.set(seat.seatId, { match, events: staged?.events ?? [] });
    }
    if (locked.size === 0) return this.current;
    return { ...this.current, pool, poolRevision: pool.revision, seats: this.current.seats.map(seat => {
      const next = locked.get(seat.seatId);
      if (!next) return seat;
      const seatRevision = seat.seatRevision + 1;
      return { ...seat, match: next.match, seatRevision, serverEvents: { seatRevision, events: next.events } };
    }) };
  }

  /** True while no command touched any alive seat or the pool since the freeze published the locked seats. */
  private untouchedSinceFreeze(): boolean {
    return this.lockedPool === this.current.pool && this.aliveSeats().every(seat => this.lockedSeats.get(seat.seatId) === seat.match);
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
    const entry = this.lockedRoom(this.deployed);
    if (!entry) return;
    // Checked on the battle-entry state before anything is published: a refused receipt or result faults with no seat moved.
    const plan = this.plan(entry, results, pool, true);
    if (!plan.ok) return this.fail({ kind: 'invalid-results', detail: plan.detail });
    this.pendingSettlement = plan.settlement;
    this.replace({ ...entry, battles: results });
    this.lockedPool = this.current.pool;
    this.lockedSeats = new Map(this.aliveSeats().map(seat => [seat.seatId, seat.match] as const));
    // Playback runs one tick record per tick, 0..terminal (contract §14.2): terminal.tick + 1 records per battle.
    const ticks = (combat: { readonly terminal: { readonly tick: number } } | null) => combat === null ? 0 : combat.terminal.tick + 1;
    const longest = Math.max(0, ...results.flatMap(result => result.kind === 'placeholder' ? result.outcomes.map(outcome => ticks(outcome.combat)) : [ticks(result.battle)]));
    if (longest === 0) return this.commitPending();
    const tickMs = this.aliveSeats()[0]!.match.tickMs;
    this.setPhase('battle', longest * tickMs + this.options.battleTailMs);
  }

  private buildInputs(deployed: ReadonlyMap<string, { readonly match: MatchState }>): readonly BattleInput[] {
    const state = this.current;
    const alive = this.aliveSeats();
    const seatInput = (seat: SeatState) => ({ seatId: seat.seatId, state: deployed.get(seat.seatId)?.match ?? seat.match });
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
    if (settlement && !this.current.settlements.includes(settlement.settlementId)) {
      let commit = this.commitSettlement(settlement);
      // Operations during the battle changed live seats: settle again on the latest states (§15.2), never on the staged ones.
      if (!commit.ok && commit.reason === 'stale-seat') {
        const plan = this.planSettlement(settlement.results);
        if (!plan.ok) return this.fail({ kind: 'invalid-results', detail: plan.detail });
        commit = this.commitSettlement(plan.settlement);
      }
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
  private releaseRound(): void { this.pendingSettlement = null; this.frozenInputs = []; this.resolvedPool = null; this.resolution = null; this.lockedPool = null; this.lockedSeats = new Map(); this.deployed = new Map(); }
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

/** Finishes a live PvE battle with the rules' shared `step` on the latest pool; the seat leaves `combat` settled by the rules. */
function finishLiveCombat(pool: SharedPoolState, state: MatchState):
  { readonly ok: true; readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[] } | { readonly ok: false; readonly reason: string } {
  let current = state, latest = pool;
  const events: MatchEvent[] = [];
  for (let steps = 0; current.phase === 'combat'; steps++) {
    if (steps >= LIVE_COMBAT_MAX_STEPS) return { ok: false, reason: 'live-combat-steps-exhausted' };
    const step = runSharedMatchCommand(latest, current, { type: 'step' });
    if (!step.ok) return { ok: false, reason: step.reason };
    current = step.state; latest = step.pool;
    // Combat ledger events stay with the resolved battle (its replay); the seat keeps the match-domain ones.
    for (const event of step.events) if (!('tick' in event)) events.push(event);
  }
  return { ok: true, pool: latest, state: current, events };
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

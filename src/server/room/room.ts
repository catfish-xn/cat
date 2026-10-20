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
  buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, readLootView, rerollAnomaly, selectAnomalyTarget,
} from '../../simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import { selectOpeningUnit } from '../../simulation/opening-unit';
import { nextRandom, validateSeed } from '../../simulation/rng';
import { readRoundInfo } from '../../simulation/round-selectors';
import {
  assertSharedPoolConservation, autoDeployToCap, buySharedUnit, claimBotPreparationOrbs, lockMatchCombatRoster, createSharedPool, initializeSharedSeat, needsAnomalyRecruitment, nextSharedRound,
  moveItemSummon, refreshSharedShops, releaseSeatOnElimination, rerollSharedShop, ROUND_SETTLEMENT_VERSION, runSharedMatchCommand, sellPendingCarouselUnit, sellSharedUnit, setSharedShopLock,
  type CarouselEvent, type CarouselRoundId, type CarouselState, type RoundSettlementReceipt, type SharedPoolFailure, type SharedPoolState, type SideProposal,
} from '../../server-entry';
import { BattleResolveError, startBattleJob, type BattleJob, type BattleResolver } from './battle-resolver';
import { LIVE_BANK_LEAD_TICKS, LivePveTrack, LivePvpTrack, withOutcome, type LiveCatchUp } from './live-bank';
import { useSeatConsumable } from './consumables';
import { carouselReleased, carouselRoundOf, heldCarouselUnits, type CarouselAutoCause, type CarouselLedgerEntry, type CarouselRules } from './carousel';
import type { CarouselPickCommand } from '../protocol';
import type { BattleSeatOutcome } from './types';
import type { Clock, ClockHandle } from './clock';
import { DEFAULT_PAIRING_POLICY, findPairing, planCandidates, planPairings, recordPairings, type PairingPolicy } from './pairing';
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
  /**
   * D11 live bank (planning/live-gold-combat-2026-10-20.md): the participants of a two-sided battle whose combat reads
   * their live gold. A gold change of such a seat during the battle phase is sampled into a live run of that battle,
   * which is then settled and shown instead of the frozen one. Omitted: none (every PvP battle stays the frozen one).
   */
  readonly liveBankSeats?: (input: BattleInput) => readonly string[];
  /**
   * Test fixtures only (§12.2): partial per-hero capacities, unspecified heroes have 0. Production omits it (official sizes).
   * Each seat's random opening one-cost needs a copy, so a hero is raised to at least its number of openings
   * (`withOpeningCopies`); a fixture that already covers the openings is used as given.
   */
  readonly poolCapacities?: Readonly<Record<string, number>>;
  /**
   * Combat ticks resolved per clock slice after the preparation deadline (B8). The frozen round is resolved in slices
   * scheduled on the room clock, so a server can serve other messages in between; default: one slice per battle.
   */
  readonly sliceTicks?: number;
  /**
   * Room-clock budget of one slice, in ms. When given, a slice advances its battle in steps of at most
   * SLICE_STEP_TICKS ticks and ends once the clock has moved past this budget (or `sliceTicks` are spent), so a
   * late-round slice of heavy ticks cannot hold the single writer for hundreds of milliseconds. Slicing never changes
   * a result; a clock that does not move during a slice (test clocks) gives exactly the `sliceTicks` slices.
   */
  readonly sliceMs?: number;
  /** G1-P6: how recent opponents are avoided; DEFAULT_PAIRING_POLICY (placeholder, S13_RULES_GAP §10) when omitted. */
  readonly pairingPolicy?: PairingPolicy;
  /**
   * G1-P7: the rules' shared carousel (`CAROUSEL_RULES_BINDING`). When given, the seats open with `createCarouselMatch`
   * (P7-1: the random one-cost opening hero and the usual opening economy, MULTIPLAYER_CONTRACT §21.5–21.6) and every carousel the rules
   * open (`opensCarousel`: the five x-4 rounds) replaces the old component supply. Omitted, the room opens and runs as
   * before P7 (supply choice), which the pre-P7 room tests keep using.
   */
  readonly carousel?: CarouselRules;
}
/** MULTIPLAYER_CONTRACT §21.1: the departure after the carousel's deadline before the round goes on. */
export const CAROUSEL_DEPARTURE_MS = 2_000;
/** Ticks per step of a time-budgeted slice (`sliceMs`): one, since a late-round tick alone can take several milliseconds. */
export const SLICE_STEP_TICKS = 1;
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
const OPS: readonly SeatCommand['type'][] = ['buy', 'sell', 'reroll', 'buyXp', 'shopLock', 'deploy', 'combine', 'equip', 'useConsumable'];
const CHOICES: readonly SeatCommand['type'][] = ['choose', 'anomalyTarget', 'anomalyReroll', 'rerollAugment'];
/** G2-4b (§26): a preparation summon moves only while its seat prepares; the rules refuse it after the roster lock. */
const PREPARATION_ONLY: readonly SeatCommand['type'][] = ['moveItemSummon'];
/** v15: an orb claim passes wherever an operation does; the rules claim it at once or queue it until the battle settles. */
const ORB: readonly SeatCommand['type'][] = ['claimOrb'];
export const ROOM_COMMAND_GATE: Readonly<Record<RoomPhase, ReadonlySet<SeatCommand['type']>>> = {
  waiting: new Set(), carousel: new Set(['carousel-pick']), preparation: new Set([...OPS, ...ORB, ...CHOICES, ...PREPARATION_ONLY]), choice: new Set([...OPS, ...ORB, ...CHOICES, ...PREPARATION_ONLY]),
  // The deadline, the automatic deployment and the freeze are one boundary no command may interleave with.
  frozen: new Set(), battle: new Set([...OPS, ...ORB]), 'awaiting-settlement': new Set([...OPS, ...ORB]), settlement: new Set([...OPS, ...ORB]), ended: new Set(),
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
    case 'moveItemSummon': return plain(moveItemSummon(state, command.itemInstanceId, command.cell));
    case 'buy': return buySharedUnit(pool, state, command.slot, command.generation);
    // P7-1: a unit in the carousel holding slot (`carousel.heldCarouselUnits`) is sold through the rules' own entry.
    case 'sell': return heldCarouselUnits(state).some(unit => unit.unitId === command.unitId)
      ? sellPendingCarouselUnit(pool, state, command.unitId) : sellSharedUnit(pool, state, command.unitId);
    case 'shopLock': return setSharedShopLock(pool, state, command.locked, command.generation);
    // The wire command has no generation (protocol unchanged); under the single-writer queue the seat's current shop is the expected one.
    case 'reroll': return rerollSharedShop(pool, state, state.shop.generation);
    case 'buyXp': return plain(buyXp(state));
    case 'combine': return plain(combineItems(state, command.a, command.b));
    case 'equip': return plain(equipItem(state, command.itemId, command.unitId, command.slot));
    case 'choose': return runSharedMatchCommand(pool, state, { type: 'choose', choiceId: command.choiceId, generation: command.generation, definitionId: command.definitionId });
    case 'anomalyTarget': return plain(selectAnomalyTarget(state, command.choiceId, command.generation, command.unitId));
    // v15: one card of the offer (optionIndex); the rules' shared-pool transaction, like every other choice command.
    case 'rerollAugment': return runSharedMatchCommand(pool, state, { type: 'rerollAugment', choiceId: command.choiceId, generation: command.generation, optionIndex: command.optionIndex });
    // v15: forwarded as is; the rules claim at once or queue it during the battle (settled with the round), and refuse the rest.
    case 'claimOrb': return runSharedMatchCommand(pool, state, { type: 'claimOrb', round: command.round, orbId: command.orbId });
    case 'anomalyReroll': return plain(rerollAnomaly(state, command.choiceId, command.generation));
    // §18.3: the tool commands share the operations' four-phase gate; the rules decide everything (see consumables.ts).
    case 'useConsumable': return useSeatConsumable(pool, state, command);
    // G1-P7: a carousel pick is a room-level transaction (the carousel state is the room's), never a seat command.
    case 'carousel-pick': return { ok: false, pool, state, reason: 'wrong-phase' };
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
  /**
   * v15: orb claims accepted while the round is `frozen` (the client already shows the battle; user rule: an orb may be
   * clicked any time during it). The seats are still in preparation there, where the rules would claim at once and change
   * the frozen inputs, so the room holds the claims in arrival order and hands each to the rules right after battle entry,
   * where they are queued like any claim during the battle (or claimed at once if the round settled immediately).
   */
  private frozenClaims: { readonly seatId: string; readonly command: Extract<SeatCommand, { type: 'claimOrb' }> }[] = [];
  private disposed = false;
  private extensions = 0;
  /** Clock time the current battle phase began (tick 0 of every battle's playback); null outside it. */
  private battleStartedAt: number | null = null;
  /** Live runs of this round's two-sided battles a live-bank seat changed its gold in, by battle id. */
  private readonly livePvp = new Map<string, LivePvpTrack>();
  /** PvE seats whose live combat was stepped during the battle phase, by seat id. */
  private readonly livePve = new Map<string, LivePveTrack>();
  private liveTimer: ClockHandle | null = null;
  /** The battle deadline passed while a live run was still going: the settlement waits for it. */
  private awaitingLive = false;
  /** A live run replaced one of this round's published battles: the round settles those, not the staged ones. */
  private liveReplaced = false;
  private readonly listeners = new Set<(state: RoomState) => void>();
  private readonly pvpMode: PvpMode;
  private readonly checkConservation: boolean;
  private readonly pairingPolicy: PairingPolicy;

  constructor(seats: readonly SeatSpec[], private readonly options: RoomOptions) {
    if (seats.length !== ROOM_CAPACITY) throw new RangeError(`a room has exactly ${ROOM_CAPACITY} seats`);
    if (new Set(seats.map(seat => seat.seatId)).size !== seats.length) throw new RangeError('duplicate seat id');
    validateSeed(options.seed);
    this.pvpMode = options.pvpMode ?? 'two-sided';
    this.checkConservation = options.assertPoolConservation ?? true;
    this.pairingPolicy = options.pairingPolicy ?? DEFAULT_PAIRING_POLICY;
    // §12.2 opening, in order: create the pool → import eight unpublished `createMatch(seed, shared-deferred)` openings by
    // the fixed seat index 0–7 (this also enables the server mode of §11.1; §18.2: each seat is built shared-deferred,
    // never solo-then-recoloured, and the first initializeSharedSeat freezes the room's orb layout in pool.orbLayout)
    // → one fair first refresh → publish once. Any refusal throws before anything is published, so the whole proposal is discarded.
    // P7-1 (§21.5 order): with the carousel each seat is a `createCarouselMatch` opening (a random one-cost hero), joined and
    // refreshed exactly like the plain opening; no carousel is created here, the first one is the rules' 2-4.
    const carousel = options.carousel;
    let rngState = options.seed >>> 0;
    const capacities = options.poolCapacities ? withOpeningCopies(options.poolCapacities, options.seed >>> 0, seats.map(seat => seat.seatId)) : null;
    let pool = createSharedPool(options.roomId, options.seed >>> 0, capacities ? { capacities } : {});
    const imported = seats.map((spec, index) => {
      const draw = nextRandom(rngState); rngState = draw.state;
      const opening = carousel ? carousel.createCarouselMatch(draw.word) : createMatch(draw.word, { mode: 'shared-deferred' });
      const joined = initializeSharedSeat(pool, opening, spec.seatId, index);
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
      deadlineAt: null, seats: seatStates, pairings: [], battleSeeds: {}, pairingHistory: {}, opponentCandidates: {}, carousel: null, carouselLedger: [], battles: [], settlements: [], ranking: null, fault: null, roomRevision: 0, rngState,
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
    return { timers: (this.timer === null ? 0 : 1) + (this.liveTimer === null ? 0 : 1), listeners: this.listeners.size, frozenInputs: this.frozenInputs.length, pendingSettlement: this.pendingSettlement !== null,
      resolving: this.resolution !== null };
  }

  /** waiting → first round. */
  start(): void {
    if (this.current.phase !== 'waiting') return;
    this.enterRound();
  }

  /**
   * Ends a running room with `fault` (G3: the lobby's watchdog closes a stalled or abandoned match). Same path as any
   * other fault: the round in progress is dropped, nothing is settled or ranked. False when the room is not running.
   */
  abort(fault: RoomFault): boolean {
    if (this.disposed || this.current.phase === 'waiting' || this.current.phase === 'ended') return false;
    this.fail(fault);
    return true;
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

  /**
   * v15 (MULTIPLAYER_CONTRACT, bot preparation entry): a bot-controlled seat claims every unclaimed orb through the rules'
   * `claimBotPreparationOrbs` (orbId order, rewards a claim unlocks included, no bot RNG), as one seat transaction before
   * its policy steps. Same control check as handleBot; only in the room's preparation with the seat itself preparing.
   * Nothing to claim, or a refusal, publishes nothing (a refusal returns the rules' reason, the seat stays as it was).
   */
  claimBotOrbs(seatId: string, controlEpoch: number): RoomCommandResult {
    const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
    if (!seat) return { ok: false, reason: 'unknown-seat', state: null };
    if (seat.controller === 'human' || seat.controlEpoch !== controlEpoch) return { ok: false, reason: 'control-revoked', state: seat.match };
    if (!seat.alive) return { ok: false, reason: 'seat-eliminated', state: seat.match };
    if (this.disposed || this.current.phase !== 'preparation' || seat.match.phase !== 'preparation') return { ok: false, reason: 'wrong-phase', state: seat.match };
    const claimed = claimBotPreparationOrbs(this.current.pool, seat.match);
    if (!claimed.ok) return { ok: false, reason: claimed.reason, state: seat.match };
    if (claimed.state === seat.match) return { ok: true, state: seat.match, events: [], seatRevision: seat.seatRevision, roomRevision: this.current.roomRevision };
    const result = this.withPendingResolved({ pool: claimed.pool, state: claimed.state, events: claimed.events });
    const seatRevision = seat.seatRevision + 1;
    this.commitSeat(seatId, result.state, result.pool);
    return { ok: true, state: result.state, events: result.events, seatRevision, roomRevision: this.current.roomRevision };
  }

  private apply(seat: SeatState, command: SeatCommand): RoomCommandResult {
    const seatId = seat.seatId;
    if (!seat.alive) return { ok: false, reason: 'seat-eliminated', state: seat.match };
    const phase = this.current.phase;
    const allowed = !this.disposed && ROOM_COMMAND_GATE[phase].has(command.type);
    if (!allowed) return phase === 'frozen' && command.type === 'claimOrb' && !this.disposed ? this.holdFrozenClaim(seat, command) : { ok: false, reason: 'wrong-phase', state: seat.match };
    if (command.type === 'carousel-pick') return this.pickCarousel(seat, command);
    // D11 live bank: a PvE seat fighting its live battle first catches up to the live tick, so the operation's gold
    // reaches the rules at that tick (published together with the operation, nothing if it is refused).
    let live: LiveCatchUp | null = null;
    try { live = phase === 'battle' ? this.pveCatchUp(seat) : null; }
    catch (error) { this.failLive(seatId, error); return { ok: false, reason: 'wrong-phase', state: seat.match }; }
    const applied = applySeatCommand(live?.pool ?? this.current.pool, live?.state ?? seat.match, command);
    // A refusal publishes nothing: pool, poolRevision, seat state and seatRevision stay the same references.
    if (!applied.ok) return { ok: false, reason: applied.reason, state: seat.match };
    if (live) this.livePve.get(seatId)!.commit(live.steps);
    const operated = live?.events.length ? { ...applied, events: [...live.events, ...applied.events] } : applied;
    // P7-1: a command that may have freed a bench slot or a board place (sell, deploy, buyXp, …) lets the rules move held
    // carousel units in, in the same publication.
    const result = this.withPendingResolved(operated);
    const seatRevision = seat.seatRevision + 1;
    this.commitSeat(seatId, result.state, result.pool);
    if (phase === 'battle' && result.state.gold !== seat.match.gold) this.sampleLiveBank(seatId, result.state.gold);
    if (phase === 'choice' && !this.aliveSeats().some(candidate => candidate.match.phase === 'choice')) { this.clearTimer(); this.afterChoiceWindow(); }
    return { ok: true, state: result.state, events: result.events, seatRevision, roomRevision: this.current.roomRevision };
  }

  /**
   * v15: a claim during `frozen` is held (see `frozenClaims`) and publishes nothing yet; the seat's private view shows it as
   * queued from battle entry on. Refused here only for what the seat's own loot view already answers: another round
   * (`stale-round`), an orb it does not hold unclaimed (`unknown-orb`) and one already queued or held (`already-claimed`).
   * Every other check is the rules' own when the claim is handed over; a refusal then leaves the seat as it was.
   */
  private holdFrozenClaim(seat: SeatState, command: Extract<SeatCommand, { type: 'claimOrb' }>): RoomCommandResult {
    if (command.round !== seat.match.round) return { ok: false, reason: 'stale-round', state: seat.match };
    const orb = (readLootView(seat.match).unclaimedOrbs ?? []).find(candidate => candidate.orbId === command.orbId);
    if (!orb) return { ok: false, reason: 'unknown-orb', state: seat.match };
    if (orb.queued || this.frozenClaims.some(held => held.seatId === seat.seatId && held.command.orbId === command.orbId)) return { ok: false, reason: 'already-claimed', state: seat.match };
    this.frozenClaims.push({ seatId: seat.seatId, command });
    return { ok: true, state: seat.match, events: [], seatRevision: seat.seatRevision, roomRevision: this.current.roomRevision };
  }
  /** Hands the claims held during `frozen` to the rules through the normal gate, in arrival order (battle or settlement phase). */
  private flushFrozenClaims(): void {
    const held = this.frozenClaims;
    this.frozenClaims = [];
    for (const { seatId, command } of held) {
      const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
      if (seat && seat.controller !== 'takeover') this.apply(seat, command);
    }
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
      // The rules already settled this round on the live seat at or before the freeze (an empty PvE board loses at once
      // when its battle starts; a supply round settles in its choice): that live seat, with whatever was operated since,
      // is the result. Its HP is the rules' own and must agree with the resolved battle.
      if (seat.match.roundResults.at(-1)?.round === state.round) {
        if (seat.match.playerHp !== expected) return { ok: false, detail: `seat ${seat.seatId}: live HP ${seat.match.playerHp} disagrees with the resolved battle ${seat.hp} - ${outcome.damage}` };
        seats.push(settled(seat.match, outcome.damage, null, []));
        continue;
      }
      // Neither in a live battle nor settled by the rules (a state the resolver left as it was): only an unchanged seat may pass.
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

  /**
   * Round entry. G1-P6: a PvP round only publishes each seat's possible opponents here (from the pairing history);
   * the real pairings and every battle seed are drawn at the freeze (`drawRound`), inside those candidates.
   */
  private enterRound(): void {
    const alive = this.aliveSeats();
    const info = readRoundInfo(alive[0]!.match);
    const state = this.current;
    const opponentCandidates = info.kind === 'pvp' ? planCandidates(alive.map(seat => seat.seatId), state.pairingHistory, this.pairingPolicy) : {};
    this.extensions = 0; this.releaseRound();
    this.replace({ ...state, round: info.ordinal, roundId: info.roundId, roundName: info.displayName, roundKind: info.kind, pairings: [], battleSeeds: {}, opponentCandidates, carousel: null, battles: [] });
    // G1-P7: the rules mark the carousel round on the seats (`opensCarousel`); every alive seat must agree on it.
    const rules = this.options.carousel;
    const roundIds = rules ? new Set(alive.map(seat => carouselRoundOf(rules, seat.match))) : new Set<CarouselRoundId | null>([null]);
    if (roundIds.size > 1) return this.fail({ kind: 'carousel-error', reason: `round-mismatch:${[...roundIds].join(',')}` });
    const carouselRound = [...roundIds][0] ?? null;
    if (rules && carouselRound !== null) return this.openCarousel(rules, carouselRound);
    this.continueRound();
  }

  /** After round entry (and its carousel, when it had one): the round's own choice phase, or what follows it. */
  private continueRound(): void {
    if (this.aliveSeats().some(seat => seat.match.phase === 'choice')) this.setPhase('choice', this.options.choiceMs);
    else this.afterChoiceWindow();
  }

  /* ---------------- G1-P7 carousel (MULTIPLAYER_CONTRACT §21) ---------------- */

  /**
   * Opens the carousel `roundId` (§21.1, §21.4 "创建"): the rules freeze the alive seats as participants
   * (`prepareCarouselParticipants`), then `createCarousel` draws it from the room rng; the pool, the room rng after it and
   * the carousel are published once. Logical time 0 is now; the phase runs to the rules' deadline plus the departure
   * (option B: never closed early), batches and the deadline are handled on their own timers.
   */
  private openCarousel(rules: CarouselRules, roundId: CarouselRoundId): void {
    const state = this.current;
    const prepared = rules.prepareCarouselParticipants(state.pool, this.aliveSeats().map(seat => ({ seatId: seat.seatId, state: seat.match })));
    if (!prepared.ok) return this.fail({ kind: 'carousel-error', reason: `participants:${prepared.reason}` });
    const created = rules.createCarousel(prepared.pool, roundId, { algorithm: 'lcg32-v1', state: state.rngState });
    if (!created.ok) return this.fail({ kind: 'carousel-error', reason: `create:${created.reason}` });
    const carousel = created.state;
    this.replace({ ...state, pool: carousel.pool, poolRevision: carousel.pool.revision, rngState: carousel.rngAfter.state,
      carousel: { state: carousel, startedAt: Math.ceil(this.options.clock.now()), auto: {} },
      carouselLedger: [...state.carouselLedger, { carouselId: carousel.id, seatId: null, events: created.events }] });
    this.setPhase('carousel', carousel.deadlineMs + CAROUSEL_DEPARTURE_MS);
    this.runCarousel();
  }

  /**
   * Brings the carousel up to the room clock in the contract's order (§21.2): logical time first, then every bot-controlled
   * seat released by then picks automatically; at the deadline every alive seat still without a unit is picked for, in
   * release order (a disconnected player as `disconnected`, everyone else as `timeout`). False when the rules refused
   * something (the room faulted).
   */
  private catchUpCarousel(rules: CarouselRules): boolean {
    const room = this.current.carousel!;
    const elapsed = Math.min(this.carouselElapsed(room.startedAt), room.state.deadlineMs);
    if (elapsed > room.state.elapsedMs) {
      const advanced = rules.advanceCarousel(room.state, elapsed);
      if (!advanced.ok) { this.fail({ kind: 'carousel-error', reason: `advance:${advanced.reason}` }); return false; }
      this.publishCarousel(advanced.state, null, advanced.events, null);
    }
    const atDeadline = elapsed >= room.state.deadlineMs;
    for (const seatId of room.state.releaseOrder) {
      const carousel = this.current.carousel!.state;
      const seat = this.current.seats.find(candidate => candidate.seatId === seatId);
      if (!seat || !seat.alive || carousel.status !== 'open' || carousel.receipts.some(receipt => receipt.seatId === seatId)) continue;
      const bot = seat.controller !== 'human';
      if (!atDeadline && !(bot && carouselReleased(carousel, seatId))) continue;
      const cause: CarouselAutoCause = bot ? 'bot' : seat.connected ? 'timeout' : 'disconnected';
      const result = rules.autoPickCarouselForSeat(this.current.pool, carousel, seat.match, seatId, cause);
      if (!result.ok) { this.fail({ kind: 'carousel-error', reason: `auto-pick:${cause}:${result.reason}`, seatId }); return false; }
      this.publishCarousel(result.carousel, { seatId, match: result.state }, result.events, cause);
    }
    return true;
  }
  /** Timer step: catch up, then wait for the next release, the deadline, or (after it) the end of the departure. */
  private runCarousel(): void {
    const rules = this.options.carousel;
    if (!rules || this.current.phase !== 'carousel' || !this.current.carousel) return;
    if (!this.catchUpCarousel(rules)) return;
    // The next step follows the logical time the rules processed, never a fresh clock read: a timer may fire a little early
    // (or the catch-up take a moment), and a later read would skip the batch released in between.
    const { state, startedAt } = this.current.carousel;
    if (state.elapsedMs >= state.deadlineMs) return this.armTimer(this.current.deadlineAt!, () => this.finishCarousel());
    const next = Math.min(state.deadlineMs, ...Object.values(state.releaseAtMs).filter(at => at > state.elapsedMs));
    this.armTimer(startedAt + next, () => this.runCarousel());
  }
  /** The rules take whole logical milliseconds (`advanceCarousel` refuses a fraction); a real clock may give one. */
  private carouselElapsed(startedAt: number): number { return Math.floor(this.options.clock.now() - startedAt); }
  private armTimer(at: number, run: () => void): void {
    this.clearTimer();
    this.timer = this.options.clock.schedule(at, () => { this.timer = null; run(); });
  }
  /**
   * End of the departure (§21.5): every seat's `completeCarouselForSeat` (x-4: the supply round's natural economy once, the
   * seat goes to settlement). One publication; the round goes on from the seats' own phases. Units held by the carousel are
   * placed and merged by the rules at the next preparation (`nextSharedRound`, §21.6), never here.
   */
  private finishCarousel(): void {
    const rules = this.options.carousel;
    if (this.current.phase !== 'carousel' || !rules) return;
    this.clearTimer();
    // A deadline timer that fired before the catch-up timer (same instant) still meets the automatic picks first.
    if (this.current.carousel && this.current.carousel.state.status === 'open' && !this.catchUpCarousel(rules)) return;
    const room = this.current.carousel;
    if (!room || room.state.status !== 'closed') return this.fail({ kind: 'carousel-error', reason: 'not-closed' });
    let carousel = room.state;
    const ledger: CarouselLedgerEntry[] = [];
    const matches = new Map<string, MatchState>(), events = new Map<string, MatchEvent[]>();
    for (const seat of this.aliveSeats()) {
      const done = rules.completeCarouselForSeat(carousel, seat.match, seat.seatId);
      if (!done.ok) return this.fail({ kind: 'carousel-error', reason: `complete:${done.reason}`, seatId: seat.seatId });
      carousel = done.state; matches.set(seat.seatId, done.match); events.set(seat.seatId, [...done.events]);
      if (done.events.length > 0) ledger.push({ carouselId: carousel.id, seatId: seat.seatId, events: done.events });
    }
    const pool = carousel.pool;
    this.replace({ ...this.current, pool, poolRevision: pool.revision, carousel: null, carouselLedger: [...this.current.carouselLedger, ...ledger],
      seats: this.current.seats.map(seat => {
        const match = matches.get(seat.seatId);
        if (!match || match === seat.match) return seat;
        const seatRevision = seat.seatRevision + 1;
        return { ...seat, match, seatRevision, serverEvents: { seatRevision, events: events.get(seat.seatId)! } };
      }) });
    this.continueRound();
  }
  /**
   * A player's pick (§21.1): the carousel id and revision it was decided on, then the clock catch-up (a pick at or after the
   * deadline meets the automatic picks first and then the rules' `carousel-closed`), then the rules' one pick-and-grant
   * transaction (`pickCarouselForSeat`: a failed grant leaves the slot untaken).
   */
  private pickCarousel(seat: SeatState, command: CarouselPickCommand): RoomCommandResult {
    const rules = this.options.carousel, room = this.current.carousel;
    if (!rules || !room) return { ok: false, reason: 'wrong-phase', state: seat.match };
    if (command.carouselId !== room.state.id || command.revision !== room.state.revision) return { ok: false, reason: 'stale-carousel', state: seat.match };
    if (!this.catchUpCarousel(rules)) return { ok: false, reason: 'wrong-phase', state: seat.match };
    const carousel = this.current.carousel!.state;
    const latest = this.current.seats.find(candidate => candidate.seatId === seat.seatId)!;
    if (this.carouselElapsed(this.current.carousel!.startedAt) >= carousel.deadlineMs) return { ok: false, reason: 'carousel-closed', state: latest.match };
    const result = rules.pickCarouselForSeat(this.current.pool, carousel, latest.match, seat.seatId, command.slot);
    if (!result.ok) return { ok: false, reason: result.reason, state: latest.match };
    this.publishCarousel(result.carousel, { seatId: seat.seatId, match: result.state }, result.events, null);
    const after = this.current.seats.find(candidate => candidate.seatId === seat.seatId)!;
    const matchEvents = result.events.filter((event): event is MatchEvent => 'domain' in event);
    return { ok: true, state: result.state, events: matchEvents, seatRevision: after.seatRevision, roomRevision: this.current.roomRevision };
  }
  /**
   * Publishes one carousel transaction (§21.1 "原子发布"): the carousel, the pool it carries, the granted seat's state and
   * every event it returned (into the carousel ledger and the seat's server events), in one room publication.
   */
  private publishCarousel(carousel: CarouselState, granted: { readonly seatId: string; readonly match: MatchState } | null, events: readonly (CarouselEvent | MatchEvent)[], auto: CarouselAutoCause | null): void {
    const room = this.current.carousel!;
    const seatId = granted?.seatId ?? null;
    const matchEvents = events.filter((event): event is MatchEvent => 'domain' in event);
    this.replace({ ...this.current, pool: carousel.pool, poolRevision: carousel.pool.revision,
      carousel: { ...room, state: carousel, auto: auto && seatId ? { ...room.auto, [seatId]: auto } : room.auto },
      carouselLedger: events.length > 0 ? [...this.current.carouselLedger, { carouselId: carousel.id, seatId, events }] : this.current.carouselLedger,
      seats: granted === null ? this.current.seats : this.current.seats.map(candidate => {
        if (candidate.seatId !== granted.seatId) return candidate;
        const seatRevision = candidate.seatRevision + 1;
        return { ...candidate, match: granted.match, seatRevision, serverEvents: { seatRevision, events: matchEvents } };
      }) });
  }
  /**
   * §21.5–21.6 "进入 preparation 时": each seat still holding carousel units gets the rules' placement, one seat transaction
   * each (`nextSharedRound` already placed what it could at the round entry; this covers a seat that reached preparation
   * through its choice phase).
   */
  private resolvePendingOnEntry(): void {
    for (const seat of this.aliveSeats()) {
      const resolved = this.withPendingResolved({ pool: this.current.pool, state: seat.match, events: [] as readonly MatchEvent[] });
      if (resolved.state === seat.match) continue;
      const seatRevision = seat.seatRevision + 1;
      this.replace({ ...this.current, pool: resolved.pool, poolRevision: resolved.pool.revision,
        seats: this.current.seats.map(candidate => candidate.seatId === seat.seatId ? { ...candidate, match: resolved.state, seatRevision, serverEvents: { seatRevision, events: resolved.events } } : candidate) });
    }
  }
  /**
   * §21.6: in preparation, units in the holding slot are moved to the bench or the board (and merged) by the rules'
   * `resolvePendingCarouselUnits` whenever the seat may have room; the room only asks, never decides where a unit goes
   * or whether it merges. A refusal (e.g. a locked combat roster) or nothing to move leaves the transaction as it was.
   */
  private withPendingResolved<T extends { readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[] }>(result: T): T {
    const rules = this.options.carousel;
    if (!rules || heldCarouselUnits(result.state).length === 0 || result.state.phase !== 'preparation') return result;
    const resolved = rules.resolvePendingCarouselUnits(result.pool, result.state);
    if (!resolved.ok || resolved.state === result.state) return result;
    return { ...result, pool: resolved.pool, state: resolved.state, events: [...result.events, ...resolved.events] };
  }

  /**
   * At the freeze, before any input is built: PvP pairings (inside the candidates shown since round entry) and one
   * explicit combat seed per battle, all from the room rng in that order; a resolver retry reuses the seeds (§10.6
   * item 1). The pairings join the history (PvE and supply rounds add nothing). Published once, inside `frozen`.
   */
  private drawRound(): void {
    const state = this.current;
    const alive = this.aliveSeats();
    const prefix = `${state.roomId}:r${state.round}`;
    const plan = state.roundKind === 'pvp' ? planPairings(alive.map(seat => seat.seatId), state.rngState, prefix, state.pairingHistory, this.pairingPolicy) : { pairings: [], rngState: state.rngState };
    const battleIds = plan.pairings.length > 0 ? [...new Set(plan.pairings.map(pairing => pairing.battleId))] : alive.map(seat => `${prefix}:${seat.seatId}`);
    let rngState = plan.rngState;
    const battleSeeds: Record<string, number> = {};
    for (const battleId of battleIds) { const draw = nextRandom(rngState); rngState = draw.state; battleSeeds[battleId] = draw.word >>> 0; }
    this.replace({ ...state, pairings: plan.pairings, battleSeeds, rngState, pairingHistory: recordPairings(state.pairingHistory, plan.pairings) });
  }

  /** Every alive seat has left the choice phase: decide what the round needs next. */
  private afterChoiceWindow(): void {
    const alive = this.aliveSeats();
    const committed = this.current.settlements.includes(`${this.current.roomId}:round-${this.current.round}`);
    if (committed) return this.setPhase('settlement', this.options.settlementMs);
    if (alive.every(seat => seat.match.phase === 'preparation')) { this.resolvePendingOnEntry(); return this.setPhase('preparation', this.options.preparationMs); }
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
    this.drawRound();
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

  /**
   * One slice: advance the current battle by at most `sliceTicks`; the next slice is scheduled until every battle finished.
   * A PvP job is one resumable `startTwoSidedBattle` task (§19, two-sided-resolver.ts) and the network server's wrapper
   * then builds its replays as `startCombatReplay` tasks, both cut at this same budget.
   */
  private resolveSlice(): void {
    const resolution = this.resolution;
    if (this.disposed || !resolution || this.current.phase !== 'frozen') return;
    const input = this.frozenInputs[resolution.results.length]!;
    try {
      resolution.job ??= startBattleJob(this.options.resolver, input, resolution.pool);
      const result = this.advanceSlice(resolution.job);
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

  /** One slice of `job`: `sliceTicks` at once, or, with `sliceMs`, steps of SLICE_STEP_TICKS until the budget runs out. */
  private advanceSlice(job: BattleJob): BattleResult | null {
    const ticks = this.options.sliceTicks ?? Number.POSITIVE_INFINITY, budgetMs = this.options.sliceMs;
    if (budgetMs === undefined) return job.advance(ticks);
    const clock = this.options.clock, deadline = clock.now() + budgetMs;
    for (let spent = 0; ;) {
      const step = Math.min(SLICE_STEP_TICKS, ticks - spent);
      const result = job.advance(step);
      spent += step;
      if (result || spent >= ticks || clock.now() >= deadline) return result;
    }
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
    if (longest === 0) { this.commitPending(); return this.flushFrozenClaims(); }
    const tickMs = this.aliveSeats()[0]!.match.tickMs;
    this.battleStartedAt = this.options.clock.now();
    this.setPhase('battle', longest * tickMs + this.options.battleTailMs);
    this.flushFrozenClaims();
  }

  /* ---------------- D11 live bank during the battle phase ---------------- */

  private get tickMs(): number { return this.aliveSeats()[0]?.match.tickMs ?? 50; }
  /** The tick a live run may reach now: the battle clock's tick plus the lead. */
  private liveTarget(): number {
    const started = this.battleStartedAt ?? this.options.clock.now();
    return Math.floor((this.options.clock.now() - started) / this.tickMs) + LIVE_BANK_LEAD_TICKS;
  }

  /**
   * The seat's PvE live combat stepped to the live tick (not yet published), or null when the seat does not fight a
   * live battle now. Its first catch-up starts the seat's track from the frozen run's opening ledger.
   */
  private pveCatchUp(seat: SeatState): LiveCatchUp | null {
    if (seat.match.phase !== 'combat') return null;
    let track = this.livePve.get(seat.seatId);
    if (!track) {
      const frozen = this.frozenOutcome(seat.seatId);
      if (!frozen?.combat) return null;
      track = new LivePveTrack(seat.seatId, seat.match, frozen.combat.events);
      this.livePve.set(seat.seatId, track);
    }
    return track.catchUp(this.current.pool, seat.match, this.liveTarget());
  }
  /** This seat's outcome in the round's published (frozen) placeholder results. */
  private frozenOutcome(seatId: string): BattleSeatOutcome | null {
    for (const battle of this.current.battles) {
      if (battle.kind !== 'placeholder') continue;
      const outcome = battle.outcomes.find(candidate => candidate.seatId === seatId);
      if (outcome) return outcome;
    }
    return null;
  }

  /** A live-bank seat's gold changed during the battle: its two-sided battle samples it at the live tick. */
  private sampleLiveBank(seatId: string, gold: number): void {
    const reads = this.options.liveBankSeats;
    if (!reads || this.pvpMode !== 'two-sided') return;
    const battle = this.current.battles.find(candidate => candidate.kind === 'two-sided' && candidate.participants.includes(seatId));
    if (!battle || battle.kind !== 'two-sided') return;
    const target = this.liveTarget();
    let track = this.livePvp.get(battle.battleId);
    if (!track) {
      const envelope = this.frozenInputs.find(input => input.battleId === battle.battleId);
      // A battle the playback already finished cannot change any more.
      if (!envelope || target > battle.battle.terminal.tick || !reads(envelope).includes(seatId)) return;
      try { track = new LivePvpTrack(envelope, battle); }
      catch (error) { return this.failLive(battle.battleId, error); }
      this.livePvp.set(battle.battleId, track);
    } else if (!reads(track.envelope).includes(seatId)) return;
    track.sample(seatId, gold, target);
    this.scheduleLive();
  }

  private scheduleLive(): void {
    if (this.liveTimer !== null || ![...this.livePvp.values()].some(track => !track.result)) return;
    const clock = this.options.clock;
    // Half the lead: a live run never falls behind the playback it feeds.
    this.liveTimer = clock.schedule(clock.now() + Math.max(1, Math.floor(LIVE_BANK_LEAD_TICKS / 2)) * this.tickMs, () => { this.liveTimer = null; this.liveSlice(); });
  }

  /** One live slice: every unfinished live run steps to the live tick; a finished one replaces its frozen battle. */
  private liveSlice(): void {
    if (this.disposed || this.current.phase !== 'battle') return;
    const target = this.liveTarget(), budget = Number.isFinite(this.options.sliceTicks ?? Infinity) ? this.options.sliceTicks! : 1200;
    for (const track of this.livePvp.values()) {
      if (track.result) continue;
      try { if (track.advance(target, budget)) this.adoptLive(track); }
      catch (error) { return this.failLive(track.battleId, error); }
    }
    if (this.current.phase !== 'battle') return;
    this.scheduleLive();
    if (this.awaitingLive && [...this.livePvp.values()].every(track => track.result)) this.armBattleEnd();
  }

  /** Publishes a finished live run's result in place of the frozen one, and keeps the battle phase long enough to show it. */
  private adoptLive(track: LivePvpTrack): void {
    const adopted = track.adopted;
    if (!adopted) return;
    this.replace({ ...this.current, battles: this.current.battles.map(battle => battle.battleId === adopted.battleId ? adopted : battle) });
    this.liveReplaced = true;
    if (!this.awaitingLive) this.armBattleEnd();
  }

  /** (Re-)arms the battle deadline at the end of the longest published battle's playback, never before now. */
  private armBattleEnd(): void {
    this.awaitingLive = false;
    const ticks = Math.max(0, ...this.current.battles.flatMap(result => result.kind === 'placeholder'
      ? result.outcomes.map(outcome => outcome.combat ? outcome.combat.terminal.tick + 1 : 0) : [result.battle.terminal.tick + 1]));
    const end = Math.max(this.options.clock.now(), (this.battleStartedAt ?? 0) + ticks * this.tickMs + this.options.battleTailMs);
    if (this.timer !== null && this.current.deadlineAt === end) return;
    this.clearTimer();
    this.replace({ ...this.current, deadlineAt: end });
    this.timer = this.options.clock.schedule(end, () => this.onDeadline());
  }

  /**
   * Battle deadline with live runs: a run still going keeps the phase open (it is fed by the battle clock, so a seat
   * can still change its gold); PvE live combats are finished now (nothing can operate on them in between) and
   * replace their frozen outcome when they differ. Returns true while the settlement must wait.
   */
  private settleLive(): boolean {
    if ([...this.livePvp.values()].some(track => !track.result)) {
      this.awaitingLive = true;
      this.replace({ ...this.current, deadlineAt: (this.battleStartedAt ?? 0) + 1201 * this.tickMs + this.options.battleTailMs });
      this.scheduleLive();
      return true;
    }
    for (const [seatId, track] of this.livePve) {
      const seat = this.current.seats.find(candidate => candidate.seatId === seatId)!;
      const frozen = this.frozenOutcome(seatId);
      if (!seat.alive || !frozen || seat.match.roundResults.at(-1)?.round !== this.current.round && seat.match.phase !== 'combat') continue;
      let settled = seat.match;
      if (settled.phase === 'combat') {
        const finished = track.catchUp(this.current.pool, settled, Number.MAX_SAFE_INTEGER);
        track.commit(finished.steps);
        this.commitSeat(seatId, finished.state, finished.pool);
        settled = finished.state;
      }
      const outcome = track.outcome(settled, settled.combat!, frozen);
      if (!outcome) continue;
      this.replace({ ...this.current, battles: this.current.battles.map(battle => battle.kind === 'placeholder' && battle.outcomes.some(candidate => candidate.seatId === seatId) ? withOutcome(battle, outcome) : battle) });
      this.liveReplaced = true;
    }
    return false;
  }

  private failLive(battleId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.fail(error instanceof BattleResolveError ? { kind: 'resolver-error', battleId, message, reason: error.reason } : { kind: 'resolver-error', battleId, message });
  }
  private clearLive(): void {
    if (this.liveTimer !== null) { this.options.clock.cancel(this.liveTimer); this.liveTimer = null; }
    this.livePvp.clear(); this.livePve.clear(); this.battleStartedAt = null; this.awaitingLive = false; this.liveReplaced = false;
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
    try { if (this.settleLive()) return; }
    catch (error) { return this.failLive(`${this.current.roomId}:r${this.current.round}`, error); }
    const settlement = this.pendingSettlement;
    // D11 live bank: a live run replaced published battles, so the round settles those, never the staged ones.
    const replaced = this.liveReplaced;
    this.pendingSettlement = null;
    this.clearLive();
    if (settlement && !this.current.settlements.includes(settlement.settlementId)) {
      let commit: CommitResult = replaced ? { ok: false, reason: 'stale-seat', state: this.current } : this.commitSettlement(settlement);
      // Operations during the battle changed live seats: settle again on the latest states (§15.2), never on the staged ones.
      if (!commit.ok && commit.reason === 'stale-seat') {
        const plan = this.planSettlement(replaced ? this.current.battles : settlement.results);
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
      // Name the seat the rules refuse to advance on its own (a dry run, nothing is published, never used instead of the
      // batch, §18.2); the batch reason stays the rules' code. A shared-bound seat may be refused or rejected outright here.
      const refuses = (seat: SeatState) => { try { return !nextRound(seat.match, seat.match.round).ok; } catch { return true; } };
      const stuck = alive.find(refuses) ?? alive[0]!;
      return this.fail({ kind: 'seat-stuck', seatId: stuck.seatId, reason: batch.reason });
    }
    const advanced = new Map(alive.map((seat, position) => [seat.seatId, batch.states[position]!] as const));
    // P7-1 (§21.6): the round entry may place and merge carousel units; its events are published with the seats they produced.
    const entered = new Map(batch.events.map(entry => [entry.seatId, entry.events] as const));
    this.replace({ ...this.current, pool: batch.pool, poolRevision: batch.pool.revision,
      seats: this.current.seats.map(seat => {
        const match = advanced.get(seat.seatId);
        if (!match) return seat;
        const seatRevision = seat.seatRevision + 1;
        return { ...seat, match, seatRevision, serverEvents: { seatRevision, events: entered.get(seat.seatId) ?? [] } };
      }) });
    this.enterRound();
  }

  private onDeadline(): void {
    this.timer = null;
    switch (this.current.phase) {
      case 'preparation': return this.freezeAndResolve();
      case 'choice': if (this.applyTimeouts('choice')) this.afterChoiceWindow(); return;
      case 'battle': return this.commitPending();
      case 'settlement': return this.advanceRound();
      case 'carousel': return this.finishCarousel();
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
  private releaseRound(): void { this.clearLive(); this.frozenClaims = []; this.pendingSettlement = null; this.frozenInputs = []; this.resolvedPool = null; this.resolution = null; this.lockedPool = null; this.lockedSeats = new Map(); this.deployed = new Map(); }
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
/**
 * Debug/test `poolCapacities` with random openings: the rules give each seat a random one-cost hero from the pool
 * (`selectOpeningUnit(pool seed, seatId)`, MULTIPLAYER_CONTRACT), and a pool without that copy refuses the seat with
 * `pool-empty`. Each opening hero is raised to at least the number of seats opening with it; everything else is kept.
 * The selector is only read here to size the fixture, the opening itself stays the rules' `initializeSharedSeat`.
 */
export function withOpeningCopies(capacities: Readonly<Record<string, number>>, seed: number, seatIds: readonly string[]): Readonly<Record<string, number>> {
  const openings: Record<string, number> = {};
  for (const seatId of seatIds) { const hero = selectOpeningUnit(seed, seatId); openings[hero] = (openings[hero] ?? 0) + 1; }
  const result: Record<string, number> = { ...capacities };
  for (const [hero, count] of Object.entries(openings)) result[hero] = Math.max(result[hero] ?? 0, count);
  return result;
}

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
    // G23-SERVER-FACTS: the rules' own battle facts, forwarded verbatim (a mirror copy has none and never settles).
    ...(proposal.g23Facts ? { g23Facts: proposal.g23Facts } : {}),
  };
}

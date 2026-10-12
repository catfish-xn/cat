/**
 * Real two-sided PvP through the rules' T2 entry (work order B3, contract §10.6).
 *
 * Per pairing the two frozen seats are snapshotted, compiled and run ONCE through
 * `resolveTwoSidedBattle`; `proposeSettlement` turns the result into two uncommitted
 * proposals. Nothing here settles anything: no HP, income, growth or round record moves.
 * The room parks the proposals until the rules' commit entry (T3) exists.
 *
 * Mirror pairings (odd survivor count): the real participant is side A, the frozen copy of
 * the source seat is side B and `mirrorOfSeatId` names it, so the rules mark B's proposal
 * `settlementEligible=false` (damage 0, growth []). The source seat is not a participant.
 *
 * PvE and supply rounds never reach this entry (§10.6 item 5); they go to the inner resolver.
 */
import {
  BattleValidationError, compileBattle, proposeSettlement, resolveTwoSidedBattle, snapshotForBattle, startTwoSidedCombatWithEvents, stepCombat,
  type BattleIdentity, type BattleInput as RulesBattleInput, type CombatState, type LedgerCombatEvent, type PlayerBattleSnapshot,
} from '../../server-entry';
import { BattleResolveError, PlaceholderBattleResolver, type BattleResolver } from './battle-resolver';
import type { BattleFrame, BattleInput, BattleResult, BattleSeatInput, RulesBattleResult, TwoSidedBattleResult } from './types';

export class TwoSidedBattleResolver implements BattleResolver {
  /** @param nonPvp resolves PvE and supply rounds (each seat on its own); the placeholder by default. */
  constructor(private readonly nonPvp: BattleResolver = new PlaceholderBattleResolver()) {}
  resolveBattle(input: BattleInput): BattleResult {
    if (input.roundKind !== 'pvp') return this.nonPvp.resolveBattle(input);
    return resolveTwoSidedPvp(input);
  }
}

/** A rules refusal (BattleValidationError) becomes a resolver fault carrying the stable reason; the round never commits. */
function guarded<T>(subject: string, run: () => T): T {
  try { return run(); }
  catch (error) {
    if (error instanceof BattleValidationError) throw new BattleResolveError(subject, `battle-validation:${error.reason}`);
    throw error;
  }
}

/** §10.6 pseudo-code, verbatim in structure: snapshot both sides, compile with the explicit seed and identity, resolve once, propose. */
export function resolveTwoSidedPvp(envelope: BattleInput): TwoSidedBattleResult {
  const [first, second] = envelope.seats;
  if (!first) throw new BattleResolveError(envelope.battleId, 'no-participant');
  const opponent: BattleSeatInput | undefined = envelope.mirrorOf ?? second;
  if (!opponent) throw new BattleResolveError(envelope.battleId, 'missing-opponent');
  if (envelope.mirrorOf !== null && second) throw new BattleResolveError(envelope.battleId, 'mirror-with-two-seats');
  if (envelope.seats.length > 2) throw new BattleResolveError(envelope.battleId, 'too-many-seats');
  if (!Number.isInteger(envelope.battleSeed) || envelope.battleSeed < 0 || envelope.battleSeed > 0xffffffff) throw new BattleResolveError(envelope.battleId, 'invalid-seed');
  if (!Number.isSafeInteger(envelope.maxSteps) || envelope.maxSteps < 1) throw new BattleResolveError(envelope.battleId, 'invalid-budget');
  // The envelope's round must be the round both preparation states are in (§10.6 item 1).
  for (const side of [first, opponent]) {
    if (side.state.roundDefinitionId !== envelope.roundId) throw new BattleResolveError(side.seatId, `round-mismatch:${side.state.roundDefinitionId}`);
  }
  const a: PlayerBattleSnapshot = guarded(first.seatId, () => snapshotForBattle(first.state, first.seatId));
  const b: PlayerBattleSnapshot = guarded(opponent.seatId, () => snapshotForBattle(opponent.state, opponent.seatId));
  const identity: BattleIdentity = envelope.mirrorOf === null ? { battleId: envelope.battleId } : { battleId: envelope.battleId, mirrorOfSeatId: envelope.mirrorOf.seatId };
  const frozen = guarded(envelope.battleId, () => compileBattle(a, b, envelope.battleSeed, identity));
  const battle = guarded(envelope.battleId, () => resolveTwoSidedBattle(frozen, envelope.maxSteps));
  const proposals = guarded(envelope.battleId, () => proposeSettlement(battle));
  const frames = guarded(envelope.battleId, () => toFrames(frozen, battle, envelope.maxSteps));
  return {
    kind: 'two-sided', battleId: envelope.battleId, round: envelope.round, roomRevision: envelope.roomRevision,
    participants: envelope.seats.map(seat => seat.seatId), battle, proposals, frames,
  };
}

/**
 * Per-tick playback frames of this one battle (§10.6 item 3): the frozen input replayed through the
 * events-bearing start entry and `stepCombat`. The ledger events come from the authoritative result,
 * grouped by tick, so playback and settlement share one account; a divergence is a fault, not a guess.
 */
function toFrames(frozen: RulesBattleInput, battle: RulesBattleResult, maxSteps: number): readonly BattleFrame[] {
  const byTick = new Map<number, LedgerCombatEvent[]>();
  for (const event of battle.events) { const bucket = byTick.get(event.tick); if (bucket) bucket.push(event); else byTick.set(event.tick, [event]); }
  const start = startTwoSidedCombatWithEvents(frozen);
  const frames: BattleFrame[] = [{ state: start.state, events: byTick.get(start.state.tick) ?? [] }];
  let current: CombatState = start.state, steps = 0;
  while (current.status === 'running' && steps < maxSteps) {
    current = stepCombat(current).state; steps++;
    frames.push({ state: current, events: byTick.get(current.tick) ?? [] });
  }
  const terminal = battle.terminal;
  const consistent = current.status === 'finished' && current.tick === terminal.tick && current.result === terminal.result
    && frames.reduce((count, frame) => count + frame.events.length, 0) === battle.events.length;
  if (!consistent) throw new BattleResolveError(battle.battleId, 'frame-divergence');
  return frames;
}

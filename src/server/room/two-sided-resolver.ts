/**
 * Real two-sided PvP through the rules' T2 entry (work order B3, contract §10.6).
 *
 * Per pairing the two frozen seats are snapshotted, compiled and run ONCE as a resumable
 * `startTwoSidedBattle` task (§19); `proposeSettlement` turns the result into two uncommitted
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
  BattleValidationError, compileBattle, proposeSettlement, snapshotForBattle, startTwoSidedBattle,
  type BattleIdentity, type BattleReplayTask, type BattleTask, type PlayerBattleSnapshot, type SharedPoolState,
} from '../../server-entry';
import { BattleResolveError, PlaceholderBattleResolver, startBattleJob, type BattleJob, type BattleResolver, type ReplayCapture } from './battle-resolver';
import { primeCombatReplay } from './projection';
import type { BattleInput, BattleResult, BattleSeatInput, TwoSidedBattleResult } from './types';

export class TwoSidedBattleResolver implements BattleResolver {
  /**
   * @param nonPvp resolves PvE and supply rounds (each seat on its own); the placeholder by default.
   * @param options.captureReplay PvP battles whose participants it accepts record their replay during the first pass.
   */
  constructor(private readonly nonPvp: BattleResolver = new PlaceholderBattleResolver(), private readonly options: { readonly captureReplay?: ReplayCapture } = {}) {}
  /** PvP proposals award nothing and leave the pool alone; PvE/supply may award units, so the pool goes to the inner resolver. */
  resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult {
    if (input.roundKind !== 'pvp') return this.nonPvp.resolveBattle(input, pool);
    return resolveTwoSidedPvp(input, this.options.captureReplay ?? null);
  }
  /** Sliced form (B8, §19): the rules' battle task advances by the slice budget; the proposals follow in the slice that finishes it. */
  startBattle(input: BattleInput, pool: SharedPoolState): BattleJob {
    if (input.roundKind !== 'pvp') return startBattleJob(this.nonPvp, input, pool);
    return twoSidedJob(input, this.options.captureReplay ?? null);
  }
}

/** A rules refusal (BattleValidationError) becomes a resolver fault carrying the stable reason; the round never commits. */
function guarded<T>(subject: string, run: () => T): T {
  try { return run(); }
  catch (error) { throw asResolveError(subject, error); }
}
function asResolveError(subject: string, error: unknown): unknown {
  return error instanceof BattleValidationError ? new BattleResolveError(subject, `battle-validation:${error.reason}`) : error;
}

/** §10.6 pseudo-code, verbatim in structure: snapshot both sides, compile with the explicit seed and identity, resolve once, propose. */
export function resolveTwoSidedPvp(envelope: BattleInput, capture: ReplayCapture | null = null): TwoSidedBattleResult {
  const job = twoSidedJob(envelope, capture);
  for (;;) { const result = job.advance(envelope.maxSteps); if (result) return result; }
}

/**
 * resolveTwoSidedPvp as a job (§19): the envelope is checked, both sides snapshotted and compiled on the first advance,
 * then one `startTwoSidedBattle` task advances by at most `maxTicks` per call and is never recreated. The envelope's
 * `maxSteps` stays the battle's whole budget: a battle still running after it fails `step-limit-exceeded`, as the
 * synchronous entry did. A refusal at any point throws; nothing partial is returned.
 */
function twoSidedJob(envelope: BattleInput, capture: ReplayCapture | null): { advance(maxTicks: number): TwoSidedBattleResult | null } {
  let task: BattleTask | BattleReplayTask | null = null, used = 0;
  return {
    advance(maxTicks: number): TwoSidedBattleResult | null {
      task ??= startTask(envelope, capture?.(envelope.seats.map(seat => seat.seatId)) ?? false);
      // The room passes Infinity when it does not slice; the rules take a positive safe integer within the budget.
      const budget = Math.min(maxTicks, envelope.maxSteps - used);
      const battle = guarded(envelope.battleId, () => task!.advance(budget));
      used += budget;
      if (!battle) {
        if (used >= envelope.maxSteps) throw new BattleResolveError(envelope.battleId, 'battle-validation:step-limit-exceeded');
        return null;
      }
      const proposals = guarded(envelope.battleId, () => proposeSettlement(battle));
      const result: TwoSidedBattleResult = {
        kind: 'two-sided', battleId: envelope.battleId, round: envelope.round, roomRevision: envelope.roomRevision,
        participants: envelope.seats.map(seat => seat.seatId), battle, proposals,
      };
      // The frames the rules recorded on this very run; side B's view is still mirrored from them at push time.
      const finished = task;
      const replay = 'replay' in finished ? finished.replay() : null;
      if (replay) primeCombatReplay(result, replay);
      return result;
    },
  };
}

function startTask(envelope: BattleInput, captureReplay: boolean): BattleTask | BattleReplayTask {
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
  return guarded(envelope.battleId, () => startTwoSidedBattle(frozen, { captureReplay }));
}

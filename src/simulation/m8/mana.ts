import type { CastReceipt, ManaOutcome, ManaRequest, ManaState } from './contracts';
import { integer, safeNumber } from './stats';
const natural = (n: number) => { integer(n); if (n < 0) throw new RangeError('Negative mana value'); return n; };
export function validateManaDefinition(value: { initialMana: number; maxMana: number; unitKind?: 'neutral' | 'champion' }): void {
  natural(value.initialMana); natural(value.maxMana);
  if (value.initialMana > value.maxMana || value.maxMana === 0 && value.unitKind !== 'neutral') throw new RangeError('Invalid mana definition');
}
export function validateManaState(state: ManaState): void {
  natural(state.current); natural(state.maximum); natural(state.lockedUntilTick);
  if (!state.unitId || state.current > state.maximum) throw new RangeError('Invalid mana state');
}
/** Ordinary gain has no knowledge of ability cost, recursion, or special resources. */
export function resolveMana(state: ManaState, request: ManaRequest, tick: number, cast?: CastReceipt): ManaOutcome {
  validateManaState(state); natural(tick); natural(request.amount);
  if (request.targetId !== state.unitId) throw new RangeError('Mana target mismatch');
  const bypass = request.bypassLock === 'this-cast-refund';
  if (request.reason === 'cast-refund' || bypass) {
    if (!cast?.completed || request.reason !== 'cast-refund' || request.castActionSeq !== cast.actionSeq
      || cast.source.ownerId !== state.unitId || cast.targetsSampledAtTick !== tick) throw new RangeError('Unbound cast refund');
  } else if (request.castActionSeq !== null) throw new RangeError('Unexpected cast binding');
  const blocked = tick < state.lockedUntilTick && !bypass ? request.amount : 0;
  const applied = Math.min(request.amount - blocked, state.maximum - state.current);
  return { ...request, before: state.current, blocked, applied, overflow: request.amount - blocked - applied, after: state.current + applied };
}
export function damageMana(actualHpLoss: number): number {
  return Math.min(20, safeNumber(BigInt(natural(actualHpLoss)) * 3n / 100n));
}
/** A cost quote can later come from another resource policy; zero-max never casts. */
export function planManaCost(state: ManaState, requested: number): { actualManaSpent: number; after: ManaState } | null {
  validateManaState(state); natural(requested);
  return state.maximum === 0 || state.current < requested ? null : { actualManaSpent: requested, after: { ...state, current: state.current - requested } };
}
export function completeCast(plan: CastReceipt, actualManaSpent: number): CastReceipt {
  natural(actualManaSpent); natural(plan.actionSeq); natural(plan.targetsSampledAtTick);
  if (!plan.completed || plan.refundedMana !== 0) throw new RangeError('Invalid new completed cast');
  return { ...plan, actualManaSpent, targetIds: [...plan.targetIds], completionCell: { ...plan.completionCell } };
}
export function refundCast(state: ManaState, request: ManaRequest, receipt: CastReceipt, tick: number): { receipt: CastReceipt; outcome: ManaOutcome } {
  const outcome = resolveMana(state, request, tick, receipt);
  return { outcome, receipt: { ...receipt, refundedMana: safeNumber(integer(receipt.refundedMana) + integer(outcome.applied)) } };
}

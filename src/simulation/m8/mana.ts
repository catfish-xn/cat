import type { CastReceipt, ManaOutcome, ManaRequest, ManaState } from './contracts';
import { integer, safeNumber } from './stats';
import { S13_COMBAT_RULES } from '../s13-rules';
const natural = (n: number) => { integer(n); if (n < 0) throw new RangeError('Negative mana value'); return n; };
export function validateManaDefinition(value: { initialMana: number; maxMana: number; unitKind?: 'neutral' | 'champion'; abilityId?: string }): void {
  natural(value.initialMana); natural(value.maxMana);
  if (value.initialMana > value.maxMana || value.maxMana === 0 && value.unitKind !== 'neutral' && value.abilityId !== 'amumu-ability' && value.abilityId !== 'g24-voidspawn-ability' && value.abilityId !== 'b5-voidling-ability' && value.abilityId !== 'training-dummy-ability' && value.abilityId !== 'tower-dummy-ability' && !['s13-crab-ability','s13-wolf-ability','s13-mini-ability'].includes(value.abilityId ?? '')) throw new RangeError('Invalid mana definition');
}
export function validateManaState(state: ManaState): void {
  natural(state.current); natural(state.maximum); natural(state.lockedUntilTick);
  if (!state.unitId || state.maximum === 0 && state.current !== 0) throw new RangeError('Invalid mana state');
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
  const applied = state.maximum === 0 ? 0 : request.reason === 'damage'
    ? Math.min(request.amount - blocked, Math.max(0, state.maximum - state.current)) : request.amount - blocked;
  return { ...request, before: state.current, blocked, applied, overflow: request.amount - blocked - applied, after: safeNumber(BigInt(state.current) + BigInt(applied)) };
}
/** One packet, in hundredths of mana; caller sums before the tick's one floor. */
export function damageMana(beforeMitigation: number, afterMitigation: number): number {
  const value = (BigInt(natural(beforeMitigation)) * BigInt(S13_COMBAT_RULES.damageManaBeforeBps)
    + BigInt(natural(afterMitigation)) * BigInt(S13_COMBAT_RULES.damageManaBps)) / 100n, cap = BigInt(S13_COMBAT_RULES.damageManaCapCenti);
  return safeNumber(value > cap ? cap : value);
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

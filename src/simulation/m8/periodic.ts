import type { Amount, PeriodicRemainder, PeriodicTask } from './contracts';
import { addFractions, compareCodePoints, fraction, validateIdentity } from './identity';
import { amountNumerator, integer, safeNumber, type AmountSample } from './stats';
function effectAmount(task: PeriodicTask, effectIndex: number): Amount {
  integer(effectIndex);
  const effect = task.program.effects[effectIndex];
  if (!effect || !['damage', 'heal', 'grant-shield'].includes(effect.kind) || !('amount' in effect) || typeof effect.amount === 'number') throw new RangeError('Periodic account is not an amount effect');
  return effect.amount;
}
export function clearRemainder(task: PeriodicTask, effectIndex: number, targetId: string): PeriodicTask {
  return { ...task, remainders: task.remainders.filter(r => r.effectIndex !== effectIndex || r.targetId !== targetId) };
}
export function periodicAmount(task: PeriodicTask, effectIndex: number, targetId: string, sample: AmountSample): { task: PeriodicTask; requested: number } {
  const amount = effectAmount(task, effectIndex), old = task.remainders.find(r => r.effectIndex === effectIndex && r.targetId === targetId);
  const exact = addFractions({ numerator: amountNumerator(amount, sample), denominator: 10000n }, old ? fraction(old.numerator, old.denominator) : { numerator: 0n, denominator: 1n });
  const capped = amount.cap !== null && exact.numerator > integer(amount.cap) * exact.denominator;
  const hp = sample.target ?? sample.holder;
  const fullHealth = task.program.effects[effectIndex].kind === 'heal' && hp !== undefined && hp.hp === hp.maxHp;
  const requested = capped ? amount.cap! : safeNumber(exact.numerator / exact.denominator);
  const numerator = exact.numerator % exact.denominator;
  const cleared = clearRemainder(task, effectIndex, targetId);
  const remainder: PeriodicRemainder = { effectIndex, targetId, numerator: safeNumber(numerator), denominator: safeNumber(exact.denominator) };
  return { requested, task: { ...cleared, remainders: [...cleared.remainders, ...(!capped && !fullHealth && numerator !== 0n ? [remainder] : [])]
    .sort((a, b) => a.effectIndex - b.effectIndex || compareCodePoints(a.targetId, b.targetId)) } };
}
export function splitTotal(total: number, count: number): number[] {
  const n = integer(total), c = integer(count, 1); return Array.from({ length: count }, (_, i) => safeNumber(n / c + (BigInt(i) < n % c ? 1n : 0n)));
}
export function advancePeriodicTask(task: PeriodicTask, tick: number): { due: boolean; task: PeriodicTask | null } {
  integer(tick);
  if (task.pulseLimit !== null && task.pulseOrdinal >= task.pulseLimit || task.endsAtTick !== null && (tick > task.endsAtTick || tick === task.endsAtTick && (task.finalPulse === 'none' || task.nextPulseAtTick !== tick))) return { due: false, task: null };
  if (tick < task.nextPulseAtTick) return { due: false, task };
  if (tick !== task.nextPulseAtTick) throw new RangeError('Missed periodic pulse; never backfill');
  const next = { ...task, nextPulseAtTick: task.nextPulseAtTick + task.periodTicks, pulseOrdinal: task.pulseOrdinal + 1 };
  return { due: true, task: task.pulseLimit !== null && next.pulseOrdinal >= task.pulseLimit ? null : next };
}
export function cleanPeriodicTasks(tasks: readonly PeriodicTask[], deadTargets: ReadonlySet<string>, deadSources: ReadonlySet<string>): PeriodicTask[] {
  return tasks.filter(t => !deadTargets.has(t.targetId) && !(t.onSourceDeath === 'cancel' && deadSources.has(t.source.ownerId)))
    .map(t => ({ ...t, remainders: t.remainders.filter(r => !deadTargets.has(r.targetId)) }));
}
export function validatePeriodicTask(task: PeriodicTask, unitIds: ReadonlySet<string>, deadIds: ReadonlySet<string>, tick: number, combatId?: string): void {
  validateIdentity(task, combatId); integer(task.nextPulseAtTick); integer(task.periodTicks, 1); integer(task.pulseOrdinal);
  if (!unitIds.has(task.targetId) || !unitIds.has(task.source.ownerId) || deadIds.has(task.targetId) || task.onSourceDeath === 'cancel' && deadIds.has(task.source.ownerId)
    || task.nextPulseAtTick <= tick || task.program.targetSnapshot !== 'once-per-pulse') throw new RangeError('Invalid periodic lifecycle');
  if (task.endsAtTick !== null) { integer(task.endsAtTick, 1); if (task.endsAtTick <= tick) throw new RangeError('Invalid last pulse'); }
  if (task.pulseLimit !== null) { integer(task.pulseLimit, 1); if (task.pulseOrdinal >= task.pulseLimit) throw new RangeError('Completed periodic task'); }
  const accounts = new Set<string>();
  for (const r of task.remainders) {
    effectAmount(task, r.effectIndex); integer(r.numerator); integer(r.denominator, 1);
    const account = JSON.stringify([r.effectIndex, r.targetId]);
    if (accounts.has(account) || !unitIds.has(r.targetId) || deadIds.has(r.targetId) || r.numerator >= r.denominator) throw new RangeError('Invalid periodic remainder account'); accounts.add(account);
  }
}

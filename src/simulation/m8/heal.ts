import type { DamageOutcome, HealContribution, HealOutcome, HealRequest, Source } from './contracts';
import { addFractions, canonicalSource, compareCodePoints, fraction, savedFraction, type Fraction } from './identity';
import { integer, safeNumber } from './stats';
import { permissionsFor } from './damage';
function merge(contributions: readonly HealContribution[]): HealContribution[] {
  const sources = new Map<string, { source: Source; weight: Fraction }>();
  for (const c of contributions) { const id = canonicalSource(c.source), old = sources.get(id); sources.set(id, { source: c.source, weight: addFractions(old?.weight ?? { numerator: 0n, denominator: 1n }, fraction(c.numerator, c.denominator)) }); }
  return [...sources.entries()].sort((a, b) => compareCodePoints(a[0], b[0])).map(([, c]) => ({ source: c.source, ...savedFraction(c.weight) }));
}
export function makeHealRequest(healId: string, targetId: string, kind: HealRequest['kind'], fromPacketId: string | null, contributions: readonly HealContribution[]): HealRequest {
  const merged = merge(contributions), sum = merged.reduce((s, c) => addFractions(s, fraction(c.numerator, c.denominator)), { numerator: 0n, denominator: 1n });
  return { healId, targetId, kind, fromPacketId, contributions: merged, requested: safeNumber(sum.numerator / sum.denominator) };
}
/** Largest remainder apportionment; independent of caller/slot order. */
function apportion(total: number, weights: readonly Fraction[], sources: readonly Source[]): number[] {
  const sum = weights.reduce(addFractions, { numerator: 0n, denominator: 1n });
  if (sum.numerator === 0n) return weights.map(() => 0);
  const fractions = weights.map((w, index) => {
    const numerator = integer(total) * w.numerator * sum.denominator, denominator = w.denominator * sum.numerator;
    return { index, floor: numerator / denominator, numerator: numerator % denominator, denominator };
  });
  const result = fractions.map(f => safeNumber(f.floor));
  let remaining = total - result.reduce((a, b) => a + b, 0);
  fractions.sort((a, b) => {
    const left = a.numerator * b.denominator, right = b.numerator * a.denominator;
    return (left > right ? -1 : left < right ? 1 : 0) || compareCodePoints(canonicalSource(sources[a.index]), canonicalSource(sources[b.index]));
  });
  for (const f of fractions) if (remaining-- > 0) result[f.index]++;
  return result;
}
export function resolveHeal(request: HealRequest, target: { readonly hp: number; readonly maxHp: number; readonly alive: boolean }, woundBps: number): HealOutcome {
  integer(target.hp); integer(target.maxHp, 1); integer(woundBps);
  if (target.hp > target.maxHp || woundBps > 10000) throw new RangeError('Invalid healing sample');
  const canonical = makeHealRequest(request.healId, request.targetId, request.kind, request.fromPacketId, request.contributions);
  if (canonical.requested !== request.requested) throw new RangeError('Heal requested total mismatch');
  const afterWound = safeNumber(integer(canonical.requested) * BigInt(10000 - woundBps) / 10000n);
  const actual = target.alive && target.hp > 0 ? Math.min(afterWound, target.maxHp - target.hp) : 0;
  const sources = canonical.contributions.map(c => c.source);
  const requestedShares = apportion(canonical.requested, canonical.contributions.map(c => fraction(c.numerator, c.denominator)), sources);
  const allowedShares = apportion(afterWound, requestedShares.map(n => fraction(n, 1)), sources);
  const actualShares = apportion(actual, allowedShares.map(n => fraction(n, 1)), sources);
  return { ...canonical, afterWound, actual, overheal: afterWound - actual, preventedByWound: canonical.requested - afterWound,
    shares: sources.map((source, i) => ({ source, requested: requestedShares[i], afterWound: allowedShares[i], actual: actualShares[i], overheal: allowedShares[i] - actualShares[i], preventedByWound: requestedShares[i] - allowedShares[i] })) };
}
export interface VampUnit { readonly id: string; readonly team: string; readonly hp: number; readonly maxHp: number; readonly alive: boolean }
export function selectVampAlly<T extends VampUnit>(holder: VampUnit, units: readonly T[]): T | undefined {
  return units.filter(u => u.id !== holder.id && u.team === holder.team && u.alive && u.hp > 0).sort((a, b) => {
    const left = integer(a.hp) * integer(b.maxHp, 1), right = integer(b.hp) * integer(a.maxHp, 1);
    return (left < right ? -1 : left > right ? 1 : 0) || compareCodePoints(a.id, b.id);
  })[0];
}
export interface VampRate { readonly source: Source; readonly bps: number; readonly allyBps: number }
export function vampRequests(healId: string, holder: VampUnit, damage: DamageOutcome | readonly DamageOutcome[], rates: readonly VampRate[], units: readonly VampUnit[]): HealRequest[] {
  if (!holder.alive || holder.hp <= 0) return [];
  const outcomes: readonly DamageOutcome[] = Array.isArray(damage) ? damage : [damage as DamageOutcome];
  const eligible = outcomes.filter(o => o.hit && o.context.source.ownerId === holder.id && permissionsFor(o.context).includes('omnivamp'));
  const actual = safeNumber(eligible.reduce((sum, o) => sum + integer(o.absorbed) + integer(o.hpDamage), 0n));
  if (!actual) return [];
  const fromPacketId = eligible.length === 1 ? eligible[0].context.packetId : null;
  const ordered = [...rates].sort((a, b) => compareCodePoints(canonicalSource(a.source), canonicalSource(b.source)));
  const self = ordered.filter(r => r.bps > 0).map(r => ({ source: r.source, numerator: safeNumber(integer(actual) * integer(r.bps)), denominator: 10000 }));
  const requests = self.length ? [makeHealRequest(healId, holder.id, 'omnivamp', fromPacketId, self)] : [];
  const ally = selectVampAlly(holder, units);
  const allyActual = safeNumber(eligible.filter(o => permissionsFor(o.context).includes('gunblade-ally-heal')).reduce((sum, o) => sum + integer(o.absorbed) + integer(o.hpDamage), 0n));
  if (ally && allyActual) for (const rate of ordered) if (rate.allyBps > 0)
    requests.push(makeHealRequest(JSON.stringify([healId, canonicalSource(rate.source), 'ally']), ally.id, 'ally-vamp', fromPacketId,
      [{ source: rate.source, numerator: safeNumber(integer(allyActual) * integer(rate.allyBps)), denominator: 10000 }]));
  return requests;
}

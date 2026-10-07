import type { EffectIdentity, EffectKeyTuple, Source } from './contracts';
import { integer, safeNumber } from './stats';
export const compareCodePoints = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const sourceTuple = (s: Source): readonly unknown[] => [s.ownerId, s.sourceKind, s.definitionId, s.instanceId, s.effectIndex, s.parentItemInstanceId];
export const canonicalSource = (s: Source): string => JSON.stringify(sourceTuple(s));
export function effectIdentity(combatId: string, source: Source, targetId: string, applicationId = 'source'): EffectIdentity {
  const tuple: EffectKeyTuple = [combatId, source.ownerId, source.sourceKind, source.definitionId, source.instanceId, source.effectIndex, source.parentItemInstanceId, targetId, applicationId];
  return { key: JSON.stringify(tuple), source, targetId };
}
export function validateIdentity(value: EffectIdentity, combatId?: string): void {
  const tuple: unknown = JSON.parse(value.key);
  if (!Array.isArray(tuple) || tuple.length !== 9 || typeof tuple[0] !== 'string' || typeof tuple[8] !== 'string' || !tuple[8]
    || combatId !== undefined && tuple[0] !== combatId || JSON.stringify(tuple) !== value.key
    || effectIdentity(tuple[0], value.source, value.targetId, tuple[8]).key !== value.key) throw new RangeError('Invalid effect identity');
  integer(value.source.effectIndex);
  for (const text of [value.targetId, value.source.ownerId, value.source.definitionId, value.source.instanceId]) if (typeof text !== 'string' || !text) throw new RangeError('Invalid effect source');
  if (!['attack', 'ability', 'trait', 'item', 'augment', 'anomaly', 'enemyGrowth'].includes(value.source.sourceKind)
    || value.source.parentItemInstanceId !== null && (typeof value.source.parentItemInstanceId !== 'string' || !value.source.parentItemInstanceId)) throw new RangeError('Invalid source kind/parent');
}
export function gcd(a: bigint, b: bigint): bigint { while (b !== 0n) { const next = a % b; a = b; b = next; } return a; }
export type Fraction = { readonly numerator: bigint; readonly denominator: bigint };
export function fraction(numerator: number, denominator: number): Fraction { return { numerator: integer(numerator), denominator: integer(denominator, 1) }; }
export function addFractions(a: Fraction, b: Fraction): Fraction {
  const common = gcd(a.denominator, b.denominator), denominator = a.denominator / common * b.denominator;
  return { numerator: a.numerator * (denominator / a.denominator) + b.numerator * (denominator / b.denominator), denominator };
}
export function savedFraction(f: Fraction): { numerator: number; denominator: number } {
  const divisor = gcd(f.numerator, f.denominator);
  return { numerator: safeNumber(f.numerator / divisor), denominator: safeNumber(f.denominator / divisor) };
}

import type { CritEligibility, Source, SpellCritAuthorization } from './contracts';
import { integer, safeNumber } from './stats';

export const sourceTuple = (source: Source): string => JSON.stringify([source.ownerId, source.sourceKind, source.definitionId,
  source.instanceId, source.effectIndex, source.parentItemInstanceId]);
function ordered(sources: readonly Source[]): Source[] {
  for (const source of sources) {
    integer(source.effectIndex);
    if (![source.ownerId, source.definitionId, source.instanceId].every(id => typeof id === 'string' && id.length > 0)
      || !['attack', 'ability', 'trait', 'item', 'augment', 'anomaly', 'enemyGrowth'].includes(source.sourceKind)
      || (source.parentItemInstanceId !== null && (typeof source.parentItemInstanceId !== 'string' || source.parentItemInstanceId.length === 0))) throw new RangeError('Invalid authorization provenance');
  }
  const sorted = sources.map(source => ({ ...source })).sort((a, b) => sourceTuple(a) < sourceTuple(b) ? -1 : sourceTuple(a) > sourceTuple(b) ? 1 : 0);
  if (new Set(sorted.map(sourceTuple)).size !== sorted.length) throw new RangeError('Duplicate authorization source');
  return sorted;
}
export function authorizeSpellCrit(nonItemSources: readonly Source[], itemSources: readonly Source[], chanceBps: number,
  baseMultiplierBps: number): SpellCritAuthorization {
  integer(chanceBps, Number.MIN_SAFE_INTEGER); integer(baseMultiplierBps, 10000);
  if (nonItemSources.some(s => s.sourceKind === 'item') || itemSources.some(s => s.sourceKind !== 'item')) throw new RangeError('Invalid authorization source kind');
  const nonItems = ordered(nonItemSources), items = ordered(itemSources);
  const bonus = 1000 * (nonItems.length > 0 ? items.length : Math.max(0, items.length - 1));
  return { nonItemSources: nonItems, itemSources: items, enabled: nonItems.length > 0 || items.length > 0,
    redundantItemBonusBps: bonus, chanceBps: Math.max(0, Math.min(10000, chanceBps)),
    multiplierBps: safeNumber(BigInt(baseMultiplierBps) + BigInt(bonus)) };
}
export function validateSpellCrit(authorization: SpellCritAuthorization): SpellCritAuthorization {
  const expected = authorizeSpellCrit(authorization.nonItemSources, authorization.itemSources, authorization.chanceBps,
    authorization.multiplierBps - authorization.redundantItemBonusBps);
  if (expected.enabled !== authorization.enabled || expected.chanceBps !== authorization.chanceBps
    || expected.multiplierBps !== authorization.multiplierBps || expected.redundantItemBonusBps !== authorization.redundantItemBonusBps
    || expected.itemSources.some((s, i) => sourceTuple(s) !== sourceTuple(authorization.itemSources[i]))
    || expected.nonItemSources.some((s, i) => sourceTuple(s) !== sourceTuple(authorization.nonItemSources[i]))) throw new RangeError('Invalid spell critical projection');
  return expected;
}
/** Caller invokes only for a planned packet. Inherited inputs never call this function. */
export function rollCrit(eligibility: CritEligibility, authorization: SpellCritAuthorization, draw: () => number): boolean {
  if (!['basic', 'requires-spell-authorization', 'never'].includes(eligibility)) throw new RangeError('Invalid critical eligibility');
  validateSpellCrit(authorization);
  if (eligibility === 'never' || (eligibility === 'requires-spell-authorization' && !authorization.enabled)) return false;
  const word = draw();
  integer(word); integer(authorization.chanceBps);
  if (word >= 0x100000000 || authorization.chanceBps > 10000) throw new RangeError('Invalid critical random word/chance');
  return word * 10000 < authorization.chanceBps * 0x100000000;
}

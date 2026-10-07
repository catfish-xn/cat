import type { Amount, CastReceipt, Condition, DamageContext, DamageOutcome, Stat, StatModifier } from './contracts';

export interface HpSample { readonly id: string; readonly hp: number; readonly maxHp: number }
export interface StatSample {
  readonly holder: HpSample;
  readonly target?: HpSample;
  readonly counters?: Readonly<Record<string, number>>;
  /** The caller supplies current alive enemy primary targets; IDs are deduplicated here. */
  readonly enemiesTargetingHolder?: readonly string[];
  readonly startingRows?: 'front-two' | 'back-two';
  readonly positiveHpDamage?: boolean;
  readonly packet?: DamageContext;
}
export function integer(value: number, minimum = 0): bigint {
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('Expected safe integer');
  return BigInt(value);
}
export function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError('Unsafe numeric result');
  return result;
}
export function conditionHolds(condition: Condition, sample: StatSample): boolean {
  switch (condition.kind) {
    case 'always': return true;
    case 'positive-hp-damage':
      if (sample.positiveHpDamage === undefined) throw new RangeError('Missing HP damage sample');
      return sample.positiveHpDamage;
    case 'hp-ratio': {
      const unit = condition.subject === 'holder' ? sample.holder : sample.target;
      if (!unit) throw new RangeError('Missing HP ratio subject');
      const left = integer(unit.hp) * 10000n, right = integer(unit.maxHp, 1) * integer(condition.thresholdBps);
      return condition.op === 'gt' ? left > right : condition.op === 'lt' ? left < right : left <= right;
    }
    case 'target-max-hp':
      if (!sample.target) throw new RangeError('Missing target HP');
      return integer(sample.target.maxHp, 1) > integer(condition.hp);
    case 'starting-rows':
      if (!sample.startingRows) throw new RangeError('Missing frozen starting rows');
      return sample.startingRows === condition.rows;
    case 'enemy-targeting-holder':
      if (!sample.enemiesTargetingHolder) throw new RangeError('Missing current primary targets');
      return sample.enemiesTargetingHolder.length > 0;
  }
}
/** Counter dictionaries belong to one source runtime, never to the whole holder. */
export type BoundModifier = StatModifier | { readonly modifier: StatModifier; readonly counters: Readonly<Record<string, number>> };
export function modifierValues(stat: Stat, modifiers: readonly BoundModifier[], sample: StatSample): { flat: number; bps: number } {
  let flat = 0n, bps = 0n, resistanceReduction = 0n;
  for (const entry of modifiers) {
    const modifier = 'modifier' in entry ? entry.modifier : entry;
    const counters = 'modifier' in entry ? entry.counters : sample.counters;
    if (modifier.stat !== stat) continue;
    if ((modifier.unit === 'hexes' && stat !== 'range') || (stat === 'range' && modifier.unit !== 'hexes')
      || (['attackSpeed', 'critChance', 'critMultiplier', 'damageAmp', 'damageReduction', 'omnivamp'].includes(stat) && modifier.unit !== 'bps')) throw new RangeError('Invalid modifier unit');
    if (stat === 'damageReduction') {
      if (!modifier.damageFilter || !sample.packet) throw new RangeError('Reduction requires explicit filter and packet');
      const f = modifier.damageFilter, c = sample.packet;
      if ((f.deliveries !== 'all' && !f.deliveries.includes(c.delivery)) ||
          (f.damageTypes !== 'all' && !f.damageTypes.includes(c.damageType)) ||
          (f.redirected === 'exclude' && c.redirected) || (f.redirected === 'only' && !c.redirected)) continue;
    } else if (modifier.damageFilter !== null) throw new RangeError('Only reduction accepts a damage filter');
    if (!conditionHolds(modifier.condition, sample)) continue;
    let value: bigint;
    switch (modifier.value.kind) {
      case 'constant': value = integer(modifier.value.amount, Number.MIN_SAFE_INTEGER); break;
      case 'counter':
        if (!counters || !Object.hasOwn(counters, modifier.value.counterId)) throw new RangeError('Missing modifier counter');
        value = integer(counters[modifier.value.counterId]) * integer(modifier.value.perCount, Number.MIN_SAFE_INTEGER); break;
      case 'unit-count':
        if (!sample.enemiesTargetingHolder) throw new RangeError('Missing current unit count');
        value = BigInt(new Set(sample.enemiesTargetingHolder).size) * integer(modifier.value.perUnit, Number.MIN_SAFE_INTEGER); break;
    }
    if (stat === 'damageReduction') {
      if (modifier.unit !== 'bps' || value < 0n || value > 10000n) throw new RangeError('Invalid reduction');
      bps = value > bps ? value : bps;
    } else if ((stat === 'armor' || stat === 'magicResist') && modifier.unit === 'bps' && value < 0n)
      resistanceReduction = value < resistanceReduction ? value : resistanceReduction;
    else if (modifier.unit === 'bps') bps += value;
    else flat += value;
  }
  return { flat: safeNumber(flat), bps: safeNumber(bps + resistanceReduction) };
}
export function resolveStat(stat: Stat, base: number, modifiers: readonly BoundModifier[], sample: StatSample): number {
  const { flat, bps } = modifierValues(stat, modifiers, sample);
  if (stat === 'damageReduction') return Math.max(base, bps);
  if (['attackSpeed', 'critChance', 'critMultiplier', 'damageAmp', 'omnivamp'].includes(stat)) {
    const total = integer(base, Number.MIN_SAFE_INTEGER) + integer(flat, Number.MIN_SAFE_INTEGER) + integer(bps, Number.MIN_SAFE_INTEGER);
    if (stat === 'critChance') return total < 0n ? 0 : total > 10000n ? 10000 : safeNumber(total);
    return safeNumber(total > 0n ? total : 0n);
  }
  const numerator = (integer(base, Number.MIN_SAFE_INTEGER) + integer(flat, Number.MIN_SAFE_INTEGER)) * (10000n + integer(bps, Number.MIN_SAFE_INTEGER));
  return Math.max(stat === 'maxHp' ? 1 : 0, safeNumber(numerator / 10000n));
}
export function attackInterval(baseSpeedBps: number, bonusBps: number): number {
  const denominator = integer(baseSpeedBps, 1) * (10000n + integer(bonusBps, -9999));
  return Math.max(1, safeNumber((2000000000n + denominator - 1n) / denominator));
}
export function changeMaxHp(beforeMax: number, beforeHp: number, afterMax: number): {
  beforeMax: number; afterMax: number; beforeHp: number; afterHp: number; countsAsHeal: false;
} {
  integer(beforeMax, 1); integer(beforeHp); integer(afterMax, 1);
  if (beforeHp > beforeMax) throw new RangeError('Invalid current HP');
  return { beforeMax, afterMax, beforeHp,
    afterHp: beforeHp === 0 ? 0 : Math.max(0, Math.min(afterMax, safeNumber(BigInt(beforeHp) + BigInt(afterMax) - BigInt(beforeMax)))), countsAsHeal: false };
}
export interface AmountSample {
  readonly holder: HpSample;
  readonly target?: HpSample;
  readonly attackDamage: number;
  readonly abilityPower: number;
  readonly cast?: CastReceipt;
  readonly damage?: DamageOutcome;
  readonly shieldAbsorbed?: number;
}
/** G01: no RNG or mutation; each coefficient joins the same rational numerator. */
export function evaluateAmount(amount: Amount, sample: AmountSample): number {
  const hp = amount.hpBasis === 'holder' ? sample.holder : sample.target;
  if (!hp) throw new RangeError('Missing amount HP basis');
  integer(hp.hp); integer(hp.maxHp, 1);
  if (hp.hp > hp.maxHp) throw new RangeError('Invalid HP sample');
  let numerator = integer(amount.flat) * 10000n + integer(sample.attackDamage) * integer(amount.attackDamageBps)
    + integer(sample.abilityPower) * integer(amount.abilityPowerBps) + integer(hp.maxHp) * integer(amount.maxHpBps)
    + integer(hp.maxHp - hp.hp) * integer(amount.missingHpBps);
  if (amount.actualManaSpentBps !== 0) {
    if (!sample.cast?.completed) throw new RangeError('Missing completed cast receipt');
    numerator += integer(sample.cast.actualManaSpent) * integer(amount.actualManaSpentBps);
  }
  if (amount.actualDamageBps !== 0) {
    if (!sample.damage || !sample.damage.hit || sample.damage.absorbed + sample.damage.hpDamage <= 0) throw new RangeError('Missing positive damage outcome');
    numerator += (integer(sample.damage.absorbed) + integer(sample.damage.hpDamage)) * integer(amount.actualDamageBps);
  }
  if (amount.shieldAbsorbedBps !== 0) {
    if (sample.shieldAbsorbed === undefined) throw new RangeError('Missing shield absorption sample');
    numerator += integer(sample.shieldAbsorbed) * integer(amount.shieldAbsorbedBps);
  }
  const value = numerator / 10000n;
  return safeNumber(amount.cap === null ? value : value < integer(amount.cap) ? value : integer(amount.cap));
}

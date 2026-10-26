import type { Amount } from './contracts';

/** Pure amount data constructor, safe during neutral catalog initialization. */
export const flatAmount = (flat = 0, patch: Partial<Amount> = {}): Amount => ({ flat, attackDamageBps: 0, abilityPowerBps: 0, maxHpBps: 0, missingHpBps: 0, actualManaSpentBps: 0,
  actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'holder', sample: 'application', cap: null, ...patch });

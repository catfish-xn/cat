/** Finite S13 engine constants and semantic identifiers are part of the content
 * digest. A change here invalidates earlier development saves and goldens. */
export const S13_COMBAT_RULES = Object.freeze({
  tickMs: 50,
  maxTicks: 1200,
  moveIntervalTicks: 5,
  abilityPowerBase: 100,
  attackCritBps: 2500,
  critMultiplierBps: 14000,
  attackMana: 10,
  damageManaBps: 300,
  damageManaCap: 20,
  attackSpeedIntervalNumerator: 2000000000,
  starStatPercent: Object.freeze([100, 180, 324]),
  arithmeticRevision: 'm5-cross-review-3',
  neutralAttackTiming: 'authored-integer-ticks-no-speed-inversion',
  attackSpeedStacking: 'original-base-times-sum-static-runtime-status-final-ceil',
  packetOrder: 'owner-action-target-ordinal',
  statusTiming: 'new-action-status-next-tick-full-duration',
  periodicTiming: 'scheduled-at-tick-start-before-actions',
  ricochet: 'primary-lethal-only-once-per-action-no-redirect-no-recursion',
});

/**
 * 卯足全力 (TFT13_Augment_PrimeCarry) — the strongest Vander's hero spell `TFT13_PrimeSpellHero`, 14.24b
 * `characters/tft13_prime.cdtb.bin.json`: mCastTime 0.5 / HEROSpellDuration 0.5, HEROBonusDamage 1.85 (multiplies only
 * ModifiedDamage; ModifiedBonusDamage ×1.0), HEROSplashPerc 0.25, HEROStunDuration 0.75, HEROManaIncrease 60 (also the
 * augment's `{8cfa39af}` = 60). Tooltip `tft13_primespellhero_dsc`: punch the target so it flies backwards; every enemy the
 * initial target hits takes 25% of the original damage. No resists and no 2.5 s brace.
 * P (2026-11-02): the flight distance is not in the client data; the target is pushed `knockbackHexes` straight away from
 * Vander (stops before a unit or the board edge), and "hit" means every other enemy within 1 hex of a cell it passes.
 */
export const GLOVES_OFF = Object.freeze({
  castTicks: 10,
  stunTicks: 15,
  manaIncrease: 60,
  knockbackHexes: 2,
  /** Display copies of the augment row's damageBps / splashBps (augment-pool-batch3 `all-out`); a test keeps them equal. */
  damageBps: 18500,
  splashBps: 2500,
});

/**
 * Clips whose authored root travel is not the unit's own movement, played in place (root x/z held at the idle stance,
 * height kept). Display only; the combat rules never move these units for the action.
 *
 * Jayce's back-row cast: both clips carry the root forward and the jump range ends while it is still forward, so the
 * blend back to idle slid him back across his hex. In the original he jumps and lands on his own hex.
 */
export const IN_PLACE_CLIPS: Readonly<Record<string, readonly string[]>> = {
  jayce: ['tft13_jayce_spell2_knockhexcrystals', 'tft13_jayce_spell2_ranged_jump'],
};
/** The skeleton bone that carries a League model's root travel. */
export const ROOT_BONE = 'Root';

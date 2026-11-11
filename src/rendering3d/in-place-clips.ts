/**
 * Clips whose authored root travel is not the unit's own movement, played in place (root x/z held at the bind pose,
 * height kept). Display only; the combat rules never move these units for the action.
 *
 * Jayce's back-row cast (11-11, Fable): knockhexcrystals steps the root about 70 units forward (0.3-0.7 s) and slides
 * it back, and the ranged_jump range lands about 63 units forward and ends there, so the blend to idle slid him back a
 * cell. In the original (xi912X5QsRs 94-97 s) he jumps and lands on his own hex.
 */
export const IN_PLACE_CLIPS: Readonly<Record<string, readonly string[]>> = {
  jayce: ['tft13_jayce_spell2_knockhexcrystals', 'tft13_jayce_spell2_ranged_jump'],
};
/** The skeleton bone that carries a League model's root travel. */
export const ROOT_BONE = 'Root';

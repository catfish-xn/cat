/**
 * User-approved 2026-11-15 (timing only, no numbers changed; Fable reviews each hero's timeline against the original):
 * these skills land a few ticks after the cast, as the original's first damage or heal number does. The values are fitted
 * (not original data). What is chosen on the cast (targets, amounts) stays on the cast; what lands, lands then.
 * See docs/S13_RULES_GAP.md (技能生效前摇对齐).
 */
export const CAST_WINDUP_TICKS = Object.freeze({ drmundo: 10, trundle: 4, zyra: 6, tristana: 12 } as const);

/**
 * Wind-up batch 2 (user-approved 2026-11-15 authorization, timing only; fitted, not original data): Smeech's stabs land one
 * after another, SMEECH_STAB_TICKS apart, instead of all on the cast tick. Each stab's amount is still taken on the cast.
 */
export const SMEECH_STAB_TICKS = 7;

/** Wind-up batch 2 (same authorization; fitted, not original data): Dr. Mundo's closing blast lands this many ticks after his
 * last once-a-second damage instead of on the same tick. Its amount is still taken on the cast. */
export const DRMUNDO_BLAST_AFTER_PULSE_TICKS = 5;

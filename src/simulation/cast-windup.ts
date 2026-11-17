/**
 * User-approved 2026-11-15 (timing only, no numbers changed; Fable reviews each hero's timeline against the original):
 * these skills land a few ticks after the cast, as the original's first damage or heal number does. The values are fitted
 * (not original data). What is chosen on the cast (targets, amounts) stays on the cast; what lands, lands then.
 * See docs/S13_RULES_GAP.md (技能生效前摇对齐).
 */
export const CAST_WINDUP_TICKS = Object.freeze({ drmundo: 10, trundle: 4, zyra: 6, tristana: 12, renata: 17 } as const);

/**
 * Wind-up batch 2 (user-approved 2026-11-15 authorization, timing only; fitted, not original data): Smeech's stabs land one
 * after another, SMEECH_STAB_TICKS apart, instead of all on the cast tick. Each stab's amount is still taken on the cast.
 */
export const SMEECH_STAB_TICKS = 7;

/** Wind-up batch 2 (same authorization; fitted, not original data): Dr. Mundo's closing blast lands this many ticks after his
 * last once-a-second damage instead of on the same tick. Its amount is still taken on the cast. */
export const DRMUNDO_BLAST_AFTER_PULSE_TICKS = 5;

/** Wind-up batch 2 (same authorization; fitted, not original data): Nunu's second damage lands this many ticks after his last
 * periodic damage instead of on the same tick. Its amount is still taken on the cast. */
export const NUNU_SECOND_AFTER_PULSE_TICKS = 9;

/** Wind-up batch 3 (fitted, not original data): Powder's monkey walks to the landing cell taken on her cast and explodes on
 * arriving, POWDER_MONKEY_BASE_TICKS + POWDER_MONKEY_TICKS_PER_HEX × the hexes from her to that cell after the cast. */
export const POWDER_MONKEY_BASE_TICKS = 18;
export const POWDER_MONKEY_TICKS_PER_HEX = 6;

/** Wind-up batch 3 (fitted, not original data): Renata's missiles fly this many ticks, so they leave her CAST_WINDUP_TICKS.renata
 * minus this after the cast. Once they have left, her death no longer stops them; before that it does. */
export const RENATA_MISSILE_FLIGHT_TICKS = 12;

/**
 * Wind-up batch 3 (fitted, not original data): a pending landing that has already left its caster lands even if the caster
 * dies; one still in the wind-up does not. Powder's monkey leaves on her cast; Renata's missiles leave
 * RENATA_MISSILE_FLIGHT_TICKS before they land.
 */
export function releasedLanding(task: { kind: string; executeAtTick: number; source: { definitionId: string } }, tick: number): boolean {
  if (task.kind === 'g2PowderMonkey') return true;
  return task.kind === 'g2Landing' && task.source.definitionId === 'renata-ability' && task.executeAtTick - RENATA_MISSILE_FLIGHT_TICKS <= tick;
}

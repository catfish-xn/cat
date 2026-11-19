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

/** Wind-up batches 3–4 (fitted, not original data): Powder lets her monkey go POWDER_MONKEY_RELEASE_TICKS after her cast; it
 * walks to the landing cell taken on the cast and explodes on arriving, POWDER_MONKEY_WALK_BASE_TICKS +
 * POWDER_MONKEY_TICKS_PER_HEX × the hexes from her (where she stood on the cast) to that cell after letting go. */
export const POWDER_MONKEY_RELEASE_TICKS = 23;
export const POWDER_MONKEY_WALK_BASE_TICKS = 1;
export const POWDER_MONKEY_TICKS_PER_HEX = 6;

/** Wind-up batch 3 (fitted, not original data): Renata's missiles fly this many ticks, so they leave her CAST_WINDUP_TICKS.renata
 * minus this after the cast. Once they have left, her death no longer stops them; before that it does. */
export const RENATA_MISSILE_FLIGHT_TICKS = 12;

/** Wind-up batch 4 (fitted, not original data; based on 3-star footage only): Malzahar's gate at 3 stars lands this many ticks
 * after the cast (damage and shred; the infection keeps landing 20 ticks after it). 1 and 2 stars keep landing on the cast. */
export const MALZAHAR_3STAR_GATE_TICKS = 26;

/** Wind-up batch 4 (fitted, not original data): Renni lifts her target (stun start) this many ticks after her cast; her stun's
 * per-tick damage and self-heal move with it, and the closing slam lands RENNI_SLAM_AFTER_STUN_TICKS after the stun ends. */
export const RENNI_LIFT_TICKS = 8;
export const RENNI_SLAM_AFTER_STUN_TICKS = 2;

/**
 * Wind-up batch 3 (fitted, not original data): a pending landing that has already left its caster lands even if the caster
 * dies; one still in the wind-up does not. Powder lets her monkey go on its release tick (g2PowderRelease): a death settled
 * on that tick still lets it go, one before does not; once let go it walks on (g2PowderMonkey / v20Powder). Renata's missiles
 * leave RENATA_MISSILE_FLIGHT_TICKS before they land.
 */
export function releasedLanding(task: { kind: string; executeAtTick: number; source: { definitionId: string } }, tick: number): boolean {
  if (task.kind === 'g2PowderMonkey' || task.kind === 'attackLanding') return true;
  if (task.kind === 'g2PowderRelease') return task.executeAtTick <= tick;
  return task.kind === 'g2Landing' && task.source.definitionId === 'renata-ability' && task.executeAtTick - RENATA_MISSILE_FLIGHT_TICKS <= tick;
}

/** Ranged basic attacks (fitted, not original data): a ranged hero's shot flies this many ticks per hex from her to its target
 * (taken on the attack tick) and settles on arrival, at least one tick later. An instant beam (Zeri's empowered shot) settles
 * on the attack tick. docs/S13_RULES_GAP.md (远程普攻弹道命中才结算). */
export const RANGED_ATTACK_TICKS_PER_HEX = 2;
/** Per-champion overrides of RANGED_ATTACK_TICKS_PER_HEX (fitted, not original data); empty in the first version. */
export const RANGED_ATTACK_TICKS_PER_HEX_BY_CHAMPION: Readonly<Record<string, number>> = Object.freeze({});
export function rangedAttackFlightTicks(hexes: number, championId = ''): number {
  return Math.max(1, Math.ceil(hexes * (RANGED_ATTACK_TICKS_PER_HEX_BY_CHAMPION[championId] ?? RANGED_ATTACK_TICKS_PER_HEX)));
}

/** Ranged attack wind-up (fitted / self-chosen, not original data; user-approved 11-19): ticks from a ranged hero's attack start (its
 * animation and cooldown) to the launch of its shot, our animation's fire frame (the attack projectile cue) / 50 ms, rounded, at most
 * RANGED_ATTACK_WINDUP_MAX (self-chosen: a later fire frame is shown with the swing sped up so it fires on the launch tick). Never
 * more than half the current attack interval; not scaled by attack speed in this first version. docs/S13_RULES_GAP.md (远程普攻前摇). */
export const RANGED_ATTACK_WINDUP_MAX = 7;
export const RANGED_ATTACK_WINDUP_DEFAULT = 5;
export const RANGED_ATTACK_WINDUP_TICKS: Readonly<Record<string, number>> = Object.freeze({
  lux: 5, zyra: 7, tristana: 4, urgot: 5, kogmaw: 5, ezreal: 6, nami: 6, corki: 3, caitlyn: 6, leblanc: 5, powder: 5, twitch: 5,
  zeri: 5, draven: 5, jinx: 6, morgana: 5, vex: 5, ziggs: 7, renata: 5, cassiopeia: 6, mel: 6, jayce: 5,
  maddie: 5, zoe: 6, heimerdinger: 4, twistedfate: 5, silco: 6, elise: 6, gangplank: 5, swain: 5,
  // Fire frames later than the maximum take it (Fable 11-19): Malzahar's and Viktor's beam.
  malzahar: 7, viktor: 7,
});
export function rangedAttackWindupTicks(championId: string, intervalTicks: number): number {
  const ticks = Math.min(RANGED_ATTACK_WINDUP_TICKS[championId] ?? RANGED_ATTACK_WINDUP_DEFAULT, RANGED_ATTACK_WINDUP_MAX);
  return Math.max(0, Math.min(ticks, Math.floor(intervalTicks / 2)));
}

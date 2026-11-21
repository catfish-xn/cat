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
export function releasedLanding(task: { kind: string; executeAtTick: number; source: { definitionId: string }; shot?: { arrivalTick?: number } }, tick: number): boolean {
  if (task.kind === 'g2PowderMonkey' || task.kind === 'attackLanding') return true;
  if (task.kind === 'skillShot') return task.shot?.arrivalTick !== undefined; // a skill projectile in flight lands even if its caster died
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

/**
 * Landing batch (11-20, user-approved timing only; amounts, ranges and targets unchanged, all taken on the cast). See
 * docs/S13_RULES_GAP.md (技能落地结算批). Darius's spin (damage, heal, bleed) lands on the render's hit: DARIUS_SPIN_TICKS
 * after the cast (fitted, not original data); his bleed's clock starts there, same total length.
 */
export const DARIUS_SPIN_TICKS = 12;
/** Lux's shield on an ally lands when her bent missile arrives, LUX_SHIELD_FLIGHT_TICKS after the cast (the render's missile
 * flight; fitted, not original data). On herself it lands LUX_SELF_SHIELD_TICKS after the cast (aligned to the original
 * frame by frame, see the GAP section), every star level alike. */
export const LUX_SHIELD_FLIGHT_TICKS = 6;
export const LUX_SELF_SHIELD_TICKS = 5;
/** Maddie's volley shots fly MADDIE_SHOT_TICKS_PER_HEX ticks a hex from her to the enemy they hit, at least MADDIE_SHOT_MIN_TICKS
 * (the render's flight, cue-overrides.ts; fitted, not original data). Each shot leaves on its own volley offset. */
export const MADDIE_SHOT_TICKS_PER_HEX = 2, MADDIE_SHOT_MIN_TICKS = 4;
export function maddieShotFlightTicks(hexes: number): number { return Math.max(MADDIE_SHOT_MIN_TICKS, hexes * MADDIE_SHOT_TICKS_PER_HEX); }
/**
 * Heimerdinger's rockets (the rules' copy of the render's HEIMER_ROCKETS timing in cue-overrides.ts; a test keeps the two
 * equal): the k-th of n leaves launchTicks plus its stagger after the cast and lands flightTicks later. Designed display
 * values (Fable 11-19), not original data.
 */
export const HEIMER_ROCKET_TIMING = Object.freeze({ launchTicks: 4, flightTicks: 10, staggerTicks: 1, spreadTicks: 9 } as const);
export function heimerRocketLaunchTick(k: number, n: number): number {
  const t = HEIMER_ROCKET_TIMING;
  return t.launchTicks + (n <= 1 || k <= 0 ? 0 : Math.round(k * Math.min(t.staggerTicks, t.spreadTicks / (n - 1))));
}
/**
 * Mordekaiser's claw (aligned to the original frame by frame, see the GAP section; 3 stars inferred from 2): it appears
 * MORDEKAISER_CLAW_TICKS[star].appear ticks after the cast and comes down on .land, where its damage settles. His damage
 * reduction, empower and pull stay on the cast.
 */
export const MORDEKAISER_CLAW_TICKS: Readonly<Record<1 | 2 | 3, { readonly appear: number; readonly land: number }>> =
  Object.freeze({ 1: { appear: 2, land: 26 }, 2: { appear: 4, land: 27 }, 3: { appear: 4, land: 27 } });

/** Heimerdinger's focus (11-20, user-approved; self-chosen, not original data): this share of each volley's rockets, rounded
 * down, goes to his current target; the rest pick at random as before. docs/S13_RULES_GAP.md (黑默丁格火箭集火). */
export const HEIMER_FOCUS_SHARE_BPS = 5000;

/** Swain's demon form (11-20, user-approved; aligned to the original frame by frame, see docs/S13_RULES_GAP.md 斯维因吸取跳频):
 * it drains every SWAIN_PULSE_TICKS, the first that long after the cast; each pulse settles one of SWAIN_PULSES_PER_SECOND
 * parts of the per-second heal and damage (splitTotal), so each second's total is unchanged. */
export const SWAIN_PULSE_TICKS = 5, SWAIN_PULSES_PER_SECOND = 4;

/** Mel's cast (11-20, user-approved): she lands from her dash MEL_DASH_LAND_TICKS after the cast and her bolts leave
 * MEL_RELEASE_TICKS after it (both aligned to the original frame by frame, every star level alike, 3 stars inferred; see
 * docs/S13_RULES_GAP.md 梅尔弹幕). The bolts fly MEL_BOLT_TICKS_PER_HEX a hex (self-chosen, not original data; the original's
 * hit time is not measured) and settle where they land. */
export const MEL_DASH_LAND_TICKS = 10, MEL_RELEASE_TICKS = 15, MEL_BOLT_TICKS_PER_HEX = 2;

/** Violet's combo (11-21, authorization ②): two jabs then an uppercut on the target taken at the cast, each landing on its own
 * tick after the cast (aligned to the original frame by frame; which hit is hers is not fully verified, see
 * docs/S13_RULES_GAP.md 蔚奥莱连击). The uppercut's knock-up starts with it. */
export const VIOLET_JAB_TICKS: readonly number[] = [16, 20], VIOLET_UPPERCUT_TICKS = 29;

/** Jinx's rocket (11-21, authorization ②): it leaves JINX_ROCKET_LAUNCH_TICKS after the cast and explodes JINX_ROCKET_FLIGHT_TICKS
 * later (both aligned to the original frame by frame; docs/S13_RULES_GAP.md 金克丝飞弹). Who is hit is read where it explodes. */
export const JINX_ROCKET_LAUNCH_TICKS = 27, JINX_ROCKET_FLIGHT_TICKS = 10;

/** Jayce's ranged cast (11-21, authorization ②; aligned to the original frame by frame, which bang is which crystal still being
 * checked): his crystals land JAYCE_CRYSTAL_LAND_TICKS after the cast and stay; crystal i explodes jayceCrystalBlastTick(i)
 * after it, one after another; the main hit on the nearest enemy lands JAYCE_MAIN_HIT_TICKS after it. Past the original's
 * three crystals (3 stars) the spacing repeats the last measured gap (self-chosen, not original data). */
export const JAYCE_CRYSTAL_LAND_TICKS = 11, JAYCE_CRYSTAL_BLASTS: readonly number[] = [26, 28, 32], JAYCE_MAIN_HIT_TICKS = 33;
export function jayceCrystalBlastTick(i: number): number {
  const n = JAYCE_CRYSTAL_BLASTS.length;
  return i < n ? JAYCE_CRYSTAL_BLASTS[i]! : JAYCE_CRYSTAL_BLASTS[n - 1]! + (i - n + 1) * (JAYCE_CRYSTAL_BLASTS[n - 1]! - JAYCE_CRYSTAL_BLASTS[n - 2]!);
}

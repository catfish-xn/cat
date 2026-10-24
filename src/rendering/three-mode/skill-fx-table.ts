/**
 * Skill feel table: every per-champion number of the skill feel sample (skill-feel.ts), in one place. Plain data, no
 * three.js or 2D imports. A champion takes part in the sample by having a row here; rolling the sample out to another
 * champion means adding its row, nothing else. Fields left out fall back to SKILL_FX_DEFAULTS.
 */

/** One cast effect's size factor (times its own scale) and live-particle limit. */
export interface SkillFxEffectTuning { readonly scale: number; readonly particles: number }
/** How a cast's impact lands: seconds the caster and targets hold, camera kick strength, a colored ring at each target. */
export interface SkillFxImpact { readonly hold: number; readonly kick: number; readonly ring: boolean }

export interface SkillFxRow {
  /** Charge (and impact ring) color: the champion's main skin color. */
  readonly color: number;
  /** The cast effects kept; left out, the cast keeps its whole plan (only shifted past the charge). */
  readonly keepCast?: readonly string[];
  /** Impact feel; left out, SKILL_FX_DEFAULTS.impact. */
  readonly impact?: SkillFxImpact;
  /** Per-effect overrides, by effect id; any other cast effect gets SKILL_FX_DEFAULTS.effect. */
  readonly effects?: Readonly<Record<string, SkillFxEffectTuning>>;
}

export const SKILL_FX_DEFAULTS = {
  /** Charge color for a champion without a row (never drawn today: only rows get the sample). */
  color: 0xffc864,
  /** Seconds of charge before a cast's own effects start (shared: the cast timeline is laid out on it). */
  windup: 0.25,
  impact: { hold: 0.07, kick: 1, ring: false } as SkillFxImpact,
  /** Live particles one cast effect may have (the shared budget still caps the whole board). */
  effect: { scale: 1, particles: 120 } as SkillFxEffectTuning,
} as const;

/** 10-24 GPU review: Vi and Renata hit too softly (蔚、烈娜塔命中力度不够). */
const STRONG_IMPACT: SkillFxImpact = { hold: 0.1, kick: 1.5, ring: true };

export const SKILL_FX_TABLE: Readonly<Record<string, SkillFxRow>> = {
  jinx: {
    color: 0xff4fb0,
    keepCast: ['jinx_tft13_jinx_base_r_muzzleflash', 'jinx_tft13_jinx_base_r_rocket_child', 'jinx_tft13_jinx_base_r_tar'],
    // 10-24: 金克丝命中的粉色爆炸太亮太大.
    effects: { jinx_tft13_jinx_base_r_tar: { scale: 0.6, particles: 50 } },
  },
  jayce: {
    color: 0x58b8ff,
    keepCast: ['jayce_tft13_jayce_base_r_ranged_recall_blast_cast', 'jayce_tft13_jayce_base_r_ranged_crystaldestroymissile', 'jayce_tft13_jayce_base_r_ranged_explosion'],
  },
  renata: { color: 0xc24dff, impact: STRONG_IMPACT },
  vi: {
    color: 0xff6a5a,
    keepCast: ['vi_tft13_vi_base_q_activate_hands_r', 'vi_tft13_vi_base_q_landing_aoe', 'vi_tft13_vi_base_q_tar'],
    impact: STRONG_IMPACT,
  },
};

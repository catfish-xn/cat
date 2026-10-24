import { describe, expect, it } from 'vitest';
import { SKILL_FX_TABLE } from '../src/rendering/three-mode/skill-fx-table';
import { CAST_PARTICLE_CAP, HITSTOP_SECONDS, SKILL_FEEL_SAMPLE, WINDUP_SECONDS, castEffectTuning, impactFeel, skillColor } from '../src/rendering/three-mode/skill-feel';

describe('skill feel table', () => {
  it('makes every row a sample champion, and nothing else', () => {
    expect([...SKILL_FEEL_SAMPLE].sort()).toEqual(Object.keys(SKILL_FX_TABLE).sort());
    expect(skillColor('ahri')).toBe(0xffc864);
  });

  it('keeps the four reviewed champions as sampled on 10-24 (Vi yellow and its ring later after the retest)', () => {
    expect(WINDUP_SECONDS).toBe(0.25); expect(HITSTOP_SECONDS).toBe(0.07); expect(CAST_PARTICLE_CAP).toBe(120);
    expect(Object.fromEntries(['jinx', 'jayce', 'renata', 'vi'].map(id => [id, skillColor(id)])))
      .toEqual({ jinx: 0xff4fb0, jayce: 0x58b8ff, renata: 0xc24dff, vi: 0xffcf4a });
    expect(impactFeel('jayce')).toEqual({ hold: 0.07, kick: 1, ring: false });
    expect(impactFeel('vi')).toEqual({ hold: 0.1, kick: 1.5, ring: true, ringDelay: 0.15 });
    expect(SKILL_FX_TABLE.renata!.keepCast).toBeUndefined();
    expect(SKILL_FX_TABLE.jayce!.keepCast).toEqual(['jayce_tft13_jayce_base_r_ranged_recall_blast_cast',
      'jayce_tft13_jayce_base_r_ranged_crystaldestroymissile', 'jayce_tft13_jayce_base_r_ranged_explosion']);
    expect(SKILL_FX_TABLE.vi!.keepCast).toEqual(['vi_tft13_vi_base_q_activate_hands_r', 'vi_tft13_vi_base_q_landing_aoe', 'vi_tft13_vi_base_q_tar']);
    expect(castEffectTuning('vi_tft13_vi_base_q_tar')).toEqual({ scale: 1, particles: 120 });
  });

  it('names only its own champion\'s effects in a row, with sane numbers', () => {
    for (const [id, row] of Object.entries(SKILL_FX_TABLE)) {
      for (const effect of [...row.keepCast ?? [], ...Object.keys(row.effects ?? {})]) expect(effect.startsWith(`${id}_`)).toBe(true);
      expect(row.color).toBeGreaterThanOrEqual(0); expect(row.color).toBeLessThanOrEqual(0xffffff);
      for (const tuning of Object.values(row.effects ?? {})) {
        expect(tuning.scale).toBeGreaterThan(0); expect(tuning.particles).toBeGreaterThan(0); expect(tuning.particles).toBeLessThanOrEqual(CAST_PARTICLE_CAP);
      }
      if (row.impact) { expect(row.impact.hold).toBeLessThanOrEqual(0.15); expect(row.impact.kick).toBeGreaterThan(0); }
      // Bright enough to show as an additive ring: no channel-poor, near-black color.
      expect(Math.max(row.color >> 16, (row.color >> 8) & 255, row.color & 255)).toBeGreaterThanOrEqual(0xa0);
      if (row.keepCast) expect(row.keepCast.length).toBeLessThanOrEqual(4);
    }
  });

  it('hands out copies, so a caller cannot change the table', () => {
    const tuning = castEffectTuning('jinx_tft13_jinx_base_r_tar'); tuning.scale = 9;
    expect(castEffectTuning('jinx_tft13_jinx_base_r_tar').scale).toBe(0.6);
    const hit = impactFeel('vi'); hit.hold = 9;
    expect(impactFeel('vi').hold).toBe(0.1);
  });

  it('covers every champion with a 3D model, trimming only the busy casts', () => {
    expect(Object.keys(SKILL_FX_TABLE)).toHaveLength(63);
    expect(Object.entries(SKILL_FX_TABLE).filter(([, row]) => row.keepCast).map(([id]) => id).sort()).toEqual(['akali', 'ambessa', 'draven',
      'elise', 'ezreal', 'gangplank', 'jayce', 'jinx', 'leblanc', 'mordekaiser', 'renni', 'scar', 'sevika', 'smeech', 'swain', 'vex', 'vi']);
  });
});

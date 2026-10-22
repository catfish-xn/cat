import { describe, expect, it } from 'vitest';
import { planActionEffects, type EffectPlayback } from '../src/rendering/three-mode/action-effect-plan';

describe('10-22 reviewed action staging', () => {
  const prefix = 'renata_tft13_renataglasc_base_e_';
  it('launches two real child missiles from the canisters and lands them with the target flash', () => {
    const effects = ['cas_r_canister', 'cas_l_canister', 'cas_center', 'mis', 'mis_child_01', 'tar', 'aoe'].map(id => ({ id: prefix + id }));
    const impact: EffectPlayback = { anchor: 'target', delay: 0.9, maxDuration: 1 };
    const plan = planActionEffects('renata', 'cast', effects, { [prefix + 'tar']: impact });
    expect(plan).toHaveLength(7);
    expect(plan.some(e => e.id === prefix + 'mis')).toBe(false);
    const missiles = plan.filter(e => e.playback.anchor === 'projectile');
    expect(missiles.map(e => e.playback.bone)).toEqual(['L_Canister', 'R_Canister']);
    expect(missiles.every(e => Math.abs(e.playback.delay + e.playback.maxDuration - impact.delay) < 1e-9)).toBe(true);
    expect(plan.find(e => e.id === prefix + 'tar')?.playback).toEqual(impact);
  });
  it('preserves unrelated and older asset bindings without guessing new effect ids', () => {
    for (const [unit, action] of [['renata', 'attack'], ['other', 'cast'], ['renata', 'cast']] as const) {
      const spec: EffectPlayback = { anchor: 'target', delay: 0.2, maxDuration: 0.5 };
      expect(planActionEffects(unit, action, [{ id: 'custom' }], { custom: spec })).toEqual([{ id: 'custom', playback: spec }]);
    }
  });
});

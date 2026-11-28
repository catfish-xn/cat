import { describe, expect, it } from 'vitest';
import { asScaleLabel, parseAsScale, realUnits, runRealCombat, parseAnchor } from '../dev/castcmp/real-combat';

// v-capture --as-scale (Fable 11-18): a recording-only slower caster, for internal evidence; nothing changes at 1.
const setup = { unit: 'twitch', star: 2, form: null, foe: 'amumu', dist: 3, nfoes: 1, foestar: 2, ally: 'amumu', allystar: 2 } as any;
const attacks = (asScale?: number) => {
  const ticks: number[] = [];
  const run = (runRealCombat as any)(realUnits(setup), 100, (_state: any, shown: any[]) => { for (const e of shown) if (e.type === 'attack' && e.attackerId === 'me') ticks.push(e.tick); },
    1, parseAnchor('attack-hit'), [], ...(asScale === undefined ? [] : [asScale]));
  return { ticks, run };
};

describe('castcmp --as-scale', () => {
  it('reads 0.2–1 only', () => {
    expect(parseAsScale('0.5')).toEqual({ asScale: 0.5 });
    expect(parseAsScale('1')).toEqual({ asScale: 1 });
    for (const bad of ['3', '0.1', '0', '-1', 'x', '', null]) expect('why' in parseAsScale(bad)).toBe(true);
  });
  it('labels only a changed speed', () => {
    expect(asScaleLabel(0.5)).toBe('录制专用：攻速×0.5');
    expect(asScaleLabel(1)).toBeNull(); expect(asScaleLabel(undefined)).toBeNull();
  });
  it('at 1 (or left out) the combat is exactly as before; below 1 the caster attacks less often', () => {
    const plain = attacks(), one = attacks(1), slow = attacks(0.5);
    expect(one.ticks).toEqual(plain.ticks);
    expect(plain.ticks.length).toBeGreaterThan(2);
    expect(slow.ticks[1]! - slow.ticks[0]!).toBeGreaterThan(1.5 * (plain.ticks[1]! - plain.ticks[0]!));
  });
});

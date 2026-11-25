import { Group, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { SLOT_BONE, SLOT_LIFT, sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { FX_SCALE, unitAnchor } from '../src/rendering/three-mode/vfx-ltk/particles';
import { OVERHEAD_TOP } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createUnitOverhead, DEFAULT_METER_COLORS } from '../src/rendering/three-mode/unit-overhead';
import { readFileSync } from 'node:fs';

// 11-25 (Fable): Sevika's slot machine stood on her feet (its own rise put it over her upper body), then on her head (it
// still sat on her bar). The original reads her, her bar and items, then the machine whole, with a small gap under it, at
// every star level. It and every result layer stand on the top of her bar row, lowered a little by a fitted amount.

const slotKeys = Object.keys(sevikaSkills).filter(key => key.startsWith('sevika-slots'));

describe('the slot machine stands on her bar', () => {
  it('the machine and every result layer, the pairs too, stand on the bar\'s top, by one fitted amount', () => {
    expect(SLOT_BONE).toBe(OVERHEAD_TOP);
    expect(Math.abs(SLOT_LIFT)).toBeLessThan(20);
    expect(slotKeys).toContain('sevika-slots');
    expect(slotKeys.filter(key => key.endsWith('-pair')).length).toBeGreaterThan(0);
    for (const key of slotKeys) for (const cue of sevikaSkills[key]!) expect([cue.bone, cue.lift], key).toEqual([SLOT_BONE, SLOT_LIFT]);
  });
  it('plays from code, not from the asset index\'s older copy, and the index format takes it', () => {
    for (const key of slotKeys) expect(CUE_OVERRIDES[key], key).toBe(sevikaSkills[key]);
    expect(() => parseIndex({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { sevika: sevikaSkills['sevika-slots']!.map(c => ({ ...c, system: 'a' })) } })).not.toThrow();
    expect(() => parseIndex({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { sevika: [{ system: 'a', event: 'cast-start', delay: 0, duration: 1, lift: 'up' }] } })).toThrow('timeline-cue');
  });
  it('her other lists are left as they were', () => {
    for (const [key, cues] of Object.entries(sevikaSkills)) if (!slotKeys.includes(key))
      for (const cue of cues) expect([cue.bone, cue.lift]).not.toContain(SLOT_BONE);
  });
});

describe('the bar-top anchor', () => {
  const unit = () => {
    const root = new Group(); root.position.set(30, 0, -12);
    const body = new Group(); const overhead = new Object3D(); overhead.name = 'C_Buffbone_Glb_Overhead_Loc'; overhead.position.set(5, 80, 5);
    body.add(overhead); root.add(body); root.updateMatrixWorld(true);
    return { root, body };
  };
  it('stands straight over the unit at the bar\'s top, plus the cue\'s lift, and follows the bar', () => {
    const { root, body } = unit();
    let top: number | undefined = 120;
    const anchor = unitAnchor(root, body, OVERHEAD_TOP, undefined, () => top, -6);
    const [x, y, z] = anchor.originAt(0);
    expect(Math.abs(x) * FX_SCALE).toBeCloseTo(30, 6); expect(z * FX_SCALE).toBeCloseTo(-12, 6);
    expect(y * FX_SCALE).toBeCloseTo(114, 6);
    top = 150; expect(anchor.originAt(0)[1] * FX_SCALE).toBeCloseTo(144, 6);
  });
  it('without a bar drawn, the overhead locator', () => {
    const { root, body } = unit();
    expect(unitAnchor(root, body, OVERHEAD_TOP, undefined, () => undefined).originAt(0)[1] * FX_SCALE).toBeCloseTo(80, 6);
  });
  it('the renderer hands each drawn bar\'s top to the effects', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    expect(source).toContain('view.overheadTop = view.overhead.drawn ? over.bar + view.overhead.top : undefined;');
    expect(readFileSync(new URL('../src/rendering/three-mode/vfx-ltk/runtime.ts', import.meta.url), 'utf8'))
      .toContain('unitAnchor(host!.root, host!.body, spawn.bone, aim, () => host!.overheadTop, spawn.lift);');
  });
  it('the bar row\'s top is over its origin while a bar shows, and 0 with none', () => {
    const view = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
    expect(view.top).toBe(0);
    view.set('player', { hp: 100, maxHp: 100, mana: 0, maxMana: 50, shield: 0 } as never, []);
    expect(view.top).toBeGreaterThan(0);
    view.dispose();
  });
});

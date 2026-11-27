import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESIST_CUTS, statusIcons } from '../src/presentation/status-icons';
import { CUE_OVERRIDES, SUSTAIN_CAPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { rell } from '../src/rendering/three-mode/vfx-ltk/batch3/rell';

// 11-25 (user, via Fable): in the real game a cut to armour or magic resist shows nothing. Every display we added for one
// goes; an asset's own short hit effect stays as the asset plays it, once per hit.

describe('no display of our own for a resistance cut', () => {
  it('the 2D piece draws no icon for an armour or magic-resist cut, and still draws the others', () => {
    expect(RESIST_CUTS).toEqual(['sunder', 'shred']);
    const unit = { id: 'a', alive: true, shield: 0, statuses: ['sunder', 'shred', 'stun', 'burn'].map(kind => ({ kind, harmful: true })) } as never;
    expect(statusIcons(null, unit).map(icon => icon.kind)).toEqual(['stun', 'burn']);
  });
  it('Rell\'s whole-fight overhead icon is gone; her steal hit plays once per hit as exported', () => {
    expect(existsSync(new URL('../src/rendering/three-mode/debuff-icons.ts', import.meta.url))).toBe(false);
    const renderer = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    const overhead = readFileSync(new URL('../src/rendering/three-mode/unit-overhead.ts', import.meta.url), 'utf8');
    for (const text of ['debuffMarks', 'setDebuffs', 'debuff-icons']) { expect(renderer).not.toContain(text); expect(overhead).not.toContain(text); }
    const steal = CUE_OVERRIDES.rell!.filter(cue => cue.system === '5fe3dc8a');
    expect(steal).toEqual(rell.rell!.filter(cue => cue.system === '5fe3dc8a'));
    expect(steal).toHaveLength(1);
    expect(Object.hasOwn(SUSTAIN_CAPS, '5fe3dc8a')).toBe(false);
  });
  it('Ekko\'s mark is no longer held past its exported time', () => {
    expect(Object.hasOwn(SUSTAIN_CAPS, '5af49b76')).toBe(false);
    expect(CUE_OVERRIDES.ekko!.filter(cue => cue.system === '5af49b76').map(cue => cue.duration)).toEqual([0.5]);
  });
});

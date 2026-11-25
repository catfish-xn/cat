import { describe, expect, it } from 'vitest';
import { SLOT_BONE, sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// 11-25 (Fable): Sevika's slot machine stood on her feet (its own lift put it over her upper body and the row behind her);
// the original's floats above her bar. It and every result layer stand on her head locator, lifted by their own data.

const slotKeys = Object.keys(sevikaSkills).filter(key => key.startsWith('sevika-slots'));

describe('the slot machine stands over her head', () => {
  it('names her head locator', () => {
    expect(SLOT_BONE).toBe('C_BUFFBONE_GLB_HEAD_LOC');
  });
  it('the machine and every result layer, the pairs too, stand on it', () => {
    expect(slotKeys).toContain('sevika-slots');
    expect(slotKeys.filter(key => key.endsWith('-pair')).length).toBeGreaterThan(0);
    for (const key of slotKeys) for (const cue of sevikaSkills[key]!) expect(cue.bone, key).toBe(SLOT_BONE);
  });
  it('plays from code, not from the asset index\'s older copy', () => {
    for (const key of slotKeys) expect(CUE_OVERRIDES[key], key).toBe(sevikaSkills[key]);
  });
  it('her other lists are left as they were', () => {
    for (const [key, cues] of Object.entries(sevikaSkills)) if (!slotKeys.includes(key))
      for (const cue of cues) expect(cue.bone).not.toBe(SLOT_BONE);
  });
});

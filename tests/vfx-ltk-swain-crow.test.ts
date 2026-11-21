import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { swain } from '../src/rendering/three-mode/vfx-ltk/batch3/swain';

// Fable 11-21: Swain's back-row crow flies as the whole crow system (smoke and red flash with the crow it carries), to the
// primary target only for now; every other cue of the exported cast stays as it was.
const CROW = '9ad716c2', WHOLE = '3d2697ac';

describe('Swain back-row crow', () => {
  it('flies the whole crow system in place of the bare crow, to the primary target, with the same timing', () => {
    const exported = swain['swain-back']!, cues = CUE_OVERRIDES['swain-back']!;
    expect(cues.some(cue => cue.system === CROW)).toBe(false);
    const whole = cues.filter(cue => cue.system === WHOLE);
    expect(whole).toHaveLength(1);
    const bare = exported.find(cue => cue.system === CROW)!;
    expect(whole[0]).toEqual({ ...bare, system: WHOLE, primary: true });
    expect(cues.filter(cue => cue.system !== WHOLE)).toEqual(exported.filter(cue => cue.system !== CROW));
    expect(cues.length).toBeLessThanOrEqual(12);
  });
});

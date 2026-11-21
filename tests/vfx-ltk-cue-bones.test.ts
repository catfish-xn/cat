import { describe, expect, it } from 'vitest';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

describe('cue bones that exist in the skeleton (11-18 bone scan)', () => {
  it("Mel's bolts leave her left hand's locator, not the L_Buffbone_Engine her skeleton lacks", () => {
    // Her bolts play from her rules' launch events since 11-21 (batch2-bridge.ts), from the display branch 'mel-bolt'.
    const bolt = CUE_EXTRA_SKILLS['mel-bolt']!.find(c => c.system === 'fe407ac6')!;
    expect(bolt.bone).toBe('L_Buffbone_Glb_Hand_Loc');
  });
});

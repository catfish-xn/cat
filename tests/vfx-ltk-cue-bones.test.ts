import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

describe('cue bones that exist in the skeleton (11-18 bone scan)', () => {
  it("Mel's bolts leave her left hand's locator, not the L_Buffbone_Engine her skeleton lacks", () => {
    const bolt = CUE_OVERRIDES.mel!.find(c => c.system === 'fe407ac6')!;
    expect(bolt.bone).toBe('L_Buffbone_Glb_Hand_Loc');
  });
});

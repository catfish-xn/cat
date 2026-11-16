import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Malzahar's gate (cue-overrides.ts): the bolt flies to each enemy the gate hits and the portal opens under that enemy the
// moment the bolt lands, so the two read as one strike per enemy (fitted timings, docs/S13_RULES_GAP.md 2026-11-16).
const BOLT = '7d0f4b1e', PORTAL = '10e4e326';

describe('vfx-ltk Malzahar gate', () => {
  it('opens the portal on the ground under each hit enemy exactly when the bolt lands there', () => {
    const cues = CUE_OVERRIDES.malzahar!;
    const bolt = cues.find(cue => cue.system === BOLT), portal = cues.find(cue => cue.system === PORTAL);
    expect(bolt).toMatchObject({ action: 'cast', event: 'projectile' });
    expect(portal).toMatchObject({ action: 'cast', event: 'hit', bone: 'BUFFBONE_GLB_GROUND_LOC' });
    // Both go to every enemy the gate hits: neither is limited to the primary target or to a count.
    for (const cue of [bolt!, portal!]) { expect(cue.primary).toBeUndefined(); expect(cue.targetLimit).toBeUndefined(); expect(cue.others).toBeUndefined(); }
    expect(bolt!.travelSeconds).toBeGreaterThan(0);
    expect(portal!.delay).toBeCloseTo(bolt!.delay + bolt!.travelSeconds!, 9);
  });
});

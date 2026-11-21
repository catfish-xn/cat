import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Fable 11-21: Cassiopeia's ground area plays on her third cast only (the rules' splash branch), on the ground at her primary
// target when her comet lands there, at the asset's own size and time; the splashed enemies get none of their own.
const AREA = 'c83f1f21';

describe('Cassiopeia third-cast ground area', () => {
  it('plays once, at the primary target, on the splash branch, with the comet\'s landing', () => {
    const cues = CUE_OVERRIDES.cassiopeia!;
    const area = cues.filter(cue => cue.system === AREA);
    expect(area).toHaveLength(1);
    expect(area[0]).toMatchObject({ action: 'cast', event: 'hit', bone: 'BUFFBONE_GLB_GROUND_LOC', primary: true, branch: 'splash', ownLife: true });
    expect(area[0]!.scale).toBeUndefined();
    expect(area[0]!.targetLimit).toBeUndefined();
    // The same moment her hits land: the comet's flight end.
    const hits = cues.filter(cue => cue.system === 'b124a9c5');
    expect(hits.every(hit => hit.delay === area[0]!.delay)).toBe(true);
    const comet = cues.find(cue => cue.system === '9f19f946')!;
    expect(area[0]!.delay).toBeCloseTo(comet.delay + comet.travelSeconds!, 9);
    expect(cues.length).toBeLessThanOrEqual(12);
  });
});

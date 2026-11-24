import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Fable 11-21: Cassiopeia's bolt hit plays where the bolt hits: on her primary target, every cast, for the asset's own time.
// Nothing about the asset is changed.
const BOLT_HIT = '259c4cbc';

describe('Cassiopeia bolt hit effect', () => {
  it('plays once per cast on the primary target when the comet lands', () => {
    const cues = CUE_OVERRIDES.cassiopeia!;
    const hit = cues.filter(cue => cue.system === BOLT_HIT);
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ action: 'cast', event: 'hit', bone: 'C_BUFFBONE_GLB_CENTER_LOC', primary: true, ownLife: true });
    // Every cast: no branch, no target limit, no size of our own.
    expect(hit[0]!.branch).toBeUndefined();
    expect(hit[0]!.targetLimit).toBeUndefined();
    expect(hit[0]!.scale).toBeUndefined();
    const comet = cues.find(cue => cue.system === '9f19f946')!;
    expect(hit[0]!.delay).toBeCloseTo(comet.delay + comet.travelSeconds!, 9);
    expect(cues.length).toBeLessThanOrEqual(12);
  });
  it('leaves the unplayed ground system and the other spell\'s missile out', () => {
    expect(CUE_OVERRIDES.cassiopeia!.some(cue => cue.system === 'c83f1f21')).toBe(false);
    // In her data b124a9c5 is another spell's missile with no hit effect; it is not played as a still ground hit.
    expect(CUE_OVERRIDES.cassiopeia!.some(cue => cue.system === 'b124a9c5')).toBe(false);
  });
});

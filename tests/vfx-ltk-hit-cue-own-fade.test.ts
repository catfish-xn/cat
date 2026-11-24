import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Two hit cues the default cue time cut while their own particles were still plainly visible now play until those have all
// but gone (fitted times, not original data): Ekko's passive burst and Scar's grenade hit on each target. Every other cue of
// their lists stays as it was.
const exported = JSON.parse(readFileSync('tests/fixtures/cue-index-systems.json', 'utf8')).champions as Record<string, string[]>;

describe('hit cues played until their own particles fade', () => {
  it("Ekko's passive burst lasts past the exported second; his list keeps every exported system once", () => {
    const cues = CUE_OVERRIDES.ekko!;
    expect([...new Set(cues.map(cue => cue.system))].sort()).toEqual([...exported.ekko!].sort());
    expect(cues).toHaveLength(exported.ekko!.length);
    const burst = cues.find(cue => cue.system === '970252f2')!;
    expect(burst).toMatchObject({ action: 'cast', event: 'hit', delay: 0.6 });
    expect(burst.duration).toBeGreaterThan(1);
    expect(burst.duration).toBeLessThanOrEqual(4);
    expect(cues.find(cue => cue.system === 'dda9e01c')).toMatchObject({ event: 'hit', delay: 0.6, duration: 1 });
  });
  it("Scar's grenade hit lasts past its old cut and keeps its place and targets", () => {
    const hit = CUE_OVERRIDES.scar!.find(cue => cue.system === 'd07052bc')!;
    expect(hit).toMatchObject({ action: 'cast', event: 'hit', delay: 0.4, targetLimit: 3 });
    expect(hit.duration).toBeGreaterThan(0.55);
    expect(hit.duration).toBeLessThanOrEqual(4);
  });
});

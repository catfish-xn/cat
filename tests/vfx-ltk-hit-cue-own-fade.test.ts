import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// A hit cue the default cue time cut while its own particles were still plainly visible now plays until those have all but
// gone (a fitted time, not original data): Ekko's passive burst. Every other cue of his list stays as it was.
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
});

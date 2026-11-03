import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES, cueOverride } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

describe('reviewed vfx-ltk cue overrides', () => {
  const exported: TimelineCue[] = [{ system: 'aa', action: 'cast', event: 'hit', delay: 0.8, duration: 1 }];
  const fixed: TimelineCue[] = [{ system: 'bb', action: 'cast', event: 'cast-start', delay: 0.2, duration: 0.6 }];
  const index = (systems: Record<string, string>) => ({ version: 1, systems, assets: {}, skills: { probe: exported } });

  it('replaces a champion\'s exported list only when every overriding system was exported', () => {
    (CUE_OVERRIDES as Record<string, readonly TimelineCue[]>).probe = fixed;
    try {
      expect(parseIndex(index({ aa: 'aa.json', bb: 'bb.json' })).skills.probe).toEqual(fixed);
      expect(parseIndex(index({ aa: 'aa.json' })).skills.probe).toEqual(exported);
      expect(cueOverride('probe', { aa: 'x' })).toBeUndefined();
    } finally { delete (CUE_OVERRIDES as Record<string, readonly TimelineCue[]>).probe; }
  });

  it('every shipped override is a well-formed timeline', () => {
    for (const [champion, cues] of Object.entries(CUE_OVERRIDES)) {
      const systems = Object.fromEntries(cues.map(cue => [cue.system, `${cue.system}.json`]));
      expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { [champion]: cues } }), champion).not.toThrow();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, HIT_TAIL_MAX_SECONDS, HIT_TAIL_SECONDS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Hit cues cut while still clearly lit now run until their system has all but faded out (fitted, not original data),
// capped; nothing else about them, or about the other cues of their lists, changes.
// zyra-vines is a display branch (CUE_EXTRA_SKILLS); the others are champions' own lists.
const listOf = (name: string) => CUE_OVERRIDES[name] ?? CUE_EXTRA_SKILLS[name];
const LISTS: Record<keyof typeof HIT_TAIL_SECONDS, { list: string; count: number }> = {
  bc4a9e0d: { list: 'akali', count: 1 },
  '9d413df0': { list: 'zyra-vines', count: 2 },
  a5373796: { list: 'darius', count: 1 },
  fb4ea008: { list: 'tristana', count: 1 },
};

describe('hit cues played to their fade', () => {
  it('stay within the cap and outlast the default they replaced', () => {
    for (const seconds of Object.values(HIT_TAIL_SECONDS)) {
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(HIT_TAIL_MAX_SECONDS);
    }
    expect(HIT_TAIL_MAX_SECONDS).toBe(4);
  });
  for (const [system, { list, count }] of Object.entries(LISTS) as [keyof typeof HIT_TAIL_SECONDS, { list: string; count: number }][]) {
    it(`${list}: ${system} runs HIT_TAIL_SECONDS as a plain hit`, () => {
      const cues = listOf(list)!.filter(cue => cue.system === system);
      expect(cues).toHaveLength(count);
      for (const cue of cues) {
        expect(cue.event).toBe('hit');
        expect(cue.duration).toBe(HIT_TAIL_SECONDS[system]);
        // The length is the cue's own; the system's own-life, fade-out and play-out switches stay off.
        expect(cue.ownLife).toBeUndefined();
        expect(cue.fadeOut).toBeUndefined();
        expect(cue.stopAfter).toBeUndefined();
      }
    });
  }
  it('zyra-vines keeps one burst on the primary target and one on the others', () => {
    const vines = CUE_EXTRA_SKILLS['zyra-vines']!.filter(cue => cue.system === '9d413df0');
    expect(vines.filter(cue => cue.primary)).toHaveLength(1);
    expect(vines.filter(cue => cue.others)).toHaveLength(1);
  });
});

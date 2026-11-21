import { describe, expect, it } from 'vitest';
import { parseIndex, SKILL_CUES_TOGETHER, skillCuesTogether } from '../src/rendering/three-mode/vfx-ltk/loader';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// A skill list holds at most SKILL_CUES_TOGETHER cues that can play together (Fable 11-21): rows of different variants
// never play together, so each variant's playable set (its rows, plus the plain rows of the actions it has none for) is
// counted on its own, and the plain set too.
const cue = (action: TimelineCue['action'], variant?: TimelineCue['variant']): TimelineCue =>
  ({ system: 'a', action, event: 'cast-start', delay: 0, duration: 1, ...(variant ? { variant } : {}) });
const index = (cues: TimelineCue[]) => ({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { jinx: cues } });
const many = (n: number, action: TimelineCue['action'], variant?: TimelineCue['variant']) => Array.from({ length: n }, () => cue(action, variant));

describe('the skill cue gate counts what can play together', () => {
  it('is twelve', () => expect(SKILL_CUES_TOGETHER).toBe(12));
  it('mutually exclusive variants count apart: twelve plain rows and twelve empowered attack rows pass', () => {
    const cues = [...many(2, 'attack'), ...many(10, 'cast'), ...many(2, 'attack', 'empowered')];
    expect(skillCuesTogether(cues)).toBe(true);
    expect(() => parseIndex(index(cues))).not.toThrow();
    const apart = [...many(12, 'attack'), ...many(12, 'attack', 'empowered'), ...many(12, 'attack', 'empowered-alt')];
    expect(() => parseIndex(index(apart))).not.toThrow();
  });
  it('a variant\'s set counts the plain rows of the actions it has none for: past twelve it is refused', () => {
    // The empowered set: 3 empowered attacks + 10 plain casts = 13.
    const cues = [...many(1, 'attack'), ...many(10, 'cast'), ...many(3, 'attack', 'empowered')];
    expect(skillCuesTogether(cues)).toBe(false);
    expect(() => parseIndex(index(cues))).toThrow('skill');
  });
  it('any one variant\'s own rows past twelve are refused, as are thirteen plain rows', () => {
    expect(() => parseIndex(index([...many(2, 'cast'), ...many(13, 'attack', 'empowered')]))).toThrow('skill');
    expect(() => parseIndex(index(many(13, 'cast')))).toThrow('skill');
  });
});

import { describe, expect, it } from 'vitest';
import { CAST_START_RANKS } from '../src/rendering/three-mode/vfx-ltk/cue-ranks';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { effectImportance } from '../src/rendering/three-mode/effect-budget';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Explicit cast-start ranks (Fable 11-19): 61 rows, 33 body and 28 decorative, labels only.
describe('cast-start ranks', () => {
  const rows = Object.values(CAST_START_RANKS).flatMap(ranks => Object.values(ranks));
  it('lists 61 rows: 33 body, 28 decorative', () => {
    expect(rows).toHaveLength(61);
    expect(rows.filter(rank => rank === 'body')).toHaveLength(33);
    expect(rows.filter(rank => rank === 'decorative')).toHaveLength(28);
  });
  it("Ambessa's chain swipe is body; her wind-up and dust are decorative", () => {
    expect(CAST_START_RANKS.ambessa).toEqual({ '754b6c78': 'decorative', a429a900: 'decorative', '6390530e': 'body', '3b4c15e0': 'body' });
  });
  it('labels only the listed cast-starts of the listed branch; the rank decides the importance', () => {
    const cue = (system: string, event: TimelineCue['event'] = 'cast-start'): TimelineCue => ({ system, action: 'cast', event, delay: 0, duration: 0.3 });
    const index = { version: 1, systems: Object.fromEntries(['3b4c15e0', '754b6c78', 'ffff0000'].map(id => [id, `systems/${id}.json`])), assets: {},
      skills: { ambessa: [cue('3b4c15e0'), cue('754b6c78'), cue('ffff0000'), cue('3b4c15e0', 'hit')] } } as never;
    const ranked = (withCueOverrides(index) as unknown as { skills: Record<string, TimelineCue[]> }).skills.ambessa!;
    const mine = ranked.filter(c => ['3b4c15e0', '754b6c78', 'ffff0000'].includes(c.system));
    expect(mine.map(c => [c.system, c.event, c.rank])).toEqual([['3b4c15e0', 'cast-start', 'body'], ['754b6c78', 'cast-start', 'decorative'], ['ffff0000', 'cast-start', undefined], ['3b4c15e0', 'hit', undefined]]);
    expect(mine.map(c => effectImportance(c))).toEqual(['body', 'decorative', 'decorative', 'critical']);
  });
});

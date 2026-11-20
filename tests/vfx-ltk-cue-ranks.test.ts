import { describe, expect, it } from 'vitest';
import { CAST_START_RANKS } from '../src/rendering/three-mode/vfx-ltk/cue-ranks';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { effectImportance } from '../src/rendering/three-mode/effect-budget';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Explicit cast-start ranks (Fable 11-19): 61 rows reviewed, 33 body and 28 decorative; Smeech's four swipes became one
// (#765: only his vertical swipe plays with a stab), so 58 rows, 30 body and 28 decorative. Labels only.
describe('cast-start ranks', () => {
  const rows = Object.values(CAST_START_RANKS).flatMap(ranks => Object.values(ranks));
  it('lists 58 rows: 30 body, 28 decorative', () => {
    expect(rows).toHaveLength(58);
    expect(rows.filter(rank => rank === 'body')).toHaveLength(30);
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

describe('the generic basic-attack hit holds its run only as long as it shows', () => {
  it('a longer cue is cut to ATTACK_HIT_SECONDS, a shorter one keeps its length, other systems and skill hits are untouched', async () => {
    const { ATTACK_HIT_SECONDS, ATTACK_HIT_SYSTEM } = await import('../src/rendering/three-mode/vfx-ltk/cue-ranks');
    const hit = (system: string, duration: number, action: 'attack' | 'cast' = 'attack'): TimelineCue => ({ system, action, event: 'hit', delay: 0.5, duration });
    const index = { version: 1, systems: { [ATTACK_HIT_SYSTEM]: 's.json', abcdabcd: 's.json' }, assets: {},
      skills: { zzz: [hit(ATTACK_HIT_SYSTEM, 1.5), hit(ATTACK_HIT_SYSTEM, 0.45), hit('abcdabcd', 1.5), hit(ATTACK_HIT_SYSTEM, 1.5, 'cast')] } } as never;
    const out = (withCueOverrides(index) as unknown as { skills: Record<string, TimelineCue[]> }).skills.zzz!;
    expect(out.map(c => c.duration)).toEqual([ATTACK_HIT_SECONDS, 0.45, 1.5, 1.5]);
  });
});

import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

describe("Mel's third-cast R explosion (3857e78b)", () => {
  const third = CUE_OVERRIDES['mel-third']!;
  const explosion = third.filter(cue => cue.system === '3857e78b');

  it('is one hit cue on every target the cast hits, up to the strike before it (a9cc7bf3), not the primary alone', () => {
    expect(explosion).toHaveLength(1);
    expect(explosion[0]).toMatchObject({ event: 'hit', targetLimit: 5, delay: 1.2, duration: 1 });
    expect(explosion[0]!.primary).toBeUndefined();
    expect(third.find(cue => cue.system === 'a9cc7bf3')!.targetLimit).toBe(explosion[0]!.targetLimit);
  });

  it('maps to one explosion per target, three targets three explosions', () => {
    const { spawns, unsupported } = mapSkillTimeline(explosion, 'mel', ['a', 'b', 'c']);
    expect(unsupported).toEqual([]);
    expect(spawns.map(spawn => spawn.targetId)).toEqual(['a', 'b', 'c']);
  });
});

import { describe, expect, it } from 'vitest';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Leona's override replaces the asset index's baked list whole. That list has these four systems, each under one action:
// attack hit, cast, end burst, passive hit. The override must keep every one of them.
const INDEX_LIST = [['attack', '0f2af66b'], ['cast', '8d9a4ccc'], ['end', 'dda108d2'], ['passive', '6f29051a']];

describe('Leona\'s reviewed list replaces the index list without dropping systems', () => {
  it('the override is the batch-1 list', () => {
    expect(CUE_OVERRIDES.leona).toBe(BATCH1_TIMELINES.leona);
  });
  it('every system of the index list is still there under its action', () => {
    const have = CUE_OVERRIDES.leona!.map(c => [c.action ?? 'cast', c.system]);
    for (const pair of INDEX_LIST) expect(have).toContainEqual(pair);
  });
  it('W_cas_hit plays at the cast and at the end, each to its own end (no stopAfter)', () => {
    const burst = CUE_OVERRIDES.leona!.filter(c => c.system === 'dda108d2');
    expect(burst.map(c => [c.action, c.event, c.delay, c.stopAfter])).toEqual([['cast', 'cast-start', 0, undefined], ['end', 'cast-start', 0, undefined]]);
  });
});

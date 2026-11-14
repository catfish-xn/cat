import { describe, expect, it, vi } from 'vitest';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import type { LtkPlayOptions } from '../src/rendering/three-mode/vfx-ltk/runtime';

// The batch2 bridge passes a retimed swing's release mapping (AttackRelease) on to its attack plays; casts never take it.
const board = { columns: 7, rows: 8, hexRadius: 34, origin: { x: 10, y: 20 } };
const timing = { atSeconds: 0.2, clipSeconds: 0.8, tailSpeed: 1 }; // synthetic
function bridge(champion: string) {
  const play = vi.fn((_c: string, _s: string, _t: readonly string[], _a: 'cast' | 'attack', _context: LtkPlayOptions) => true);
  return { b: createBatch2VfxBridge({ unit: () => ({ definitionId: champion, form: 'front', alive: true, starLevel: 1 }), board: () => board, play }), play };
}
describe('batch2 bridge: attack release timing', () => {
  it.each(['sevika', 'jayce', 'jinx', 'mel', 'warwick', 'viktor'])('%s attack plays carry the release mapping', champion => {
    const { b, play } = bridge(champion);
    expect(b.action('attack', 'u', ['t'], undefined, timing)).toBe(true);
    expect(play).toHaveBeenCalled();
    for (const call of play.mock.calls) { expect(call[3]).toBe('attack'); expect(call[4].release).toEqual(timing); }
  });
  it.each(['sevika', 'jayce', 'jinx', 'mel', 'warwick', 'viktor'])('%s attack without a retimed swing plays exactly as before', champion => {
    const withNone = bridge(champion), before = bridge(champion);
    withNone.b.action('attack', 'u', ['t'], undefined, undefined); before.b.action('attack', 'u', ['t']);
    expect(withNone.play.mock.calls).toEqual(before.play.mock.calls);
    for (const call of withNone.play.mock.calls) expect('release' in call[4]).toBe(false);
  });
  it('a cast never takes the timing, and it does not leak into the next play', () => {
    const { b, play } = bridge('jinx');
    b.action('cast', 'u', ['t'], undefined, timing);
    b.action('attack', 'u', ['t']);
    for (const call of play.mock.calls) expect('release' in call[4]).toBe(false);
  });
});

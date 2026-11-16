import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Urgot's Q bursts where his missile lands: Q_tar on the primary, Q_Explosion on every enemy hit (fitted to the missile's own
// landing in this list, not original data).
const MISSILE = 'e0afe94c', TAR = 'bd903b08', BLAST = 'fd5fd6cc';
const cast = () => CUE_OVERRIDES.urgot!.filter(c => (c.action ?? 'cast') === 'cast');

describe('Urgot\'s Q bursts on landing', () => {
  it('both bursts start when the missile arrives', () => {
    const missile = cast().find(c => c.system === MISSILE)!;
    const landing = missile.delay + (missile.travelSeconds ?? 0);
    expect(cast().filter(c => c.system === TAR || c.system === BLAST).map(c => [c.system, c.event, c.delay]))
      .toEqual([[TAR, 'hit', landing], [BLAST, 'hit', landing]]);
  });
  it('Q_tar on the primary only, Q_Explosion on each enemy hit', () => {
    const mapped = mapSkillTimeline(cast(), 'urgot', ['f1', 'f2', 'f3']);
    expect(mapped.unsupported).toEqual([]);
    const on = (system: string) => mapped.spawns.filter(s => s.system === system).map(s => s.targetId).sort();
    expect(on(TAR)).toEqual(['f1']);
    expect(on(BLAST)).toEqual(['f1', 'f2', 'f3']);
    expect(on(MISSILE)).toEqual(['f1']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import type { LtkPlayOptions } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Gangplank's attack follows his form, as Jayce's does: in his ranged form (back rows) the shot flies and lands with its
// hit; in melee form, and for his cast, his own list plays as before.
function bridge(form: 'front' | 'back') {
  const play = vi.fn((_champion: string, _source: string, _targets: readonly string[], _action: 'cast' | 'attack', _context: LtkPlayOptions) => true);
  const host = { unit: (_id: string) => ({ definitionId: 'gangplank', form, alive: true, starLevel: 2 }), board: () => null, play };
  return { bridge: createBatch2VfxBridge(host as never), play };
}
describe("Gangplank's attack by form", () => {
  it('ranged form: his attack plays the ranged branch', () => {
    const { bridge: b, play } = bridge('back');
    expect(b.action('attack', 'gp', ['foe'])).toBe(true);
    expect(play.mock.calls[0]).toMatchObject(['gangplank', 'gp', ['foe'], 'attack', { skill: 'gangplank-ranged' }]);
  });
  it('melee form, and any cast, fall through to his own list', () => {
    const melee = bridge('front');
    expect(melee.bridge.action('attack', 'gp', ['foe'])).toBeUndefined();
    expect(melee.play).not.toHaveBeenCalled();
    const ranged = bridge('back');
    expect(ranged.bridge.action('cast', 'gp', ['foe'], { type: 'cast', sourceId: 'gp', actionSeq: 1, tick: 1 } as never)).toBeUndefined();
    expect(ranged.play).not.toHaveBeenCalled();
  });
  it('the ranged shot leaves his hand as the melee hit would land and its hit plays where it lands', () => {
    const cues = CUE_EXTRA_SKILLS['gangplank-ranged']!, shot = cues.find(c => c.event === 'projectile')!, hit = cues.find(c => c.event === 'hit')!;
    const meleeHit = CUE_OVERRIDES.gangplank!.find(c => c.action === 'attack' && c.event === 'hit')!;
    expect(shot).toMatchObject({ system: 'bb62fca2', action: 'attack', bone: 'r_hand', delay: meleeHit.delay });
    expect(hit).toMatchObject({ system: meleeHit.system, action: 'attack', delay: shot.delay + shot.travelSeconds! });
    expect(mapSkillTimeline(cues, 'gp', ['foe']).unsupported).toEqual([]);
  });
});

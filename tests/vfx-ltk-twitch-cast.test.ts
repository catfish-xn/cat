import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// 11-13: Twitch's cast event targets Twitch himself (Spray and Pray only arms his empowered attacks). The cast-time bolt
// had no enemy to fly to, so mapSkillTimeline judged the whole cast unsupported and the old fallback played (4/4 casts in
// the admission audit). The bolts belong to the empowered attacks, which batch1-events aims at the enemies they pierce.
const twitch = CUE_OVERRIDES.twitch!;
const cast = twitch.filter(cue => (cue.action ?? 'cast') === 'cast' && cue.variant === undefined);
const empowered = twitch.filter(cue => cue.action === 'attack' && cue.variant === 'empowered');

describe('Twitch cast plays on a self-targeted cast event', () => {
  it('the cast list is the green aura only: no bolt or hit needing an enemy', () => {
    expect(cast.map(cue => cue.system)).toEqual(['54af463f', '2beb0657', '900dd2d2']);
    expect(cast.every(cue => cue.event === 'cast-start')).toBe(true);
  });

  it('a cast whose only target is Twitch maps with nothing unsupported', () => {
    const mapped = mapSkillTimeline(cast, 'twitch', ['twitch']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.map(spawn => spawn.system)).toEqual(['54af463f', '2beb0657', '900dd2d2']);
  });

  it('the bolts stay on the empowered attacks, aimed at the pierced enemies', () => {
    expect(empowered.map(cue => [cue.system, cue.event])).toEqual([['5938e29d', 'projectile'], ['4e7cc3b1', 'hit']]);
    const mapped = mapSkillTimeline(empowered, 'twitch', ['foe3', 'foe4']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.find(spawn => spawn.event === 'projectile')?.targetId).toBe('foe3');
    expect(mapped.spawns.filter(spawn => spawn.event === 'hit').map(spawn => spawn.targetId)).toEqual(['foe3', 'foe4']);
  });
});

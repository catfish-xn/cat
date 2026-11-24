import { describe, expect, it } from 'vitest';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Fable 11-24: Cassiopeia's comet and its hit come with the rules' own projectile ('cassiopeia-bolt'): the comet flies the
// rules' flight from its launch and the hit plays where it lands, on the primary target, for the asset's own time.
const BOLT_HIT = '259c4cbc', COMET = '9f19f946';

describe('Cassiopeia comet and its hit', () => {
  it('her cast list holds neither: they are the rule projectile\'s', () => {
    const cast = CUE_OVERRIDES.cassiopeia!.filter(cue => (cue.action ?? 'cast') === 'cast');
    expect(cast).toEqual([]);
  });
  it('the comet flies as a projectile from her chest; its hit plays once on the struck unit, at its own length', () => {
    const [comet, ...rest] = CUE_EXTRA_SKILLS['cassiopeia-bolt']!;
    expect(rest).toEqual([]);
    expect(comet).toMatchObject({ system: COMET, event: 'projectile', delay: 0, bone: 'C_buffbone_Glb_Chest_Loc', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' });
    const [hit, ...more] = CUE_EXTRA_SKILLS['cassiopeia-bolt-hit']!;
    expect(more).toEqual([]);
    expect(hit).toMatchObject({ system: BOLT_HIT, event: 'hit', delay: 0, ownLife: true, bone: 'C_BUFFBONE_GLB_CENTER_LOC' });
    expect(hit!.scale).toBeUndefined();
  });
  it('leaves the unplayed ground system and the not-yet-placed splash missile out', () => {
    const all = [...CUE_OVERRIDES.cassiopeia!, ...CUE_EXTRA_SKILLS['cassiopeia-bolt']!, ...CUE_EXTRA_SKILLS['cassiopeia-bolt-hit']!];
    expect(all.some(cue => cue.system === 'c83f1f21')).toBe(false);
    expect(all.some(cue => cue.system === 'b124a9c5')).toBe(false);
  });
});

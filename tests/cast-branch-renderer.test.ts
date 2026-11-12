import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer, selectCastSequence } from '../src/rendering3d/animation-mixer';
import { jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { melSkill } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// What the board plays is read off the rule's cast event (castIndex, branch); it keeps no cast count of its own.
// `kept` mirrors the runtime's filter (runtime.ts play): untagged cues always, tagged ones only for the named branch.
const kept = (cues: readonly TimelineCue[], branch?: string) => cues.filter(c => (c.action ?? 'cast') === 'cast' && (c.branch === undefined || c.branch === branch));

describe('rule-driven cast choice in the renderer', () => {
  it('Ekko rotates his three spell clips by the rule castIndex; an unreported index plays the first', () => {
    // The live manifest's Ekko entry (asset-root-live manifest.json, 11-12): one sequence whose main is a three-clip list.
    const names = ['tft13_ekko_spell_attack', 'tft13_ekko_spell_attack_2', 'tft13_ekko_spell_attack_3'];
    const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
    const clips = ['idle', ...names].map(name => new AnimationClip(name, 1, [new NumberKeyframeTrack('joint.position[x]', [0, 1], [0, 1])]));
    const mixer = new UnitAnimationMixer(root, clips, { idle: 'idle', cast: names[0] }, { castSequence: { main: names } });
    const played = (castIndex: number) => mixer.resolvePlayback('cast', castIndex)?.clips;
    expect([1, 2, 3, 4, 7].map(played)).toEqual([[names[0]], [names[1]], [names[2]], [names[0]], [names[0]]]);
    expect(played(0)).toEqual([names[0]]);
    mixer.dispose();
  });

  it('Jinx: each branch keeps only its own cues; an older replay (no branch) keeps none, so the cast falls back whole', () => {
    expect(kept(jinxSkills.jinx, 'zap').map(c => c.system)).toContain('40140250');
    for (const branch of ['zap', 'chompers', 'rocket']) expect(kept(jinxSkills.jinx, branch).every(c => c.branch === branch)).toBe(true);
    expect(kept(jinxSkills.jinx)).toEqual([]);
    // Animation without an index plays the default sequence (the manifest's castSequence) rather than guessing a turn.
    const meta = { castSequence: { main: 'rocket' }, castVariants: { rotate: ['zap', 'chomp', 'rocket'] } };
    expect(selectCastSequence(meta, 0)).toEqual({ main: 'rocket' });
    expect(selectCastSequence(meta, 2)).toEqual({ main: 'chomp' });
  });

  it('Cassiopeia: splash only on the reported third cast; an older replay plays the comet and no ground hit', () => {
    const cass = CUE_OVERRIDES.cassiopeia;
    expect(kept(cass, 'single').filter(c => c.system === 'b124a9c5')).toHaveLength(1);
    expect(kept(cass, 'splash').find(c => c.system === 'b124a9c5')?.targetLimit).toBe(3);
    expect(kept(cass).map(c => c.system)).toEqual(['9f19f946']);
  });

  it('Mel: the third cast is the rule branch `third`; anything else, or no branch, is the plain cast', () => {
    expect(['normal', 'third', undefined].map(melSkill)).toEqual(['mel', 'mel-third', 'mel']);
  });
});

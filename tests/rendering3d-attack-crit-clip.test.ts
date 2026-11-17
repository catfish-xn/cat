import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { UnitActionState } from '../src/rendering3d/animation-state';
import { assertManifest } from '../src/rendering3d/contracts';

// A basic attack that crits swings the model's Crit clip (AnimationNames.crit, the original's Crit), any other swings attack.
function rig(names: Record<string, string>) {
  const root = new Group(), body = new Bone(); body.name = 'Body'; root.add(body);
  const clip = (name: string, seconds: number) => new AnimationClip(name, seconds, [new NumberKeyframeTrack('Body.position[x]', [0, seconds], [0, 1])]);
  const mixer = new UnitAnimationMixer(root, [clip('rest', 1), clip('swing', 1.8), clip('crit', 1.2)], names, {});
  const state = new UnitActionState('twitch', { blendSeconds: 0, resolvePlayback: (action, detail) => mixer.resolvePlayback(action, 0, { crit: detail?.crit }) });
  return { mixer, state };
}

describe('attack crit clip', () => {
  it('a crit swings the crit clip, a plain attack the attack clip', () => {
    const { mixer, state } = rig({ idle: 'rest', attack: 'swing', crit: 'crit' });
    expect(state.consume({ type: 'attack', attackerId: 'twitch', crit: true }).playback?.clips).toEqual(['crit']);
    expect(mixer.resolvePlayback('attack', 0, {})?.clips).toEqual(['swing']);
    expect(mixer.resolvePlayback('attack', 0, { crit: true })?.clips).toEqual(['crit']);
    mixer.dispose();
  });

  it('a model without a crit clip swings its attack on a crit', () => {
    const { mixer, state } = rig({ idle: 'rest', attack: 'swing' });
    expect(state.consume({ type: 'attack', attackerId: 'twitch', crit: true }).playback?.clips).toEqual(['swing']);
    mixer.dispose();
  });

  it('the manifest accepts a crit clip name and still rejects an unknown action', () => {
    const entry = (animations: Record<string, string>) => ({ schemaVersion: 1, models: { twitch: { path: 'models/twitch/model.glb', animations } }, effects: {} });
    expect(() => assertManifest(entry({ idle: 'rest', attack: 'swing', crit: 'crit' }) as never)).not.toThrow();
    expect(() => assertManifest(entry({ idle: 'rest', smash: 'swing' }) as never)).toThrow('invalid-animation-map');
  });
});

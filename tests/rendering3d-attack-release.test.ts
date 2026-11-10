import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { assertManifest } from '../src/rendering3d/contracts';

function fixture(attackCastSeconds?: number) {
  const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
  const clip = (name: string, duration: number, a: number, b: number) => new AnimationClip(name, duration,
    [new NumberKeyframeTrack('joint.position[x]', [0, duration], [a, b])]);
  const clips = [clip('rest', 1, 0, 0), clip('windup', 0.5, 0, 1), clip('swing', 1, 2, 4)];
  const metadata = { attackSequence: { in: 'windup', main: 'swing' }, ...(attackCastSeconds === undefined ? {} : { attackCastSeconds }) };
  const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', attack: 'swing' }, metadata);
  return { bone, mixer };
}
const output = (playback: ReturnType<UnitAnimationMixer['resolvePlayback']>) =>
  ({ state: 'attack', previous: 'idle', blendSeconds: 0, loop: false, revision: 1, playback: playback! }) as const;

describe('plan C: attack wind-up at 1x, follow-through compressed', () => {
  it('plays up to the release at 1x and squeezes only the rest into the fitted time', () => {
    const f = fixture(0.6);
    const playback = f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 });
    expect(playback).toEqual({ clips: ['windup', 'swing'], durationSeconds: 0.9, releaseSeconds: 0.6 });
    f.mixer.apply(output(playback));
    f.mixer.update(0.25); expect(f.bone.position.x).toBeCloseTo(0.5);
    f.mixer.update(0.34); expect(f.bone.position.x).toBeCloseTo(2.18); // 0.59 s raw: 0.09 s into the swing (past its 0.08 s blend), still 1x
    f.mixer.update(0.11); expect(f.bone.position.x).toBeCloseTo(2.8); // release at 0.6, then 3x: 0.6 + 0.1 * 3 = 0.9 raw
    f.mixer.update(0.2); expect(f.bone.position.x).toBeCloseTo(4); // ends exactly at the fitted 0.9 s
    f.mixer.dispose();
  });
  it('switches speed and stage in one large step', () => {
    const f = fixture(0.6);
    f.mixer.apply(output(f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })));
    f.mixer.update(0.7); expect(f.bone.position.x).toBeCloseTo(2.8);
    f.mixer.dispose();
  });
  it('keeps the uniform fit without a release, when the clip fits, or when the release is past the fitted time', () => {
    expect(fixture().mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })).toEqual({ clips: ['windup', 'swing'], durationSeconds: 0.9 });
    expect(fixture(0.6).mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 2 })).toEqual({ clips: ['windup', 'swing'], durationSeconds: 1.5 });
    expect(fixture(1).mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })).toEqual({ clips: ['windup', 'swing'], durationSeconds: 0.9 });
    const f = fixture(1);
    f.mixer.apply(output(f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })));
    f.mixer.update(0.3); expect(f.bone.position.x).toBeCloseTo(1); // uniform 1.5 / 0.9 speed
    f.mixer.dispose();
  });
  it('validates attackCastSeconds in the manifest', () => {
    const base = { schemaVersion: 1, models: { a: { path: 'a.glb', attackCastSeconds: 0.3 } } };
    expect(() => assertManifest(base)).not.toThrow();
    expect(() => assertManifest({ ...base, models: { a: { path: 'a.glb', attackCastSeconds: -1 } } })).toThrow('invalid-attack-cast-seconds');
  });
});

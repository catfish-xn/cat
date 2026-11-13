import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer, selectCastSequence } from '../src/rendering3d/animation-mixer';
import { UnitActionState } from '../src/rendering3d/animation-state';
import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Offline tooling uses native ESM.
import { castReferencedClips } from '../scripts/assets3d/build.mjs';
// @ts-expect-error Offline tooling uses native ESM.
import { castClipsFor } from '../scripts/assets3d/stage-clip-ranges.mjs';
// @ts-expect-error Offline tooling uses native ESM.
import { planRotateEntry } from '../scripts/assets3d/stage-anim-sequences.mjs';

// Synthetic clips: each stage moves one joint across its own x range so the playing stage is visible.
function fixture() {
  const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
  const clip = (name: string, duration: number, a: number, b: number) => new AnimationClip(name, duration,
    [new NumberKeyframeTrack('joint.position[x]', [0, duration], [a, b])]);
  const clips = [clip('rest', 1, 0, 0), clip('zap', 1, 0, 1), clip('chomp', 1, 0, 2),
    clip('wind', 0.5, 10, 11), clip('fire', 1, 20, 22), clip('after', 0.5, 30, 31), clip('long', 2, 40, 44), clip('glow', 1.5, 0, 0)];
  const metadata = { castVariants: { rotate: ['zap', 'chomp', { in: 'wind', main: 'fire', out: 'after' }] } };
  const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', cast: 'zap' }, metadata);
  return { root, bone, clips, metadata, mixer };
}
const cast = { type: 'cast', sourceId: 'alpha' } as const;

describe('cast rotation entries that are whole sequences', () => {
  it('selects a string entry as a single main and a sequence entry as itself', () => {
    const { metadata } = fixture();
    // castIndex is the rule's cast number from the cast event (1 = first cast); 0 = not reported, so no rotation guess.
    expect(selectCastSequence(metadata, 1)).toEqual({ main: 'zap' });
    expect(selectCastSequence(metadata, 3)).toEqual({ in: 'wind', main: 'fire', out: 'after' });
    expect(selectCastSequence(metadata, 6)).toEqual({ in: 'wind', main: 'fire', out: 'after' });
    expect(selectCastSequence(metadata, 0)).toBeUndefined();
    // An explicit star3 variant still wins over the rotation; star level alone does not change it.
    expect(selectCastSequence({ castVariants: { ...metadata.castVariants, star3: { main: 'long' } } }, 3, { starLevel: 3 })).toEqual({ main: 'long' });
    expect(selectCastSequence(metadata, 3, { starLevel: 3 })).toEqual({ in: 'wind', main: 'fire', out: 'after' });
  });
  it('plays every stage of the rotating sequence in order on the third cast', () => {
    const f = fixture();
    // The board hands the cast event's castIndex to the resolver; the state machine itself counts nothing.
    let castIndex = 0;
    const state = new UnitActionState('alpha', { blendSeconds: 0, resolvePlayback: a => f.mixer.resolvePlayback(a, castIndex) });
    f.mixer.apply(state.output);
    castIndex = 1; expect(state.consume(cast).playback?.clips).toEqual(['zap']);
    castIndex = 2; expect(state.consume(cast).playback?.clips).toEqual(['chomp']);
    castIndex = 3; const output = state.consume(cast);
    expect(output.playback).toEqual({ clips: ['wind', 'fire', 'after'], durationSeconds: 2 });
    f.mixer.apply(output);
    f.mixer.update(0.25); expect(f.bone.position.x).toBeCloseTo(10.5);
    f.mixer.update(0.75); expect(f.bone.position.x).toBeCloseTo(21);
    f.mixer.update(0.75); expect(f.bone.position.x).toBeCloseTo(30.5);
    expect(state.update(1.5).state).toBe('cast'); expect(state.update(0.5).state).toBe('idle');
    f.mixer.dispose();
  });
  it('keeps the shared cast cap for a long rotating sequence and scales all stages to it', () => {
    const f = fixture();
    const metadata = { castVariants: { rotate: ['zap', { in: 'wind', main: 'long', out: 'after' }] } };
    const mixer = new UnitAnimationMixer(f.root, f.clips, { idle: 'rest' }, metadata);
    const playback = mixer.resolvePlayback('cast', 2)!;
    expect(playback).toEqual({ clips: ['wind', 'long', 'after'], durationSeconds: 2.5 });
    mixer.apply({ state: 'cast', previous: 'idle', revision: 1, loop: false, blendSeconds: 0, playback });
    mixer.update(2.5 * 0.5 / 3 + 2.5 * 1 / 3); expect(f.bone.position.x).toBeCloseTo(42);
    mixer.dispose(); f.mixer.dispose();
  });
  it('starts the layers of a rotating sequence with its main stage', () => {
    const f = fixture();
    const metadata = { castVariants: { rotate: [{ in: 'wind', main: 'fire', layers: ['glow'] }] } };
    const mixer = new UnitAnimationMixer(f.root, f.clips, { idle: 'rest' }, metadata);
    const playback = mixer.resolvePlayback('cast', 1)!;
    expect(playback).toEqual({ clips: ['wind', 'fire'], durationSeconds: 2 });
    mixer.apply({ state: 'cast', previous: 'idle', revision: 1, loop: false, blendSeconds: 0, playback });
    const glow = mixer.mixer.clipAction(f.clips.find(c => c.name === 'glow')!);
    mixer.update(0.25); expect(glow.isRunning()).toBe(false);
    mixer.update(0.5); expect(glow.isRunning()).toBe(true);
    mixer.dispose(); f.mixer.dispose();
  });
});

describe('cast rotation sequence contract and offline clip lists', () => {
  const entry = { path: 'alpha.glb', castVariants: { rotate: ['zap', { in: 'wind', main: 'fire', out: 'after', layers: ['glow'] }] } };
  it('accepts mixed string and sequence rotation entries', () => {
    expect(() => assertManifest({ schemaVersion: 1, models: { alpha: entry } })).not.toThrow();
  });
  it('rejects malformed rotation entries', () => {
    for (const rotate of [[], [' '], ['zap', { main: ' ' }], ['zap', { in: 'wind' }], ['zap', { main: 'fire', extra: 'x' }],
      ['zap', { main: 'fire', out: null }], ['zap', null], ['zap', ['fire']], ['zap', 7]]) {
      expect(() => assertManifest({ schemaVersion: 1, models: { alpha: { path: 'alpha.glb', castVariants: { rotate } } } })).toThrow();
    }
  });
  it('lists every stage of a rotating sequence for the exporter and the clip-range stager', () => {
    expect([...castReferencedClips(undefined, undefined, entry.castVariants)].sort()).toEqual(['after', 'fire', 'wind', 'zap']);
    expect([...castClipsFor(entry)].sort()).toEqual(['after', 'fire', 'wind', 'zap']);
  });
});

describe('planning a rotation entry from the original animation graph', () => {
  const atomic = (clipName: string, startFrame: number | null = null, endFrame: number | null = null, lastFrame = 60, fps = 30) => ({
    kind: 'Atomic', keyName: clipName, clipName, startFrame, endFrame,
    effectiveStartFrame: startFrame ?? 0, effectiveEndFrame: endFrame ?? lastFrame, fps, lastFrame,
    duration: ((endFrame ?? lastFrame) - (startFrame ?? 0)) / fps,
  });
  const sequencer = { kind: 'Sequencer', keyName: 'Spell_Beta', children: [
    atomic('wind', 0, 15, 45), atomic('fire', 0, 20, 60), atomic('fire', 21, 60, 60), atomic('after', null, null, 30)] };
  it('keeps a single whole clip as a string', () => {
    expect(planRotateEntry(atomic('zap'))).toMatchObject({ status: 'ok', rotateEntry: 'zap', clipRanges: {} });
  });
  it('turns a sequencer into in/main/out, merging adjacent pieces of one clip and trimming a partial clip', () => {
    expect(planRotateEntry(sequencer)).toMatchObject({
      status: 'ok',
      rotateEntry: { in: 'wind', main: 'fire', out: 'after' },
      clipRanges: { wind: [0, 0.5] },
      clipSegments: {},
      requiredClips: ['wind', 'fire', 'after'],
    });
    // The same range already staged for this clip is not a conflict.
    expect(planRotateEntry(sequencer, { entry: { clipRanges: { wind: [0, 0.5] } } })).toMatchObject({ status: 'ok' });
  });
  it('skips instead of overwriting a different existing clip range', () => {
    expect(planRotateEntry(sequencer, { entry: { clipRanges: { wind: [0, 0.4] } } })).toEqual({ status: 'skipped', reason: 'clipRanges 冲突 (wind)' });
    expect(planRotateEntry(sequencer, { entry: { clipRanges: { fire: [0, 1] } } })).toEqual({ status: 'skipped', reason: 'clipRanges 冲突 (fire)' });
  });
  it('skips graph nodes it cannot express', () => {
    expect(planRotateEntry({ kind: 'Selector', keyName: 'Spell_Beta' })).toEqual({ status: 'skipped', reason: '非常规节点 (Selector)' });
    expect(planRotateEntry(null)).toEqual({ status: 'skipped', reason: '未解析' });
  });
});

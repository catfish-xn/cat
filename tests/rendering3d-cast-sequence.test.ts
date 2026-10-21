import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack, LoopOnce } from 'three';
import { UnitAnimationMixer, selectCastSequence } from '../src/rendering3d/animation-mixer';
import { UnitActionState } from '../src/rendering3d/animation-state';
import { assertManifest } from '../src/rendering3d/contracts';
import { ModelCache } from '../src/rendering3d/assets';
// @ts-expect-error Offline tooling uses native ESM.
import { castClipNames } from '../scripts/assets3d/cast-animations.mjs';

function fixture() {
  const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
  const clip = (name: string, duration: number, a: number, b: number) => new AnimationClip(name, duration,
    [new NumberKeyframeTrack('joint.position[x]', [0, duration], [a, b])]);
  const clips = [clip('rest', 1, 0, 0), clip('entry', 0.5, 0, 1), clip('wait', 0.5, 1, 2),
    clip('strike', 1, 2, 4), clip('exit', 0.5, 4, 5), clip('alternate', 2, 0, 8), clip('fall', 0.5, 0, -1)];
  const names = { idle: 'rest', cast: 'strike', attack: 'strike', death: 'fall' };
  const metadata = { castSequence: { in: 'entry', hold: 'wait', main: 'strike', out: 'exit' } };
  const mixer = new UnitAnimationMixer(root, clips, names, metadata);
  const state = new UnitActionState('alpha', { blendSeconds: 0, resolvePlayback: (a, i) => mixer.resolvePlayback(a, i) });
  mixer.apply(state.output);
  return { root, bone, clips, names, metadata, mixer, state };
}
const cast = { type: 'cast', sourceId: 'alpha' } as const;

describe('staged casts with generated skeleton curves', () => {
  it('uses actual summed duration and preserves each ordered stage, including hold once', () => {
    const f = fixture();
    const output = f.state.consume(cast);
    expect(output.playback).toEqual({ clips: ['entry', 'wait', 'strike', 'exit'], durationSeconds: 2.5 });
    f.mixer.apply(output);
    f.mixer.update(0.25); expect(f.bone.position.x).toBeCloseTo(0.5);
    f.mixer.update(0.5); expect(f.bone.position.x).toBeCloseTo(1.5);
    f.mixer.update(0.5); expect(f.bone.position.x).toBeCloseTo(2.5);
    f.mixer.update(1.25); expect(f.bone.position.x).toBeCloseTo(5);
    for (const name of output.playback!.clips) expect(f.mixer.mixer.clipAction(f.clips.find(c => c.name === name)!).loop).toBe(LoopOnce);
    expect(f.state.update(2).state).toBe('cast'); expect(f.state.update(0.5).state).toBe('idle');
    f.mixer.dispose();
  });
  it('scales the whole sequence to bounds instead of dropping its last stage', () => {
    const f = fixture();
    const mixer = new UnitAnimationMixer(f.root, f.clips, f.names, { castSequence: { in: 'alternate', main: 'alternate', out: 'exit' } });
    const playback = mixer.resolvePlayback('cast')!;
    expect(playback.durationSeconds).toBe(2.5);
    mixer.apply({ state: 'cast', previous: 'idle', revision: 1, loop: false, blendSeconds: 0, playback });
    mixer.update(2.5); expect(f.bone.position.x).toBeCloseTo(5);
    const short = new AnimationClip('tiny', 0.1, []);
    expect(new UnitAnimationMixer(new Group(), [short], { cast: 'tiny' }).resolvePlayback('cast')!.durationSeconds).toBe(0.3);
    expect(mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 0.25 })!.durationSeconds).toBe(0.5);
    expect(mixer.resolvePlayback('attack')!.durationSeconds).toBe(1);
    mixer.dispose(); f.mixer.dispose();
  });
  it('rotates main choices per cast and uses explicit variants without changing the manifest', () => {
    const f = fixture();
    const metadata = { castSequence: { in: 'entry', main: ['strike', 'alternate'] }, castVariants: {
      star3: { main: 'alternate' }, hero: { main: 'wait' }, front: { main: 'entry' }, back: { main: 'exit' },
      branch: { beta: { main: 'wait' } },
    } };
    const saved = structuredClone(metadata), mixer = new UnitAnimationMixer(f.root, f.clips, f.names, metadata);
    const state = new UnitActionState('alpha', { resolvePlayback: (a, i) => mixer.resolvePlayback(a, i) });
    expect(state.consume(cast).playback?.clips).toEqual(['entry', 'strike']);
    expect(state.consume(cast).playback?.clips).toEqual(['entry', 'alternate']);
    expect(state.consume(cast).playback?.clips).toEqual(['entry', 'strike']);
    for (const [context, name] of [[{ starLevel: 3 }, 'alternate'], [{ hero: true }, 'wait'], [{ form: 'front' }, 'entry'], [{ form: 'back' }, 'exit'], [{ branch: 'beta' }, 'wait']] as const) {
      expect(mixer.resolvePlayback('cast', 0, context)?.clips).toEqual([name]);
    }
    expect(selectCastSequence({ castVariants: { rotate: ['entry', 'exit'] } }, 3)).toEqual({ main: 'exit' });
    expect(metadata).toEqual(saved); mixer.dispose(); f.mixer.dispose();
  });
  it('keeps the active idle time and revision for null, missing, and incomplete cast plans', () => {
    for (const metadata of [{}, { castSequence: { in: 'absent', main: 'strike' } }]) for (const name of [null, 'missing']) {
      const f = fixture(), mixer = new UnitAnimationMixer(f.root, f.clips, { idle: 'rest', cast: name }, metadata);
      const state = new UnitActionState('alpha', { resolvePlayback: (a, i) => mixer.resolvePlayback(a, i) });
      mixer.apply(state.output); mixer.update(0.25);
      expect(state.consume(cast).revision).toBe(0); mixer.apply(state.output);
      expect(mixer.mixer.clipAction(f.clips[0]).time).toBeCloseTo(0.25);
      mixer.dispose(); f.mixer.dispose();
    }
  });
  it('protects resolved cast endings from incidental events and cancels all stages on death', () => {
    const f = fixture(); f.mixer.apply(f.state.consume(cast)); f.mixer.update(0.25);
    expect(f.state.consume({ type: 'attack', attackerId: 'alpha' }).state).toBe('cast');
    expect(f.state.consume({ type: 'movement', unitId: 'alpha' }).state).toBe('cast');
    expect(f.state.consume({ type: 'packetDamage', sourceId: 'beta', targetId: 'alpha', hit: true, hpDamage: 1, absorbed: 0 }).state).toBe('cast');
    f.mixer.apply(f.state.consume({ type: 'death', unitId: 'alpha' })); f.mixer.update(4);
    expect(f.bone.position.x).toBeCloseTo(-1);
    expect(f.mixer.mixer.clipAction(f.clips[1]).isRunning()).toBe(false);
    expect(f.state.consume(cast).state).toBe('death'); f.mixer.dispose();
  });
  it('fades death in over blendSeconds when it interrupts a staged cast', () => {
    const f = fixture();
    f.mixer.apply(f.state.consume(cast)); f.mixer.update(0.25);
    const death = f.state.consume({ type: 'death', unitId: 'alpha' });
    f.mixer.apply({ ...death, blendSeconds: 0.2 });
    const action = f.mixer.mixer.clipAction(f.clips[6]);
    f.mixer.update(0.1);
    expect(action.getEffectiveWeight()).toBeCloseTo(0.5);
    // Halfway through the fade the interrupted cast stage still plays: entry at 0.35 s (x 0.7) blended with fall at 0.1 s (x -0.2).
    expect(f.mixer.mixer.clipAction(f.clips[1]).isRunning()).toBe(true);
    expect(f.bone.position.x).toBeCloseTo(0.25);
    f.mixer.update(0.1);
    expect(action.getEffectiveWeight()).toBeCloseTo(1);
    expect(f.mixer.mixer.clipAction(f.clips[1]).isRunning()).toBe(false);
    f.mixer.update(4);
    expect(f.bone.position.x).toBeCloseTo(-1);
    for (const clip of f.clips.slice(1, 5)) expect(f.mixer.mixer.clipAction(clip).isRunning()).toBe(false);
    f.mixer.dispose();
  });
  it('does not restart an already playing idle when a legacy missing cast expires', () => {
    const f = fixture(), mixer = new UnitAnimationMixer(f.root, f.clips, { idle: 'rest', cast: null });
    const state = new UnitActionState('alpha'); mixer.apply(state.output); mixer.update(0.25);
    mixer.apply(state.consume(cast)); mixer.update(0.25); mixer.apply(state.update(1));
    expect(mixer.mixer.clipAction(f.clips[0]).time).toBeCloseTo(0.5); mixer.dispose(); f.mixer.dispose();
  });
});

describe('cast metadata contract and offline dependency list', () => {
  const model = { path: 'alpha.glb', animations: { cast: 'strike' }, castSequence: { main: ['strike', 'alternate'] },
    castVariants: { hero: { main: 'hero' }, rotate: ['strike', 'alternate'], branch: { beta: { in: 'entry', main: 'exit' } } } };
  it('validates old, staged, rotating, branching and explicitly disabled models', async () => {
    for (const entry of [{ path: 'alpha.glb' }, model, { path: 'alpha.glb', animations: { cast: null } }]) {
      expect(() => assertManifest({ schemaVersion: 1, models: { alpha: entry } })).not.toThrow();
    }
    const cache = new ModelCache({ schemaVersion: 1, models: { alpha: model } }, '/local/', async () => ({ scene: new Group(), animations: [] }));
    const lease = await cache.load('alpha');
    expect(lease.castSequence).toEqual(model.castSequence); expect(lease.castVariants).toEqual(model.castVariants);
    lease.release(); cache.dispose();
  });
  it('rejects malformed metadata, partial null contracts and empty branches', () => {
    for (const extra of [{ castSequence: { main: [] } }, { castSequence: { main: ' ' } }, { castSequence: [] },
      { castSequence: { main: 'x', in: null } }, { castVariants: { rotate: [] } }, { castVariants: { branch: {} } },
      { castVariants: { unknown: { main: 'x' } } }, { animations: { cast: null }, castSequence: { main: 'x' } }]) {
      expect(() => assertManifest({ schemaVersion: 1, models: { alpha: { path: 'alpha.glb', ...extra } } })).toThrow();
    }
  });
  it('deduplicates every stage and variant needed by the exporter', () => {
    expect(castClipNames({ ...model, castExtraClips: ['candidate', 'entry'] })).toEqual(['alternate', 'candidate', 'entry', 'exit', 'hero', 'strike']);
  });
});

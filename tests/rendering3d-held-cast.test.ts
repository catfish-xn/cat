import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { HELD_CAST_OUT_SPEED, UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { UnitActionState } from '../src/rendering3d/animation-state';
import { assertManifest, type CastSequence } from '../src/rendering3d/contracts';

/** Nunu-shaped fixture: a 3 s activate (bone x 0→3) and a 1 s to-idle (3→4), with a 1 s swing. */
function fixture(castSequence: CastSequence = { main: 'activate', out: 'toidle', holdSeconds: 3 }) {
  const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
  const clip = (name: string, duration: number, a: number, b: number) => new AnimationClip(name, duration,
    [new NumberKeyframeTrack('joint.position[x]', [0, duration], [a, b])]);
  const clips = [clip('rest', 1, 0, 0), clip('activate', 3, 0, 3), clip('toidle', 1, 3, 4), clip('swing', 1, 10, 11),
    clip('flinch', 0.5, -1, -1), clip('fall', 0.5, -2, -2), clip('run', 1, 20, 20)];
  const names = { idle: 'rest', move: 'run', cast: 'activate', attack: 'swing', hit: 'flinch', death: 'fall' };
  const mixer = new UnitAnimationMixer(root, clips, names, { castSequence });
  const state = new UnitActionState('nunu', { blendSeconds: 0, resolvePlayback: a => mixer.resolvePlayback(a, 0) });
  mixer.apply(state.output);
  const step = (seconds: number) => { mixer.update(seconds); return state.update(seconds); };
  return { bone, mixer, state, step };
}
const cast = { type: 'cast', sourceId: 'nunu' } as const;
const attack = { type: 'attack', attackerId: 'nunu' } as const;

describe('held casts (manifest holdSeconds)', () => {
  it('plays the pose at 1× for the hold, then the out clip compressed', () => {
    const f = fixture();
    const output = f.state.consume(cast);
    expect(output.playback).toEqual({ clips: ['activate', 'toidle'], durationSeconds: 3 + 1 / HELD_CAST_OUT_SPEED, holdSeconds: 3 });
    f.mixer.apply(output);
    f.step(1.5); expect(f.bone.position.x).toBeCloseTo(1.5);
    f.step(1.25); expect(f.bone.position.x).toBeCloseTo(2.75);
    f.step(0.5); expect(f.bone.position.x).toBeCloseTo(3.5);
    expect(f.step(0.24).state).toBe('cast');
    expect(f.step(0.02).state).toBe('idle');
    f.mixer.dispose();
  });
  it('keeps the 2.5 s cap for casts without holdSeconds', () => {
    const f = fixture({ main: 'activate', out: 'toidle' });
    expect(f.state.consume(cast).playback).toEqual({ clips: ['activate', 'toidle'], durationSeconds: 2.5 });
    f.mixer.dispose();
  });
  it('never slows the pose: a longer hold clamps its last frame, a shorter one speeds it up', () => {
    const long = fixture({ main: 'activate', out: 'toidle', holdSeconds: 3.5 });
    long.mixer.apply(long.state.consume(cast));
    long.step(2); expect(long.bone.position.x).toBeCloseTo(2);
    long.step(1.25); expect(long.bone.position.x).toBeCloseTo(3);
    long.step(0.5); expect(long.bone.position.x).toBeCloseTo(3.5);
    long.mixer.dispose();
    const short = fixture({ main: 'activate', out: 'toidle', holdSeconds: 2 });
    short.mixer.apply(short.state.consume(cast));
    short.step(1); expect(short.bone.position.x).toBeCloseTo(1.5);
    short.step(1.25); expect(short.bone.position.x).toBeCloseTo(3.5);
    short.mixer.dispose();
  });
  it('ignores swings, runs and hits during the hold, and the next swing cuts the out clip', () => {
    const f = fixture();
    f.mixer.apply(f.state.consume(cast));
    f.step(1.7);
    expect(f.state.consume(attack).state).toBe('cast');
    expect(f.state.consume({ type: 'movement', unitId: 'nunu' }).state).toBe('cast');
    f.step(1.4);
    expect(f.state.consume({ type: 'packetDamage', sourceId: 'x', targetId: 'nunu', hit: true, hpDamage: 5, absorbed: 0, sourceKind: 'ability' }).state).toBe('cast');
    const swing = f.state.consume(attack);
    expect(swing.state).toBe('attack');
    f.mixer.apply(swing); f.step(0.5); expect(f.bone.position.x).toBeCloseTo(10.5);
    const run = fixture();
    run.mixer.apply(run.state.consume(cast)); run.step(3.1);
    expect(run.state.consume({ type: 'movement', unitId: 'nunu' }).state).toBe('move');
    f.mixer.dispose(); run.mixer.dispose();
  });
  it('death, stun and knock-up still interrupt the hold and show', () => {
    const dies = fixture();
    dies.mixer.apply(dies.state.consume(cast)); dies.step(1);
    const death = dies.state.consume({ type: 'death', unitId: 'nunu' });
    expect(death.state).toBe('death');
    dies.mixer.apply(death); dies.step(0.1); expect(dies.bone.position.x).toBeCloseTo(-2);
    // Stun and knock-up both hold the flinch pose through UnitActionState.stun (placeholder-renderer control).
    const stunned = fixture();
    stunned.mixer.apply(stunned.state.consume(cast)); stunned.step(0.5);
    const held = stunned.state.stun();
    expect(held.state).toBe('hit'); expect(stunned.state.stunned).toBe(true);
    stunned.mixer.apply(held); stunned.step(0.1); expect(stunned.bone.position.x).toBeCloseTo(-1);
    expect(stunned.step(5).state).toBe('hit');
    expect(stunned.state.recover().state).toBe('idle');
    dies.mixer.dispose(); stunned.mixer.dispose();
  });
  it('validates holdSeconds in the manifest', () => {
    const model = (holdSeconds: unknown) => ({ schemaVersion: 1, models: { nunu: { path: 'nunu.glb', castSequence: { main: 'activate', out: 'toidle', holdSeconds } } } });
    expect(() => assertManifest(model(3))).not.toThrow();
    for (const bad of [0, -1, 11, Number.NaN, '3', null]) expect(() => assertManifest(model(bad))).toThrow('invalid-cast-sequence');
  });
});

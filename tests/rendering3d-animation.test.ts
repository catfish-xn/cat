import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, LoopOnce, LoopRepeat, NumberKeyframeTrack } from 'three';
import { UnitActionState, type ActionOutput } from '../src/rendering3d/animation-state';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import type { CombatAnimationEvent } from '../src/simulation/combat-replay-view';

describe('pure 3D animation state and optional mixer', () => {
  it('starts idle, handles actual replay movement/attack/cast fields, and expires to idle', () => {
    const state = new UnitActionState('u');
    expect(state.output.state).toBe('idle'); expect(state.output.loop).toBe(true);
    const movement = { type: 'movement', tick: 1, eventSeq: 0, unitId: 'u', from: { row: 0, col: 0 }, to: { row: 1, col: 0 } } satisfies CombatAnimationEvent;
    expect(state.consume(movement).state).toBe('move'); expect(state.update(0.2).state).toBe('idle');
    const attack = { type: 'attack', tick: 2, eventSeq: 1, attackerId: 'u', targetId: 'v' } satisfies CombatAnimationEvent;
    expect(state.consume(attack).state).toBe('attack'); expect(state.output.loop).toBe(false);
    expect(state.update(0.45).state).toBe('idle');
    const cast = { type: 'cast', tick: 3, eventSeq: 2, sourceId: 'u', actionSeq: 0, completed: true,
      actualManaSpent: 0, refundedMana: 0, targetIds: ['v'], completionCell: { row: 0, col: 0 } } satisfies CombatAnimationEvent;
    expect(state.consume(cast).state).toBe('cast'); expect(state.update(0.7).state).toBe('idle');
  });
  it('filters other units and records blending and same-action retriggers', () => {
    const state = new UnitActionState('u', { blendSeconds: 0.25 });
    expect(state.consume({ type: 'attack', attackerId: 'v' }).revision).toBe(0);
    const first = state.consume({ type: 'attack', attackerId: 'u' });
    const second = state.consume({ type: 'attack', attackerId: 'u' });
    expect(second.previous).toBe('attack'); expect(second.blendSeconds).toBe(0.25); expect(second.revision).toBe(first.revision + 1);
  });
  it('shows hit only for effective damage; death locks until actual unitRevived', () => {
    const state = new UnitActionState('u');
    const damage = { type: 'packetDamage', tick: 1, eventSeq: 0, sourceId: 'v', targetId: 'u', damageType: 'physical',
      hit: true, hpDamage: 0, absorbed: 1, critical: false, killingPacket: false } satisfies CombatAnimationEvent;
    expect(state.consume({ ...damage, hit: false }).state).toBe('idle');
    expect(state.consume({ ...damage, absorbed: 0 }).state).toBe('idle');
    expect(state.consume(damage).state).toBe('hit'); expect(state.update(0.15).state).toBe('idle');
    expect(state.consume({ type: 'death', unitId: 'u' }).state).toBe('death');
    expect(state.consume({ type: 'movement', unitId: 'u' }).state).toBe('death');
    expect(state.consume({ type: 'attack', attackerId: 'u' }).state).toBe('death');
    expect(state.consume({ type: 'cast', sourceId: 'u' }).state).toBe('death');
    expect(state.consume(damage).state).toBe('death'); expect(state.update(100).state).toBe('death');
    const revive = { type: 'unitRevived', tick: 4, eventSeq: 3, unitId: 'u', hp: 1, sourceId: 'v' } satisfies CombatAnimationEvent;
    expect(state.consume(revive).state).toBe('idle'); expect(state.consume({ type: 'movement', unitId: 'u' }).state).toBe('move');
  });
  it('routes complete replay attack/cast to the source and packetDamage to the target', () => {
    const source = new UnitActionState('source'), target = new UnitActionState('target');
    const attack = { type: 'attack', tick: 1, eventSeq: 0, attackerId: 'source', targetId: 'target' } satisfies CombatAnimationEvent;
    expect(source.consume(attack).state).toBe('attack'); expect(target.consume(attack).state).toBe('idle');
    const cast = { type: 'cast', tick: 1, eventSeq: 1, sourceId: 'source', actionSeq: 0, completed: true,
      actualManaSpent: 0, refundedMana: 0, targetIds: ['target'], completionCell: { row: 0, col: 0 } } satisfies CombatAnimationEvent;
    expect(source.consume(cast).state).toBe('cast'); expect(target.consume(cast).state).toBe('idle');
    const damage = { type: 'packetDamage', tick: 1, eventSeq: 2, sourceId: 'source', targetId: 'target', damageType: 'physical',
      hit: true, hpDamage: 1, absorbed: 0, critical: false, killingPacket: false } satisfies CombatAnimationEvent;
    expect(source.consume(damage).state).toBe('cast'); expect(target.consume(damage).state).toBe('hit');
    const revive = { type: 'unitRevived', tick: 1, eventSeq: 3, sourceId: 'source', unitId: 'target', hp: 1 } satisfies CombatAnimationEvent;
    target.consume({ type: 'death', unitId: 'target' });
    expect(source.consume(revive).state).toBe('cast'); expect(target.consume(revive).state).toBe('idle');
  });
  it('accepts target-owned healing without creating hit or interrupting either unit action', () => {
    const source = new UnitActionState('source'), target = new UnitActionState('target');
    source.consume({ type: 'attack', attackerId: 'source' }); target.consume({ type: 'movement', unitId: 'target' });
    const beforeSource = source.output, beforeTarget = target.output;
    const heal = { type: 'heal', tick: 2, eventSeq: 0, targetId: 'target', actual: 5,
      shares: [{ sourceId: 'source', actual: 5 }] } satisfies CombatAnimationEvent;
    expect(source.consume(heal)).toEqual(beforeSource); expect(target.consume(heal)).toEqual(beforeTarget);
  });
  it('validates visual durations and delta without domain clock dependency', () => {
    expect(() => new UnitActionState('u', { durations: { cast: -1 } })).toThrow();
    const state = new UnitActionState('u', { durations: { attack: 2 } });
    state.consume({ type: 'attack', attackerId: 'u' }); expect(state.update(1).state).toBe('attack'); expect(state.update(1).state).toBe('idle');
    for (const dt of [-1, NaN, Infinity]) expect(() => state.update(dt)).toThrow('invalid-delta');
  });
  it('plays mapped clips, crossfades, retriggers and clamps death with in-memory three objects', () => {
    const root = new Group();
    const idle = new AnimationClip('rest', 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, 0])]);
    const attack = new AnimationClip('swing', 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, 2])]);
    const dead = new AnimationClip('fall', 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, -2])]);
    const adapter = new UnitAnimationMixer(root, [idle, attack, dead], { idle: 'rest', attack: 'swing', death: 'fall' });
    const state = new UnitActionState('u', { blendSeconds: 0.1 });
    expect(adapter.apply(state.output)).toBe(true); expect(adapter.mixer.clipAction(idle).loop).toBe(LoopRepeat);
    adapter.apply(state.consume({ type: 'attack', attackerId: 'u' })); adapter.update(0.5);
    expect(root.position.x).toBeGreaterThan(0);
    adapter.apply(state.consume({ type: 'attack', attackerId: 'u' })); expect(adapter.mixer.clipAction(attack).time).toBe(0);
    adapter.apply(state.consume({ type: 'death', unitId: 'u' })); adapter.update(2);
    const action = adapter.mixer.clipAction(dead);
    expect(action.loop).toBe(LoopOnce); expect(action.clampWhenFinished).toBe(true); expect(root.position.x).toBeCloseTo(-2);
    adapter.dispose();
  });
  it('retains idle or gracefully handles absent animations', () => {
    const state = new UnitActionState('u');
    const empty = new UnitAnimationMixer(new Group(), []);
    expect(empty.apply(state.output)).toBe(false); empty.update(0); empty.dispose();
    const idle = new AnimationClip('idle', 1, []), adapter = new UnitAnimationMixer(new Group(), [idle]);
    adapter.apply(state.output);
    expect(adapter.apply(state.consume({ type: 'cast', sourceId: 'u' }))).toBe(true);
    expect(adapter.mixer.clipAction(idle).isRunning()).toBe(true);
    expect(() => adapter.update(-1)).toThrow(); adapter.dispose();
  });
});

// Entirely generated curves on a toy joint; no external assets or authored animation data.
function fixture() {
  const root = new Group(), bone = new Bone(); bone.name = 'toy-joint'; root.add(bone);
  const clips = ['curve-a', 'curve-b', 'curve-c', 'curve-d', 'curve-e', 'curve-f'].map((name, i) =>
    new AnimationClip(name, 1.6, [new NumberKeyframeTrack('toy-joint.position[x]', [0, 1.6], [i, i + 2])]));
  const names = { idle: clips[0].name, move: clips[1].name, attack: clips[2].name,
    cast: clips[3].name, hit: clips[4].name, death: clips[5].name };
  const mixer = new UnitAnimationMixer(root, clips, names);
  const state = new UnitActionState('toy-unit', { blendSeconds: 0, durations: { move: 0.3 },
    resolvePlayback: (action, index) => mixer.resolvePlayback(action, index) });
  mixer.apply(state.output);
  const advance = (seconds: number) => { mixer.update(seconds); return mixer.apply(state.update(seconds)); };
  return { root, bone, clips, names, mixer, state, advance };
}
const damage = { type: 'packetDamage', sourceId: 'other-toy', targetId: 'toy-unit', hit: true, hpDamage: 7, absorbed: 0 } as const;
const movement = { type: 'movement', unitId: 'toy-unit' } as const;
const attack = { type: 'attack', attackerId: 'toy-unit' } as const;
const cast = { type: 'cast', sourceId: 'toy-unit' } as const;
const output = (state: ActionOutput['state'], revision: number): ActionOutput =>
  ({ state, previous: state, loop: state === 'idle' || state === 'move', revision, blendSeconds: 0 });

describe('smooth combat action ownership and revisions', () => {
  it('finishes the attack curve despite incoming damage, then allows an idle hit', () => {
    const f = fixture();
    const started = f.state.consume(attack); f.mixer.apply(started); f.advance(0.4);
    const action = f.mixer.mixer.clipAction(f.clips[2]);
    expect(f.state.consume(damage)).toEqual(started); f.mixer.apply(f.state.output);
    expect(action.time).toBeCloseTo(0.4);
    f.advance(1.1); expect(f.state.output.state).toBe('attack');
    expect(action.time).toBeCloseTo(1.5); expect(f.bone.position.x).toBeGreaterThan(3);
    f.advance(0.11);
    expect(action.time).toBeCloseTo(f.clips[2].duration); expect(action.paused).toBe(true);
    expect(f.state.output.state).toBe('idle'); expect(f.state.output.revision).toBe(started.revision + 1);
    expect(f.state.consume(damage).state).toBe('hit'); f.mixer.apply(f.state.output);
    expect(f.mixer.mixer.clipAction(f.clips[4]).isRunning()).toBe(true);
    f.mixer.dispose();
  });

  it.each(['move', 'fallback-cast', 'resolved-cast'] as const)('does not interrupt or extend %s for damage', action => {
    const f = fixture();
    const state = action === 'fallback-cast'
      ? new UnitActionState('toy-unit', { durations: { cast: 1.6 } }) : f.state;
    const started = state.consume(action === 'move' ? movement : cast);
    state.update(0.1); expect(state.consume(damage)).toEqual(started);
    expect(state.update(action === 'move' ? 0.21 : 1.51).state).toBe('idle');
    f.mixer.dispose();
  });

  it('retains effective hit retriggers, ignores misses and other targets', () => {
    const state = new UnitActionState('toy-unit', { durations: { hit: 0.28 } });
    const first = state.consume(damage); state.update(0.2);
    expect(state.consume({ ...damage, hit: false })).toEqual(first);
    expect(state.consume({ ...damage, hpDamage: 0 })).toEqual(first);
    expect(state.consume({ ...damage, targetId: 'another-toy' })).toEqual(first);
    const second = state.consume({ ...damage, hpDamage: 0, absorbed: 7 });
    expect(second.state).toBe('hit'); expect(second.revision).toBe(first.revision + 1);
    expect(state.update(0.2).state).toBe('hit'); expect(state.update(0.09).state).toBe('idle');
  });

  it.each([movement, attack, cast, damage])('death interrupts $type and stays locked until revival', event => {
    const f = fixture(); f.mixer.apply(f.state.consume(event)); f.advance(0.07);
    const dead = f.state.consume({ type: 'death', unitId: 'toy-unit' }); f.mixer.apply(dead);
    for (const next of [movement, attack, cast, damage]) expect(f.state.consume(next)).toEqual(dead);
    f.advance(3.2); expect(f.state.output).toEqual(dead);
    const action = f.mixer.mixer.clipAction(f.clips[5]);
    expect(action.loop).toBe(LoopOnce); expect(action.paused).toBe(true);
    expect(action.time).toBeCloseTo(f.clips[5].duration);
    const revived = f.state.consume({ type: 'unitRevived', unitId: 'toy-unit' });
    expect(revived.state).toBe('idle'); expect(revived.revision).toBe(dead.revision + 1);
    f.mixer.apply(revived); expect(f.mixer.mixer.clipAction(f.clips[0]).isRunning()).toBe(true);
    f.mixer.dispose();
  });

  it('keeps 250 ms steps moving with a 0.3 s window, without revisions or curve rewinds', () => {
    const f = fixture(), started = f.state.consume(movement); f.mixer.apply(started);
    const action = f.mixer.mixer.clipAction(f.clips[1]);
    for (let step = 1; step <= 4; step++) {
      f.advance(0.25); expect(f.state.output).toEqual(started);
      expect(f.state.consume(movement)).toEqual(started); f.mixer.apply(f.state.output);
      expect(action.time).toBeCloseTo(step * 0.25);
    }
    f.advance(0.29); expect(f.state.output).toEqual(started);
    f.advance(0.02); expect(f.state.output.state).toBe('idle');
    expect(f.state.output.revision).toBe(started.revision + 1);
    const restarted = f.state.consume(movement);
    expect(restarted.previous).toBe('idle'); expect(restarted.revision).toBe(started.revision + 2);
    f.mixer.dispose();
  });
});

describe('mixer loop reuse with generated skeletal animations', () => {
  it.each(['idle', 'move'] as const)('preserves a running %s across both identical and changed revisions', state => {
    const f = fixture(), clip = f.clips[state === 'idle' ? 0 : 1];
    f.mixer.apply(output(state, 10)); f.mixer.update(0.37);
    const action = f.mixer.mixer.clipAction(clip);
    for (const revision of [10, 11, 12]) {
      f.mixer.apply(output(state, revision)); expect(action.time).toBeCloseTo(0.37);
    }
    f.mixer.update(0.19); expect(action.time).toBeCloseTo(0.56);
    expect(action.loop).toBe(LoopRepeat); expect(action.isRunning()).toBe(true);
    f.mixer.dispose();
  });

  it.each(['attack', 'cast', 'hit', 'death'] as const)('replays non-looping %s on a new revision only', state => {
    const f = fixture(), clip = f.clips[['idle', 'move', 'attack', 'cast', 'hit', 'death'].indexOf(state)];
    const action = f.mixer.mixer.clipAction(clip);
    f.mixer.apply(output(state, 10)); f.mixer.update(0.37);
    f.mixer.apply(output(state, 10)); expect(action.time).toBeCloseTo(0.37);
    f.mixer.apply(output(state, 11)); expect(action.time).toBe(0); expect(action.loop).toBe(LoopOnce);
    f.mixer.update(2); expect(action.paused).toBe(true);
    f.mixer.apply(output(state, 12)); expect(action.time).toBe(0); expect(action.isRunning()).toBe(true);
    f.mixer.dispose();
  });

  it.each(['paused', 'disabled', 'zero-speed', 'stopped'] as const)('restarts a %s loop on a new revision', status => {
    const f = fixture(), action = f.mixer.mixer.clipAction(f.clips[0]); f.mixer.update(0.37);
    if (status === 'paused') action.paused = true;
    if (status === 'disabled') action.enabled = false;
    if (status === 'zero-speed') action.setEffectiveTimeScale(0);
    if (status === 'stopped') action.stop();
    expect(action.isRunning()).toBe(false);
    f.mixer.apply(output('idle', 10)); expect(action.isRunning()).toBe(true); expect(action.time).toBe(0);
    f.mixer.update(0.19); expect(action.time).toBeCloseTo(0.19); f.mixer.dispose();
  });

  it('restores infinite repetitions instead of reusing a finite repeat action', () => {
    const f = fixture(), action = f.mixer.mixer.clipAction(f.clips[0]);
    action.setLoop(LoopRepeat, 2); f.mixer.update(0.37); expect(action.isRunning()).toBe(true);
    f.mixer.apply(output('idle', 10));
    expect(action.time).toBe(0); expect(action.repetitions).toBe(Infinity);
    f.mixer.update(4.9); expect(action.isRunning()).toBe(true); f.mixer.dispose();
  });

  it.each(['idle', 'move'] as const)('restores looping when a running single-use clip is also mapped to %s', state => {
    const f = fixture(), clip = f.clips[2]; f.mixer.dispose();
    const mixer = new UnitAnimationMixer(f.root, f.clips, { ...f.names, [state]: clip.name });
    mixer.apply(output('attack', 1)); mixer.update(0.37);
    const action = mixer.mixer.clipAction(clip);
    expect(action.isRunning()).toBe(true); expect(action.loop).toBe(LoopOnce);
    mixer.apply(output(state, 2)); expect(action.loop).toBe(LoopRepeat);
    expect(action.time).toBe(0); expect(action.clampWhenFinished).toBe(false);
    mixer.update(2); expect(action.isRunning()).toBe(true); expect(action.time).toBeCloseTo(0.4);
    mixer.dispose();
  });
});

import { describe, expect, it } from 'vitest';
import { AnimationClip, Group, LoopOnce, LoopRepeat, NumberKeyframeTrack } from 'three';
import { UnitActionState } from '../src/rendering3d/animation-state';
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

import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { assertManifest, type StatusPose } from '../src/rendering3d/contracts';
import { createStatusPoseEvents } from '../src/rendering/three-mode/status-pose-events';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';

// Synthetic two-bone rig: `Arm` is the masked upper body, `Leg` is left to the unit's own action.
function rig(pose: StatusPose) {
  const root = new Group(), arm = new Bone(), leg = new Bone();
  arm.name = 'Arm'; leg.name = 'Leg'; root.add(arm, leg);
  const clip = (name: string, arm: [number, number], leg: [number, number]) => new AnimationClip(name, 1, [
    new NumberKeyframeTrack('Arm.position[x]', [0, 1], arm), new NumberKeyframeTrack('Leg.position[x]', [0, 1], leg)]);
  const clips = [clip('rest', [0, 0], [0, 0]), clip('walk', [0, 0], [5, 5]), clip('swing', [3, 3], [3, 3]), clip('source', [0, 40], [7, 7])];
  const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', move: 'walk', attack: 'swing' }, { statusPose: pose });
  let revision = 0;
  const go = (state: 'idle' | 'move' | 'attack') => mixer.apply({ state, previous: 'idle', revision: ++revision, loop: state !== 'attack', blendSeconds: 0 });
  return { arm, leg, mixer, go };
}
const pose: StatusPose = { clip: 'source', atSeconds: 0.5, mask: { Arm: 1 }, status: 'damage-reduction', blendSeconds: 0.2 };

describe('status pose held over idle and movement', () => {
  it('eases the masked bones to the frozen source pose, leaves the others to the action, and eases back', () => {
    const r = rig(pose);
    r.go('idle'); r.mixer.setStatusPose(true);
    r.mixer.update(0.1); expect(r.arm.position.x).toBeCloseTo(10, 0); // half way to the pose at 0.5 s (20)
    r.mixer.update(0.2); expect(r.arm.position.x).toBeCloseTo(20, 1); expect(r.leg.position.x).toBeCloseTo(0);
    r.go('move'); r.mixer.update(0.3); expect(r.arm.position.x).toBeCloseTo(20, 1); expect(r.leg.position.x).toBeCloseTo(5);
    r.mixer.setStatusPose(false); r.mixer.update(0.1); expect(r.mixer.statusPoseFraction).toBeCloseTo(0.5);
    r.mixer.update(0.2); expect(r.arm.position.x).toBeCloseTo(0, 1); expect(r.mixer.statusPoseFraction).toBe(0);
    r.mixer.dispose();
  });
  it('yields to an attack, which plays whole, then returns', () => {
    const r = rig(pose);
    r.go('idle'); r.mixer.setStatusPose(true); r.mixer.update(0.5);
    r.go('attack'); r.mixer.update(0.5); expect(r.arm.position.x).toBeCloseTo(3, 1); expect(r.mixer.statusPoseFraction).toBe(0);
    r.go('idle'); r.mixer.update(0.5); expect(r.arm.position.x).toBeCloseTo(20, 1);
    r.mixer.dispose();
  });
  it('does nothing without a manifest pose or a source clip', () => {
    const r = rig({ ...pose, clip: 'missing' });
    r.go('idle'); r.mixer.setStatusPose(true); r.mixer.update(0.5);
    expect(r.arm.position.x).toBeCloseTo(0); expect(r.mixer.statusPoseFraction).toBe(0);
    r.mixer.dispose();
  });
});

describe('status pose manifest contract', () => {
  const manifest = (statusPose: unknown) => ({ schemaVersion: 1, models: { unit: { path: 'u.glb', statusPose } } });
  it('accepts a pose and rejects malformed ones', () => {
    expect(() => assertManifest(manifest(pose))).not.toThrow();
    for (const bad of [{ ...pose, extra: 1 }, { ...pose, clip: '' }, { ...pose, atSeconds: -1 }, { ...pose, mask: {} }, { ...pose, mask: { Arm: 2 } },
      { ...pose, status: 'Damage Reduction' }, { ...pose, blendSeconds: 5 }]) expect(() => assertManifest(manifest(bad))).toThrow('invalid-status-pose');
  });
});

describe('status pose events', () => {
  const cast = (eventSeq: number, completed?: boolean) => ({ type: 'cast', eventSeq, tick: eventSeq, sourceId: 'u', targetIds: [], ...(completed === undefined ? {} : { completed }) }) as unknown as DisplayCombatEvent;
  const status = (eventSeq: number, reason: string, kind = 'damage-reduction') => ({ type: 'statusChanged', eventSeq, tick: eventSeq, targetId: 'u', kind, reason, effectiveMagnitudeBps: 0 }) as unknown as DisplayCombatEvent;
  it('turns on with a completed cast and off when the status ends for any reason or the unit dies; ignores replays', () => {
    const events = createStatusPoseEvents(id => id === 'u' ? 'damage-reduction' : undefined);
    expect(events.next(cast(1, false))).toBeUndefined();
    expect(events.next(cast(2))).toEqual({ id: 'u', on: true });
    expect(events.next(status(3, 'applied'))).toBeUndefined();
    expect(events.next(status(4, 'refreshed'))).toBeUndefined();
    expect(events.next(status(5, 'expired', 'stun'))).toBeUndefined();
    let seq = 6;
    for (const reason of ['expired', 'cleansed', 'source-lost', 'death-cleanup', 'replaced', 'combat-end']) expect(events.next(status(seq++, reason))).toEqual({ id: 'u', on: false });
    expect(events.next({ type: 'death', eventSeq: seq++, tick: 0, unitId: 'u' } as unknown as DisplayCombatEvent)).toEqual({ id: 'u', on: false });
    expect(events.next(cast(2))).toBeUndefined(); // a replayed cast cannot raise it again
    events.clear(); expect(events.next(cast(2))).toEqual({ id: 'u', on: true });
    expect(createStatusPoseEvents(() => undefined).next(cast(1))).toBeUndefined();
  });
});

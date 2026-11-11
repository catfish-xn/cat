import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, VectorKeyframeTrack } from 'three';
import { OVERHEAD_FOLLOW_SECONDS, OverheadFollow } from '../src/rendering/three-mode/overhead-follow';

// Synthetic skeleton, made-up integers.
const body = () => {
  const root = new Group(), scene = new Group(), bone = new Bone();
  bone.name = 'Root'; bone.position.set(1, 10, 2); scene.scale.setScalar(2); scene.add(bone); root.add(scene);
  const idle = new AnimationClip('idle', 1, [new VectorKeyframeTrack('Root.position', [0], [1, 10, 2])]);
  return { root, scene, bone, idle };
};

describe('overhead follow', () => {
  it('follows the Root bone against its idle stance in world units, height upward only', () => {
    const { root, bone, idle } = body();
    const follow = OverheadFollow.of(root, [idle], 'idle');
    root.updateMatrixWorld(true);
    expect(follow.update(1, null).length()).toBeCloseTo(0, 6);
    bone.position.set(4, 30, -8); root.updateMatrixWorld(true);
    for (let i = 0; i < 20; i++) follow.update(1, null);
    expect(follow.offset.x).toBeCloseTo(6); expect(follow.offset.y).toBeCloseTo(40); expect(follow.offset.z).toBeCloseTo(-20);
    bone.position.set(1, 3, 2); root.updateMatrixWorld(true);
    for (let i = 0; i < 20; i++) follow.update(1, null);
    expect(follow.offset.y).toBeCloseTo(0); // a crouch does not pull the bars down
  });

  it('adds the lunge, and a body with no Root bone follows its lunge only', () => {
    const plain = new OverheadFollow();
    for (let i = 0; i < 20; i++) plain.update(1, { x: 7, z: -3 });
    expect(plain.offset.toArray().map(v => Math.round(v * 1000) / 1000)).toEqual([7, 0, -3]);
    const { root, idle } = body(), follow = OverheadFollow.of(root, [idle], 'idle');
    root.updateMatrixWorld(true);
    for (let i = 0; i < 20; i++) follow.update(1, { x: 5, z: 0 });
    expect(follow.offset.x).toBeCloseTo(5);
    expect(OverheadFollow.of(new Group(), [], undefined).update(1, null).length()).toBe(0);
  });

  it('eases toward the travel instead of jumping', () => {
    const plain = new OverheadFollow();
    const first = plain.update(OVERHEAD_FOLLOW_SECONDS, { x: 10, z: 0 }).x;
    expect(first).toBeGreaterThan(5); expect(first).toBeLessThan(7);
    expect(plain.update(0, { x: 10, z: 0 }).x).toBe(first);
  });
});

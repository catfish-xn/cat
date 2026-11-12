import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, VectorKeyframeTrack } from 'three';
import { BODY_SLACK, OVERHEAD_FOLLOW_SECONDS, OVERHEAD_SNAP_DISTANCE, OverheadFollow } from '../src/rendering/three-mode/overhead-follow';

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

  it('eases a small change and takes a large one at once', () => {
    const plain = new OverheadFollow();
    const first = plain.update(OVERHEAD_FOLLOW_SECONDS, { x: 4, z: 0 }).x; // within OVERHEAD_SNAP_DISTANCE: eased
    expect(first).toBeGreaterThan(2); expect(first).toBeLessThan(3);
    expect(plain.update(0, { x: 4, z: 0 }).x).toBe(first);
    expect(plain.update(0.001, { x: first + OVERHEAD_SNAP_DISTANCE + 5, z: 0 }).x).toBe(first + OVERHEAD_SNAP_DISTANCE + 5); // a jump: no lag
  });

  // Synthetic: a Pelvis under the travel bone (name given), idle stance from made-up integers.
  const rig = (rootName: string) => {
    const root = new Group(), root2 = new Bone(), pelvis = new Bone();
    root2.name = rootName; pelvis.name = 'Pelvis'; pelvis.position.set(0, 50, 0);
    root2.add(pelvis); root.add(root2);
    const idle = new AnimationClip('idle', 1, [new VectorKeyframeTrack(`${rootName}.position`, [0], [0, 0, 0]),
      new VectorKeyframeTrack('Pelvis.position', [0], [0, 50, 0])]);
    root.updateMatrixWorld(true);
    return { root, root2, pelvis, follow: OverheadFollow.of(root, [idle], 'idle') };
  };
  const settle = (follow: OverheadFollow, height: number) => { for (let i = 0; i < 20; i++) follow.update(1, null, height); return follow.offset; };

  it('follows the body bone past its Root beyond the slack (Illaoi, Rumble, Nami: Root stays, the body moves)', () => {
    const { root, pelvis, follow } = rig('Root'), height = 100;
    pelvis.position.set(8, 70, 0); root.updateMatrixWorld(true); // inside the slack: an attack's lean, a hover's bob
    expect(settle(follow, height).length()).toBeCloseTo(0, 6);
    pelvis.position.set(40, 50 + 80, 0); root.updateMatrixWorld(true);
    const offset = settle(follow, height);
    expect(offset.x).toBeCloseTo(40 - BODY_SLACK.across * height);
    expect(offset.y).toBeCloseTo(80 - BODY_SLACK.up * height);
    expect(settle(follow, 0).length()).toBeCloseTo(0, 6); // no height given: the body bone is not followed
  });

  it('does not count the body twice when the Root carries it', () => {
    const { root, root2, follow } = rig('Root');
    root2.position.set(30, 0, 0); root.updateMatrixWorld(true);
    expect(settle(follow, 100).x).toBeCloseTo(30);
  });

  it('finds a travel bone named in another case (Malzahar ROOT, Corki root)', () => {
    const { root, root2, follow } = rig('ROOT');
    root2.position.set(0, 0, 25); root.updateMatrixWorld(true);
    expect(settle(follow, 100).z).toBeCloseTo(25);
  });
});

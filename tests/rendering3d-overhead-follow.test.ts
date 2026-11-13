import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, VectorKeyframeTrack } from 'three';
import { BODY_SLACK, OVERHEAD_FOLLOW_SECONDS, OVERHEAD_SNAP_DISTANCE, OverheadFollow, mirrorName, overheadHeights, pickFollowBones } from '../src/rendering/three-mode/overhead-follow';
import { CONTROL_3D, ControlMotion } from '../src/rendering/three-mode/unit-control';

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

  it('reports which bone and rule it picked', () => {
    const picked = pickFollowBones(rig('ROOT').root);
    expect([picked.travel?.name, picked.travelRule, picked.body.map(b => b.name), picked.bodyRule, picked.side]).toEqual(['ROOT', 'case', ['Pelvis'], 0, null]);
    const plain = pickFollowBones(new Group());
    expect([plain.travel, plain.travelRule, plain.body, plain.bodyRule, plain.side]).toEqual([null, null, [], null, null]);
  });

  it('spells the other side of a side-marked bone', () => {
    expect(['L_Front_Hip', 'Hip_R', 'Left_Hip', 'LeftHip', 'l_hip', 'Pelvis', 'Lhip'].map(mirrorName))
      .toEqual(['R_Front_Hip', 'Hip_L', 'Right_Hip', 'RightHip', 'r_hip', null, null]);
  });

  // Synthetic four-legged rig: Root > Body > (L_Front_Hip, R_Front_Hip?) and the idle stance as loaded.
  const legs = (options: { mirror: boolean; underBody: boolean }) => {
    const root = new Group(), travel = new Bone(), trunk = new Bone(), left = new Bone(), right = new Bone();
    travel.name = 'Root'; trunk.name = 'Body'; left.name = 'L_Front_Hip'; right.name = 'R_Front_Hip';
    trunk.position.set(0, 40, 0); left.position.set(-10, 0, 10); right.position.set(10, 0, 10);
    root.add(travel);
    const parent = options.underBody ? trunk : travel;
    if (options.underBody) travel.add(trunk);
    parent.add(left); if (options.mirror) parent.add(right);
    root.updateMatrixWorld(true);
    const idle = new AnimationClip('idle', 1, [new VectorKeyframeTrack('Root.position', [0], [0, 0, 0])]);
    return { root, trunk, left, right, picked: pickFollowBones(root), follow: OverheadFollow.of(root, [idle], 'idle') };
  };

  it('follows the midpoint of a hip and its mirror, so one leg swinging out moves the bars half as far', () => {
    const { root, left, right, picked, follow } = legs({ mirror: true, underBody: true }), height = 100;
    expect([picked.side, picked.body.map(b => b.name)]).toEqual(['pair', ['L_Front_Hip', 'R_Front_Hip']]);
    left.position.x -= 60; right.position.x += 60; root.updateMatrixWorld(true); // legs splay: the midpoint stays
    expect(settle(follow, height).length()).toBeCloseTo(0, 6);
    left.position.x += 60 + 40; right.position.x -= 60 - 40; root.updateMatrixWorld(true); // both step 40 sideways
    expect(settle(follow, height).x).toBeCloseTo(40 - BODY_SLACK.across * height);
  });

  it('follows the bone both hang from when the hip has no mirror', () => {
    const { root, trunk, left, picked, follow } = legs({ mirror: false, underBody: true }), height = 100;
    expect([picked.side, picked.body.map(b => b.name)]).toEqual(['parent', ['Body']]);
    left.position.x -= 80; root.updateMatrixWorld(true); // the leg alone: no follow
    expect(settle(follow, height).length()).toBeCloseTo(0, 6);
    trunk.position.z += 50; root.updateMatrixWorld(true);
    expect(settle(follow, height).z).toBeCloseTo(50 - BODY_SLACK.across * height);
  });

  it('follows only the Root when the shared parent is the Root itself', () => {
    const { root, left, picked, follow } = legs({ mirror: false, underBody: false });
    expect([picked.side, picked.body]).toEqual(['dropped', []]);
    left.position.x -= 80; root.updateMatrixWorld(true);
    expect(settle(follow, 100).length()).toBeCloseTo(0, 6);
  });

  it('follows only a cast: an attack or idle sway leaves the bars over the spot, and the cast path is unchanged', () => {
    const height = 100, steps = 20;
    const run = (casting: boolean | undefined) => {
      const { root, root2, pelvis, follow } = rig('Root');
      root2.position.set(30, 0, 0); pelvis.position.set(40, 50 + 80, 0); root.updateMatrixWorld(true);
      for (let i = 0; i < steps; i++) casting === undefined ? follow.update(1, null, height) : follow.update(1, null, height, casting);
      return follow.offset.clone();
    };
    const old = run(undefined), cast = run(true), attack = run(false);
    expect(cast.toArray()).toEqual(old.toArray()); // the cast path is the old path, frame for frame
    expect(cast.x).toBeGreaterThan(30);
    expect(attack.length()).toBe(0);
    // Back from a cast to an attack: the bars ease (or snap) back over the spot, never stay out.
    const { root, root2, follow } = rig('Root');
    root2.position.set(30, 0, 0); root.updateMatrixWorld(true);
    for (let i = 0; i < steps; i++) follow.update(1, null, height, true);
    expect(follow.offset.x).toBeCloseTo(30);
    for (let i = 0; i < steps; i++) follow.update(1, null, height, false);
    expect(follow.offset.length()).toBeCloseTo(0, 6);
  });

  it('keeps the lunge outside a cast too (only a cast starts one)', () => {
    const plain = new OverheadFollow();
    for (let i = 0; i < 20; i++) plain.update(1, { x: 7, z: -3 }, 100, false);
    expect(plain.offset.x).toBeCloseTo(7); expect(plain.offset.z).toBeCloseTo(-3);
  });

  it('lifts the star row, bar and stun ring with a knock-up or grab whatever the body plays', () => {
    const control = new ControlMotion();
    control.set('airborne');
    let top = 0;
    for (let i = 0; i < 40; i++) top = Math.max(top, control.update(0.05));
    expect(top).toBeGreaterThan(0);
    const height = 100, lift = top * height * CONTROL_3D.liftShare;
    const at = (followY: number, l: number) => overheadHeights({ rootY: 0, followY, starHeight: 112, lift: l, headHeight: height * CONTROL_3D.headShare,
      stars: true, starSize: 12, starGap: 12 });
    // Not casting: the follow gives 0, the lift still carries every row up by its full height.
    const ground = at(0, 0), held = at(0, lift);
    expect(held.stars - ground.stars).toBeCloseTo(lift); expect(held.bar - ground.bar).toBeCloseTo(lift); expect(held.halo - ground.halo).toBeCloseTo(lift);
    expect(at(0, 0)).toEqual(ground); // back on the floor: back where it was
    expect(ground.bar).toBeCloseTo(112 + 12 / 2 + 3); expect(at(0, 0).halo).toBeCloseTo(height * CONTROL_3D.headShare);
    const noStars = overheadHeights({ rootY: 5, followY: 2, starHeight: 112, lift: 0, headHeight: 60, stars: false, starSize: 12, starGap: 12 });
    expect(noStars.bar).toBeCloseTo(5 + 2 + 112 - 6);
  });
});

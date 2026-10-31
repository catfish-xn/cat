import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, AnimationMixer, Bone, BoxGeometry, Float32BufferAttribute, Group, MeshBasicMaterial,
  NumberKeyframeTrack, Quaternion, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { animationEnvelope, animationEnvelopeSliced, fitModel, standingSupport } from '../src/rendering/three-mode/model-fit';
import { createSupportSampler, supportRotation, supportVertices, updateModelGrounding, GROUNDING_BLEND_SECONDS, MESH_PENETRATION_RATIO } from '../src/rendering/three-mode/model-grounding';

/** Two feet, an independent weapon and an unindexed skin vertex. No licensed assets or GPU. */
function model(tilt = 0, propY = 15, segments = 2) {
  const body = new Group(), rig = new Group(); body.add(rig); rig.rotation.z = tilt;
  const root = new Bone(), left = new Bone(), right = new Bone(), weapon = new Bone();
  root.name = 'Root'; left.name = 'L_Foot'; right.name = 'R_Foot'; weapon.name = 'Sword_Root';
  root.add(left, right); rig.add(root, weapon);
  const meshes: SkinnedMesh[] = [];
  for (const [x, bone, y] of [[28, 1, 0], [32, 2, 0], [30, 3, propY]]) {
    const geometry = new BoxGeometry(2, 2, 4, segments, 1, segments).translate(x!, y! + 1, 40), count = geometry.attributes.position!.count;
    const positions = [...geometry.attributes.position!.array, 30, -15, 40];
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const weights = new Float32Array((count + 1) * 4), indices = new Uint16Array((count + 1) * 4);
    for (let i = 0; i <= count; i++) { weights[i * 4] = 1; indices[i * 4] = bone!; }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()); rig.add(mesh);
    body.updateMatrixWorld(true); mesh.bind(new Skeleton([root, left, right, weapon])); meshes.push(mesh);
  }
  const clip = new AnimationClip('idle', 1, [new NumberKeyframeTrack('Root.position[y]', [0, 0.5, 1], [5, 9, 5])]);
  const clips = [{ clip, loop: true, ground: true, feet: true }];
  const measure = () => {
    body.updateMatrixWorld(true); const sampler = createSupportSampler(meshes, 20), point = new Vector3();
    meshes.forEach((mesh, index) => {
      mesh.skeleton.update();
      for (let v = 0; v < mesh.geometry.attributes.position!.count; v++) {
        mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld); sampler.vertex(index, v, point);
      }
    }); sampler.frame(); return sampler.finish()!;
  };
  return { body, root, meshes, clip, clips, measure,
    dispose() { for (const mesh of meshes) { mesh.geometry.dispose(); mesh.skeleton.dispose(); (mesh.material as MeshBasicMaterial).dispose(); } } };
}

describe('animated foot support calibration', () => {
  it('caps an independent underground prop while keeping unindexed vertices out of the floor', () => {
    const toy = model(0, -9);
    try {
      const support = animationEnvelope(toy.body, toy.clips).support!;
      expect(support.floor).toBeCloseTo(5); expect(support.meshFloor).toBeCloseTo(-9);
      expect(support.meshContacts.some(c => c.mesh === 2)).toBe(true);
      expect(support.meshContacts.every(c => c.vertex < toy.meshes[c.mesh]!.geometry.attributes.position!.count - 1)).toBe(true);
      fitModel(toy.body, { height: 92, unitScale: 1, sourceScale: 0.44, support });
      const mixer = new AnimationMixer(toy.body); mixer.clipAction(toy.clip).play();
      const point = new Vector3();
      try {
        for (const time of [0, 0.27, 0.5, 0.84, 0.99]) {
          mixer.setTime(time); updateModelGrounding(toy.body, true, 1 / 60);
          toy.body.updateMatrixWorld(true); let min = Infinity;
          // Independent whole indexed mesh scan, including the weapon; no contact sampler.
          for (const mesh of toy.meshes) {
            mesh.skeleton.update();
            for (const vertex of new Set(mesh.geometry.index!.array)) {
              min = Math.min(min, mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld).y);
            }
          }
          expect(min).toBeCloseTo(-support.height * 0.44 * MESH_PENETRATION_RATIO, 5);
          expect(toy.measure().floor).toBeGreaterThan(0);
        }
      } finally { mixer.stopAllAction(); mixer.uncacheRoot(toy.body); }
    } finally { toy.dispose(); }
  });

  it('blends idle release and re-entry continuously over 120 ms, including interrupted transitions', () => {
    const toy = model();
    try {
      const support = animationEnvelope(toy.body, toy.clips).support!;
      fitModel(toy.body, { height: 92, unitScale: 1, sourceScale: 0.44, support });
      const fitted = toy.body.position.y, mixer = new AnimationMixer(toy.body);
      mixer.clipAction(toy.clip).play(); mixer.setTime(0.5);
      try {
        updateModelGrounding(toy.body, true, 1 / 60);
        const pinned = toy.body.position.y;
        expect(pinned).toBeLessThan(fitted - 1);
        updateModelGrounding(toy.body, false, 0);
        expect(toy.body.position.y).toBe(pinned); // The action switch itself never snaps.
        updateModelGrounding(toy.body, false, GROUNDING_BLEND_SECONDS / 2);
        expect(toy.body.position.y).toBeCloseTo((pinned + fitted) / 2);
        const halfReleased = toy.body.position.y;
        updateModelGrounding(toy.body, true, 0);
        expect(toy.body.position.y).toBe(halfReleased);
        updateModelGrounding(toy.body, true, GROUNDING_BLEND_SECONDS / 2);
        expect(toy.body.position.y).toBeCloseTo((halfReleased + pinned) / 2);
        updateModelGrounding(toy.body, true, GROUNDING_BLEND_SECONDS / 2);
        expect(toy.body.position.y).toBeCloseTo(pinned);
        for (let frame = 0; frame < 12; frame++) updateModelGrounding(toy.body, false, 0.01);
        expect(toy.body.position.y).toBeCloseTo(fitted);
        updateModelGrounding(toy.body, false, 1);
        expect(toy.body.position.y).toBeCloseTo(fitted);
      } finally { mixer.stopAllAction(); mixer.uncacheRoot(toy.body); }
    } finally { toy.dispose(); }
  });

  it('does not treat a Spawn locator as a foot', () => {
    const toy = model();
    try {
      toy.meshes[2]!.skeleton.bones[3]!.name = 'R_Hand_Spawn';
      expect(supportVertices(toy.meshes[2]!).some(kind => kind === 'R_Hand_Spawn')).toBe(false);
      expect(supportVertices(toy.meshes[0]!).some(kind => kind === 'L_Foot')).toBe(true);
      const tilt = 1.6 * Math.PI / 180, soleMean = [Math.sin(tilt), Math.cos(tilt), 0] as const;
      const agreeing = { method: 'feet' as const, stableFeet: 2, soleDeviation: 1.12, tiltDegrees: 1.79, tiltDeviation: 0.004,
        soleSpread: 1.77, soleTiltDelta: 0.01, soleTilt: 1.6, soleMean, normal: [0, 1, 0] as const, center: [0, 0, 0] as const, floor: 0,
        contacts: [], meshContacts: [], meshFloor: 0, height: 1 };
      expect(supportRotation(agreeing).angleTo(new Quaternion())).toBeCloseTo(tilt, 5);
      expect(supportRotation({ ...agreeing, soleSpread: 2.1 }).angleTo(new Quaternion())).toBe(0);
      expect(supportRotation({ ...agreeing, soleTiltDelta: 0.26 }).angleTo(new Quaternion())).toBe(0);
      expect(supportRotation({ ...agreeing, soleTilt: 1.4 }).angleTo(new Quaternion())).toBe(0);
    } finally { toy.dispose(); }
  });

  it('rejects a stable pooled slope caused by staggered feet, and a single tiptoe contact', () => {
    const toy = model();
    try {
      // Lift just one sole. Both soles stay individually horizontal; their pooled plane now slopes.
      toy.meshes[1]!.geometry.translate(0, 0.2, 0);
      const support = animationEnvelope(toy.body, toy.clips).support!;
      expect(support.tiltDegrees).toBeGreaterThan(1.5);
      expect(support.tiltDeviation).toBeLessThan(0.01);
      expect(support.soleDeviation).toBeGreaterThan(0.5);
      expect(supportRotation(support).angleTo(supportRotation({ ...support, method: 'body' }))).toBe(0);
      expect(supportRotation({ ...support, stableFeet: 1, soleDeviation: 0 }).angleTo(supportRotation(support))).toBe(0);
    } finally { toy.dispose(); }
  });

  it('yields during skin classification before any animation vertex scan', async () => {
    const toy = model(0, 15, 32); let clock = 0, pauses = 0, readsAtFirstPause = -1;
    const indices = toy.meshes[0]!.geometry.attributes.skinIndex!;
    const original = indices.getComponent.bind(indices);
    vi.spyOn(indices, 'getComponent').mockImplementation((v, c) => { clock += 0.01; return original(v, c); });
    const read = vi.spyOn(toy.meshes[0]!, 'getVertexPosition');
    try {
      await animationEnvelopeSliced(toy.body, toy.clips, { budgetMs: 3, now: () => clock, pause: async () => {
        if (!pauses++) readsAtFirstPause = read.mock.calls.length;
      } });
      expect(pauses).toBeGreaterThan(0);
      expect(readsAtFirstPause).toBeLessThan(toy.meshes[0]!.geometry.attributes.position!.count * 2);
    } finally { toy.dispose(); }
  });

  it('centers on indexed foot contacts, excluding a weapon and unrendered vertices', () => {
    const toy = model();
    try {
      expect(supportVertices(toy.meshes[0]!).at(-1)).toBeNull();
      const envelope = animationEnvelope(toy.body, toy.clips), support = envelope.support!;
      expect(support.method).toBe('feet');
      expect(support.center[0]).toBeCloseTo(30); expect(support.center[2]).toBeCloseTo(40);
      expect(support.floor).toBeCloseTo(5); expect(support.tiltDegrees).toBeCloseTo(0);
      expect(support.contacts.every(c => c.mesh !== 2)).toBe(true);
      fitModel(toy.body, { height: 92, width: 110, unitScale: 1, sourceScale: 0.44, support });
      const mixer = new AnimationMixer(toy.body); mixer.clipAction(toy.clip).play();
      try {
        for (const time of [0, 0.27, 0.5, 0.84, 0.99]) {
          mixer.setTime(time); updateModelGrounding(toy.body, true, 0.12);
          const measured = toy.measure();
          expect(measured.floor).toBeCloseTo(0, 5);
          expect(measured.center[0]).toBeCloseTo(0, 5); expect(measured.center[2]).toBeCloseTo(0, 5);
        }
      } finally { mixer.stopAllAction(); mixer.uncacheRoot(toy.body); }
    } finally { toy.dispose(); }
  });

  it('levels a coherent whole-model tilt using the soles, independent of root-bone rotation', () => {
    const toy = model(3 * Math.PI / 180);
    try {
      const support = animationEnvelope(toy.body, toy.clips).support!;
      expect(support.tiltDegrees).toBeCloseTo(3, 4); expect(support.tiltDeviation).toBeLessThan(0.01);
      fitModel(toy.body, { height: 92, unitScale: 1, sourceScale: 0.44, support });
      const mixer = new AnimationMixer(toy.body); mixer.clipAction(toy.clip).play(); mixer.setTime(0.3);
      try {
        updateModelGrounding(toy.body, true, 0.12);
        expect(toy.measure().floor).toBeCloseTo(0, 5);
        expect(toy.measure().tiltDegrees).toBeCloseTo(0, 4);
      } finally { mixer.stopAllAction(); mixer.uncacheRoot(toy.body); }
    } finally { toy.dispose(); }
  });

  it('preserves parent height/scale, external lift and idle release without accumulating offsets', () => {
    const toy = model();
    try {
      const support = animationEnvelope(toy.body, toy.clips).support!;
      fitModel(toy.body, { height: 92, unitScale: 1, sourceScale: 0.44, support });
      const fitted = toy.body.position.y, parent = new Group(); parent.position.y = 7; parent.scale.setScalar(2); parent.add(toy.body);
      toy.body.position.y += 12;
      const mixer = new AnimationMixer(toy.body); mixer.clipAction(toy.clip).play(); mixer.setTime(0.5);
      try {
        for (let i = 0; i < 3; i++) {
          updateModelGrounding(toy.body, true, 0.12);
          expect(toy.measure().floor).toBeCloseTo(31, 5);
        }
        updateModelGrounding(toy.body, false, 0.12);
        expect(toy.body.position.y).toBeCloseTo(fitted + 12, 5);
        updateModelGrounding(toy.body, false, 0.12);
        expect(toy.body.position.y).toBeCloseTo(fitted + 12, 5);
      } finally { mixer.stopAllAction(); mixer.uncacheRoot(toy.body); }
    } finally { toy.dispose(); }
  });

  it('shares sliced calibration across leases and retains designed flight / uncertain sole orientations', async () => {
    const first = model(), second = model();
    try {
      let clock = 0;
      const envelope = await animationEnvelopeSliced(first.body, first.clips, { budgetMs: 1, now: () => ++clock, pause: async () => {} });
      expect(envelope).toEqual(animationEnvelope(first.body, first.clips));
      const support = envelope!.support!;
      for (const id of ['malzahar', 'nocturne', 'corki', 'pve-elder-dragon']) expect(standingSupport(id, envelope!)).toBeUndefined();
      expect(standingSupport('akali', envelope!)).toBe(support);
      expect(supportRotation({ ...support, method: 'body', tiltDegrees: 4 }).angleTo(supportRotation(support))).toBe(0);
      expect(supportRotation({ ...support, tiltDegrees: 4, tiltDeviation: 9 }).angleTo(supportRotation(support))).toBe(0);
      fitModel(second.body, { height: 92, unitScale: 1, sourceScale: 0.44, support });
      const mixer = new AnimationMixer(second.body); mixer.clipAction(second.clip).play(); mixer.setTime(0.7);
      try { updateModelGrounding(second.body, true, 0.12); expect(second.measure().floor).toBeCloseTo(0, 5); }
      finally { mixer.stopAllAction(); mixer.uncacheRoot(second.body); }
    } finally { first.dispose(); second.dispose(); }
  });
});

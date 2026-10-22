import { describe, expect, it } from 'vitest';
import { AnimationClip, AnimationMixer, Bone, Box3, BufferGeometry, Float32BufferAttribute, Group,
  Int16BufferAttribute, Matrix4, MeshBasicMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh,
  Uint16BufferAttribute, Vector3 } from 'three';
import { animationEnvelope, animationEnvelopeSliced, fitModel } from '../src/rendering/three-mode/model-fit';

/** glTF quantization folds decode into inverse binds, while authored node TRS stay in source units. */
function skin(quantized: boolean, hover = 0) {
  const count = 1601, geometry = new BufferGeometry(), body = new Group(), rig = new Group();
  rig.name = 'rig'; body.add(rig);
  const root = new Bone(), foot = new Bone(); root.name = 'ROOT'; foot.name = 'foot';
  root.position.y = 99; foot.rotation.y = 0.2; foot.scale.set(1.2, 1, 0.8); root.add(foot); rig.add(root);
  const decode = new Matrix4().makeScale(2, 2, 2).setPosition(0, 2 + hover, 0);
  const positions = [], weights = [], indices = [];
  for (let i = 0; i < count; i++) {
    // The only lowest vertex is BETWEEN stride-7 samples.
    const p = new Vector3(i % 2 ? -1 : 1, i === 1 ? -1 : 1, 0);
    if (!quantized) p.applyMatrix4(decode); else p.multiplyScalar(32767);
    positions.push(...p.toArray()); weights.push(1, 0, 0, 0); indices.push(1, 0, 0, 0);
  }
  geometry.setAttribute('position', quantized ? new Int16BufferAttribute(positions, 3, true) : new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  body.updateMatrixWorld(true);
  const inverses = [root, foot].map(b => b.matrixWorld.clone().invert().multiply(quantized ? decode : new Matrix4()));
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()); body.add(mesh);
  mesh.bind(new Skeleton([root, foot], inverses), new Matrix4());
  const clip = (name: string, lift: number, footY?: number) => new AnimationClip(name, 1, [
    new NumberKeyframeTrack('ROOT.position[y]', [0, 1], [99 + lift, 99 + lift]),
    ...(footY === undefined ? [] : [new NumberKeyframeTrack('foot.position[y]', [0, 1], [footY, footY])]),
    new NumberKeyframeTrack('rig.position[x]', [0, 1], [0, 3]),
  ]);
  const idle = clip('idle', 10), attack = clip('attack', 0, -2);
  const clips = [{ clip: attack, loop: false, ground: true }, { clip: idle, loop: true, ground: true }];
  const transforms = () => [body, rig, root, foot, mesh].map(n => [...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()]);
  const box = () => { body.updateMatrixWorld(true); mesh.skeleton.update(); return new Box3().setFromObject(body, true); };
  const feet = (animation: AnimationClip) => {
    const mixer = new AnimationMixer(body); mixer.clipAction(animation).play(); mixer.setTime(0.5);
    const y = box().min.y; mixer.stopAllAction(); mixer.uncacheRoot(body); return y;
  };
  return { body, root, foot, mesh, clips, idle, attack, transforms, box, feet,
    dispose() { geometry.dispose(); mesh.material.dispose(); mesh.skeleton.dispose(); } };
}

describe.each([false, true])('loaded pose restoration (quantized=%s)', quantized => {
  it.each(['sync', 'sliced'] as const)('keeps authored TRS, ROOT home and loaded bounds across clips (%s)', async mode => {
    const toy = skin(quantized);
    try {
      const before = toy.transforms(), bind = toy.box();
      const measure = mode === 'sync' ? animationEnvelope : animationEnvelopeSliced;
      const envelope = await measure(toy.body, toy.clips);
      expect(envelope!.ground).toBeCloseTo(-2, 6);
      expect(toy.transforms()).toEqual(before); expect(toy.root.position.y).toBe(99);
      expect(toy.box().min.y).toBeCloseTo(bind.min.y, 6);
      expect(toy.mesh.boundingBox!.min.y).toBeCloseTo(bind.min.y, 6);
      // A partial-track idle cannot inherit attack's foot offset; clip order and repeated measurements agree.
      expect((await measure(toy.body, [...toy.clips].reverse()))).toEqual(envelope);
      expect((await measure(toy.body, toy.clips.slice(1)))!.ground).toBeCloseTo(0, 6);
      fitModel(toy.body, { height: 92, sourceScale: 1, unitScale: 1, ground: envelope!.ground });
      expect(toy.feet(toy.attack)).toBeCloseTo(0, 6);
      expect(toy.feet(toy.idle)).toBeCloseTo(12, 6);
    } finally { toy.dispose(); }
  });

  it('preserves authored bind hover after fitting to the lowest combat pose', () => {
    const toy = skin(quantized, 5);
    try {
      const envelope = animationEnvelope(toy.body, toy.clips);
      expect(envelope.ground).toBeCloseTo(3, 6);
      fitModel(toy.body, { height: 92, sourceScale: 1, unitScale: 1, ground: envelope.ground });
      expect(toy.feet(toy.attack)).toBeCloseTo(5, 6);
      expect(toy.feet(toy.idle)).toBeCloseTo(17, 6);
    } finally { toy.dispose(); }
  });

  it.each(['cancel', 'reject'] as const)('restores TRS, matrices and stale bounds on slice %s', async mode => {
    const toy = skin(quantized);
    try {
      const before = toy.transforms(), bind = toy.box(); let clock = 0;
      const result = animationEnvelopeSliced(toy.body, toy.clips, {
        now: () => ++clock, budgetMs: 1, stop: () => true,
        pause: async () => { toy.mesh.computeBoundingBox(); if (mode === 'reject') throw Error('pause failed'); },
      });
      if (mode === 'reject') await expect(result).rejects.toThrow('pause failed');
      else expect(await result).toBeNull();
      expect(toy.transforms()).toEqual(before);
      expect(toy.mesh.boundingBox!.min.y).toBeCloseTo(bind.min.y, 6);
      expect(toy.box().min.y).toBeCloseTo(bind.min.y, 6);
      expect(animationEnvelope(toy.body, toy.clips).ground).toBeCloseTo(-2, 6);
    } finally { toy.dispose(); }
  });
});

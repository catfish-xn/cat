import { describe, expect, it } from 'vitest';
import { AnimationClip, AnimationMixer, Bone, BoxGeometry, Float32BufferAttribute, Group, MeshBasicMaterial,
  NumberKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { animationEnvelope, animationEnvelopeSliced, fitModel } from '../src/rendering/three-mode/model-fit';

/** Feet and head are repeated so both occur in the production sampler's stride; no asset files or GPU. */
function model(bindFeet = 0) {
  const geometry = new BoxGeometry(2, 4, 2).translate(0, bindFeet + 2, 0);
  const count = geometry.getAttribute('position').count;
  const weights = new Float32Array(count * 4);
  const indices = new Uint16Array(count * 4);
  for (let i = 0; i < count; i++) { weights[i * 4] = 1; indices[i * 4] = 1; }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  // A nonzero bind root catches subtracting its absolute position instead of its drift.
  const root = new Bone(); root.name = 'root'; root.position.y = 3;
  const foot = new Bone(); foot.name = 'foot'; root.add(foot);
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()); mesh.add(root); mesh.bind(new Skeleton([root, foot]));
  const body = new Group(); body.add(mesh);
  const clip = (name: string, rise: number, footLift = 0) => new AnimationClip(name, 1,
    [new NumberKeyframeTrack('root.position[y]', [0, 1], [3 + rise, 3 + rise]),
      new NumberKeyframeTrack('foot.position[y]', [0, 1], [footLift, footLift])]);
  const idle = clip('idle', 10), attack = clip('attack', 0);
  const clips = [{ clip: idle, loop: true, ground: true }, { clip: attack, loop: false, ground: true }];
  const feet = (animation: AnimationClip) => {
    const mixer = new AnimationMixer(body);
    mixer.clipAction(animation).play(); mixer.setTime(0.5); body.updateMatrixWorld(true); mesh.skeleton.update();
    const point = new Vector3(); let low = Infinity;
    for (let i = 0; i < count; i++) low = Math.min(low, mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).y);
    mixer.stopAllAction(); mixer.uncacheRoot(body); mesh.skeleton.pose();
    return low;
  };
  return { body, idle, attack, clips, feet, clip,
    dispose() { mesh.skeleton.dispose(); geometry.dispose(); mesh.material.dispose(); } };
}

describe('root-motion independent grounding', () => {
  it.each(['sync', 'sliced'] as const)('ignores a weapon hidden far underground without dropping real foot vertices (%s)', async mode => {
    const geometry = new BoxGeometry(2, 4, 2).translate(0, 2, 0);
    const count = geometry.getAttribute('position').count;
    const weights = new Float32Array(count * 4), indices = new Uint16Array(count * 4);
    for (let i = 0; i < count; i++) { weights[i * 4] = 1; indices[i * 4] = i < 8 ? 1 : 0; }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    const root = new Bone(), axe = new Bone(); root.name = 'root'; axe.name = 'axe'; root.add(axe);
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()); mesh.add(root); mesh.bind(new Skeleton([root, axe]));
    const body = new Group(); body.add(mesh);
    const attack = new AnimationClip('attack', 1, [new NumberKeyframeTrack('axe.position[y]', [0, 1], [-15000, -15000])]);
    try {
      const measure = mode === 'sync' ? animationEnvelope : animationEnvelopeSliced;
      const envelope = await measure(body, [{ clip: attack, loop: false, ground: true }]);
      expect(envelope!.ground).toBeCloseTo(0);
      fitModel(body, { height: 92, width: 110, sourceScale: 1, unitScale: 1, ground: envelope!.ground });
      expect(body.position.y).toBeCloseTo(0);
      expect(body.scale.y).toBe(1);
    } finally { mesh.skeleton.dispose(); geometry.dispose(); mesh.material.dispose(); }
  });
  it.each(['sync', 'sliced'] as const)('keeps a raised idle at +10 and a root-zero action on the floor (%s)', async mode => {
    const toy = model();
    try {
      // Idle alone must already discount its root drift, even before a lower action is measured.
      const measure = mode === 'sync' ? animationEnvelope : animationEnvelopeSliced;
      expect((await measure(toy.body, toy.clips.slice(0, 1)))?.ground).toBeCloseTo(0);
      const envelope = await measure(toy.body, toy.clips);
      expect(envelope?.ground).toBeCloseTo(0);
      fitModel(toy.body, { height: 92, sourceScale: 1, unitScale: 1, ground: envelope!.ground });
      expect(toy.body.position.y).toBeCloseTo(0);
      expect(toy.feet(toy.idle)).toBeCloseTo(10);
      expect(toy.feet(toy.attack)).toBeCloseTo(0);
    } finally { toy.dispose(); }
  });

  it('preserves the height of a model whose bind feet already hover above the origin', () => {
    const toy = model(5);
    try {
      expect(toy.feet(toy.attack)).toBeCloseTo(5);
      const envelope = animationEnvelope(toy.body, toy.clips);
      expect(envelope.ground).toBeCloseTo(5);
      fitModel(toy.body, { height: 92, sourceScale: 1, unitScale: 1, ground: envelope.ground });
      expect(toy.feet(toy.attack)).toBeCloseTo(5);
      expect(toy.feet(toy.idle)).toBeCloseTo(15);
    } finally { toy.dispose(); }
  });

  it('uses the lowest root-corrected foot position across clips regardless of their order', () => {
    const toy = model();
    try {
      const idle = { clip: toy.clip('idle', 10, 3), loop: true, ground: true };
      const attack = { clip: toy.clip('attack', 0, 1), loop: false, ground: true };
      expect(animationEnvelope(toy.body, [idle]).ground).toBeCloseTo(3);
      for (const clips of [[idle, attack], [attack, idle]]) {
        expect(animationEnvelope(toy.body, clips).ground).toBeCloseTo(1);
      }
    } finally { toy.dispose(); }
  });

  it('keeps a non-root foot pose below the bind floor from sinking after fitting', () => {
    const toy = model();
    try {
      const low = toy.clip('attack', 0, -2);
      const envelope = animationEnvelope(toy.body, [{ clip: low, loop: false, ground: true }]);
      expect(envelope.ground).toBeCloseTo(-2);
      fitModel(toy.body, { height: 92, sourceScale: 1, unitScale: 1, ground: envelope.ground });
      expect(toy.feet(low)).toBeCloseTo(0);
    } finally { toy.dispose(); }
  });
});

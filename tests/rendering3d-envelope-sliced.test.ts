import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial,
  NumberKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three';
import { animationEnvelopeRadius, animationEnvelopeRadiusSliced, fitModel } from '../src/rendering/three-mode/model-fit';

/** Synthetic skin only: no local model files or GPU required. */
function skin(sampledVertices: number) {
  const count = sampledVertices * 7, geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { positions[i * 3] = 2; weights[i * 4] = 1; }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  const root = new Bone(), arm = new Bone(); root.name = 'root'; arm.name = 'arm'; root.add(arm);
  // Attach all vertices to the animated child, leaving root drift independent of reach.
  const indices = geometry.getAttribute('skinIndex');
  for (let i = 0; i < count; i++) indices.setX(i, 1);
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()); mesh.add(root); mesh.bind(new Skeleton([root, arm]));
  const body = new Group(); body.add(mesh);
  const clips = [{ clip: new AnimationClip('attack', 1, [new NumberKeyframeTrack('arm.position[x]', [0, 1], [0, 8])]), loop: false }];
  return { body, mesh, arm, clips, dispose() { mesh.skeleton.dispose(); geometry.dispose(); mesh.material.dispose(); } };
}

describe('sliced animation envelope', () => {
  it('documents the remaining synchronous bind-box vertex scan even after an envelope was warmed', async () => {
    const model = skin(24);
    try {
      const envelopeRadius = await animationEnvelopeRadiusSliced(model.body, model.clips);
      expect(envelopeRadius).not.toBeNull(); expect(model.mesh.boundingBox).toBeNull();
      const reads = vi.spyOn(model.mesh, 'getVertexPosition');
      fitModel(model.body, { height: 92, width: 110, sourceScale: 0.44, unitScale: 1, envelopeRadius: envelopeRadius! });
      // Three's Box3.setFromObject -> SkinnedMesh.computeBoundingBox is still O(all vertices), per uncached lease.
      expect(reads).toHaveBeenCalledTimes(model.mesh.geometry.getAttribute('position').count);
    } finally { model.dispose(); }
  });

  it('matches synchronous full sampling across multiple yields and restores the bind pose', async () => {
    const model = skin(1501), pause = vi.fn(async () => {}); let clock = 0;
    try {
      const expected = animationEnvelopeRadius(model.body, model.clips);
      expect(expected).toBeCloseTo(10);
      const radius = await animationEnvelopeRadiusSliced(model.body, model.clips, { now: () => ++clock, budgetMs: 1, pause });
      expect(radius).toBe(expected); expect(pause.mock.calls.length).toBeGreaterThan(1);
      expect(model.arm.position.x).toBe(0);
    } finally { model.dispose(); }
  });

  it('returns null on interruption rather than a partial radius, restores bones and can restart fully', async () => {
    const model = skin(1501); let clock = 0, resume!: () => void, stopped = false;
    const pause = vi.fn(() => new Promise<void>(resolve => { resume = resolve; }));
    try {
      const result = animationEnvelopeRadiusSliced(model.body, model.clips, { now: () => ++clock, budgetMs: 1, pause, stop: () => stopped });
      expect(pause).toHaveBeenCalledTimes(1);
      stopped = true; resume(); expect(await result).toBeNull(); expect(model.arm.position.x).toBe(0);
      expect(animationEnvelopeRadius(model.body, model.clips)).toBeCloseTo(10);
    } finally { model.dispose(); }
  });

  it('yields when the total work exceeds budget even if each pose has fewer than 1500 sampled vertices', async () => {
    const model = skin(1499), pause = vi.fn(async () => {}); let clock = 0;
    const vertex = model.mesh.getVertexPosition.bind(model.mesh);
    vi.spyOn(model.mesh, 'getVertexPosition').mockImplementation((index, target) => { clock += 0.01; return vertex(index, target); });
    try {
      expect(await animationEnvelopeRadiusSliced(model.body, model.clips, { now: () => clock, budgetMs: 3, pause })).toBeCloseTo(10);
      // 8 poses × 1499 samples consume ~120 synthetic ms; every slice must be able to yield.
      expect(pause.mock.calls.length).toBeGreaterThan(0);
    } finally { model.dispose(); }
  });
});

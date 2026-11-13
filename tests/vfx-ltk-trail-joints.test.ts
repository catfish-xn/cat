import { Camera } from 'three';
import { describe, expect, it } from 'vitest';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import { ribbonBuffers, strand, writeTrail, type TrailBuild } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/ribbon';
import { TRAIL_SMOOTHING } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, pointAnchor } from '../src/rendering/three-mode/vfx-ltk/particles';
import { Texture } from 'three';
import { constant, num, struct, vec } from './vfx-ltk-synthetic';

/** A strand through `points` (oldest first), each `half` wide, facing nothing in particular. Synthetic. */
function strandOf(points: readonly (readonly [number, number, number])[], half = 100) {
  const held = strand(points.length);
  held.count = points.length;
  points.forEach((p, i) => { held.position.set(p, i * 3); held.width[i] = half; held.color.set([1, 1, 1, 1], i * 4); held.tiling.set([100, 0], i * 2); });
  return held;
}
const build = (smoothing: number): TrailBuild => ({ view: [0, 0, 1], wake: false, smoothing, reach: 0, cutoff: 0,
  layers: { base: { center: [0.5, 0.5], flipU: false, flipV: false }, mult: null } });
function written(points: readonly (readonly [number, number, number])[], smoothing: number = TRAIL_SMOOTHING.frontToBack) {
  const buffers = ribbonBuffers(64), cursor = { vertex: 0, index: 0 };
  writeTrail(strandOf(points), build(smoothing), buffers.arrays, cursor);
  const pairs: { at: number[]; across: number[] }[] = [];
  for (let v = 0; v < cursor.vertex; v += 2) {
    const a = Array.from(buffers.arrays.position.slice(v * 3, v * 3 + 3)), b = Array.from(buffers.arrays.position.slice(v * 3 + 3, v * 3 + 6));
    pairs.push({ at: a.map((x, i) => (x + b[i]!) / 2), across: a.map((x, i) => x - b[i]!) });
  }
  return { pairs, triangles: cursor.index / 3 };
}
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

describe('vfx-ltk trail joints', () => {
  it('a point on (or all but on) the last is merged: no pair on it and no turn of the ribbon there', () => {
    const plain = written([[0, 0, 0], [0, 200, 0], [0, 400, 0]]);
    expect(plain.pairs).toHaveLength(3);
    // Synthetic: the middle point is 1.5 units from the last on a 200-wide ribbon, the shape the comet trail's step had.
    const near = written([[0, 0, 0], [0, 200, 0], [1.5, 200.5, 0], [0, 400, 0]]);
    expect(near.pairs).toHaveLength(3);
    expect(near.triangles).toBe(plain.triangles);
    for (let i = 1; i < near.pairs.length; i++) expect(dot(near.pairs[i]!.across, near.pairs[i - 1]!.across)).toBeGreaterThan(0);
  });

  it('a final point on the last still closes the ribbon, keeping the last side', () => {
    // The walk runs newest to oldest, so the oldest point is its final one.
    const near = written([[0.5, 0, 0], [0, 0, 0], [0, 200, 0]]);
    expect(near.pairs).toHaveLength(3);
    expect(near.pairs[2]!.across).toEqual(near.pairs[1]!.across);
  });

  it('the head (the walk\'s first point) on the next one takes its direction from the first point past it', () => {
    const plain = written([[0, 0, 0], [0, 200, 0], [0, 400, 0]]), near = written([[0, 0, 0], [0, 200, 0], [0, 399, 0], [1, 400, 0]]);
    const a = near.pairs[0]!.across, b = plain.pairs[0]!.across;
    // Within half a degree of the plain trail's head (it points at a point 1 unit aside, 200 away), not along the 1-unit step to its neighbour.
    expect(dot(a, b) / Math.hypot(...a) / Math.hypot(...b)).toBeGreaterThan(Math.cos(0.5 * Math.PI / 180));
  });

  it('points apart by more than a twentieth of the half-width are each their own joint, as before', () => {
    expect(written([[0, 0, 0], [0, 6, 0], [0, 12, 0], [0, 18, 0]]).pairs).toHaveLength(4);
    expect(written([[0, 0, 0], [0, 200, 0], [6, 205, 0], [0, 400, 0]], TRAIL_SMOOTHING.off).pairs).toHaveLength(4);
  });
});

describe('vfx-ltk trail on a landing missile', () => {
  const yes: VfxValue = { type: 'bool', value: true };
  // A camera trail emitting slowly (2 a second, Caitlyn's comet is about as sparse for its fall). Synthetic.
  const trail = struct('VfxEmitterDefinitionData', {
    emitterName: { type: 'string', value: 'trail' }, rate: constant(num(2)), lifetime: num(5), particleLifetime: constant(num(2)), particleLinger: num(2),
    birthScale0: constant(vec(20, 20, 20)), texture: { type: 'asset', path: 'synthetic.tex', asset: null },
    primitive: struct('VfxPrimitiveCameraTrail', { mTrail: struct('VfxTrailDefinitionData', { mMode: num(1), mBirthTilingSize: constant(vec(100, 0, 0)) }) }),
  });
  const system: VfxSystem = { entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'), class: 'VfxSystemDefinitionData',
    materials: [], root: struct('VfxSystemDefinitionData', { complexEmitterDefinitionData: { type: 'container', items: [trail] } }) };
  void yes;

  it('lays its last point where the missile lands, though its rate owes none', async () => {
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { probe: [{ system: 'sample', event: 'cast-start', delay: 0, duration: 1 }] } }
      : system, readTexture: async () => new Texture() });
    await library.load('sample'); const prepared = library.get('sample')!;
    const from = pointAnchor([-100, 300, -100]), to = pointAnchor([0, 0, 0]);
    const fx: any = createLtkParticles(prepared, { anchor: from, target: to, joints: () => from, duration: 0.6, seed: 1, projectileSeconds: 0.3, fixedTime: true } as any);
    for (let f = 0; f < 30; f++) fx.update(1 / 60, new Camera());
    const pool = fx.driver.pool; let newest = -1;
    for (let i = 0; i < pool.count; i++) if (newest < 0 || pool.serial[i] > pool.serial[newest]) newest = i;
    const landing = to.originAt(0);
    // The newest point's anchor (where it was born) is the landing point.
    expect(Math.hypot(...[0, 1, 2].map(k => pool.anchor[newest * 3 + k] - landing[k]!))).toBeLessThan(1);
    fx.dispose();
  });
});

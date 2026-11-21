import { describe, expect, it } from 'vitest';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { createDriver } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/driver';
import { pointAnchor, ROOT_PARTICLES } from '../src/rendering/three-mode/vfx-ltk/particles';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { constant, num, struct, vec } from './vfx-ltk-synthetic';

// Synthetic values only, not exported game data.
const yes: VfxValue = { type: 'bool', value: true } as VfxValue;
const emitter = (name: string, fields: Record<string, VfxValue>) => struct('VfxEmitterDefinitionData', {
  emitterName: { type: 'string', value: name }, rate: constant(num(1)), isSingleParticle: yes, lifetime: num(1), particleLifetime: constant(num(0.5)),
  birthScale0: constant(vec(40, 1, 1)), birthColor: constant(vec(1, 1, 1, 1)), texture: { type: 'asset', path: 'synthetic.tex', asset: null }, ...fields });
const system = (items: VfxValue[]): VfxSystem => ({ entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'),
  class: 'VfxSystemDefinitionData', materials: [], root: struct('VfxSystemDefinitionData', { complexEmitterDefinitionData: { type: 'container', items } }) });
const SYSTEM = system([
  emitter('beam', { primitive: struct('VfxPrimitiveBeam', { mBeam: struct('VfxBeamDefinitionData', {}) }) }),
  emitter('quad', {}),
]);

/** Each emitter's first particle's birth scale, at a cue size of `scale`. */
function births(scale: number) {
  const model = readVfxSystem(SYSTEM as any), anchor = pointAnchor([0, 0, 0]);
  const driver = createDriver(3, { capacity: ROOT_PARTICLES, seekable: false, childBudget: 0, maxChildren: 0 });
  driver.setScale(scale); driver.swap(model);
  driver.steer({ life: 'once', height: 0, joints: () => anchor, motion: { kind: 'bone', anchor, target: null } } as any);
  driver.advance(1 / 60);
  const out: Record<string, number[]> = {};
  for (let i = 0; i < driver.pool.count; i++) out[model.emitters[driver.pool.emitter[i]!]!.name] = [...driver.pool.birthScale.subarray(i * 3, i * 3 + 3)];
  return out;
}

describe("vfx-ltk ribbon beam: a cue's size scales its width, never the shares of its length kept from each end", () => {
  it('a beam keeps its end shares at a cue size; a quad scales on every axis as before', () => {
    const half = births(0.5);
    expect(half.beam![0]).toBeCloseTo(20, 5);
    expect(half.beam![1]).toBeCloseTo(1, 5);
    expect(half.beam![2]).toBeCloseTo(1, 5);
    expect(half.quad).toEqual([20, 0.5, 0.5].map(v => expect.closeTo(v, 5)));
  });

  it('at size 1 nothing changes', () => {
    expect(births(1).beam!.map(v => +v.toFixed(5))).toEqual([40, 1, 1]);
  });
});

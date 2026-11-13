import { describe, expect, it } from 'vitest';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { heldUntilReveal } from '../src/rendering/three-mode/vfx-ltk/engine/model/systemModel';
import { createDriver } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/driver';
import { pointAnchor, ROOT_PARTICLES } from '../src/rendering/three-mode/vfx-ltk/particles';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { constant, num, struct, vec } from './vfx-ltk-synthetic';

// Synthetic values only, not exported game data.
const yes: VfxValue = { type: 'bool', value: true } as VfxValue;
const single = (name: string, born: number, life: number, lifetime = 3) => struct('VfxEmitterDefinitionData', {
  emitterName: { type: 'string', value: name }, rate: constant(num(1)), isSingleParticle: yes, lifetime: num(lifetime),
  particleLifetime: constant(num(life)), timeBeforeFirstEmission: num(born),
  birthScale0: constant(vec(4, 4, 4)), birthColor: constant(vec(1, 1, 1, 1)), texture: { type: 'asset', path: 'synthetic.tex', asset: null } });
const stream = struct('VfxEmitterDefinitionData', {
  emitterName: { type: 'string', value: 'stream' }, rate: constant(num(30)), lifetime: num(3), particleLifetime: constant(num(0.4)),
  birthScale0: constant(vec(4, 4, 4)), birthColor: constant(vec(1, 1, 1, 1)), texture: { type: 'asset', path: 'synthetic.tex', asset: null } });
function system(buildUp: number, items: VfxValue[]): VfxSystem {
  return { entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'), class: 'VfxSystemDefinitionData', materials: [],
    root: struct('VfxSystemDefinitionData', { buildUpTime: num(buildUp), complexEmitterDefinitionData: { type: 'container', items } }) };
}
const EMITTERS = [single('atStart', 0, 0.5), single('later', 0.15, 0.3), single('outlives', 0, 2.1), single('endsInside', 0, 0.5, 1), stream];

/** The last frame index with a live particle of `name`, -1 for none. */
const lastWith = (out: readonly Record<string, number>[], name: string) => { for (let i = out.length - 1; i >= 0; i--) if (out[i]![name]) return i; return -1; };
/** Live particles per emitter name, frame by frame, from the system's first drawn step. */
function run(buildUp: number, frames: number) {
  const model = readVfxSystem(system(buildUp, EMITTERS) as any);
  const anchor = pointAnchor([0, 0, 0]);
  const driver = createDriver(7, { capacity: ROOT_PARTICLES, seekable: false, childBudget: 100, maxChildren: 8 });
  driver.swap(model);
  driver.steer({ life: 'once', height: 0, joints: () => anchor, motion: { kind: 'bone', anchor, target: null } } as any);
  const out: Record<string, number>[] = [];
  for (let f = 0; f < frames; f++) {
    driver.advance(1 / 60);
    const live: Record<string, number> = {};
    for (let i = 0; i < driver.pool.count; i++) { const name = model.emitters[driver.pool.emitter[i]!]!.name; live[name] = (live[name] ?? 0) + 1; }
    out.push(live);
  }
  return { model, out };
}

describe('vfx-ltk build-up: single particles born at the start show when the system is revealed (our handling)', () => {
  it('holds only single emitters born at zero whose whole life fits inside the build-up and whose emitter outlasts it', () => {
    const { model } = run(1.8, 1);
    expect([...heldUntilReveal(model)].map(i => model.emitters[i]!.name)).toEqual(['atStart']);
    // No build-up, nothing held.
    expect(heldUntilReveal(run(0, 1).model).size).toBe(0);
  });

  it('the held emitter is born on the first drawn frame with its whole life; a later one stays consumed', () => {
    const { out } = run(1.8, 40);
    expect(out[0]!.atStart).toBe(1);
    expect(lastWith(out, 'atStart')).toBeGreaterThanOrEqual(25);   // about its 0.5 s at 1/60
    expect(out.every(f => !f.later)).toBe(true);
    expect(out.every(f => !f.endsInside)).toBe(true);
    // An emitter whose particle outlives the build-up keeps what is left of it: born in the build-up, as before.
    expect(out[0]!.outlives).toBe(1);
    expect(lastWith(out, 'outlives')).toBeLessThan(25);
    expect(out[0]!.stream).toBeGreaterThan(0);
  });

  it('a system without a build-up plays exactly as before', () => {
    const plain = run(0, 40).out;
    expect(plain[0]!.atStart).toBe(1);
    expect(lastWith(plain, 'later')).toBeGreaterThan(0);
  });
});

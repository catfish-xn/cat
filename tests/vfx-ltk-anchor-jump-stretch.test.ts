import { describe, expect, it } from 'vitest';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { createDriver } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/driver';
import { stretchOf } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/particleRead';
import { constant, num, vec, syntheticSystem } from './vfx-ltk-synthetic';

// Steb's orange streak (11-15, C24): the shared attack hit (0f2af66b) has one spark emitter that stretches along its speed
// (isDirectionOriented, directionVelocityScale) and follows its host fully (bindWeight 1). carry() (integrate.ts) adds the
// host's step travel divided by dt to that speed, so one frame in which the host jumps stretches the spark across the board.
// Synthetic emitter with the same switches; values are not the asset's.
const SCALE = 0.05;
function spark(bindWeight: number) {
  return readVfxSystem(syntheticSystem({
    rate: constant(num(1)), lifetime: num(0.1), particleLifetime: constant(num(0.5)), isSingleParticle: { type: 'bool', value: true },
    birthVelocity: constant(vec(100, 0, 0)),
    isDirectionOriented: { type: 'bool', value: true }, directionVelocityScale: num(SCALE),
    bindWeight: constant(num(bindWeight)),
  }));
}
/** Runs the spark on a host standing at `at(step)`; returns the stretch of its one particle at each step. */
function stretches(bindWeight: number, at: (step: number) => [number, number, number], steps = 12) {
  const model = spark(bindWeight), emitter = model.emitters[0]!;
  let now: [number, number, number] = at(0);
  const anchor = { originAt: () => now, basisInto: (_t: number, out: Float32Array) => { out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return out; } };
  const driver = createDriver(1, { capacity: 16, seekable: false, childBudget: 0, maxChildren: 0 });
  driver.swap(model);
  driver.steer({ life: 'once', height: 0, joints: () => anchor, motion: { kind: 'bone', anchor, target: null } } as never);
  const out: number[] = [];
  for (let s = 1; s <= steps; s++) {
    now = at(s); driver.advance(1 / 60);
    const pool = driver.pool; out.push(pool.count ? stretchOf(pool, 0, emitter) : 0);
  }
  return out;
}

describe('a spark that follows its host stretches by the host\'s step travel (C24 repro)', () => {
  it('a still host: the spark keeps its own speed\'s stretch', () => {
    const still = stretches(1, () => [0, 0, 0]);
    expect(Math.max(...still)).toBeLessThan(10);
  });

  it('one frame in which the host jumps 60 units stretches the spark by 60 × 60 × scale for that frame only', () => {
    const jump = stretches(1, s => (s >= 6 ? [60, 0, 0] : [0, 0, 0]));
    const still = stretches(1, () => [0, 0, 0]);
    expect(jump[5]! - still[5]!).toBeGreaterThan(60 * 60 * SCALE * 0.9);
    // The frames before and after the jump are as a still host's.
    for (const s of [2, 3, 4, 7, 8]) expect(Math.abs(jump[s]! - still[s]!)).toBeLessThan(1);
  });

  it('with bindWeight 0 the same jump leaves the stretch alone', () => {
    const jump = stretches(0, s => (s >= 6 ? [60, 0, 0] : [0, 0, 0]));
    const still = stretches(0, () => [0, 0, 0]);
    for (let s = 0; s < jump.length; s++) expect(Math.abs(jump[s]! - still[s]!)).toBeLessThan(1);
  });
});

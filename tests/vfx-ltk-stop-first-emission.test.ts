import { Camera, Group, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { FIRST_EMISSION_SLACK } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/emit';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

// 11-16: a cue stopping at 0.1 s lost every emitter whose first emission was authored at 0.1 s (it reads 0.100000001 as a
// float), because the first step to reach it lay past the stop: Lux's empowered stars, Leona's ring, Mel's shield.
const f32 = (x: number) => Math.fround(x);
const single = (delay: number) => syntheticSystem({ isSingleParticle: { type: 'bool', value: true }, rate: constant(num(1)), lifetime: num(1),
  particleLifetime: constant(num(1)), timeBeforeFirstEmission: num(delay) });
const steady = (delay: number) => syntheticSystem({ rate: constant(num(30)), lifetime: num(1), particleLifetime: constant(num(1)), timeBeforeFirstEmission: num(delay) });
/** The most particles alive at once over a 1 s cue stopping at `stopAfter`, stepped at 60 Hz. */
async function peak(build: () => ReturnType<typeof syntheticSystem>, stopAfter: number | undefined) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : build(), readTexture: async () => new Texture() });
  const system = await library.load('sample');
  const root = new Group(), body = new Group(); root.add(body);
  const fx = createLtkParticles(system, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, stopAfter, seed: 3 });
  const camera = new Camera(); let most = 0;
  for (let step = 0; step < 60; step++) { fx.update(1 / 60, camera); most = Math.max(most, fx.driver.pool.count); }
  fx.dispose(); library.dispose();
  return most;
}

describe('a stop never takes an emission that was due by it', () => {
  it('a single particle authored to start at the stop itself still spawns (float 0.1 against a 0.1 s stop)', async () => {
    expect(f32(0.1)).toBeGreaterThan(0.1);
    expect(await peak(() => single(f32(0.1)), 0.1)).toBe(1);
    expect(await peak(() => single(0.05), 0.1)).toBe(1);
  });
  it('one that starts after the stop still never spawns, and the slack is float rounding only', async () => {
    expect(await peak(() => single(0.2), 0.1)).toBe(0);
    expect(await peak(() => single(0.1 + 2 * FIRST_EMISSION_SLACK), 0.1)).toBe(0);
    expect(FIRST_EMISSION_SLACK).toBeLessThan(1 / 600);
  });
  it('a steady emitter due at the stop gets its first step and no more; without a stop nothing changes', async () => {
    const atStop = await peak(() => steady(f32(0.1)), 0.1);
    expect(atStop).toBeGreaterThan(0);
    expect(atStop).toBeLessThan(await peak(() => steady(f32(0.1)), undefined));
    expect(await peak(() => steady(0.2), 0.1)).toBe(0);
  });
});

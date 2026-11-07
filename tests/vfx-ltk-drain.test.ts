import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, drainRate, MAX_DRAIN_RATE, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

// Zyra's E_Outer field shape (3e90bd1c): particles live 2.5 s and linger past a stop, the cue ends 1.4 s in, emission stops at 0.8 s.
const longLived = () => syntheticSystem({ rate: constant(num(60)), lifetime: num(5), particleLifetime: constant(num(2.5)), particleLinger: num(5) });
async function prepared() {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : longLived(), readTexture: async () => new Texture() });
  return { library, system: await library.load('sample') };
}
function living(drain: boolean, system: Awaited<ReturnType<typeof prepared>>['system']) {
  const root = new Group(), body = new Group(); root.add(body);
  const fx = createLtkParticles(system, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body),
    duration: 1.4, stopAfter: 0.8, drain, seed: 5 });
  const camera = new Camera(), counts: number[] = [];
  for (let step = 0; step < 140; step++) { fx.update(0.01, camera); counts.push(fx.driver.pool.count); }
  fx.dispose();
  return counts;
}

describe('a drained cue fades out on its own particles before it ends (Zyra E, 11-07)', () => {
  it('runs the tail just fast enough for the longest life to end inside the cue, within the cap', () => {
    expect(drainRate(2.5, 1.4, 0.8)).toBeCloseTo(2.5 / 0.6);
    expect(drainRate(0.4, 1.4, 0.8)).toBe(1);
    expect(drainRate(2.5, 1.4, undefined)).toBe(1);
    expect(drainRate(2.5, 0.8, 0.8)).toBe(1);
    expect(drainRate(30, 1.4, 0.8)).toBe(MAX_DRAIN_RATE);
  });
  it('keeps the same particles up to the stop, then lets them die out instead of being cut off at full strength', async () => {
    const { library, system } = await prepared();
    const plain = living(false, system), drained = living(true, system);
    // Before emission stops both runs are the same simulation.
    expect(drained.slice(0, 79)).toEqual(plain.slice(0, 79));
    expect(plain[79]).toBeGreaterThan(20);
    // Undrained, nothing has reached 2.5 s by the cue's end: everything is still alive in its last frame.
    expect(plain[139]).toBe(plain[79]);
    // Drained, the living particles thin out across the tail and are almost gone by the end.
    expect(drained[124]).toBeLessThan(plain[124]);
    expect(drained[124]).toBeGreaterThan(0);
    expect(drained[139]).toBeLessThanOrEqual(plain[139] * 0.15);
    library.dispose();
  });
  it('asks for a drain only together with a soft stop', () => {
    const index = (cue: Record<string, unknown>) => ({ ...syntheticIndex(), skills: { jinx: [{ system: 'sample', event: 'cast-start', delay: 0, duration: 1, ...cue }] } });
    expect(() => parseIndex(index({ stopAfter: 0.5, drain: true }))).not.toThrow();
    expect(() => parseIndex(index({ drain: true }))).toThrow();
    expect(() => parseIndex(index({ stopAfter: 0.5, drain: 1 }))).toThrow();
  });
  it('drains both of Zyra\'s lingering E systems and nothing it does not stop', () => {
    const zyra = CUE_OVERRIDES.zyra.filter(cue => cue.drain);
    expect(zyra.map(cue => cue.system)).toEqual(['7ce6b652', '7ce6b652', 'b888a24f']);
    for (const cue of Object.values(CUE_OVERRIDES).flat()) if (cue.drain) expect(cue.stopAfter).toBeLessThan(cue.duration);
  });
});

describe('a board-timed receipt delay', () => {
  it('shifts every cue of the play by the delay, and refuses one out of range', async () => {
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, scene = new Scene(), camera = new Camera();
    const runtime = createLtkRuntime(library, scene, () => source);
    await library.load('sample');
    expect(runtime.play('jinx', 'caster', [], 0, 'cast', { delay: 3 })).toBe(false);
    expect(runtime.play('jinx', 'caster', [], 0, 'cast', { delay: -0.1 })).toBe(false);
    expect(runtime.play('jinx', 'caster', [], 0, 'cast', { delay: 0.5 })).toBe(true);
    runtime.update(0.45, camera); expect(runtime.active).toBe(0);
    runtime.update(0.1, camera); expect(runtime.active).toBe(1);
    runtime.dispose(); library.dispose();
  });
});

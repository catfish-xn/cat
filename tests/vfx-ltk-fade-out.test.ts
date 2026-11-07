import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, fadeAt, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

// Zyra's roots in the d650fcf2 field: long-lived particles that linger past a stop at full alpha, in a 1.4 s cue.
const longLived = () => syntheticSystem({ rate: constant(num(60)), lifetime: num(5), particleLifetime: constant(num(5)), particleLinger: num(5) });
/** The drawn strength (red × alpha, as additive emitters premultiply) of the first live quad, and the live count, every 10 ms of a 1.4 s cue that stops at 0.8 s. */
async function play(fadeOut: boolean) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : longLived(), readTexture: async () => new Texture() });
  const system = await library.load('sample');
  const root = new Group(), body = new Group(); root.add(body);
  const fx = createLtkParticles(system, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body),
    duration: 1.4, stopAfter: 0.8, fadeOut, seed: 5 });
  const camera = new Camera(), alpha: number[] = [], live: number[] = [];
  for (let step = 0; step < 140; step++) {
    fx.update(0.01, camera);
    const color = fx.draws[0].object.geometry.getAttribute('color'); alpha.push(color.getX(0) * color.getW(0)); live.push(fx.driver.pool.count);
  }
  fx.dispose(); library.dispose();
  return { alpha, live };
}

describe('a fading cue eases its lingering particles out by its end (Zyra E, 11-07)', () => {
  it('holds full alpha to the stop, then eases smoothly to nothing at the end', () => {
    expect(fadeAt(0.5, 1.4, 0.8)).toBe(1);
    expect(fadeAt(0.8, 1.4, 0.8)).toBe(1);
    expect(fadeAt(1.1, 1.4, 0.8)).toBeCloseTo(0.5);
    expect(fadeAt(1.4, 1.4, 0.8)).toBe(0);
    expect(fadeAt(2, 1.4, 0.8)).toBe(0);
    expect(fadeAt(1.2, 1.4, 0.8)).toBeLessThan(fadeAt(1.0, 1.4, 0.8));
    expect(fadeAt(1.2, 1.4, undefined)).toBe(1);
  });
  it('dims every drawn particle across the tail while the simulation itself is unchanged', async () => {
    const plain = await play(false), faded = await play(true);
    // The same particles live either way: the fade is drawn, not simulated.
    expect(faded.live).toEqual(plain.live);
    expect(plain.live[139]).toBeGreaterThan(20);
    // Undrawn by the fade, the oldest particle stays at full alpha to the last frame (the field's hard cut).
    expect(plain.alpha[139]).toBe(plain.alpha[79]);
    expect(faded.alpha[79]).toBeCloseTo(plain.alpha[79]);
    // Faded: half way through the tail it is near half, and it is almost gone in the last frame.
    expect(faded.alpha[109] / plain.alpha[109]).toBeCloseTo(0.5, 1);
    expect(faded.alpha[129]).toBeLessThan(faded.alpha[109]);
    expect(faded.alpha[139] / plain.alpha[139]).toBeLessThan(0.01);
  });
  it('asks for a fade only together with a soft stop', () => {
    const index = (cue: Record<string, unknown>) => ({ ...syntheticIndex(), skills: { jinx: [{ system: 'sample', event: 'cast-start', delay: 0, duration: 1, ...cue }] } });
    expect(() => parseIndex(index({ stopAfter: 0.5, fadeOut: true }))).not.toThrow();
    expect(() => parseIndex(index({ fadeOut: true }))).toThrow();
    expect(() => parseIndex(index({ stopAfter: 0.5, fadeOut: 1 }))).toThrow();
  });
  it('fades both of Zyra\'s lingering E systems', () => {
    const zyra = CUE_OVERRIDES.zyra.filter(cue => cue.fadeOut);
    expect(zyra.map(cue => cue.system)).toEqual(['7ce6b652', '7ce6b652', 'b888a24f']);
    for (const cue of Object.values(CUE_OVERRIDES).flat()) if (cue.fadeOut) expect(cue.stopAfter).toBeLessThan(cue.duration);
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

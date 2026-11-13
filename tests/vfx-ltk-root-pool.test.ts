import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';

// Each particle set the runtime builds, with the options it was built with.
const built: { options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => {
    const fx = real.createLtkParticles(prepared, options), entry = { options, fx };
    built.push(entry); return fx;
  } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { createLtkParticles, measurePeak, pointAnchor, rootRoomOf, ROOT_PARTICLES, ROOT_PARTICLES_MOST } from '../src/rendering/three-mode/vfx-ltk/particles';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import { constant, num, struct, vec } from './vfx-ltk-synthetic';

const yes: VfxValue = { type: 'bool', value: true };
/** A one-shot emitter: `burst` particles at once, living two seconds. Synthetic, not exported game data. */
const oneShot = (name: string, burst: number) => struct('VfxEmitterDefinitionData', {
  emitterName: { type: 'string', value: name }, isSingleParticle: yes, rate: constant(num(burst)), lifetime: num(1),
  particleLifetime: constant(num(2)), birthScale0: constant(vec(4, 4, 4)), texture: { type: 'asset', path: 'synthetic.tex', asset: null } });
/** A system of the given emitters, in that order (the order they spawn in each step). */
const system = (...emitters: VfxValue[]): VfxSystem => ({ entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'),
  class: 'VfxSystemDefinitionData', materials: [], root: struct('VfxSystemDefinitionData', { complexEmitterDefinitionData: { type: 'container', items: emitters } }) });
const prepare = async (sys: VfxSystem) => {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { probe: [{ system: 'sample', event: 'cast-start', delay: 0, duration: 1 }] } }
    : sys, readTexture: async () => new Texture() });
  await library.load('sample'); return library.get('sample')!;
};
const born = (prepared: any, rootRoom?: number) => {
  const anchor = pointAnchor([0, 0, 0]);
  const fx: any = createLtkParticles(prepared, { anchor, target: null, joints: () => anchor, duration: 1, seed: 1, rootRoom });
  fx.update(1 / 60, new Camera());
  const names = prepared.model.emitters.map((e: any) => e.name), by: Record<string, number> = {};
  for (let i = 0; i < fx.driver.pool.count; i++) by[names[fx.driver.pool.emitter[i]]] = (by[names[fx.driver.pool.emitter[i]]] ?? 0) + 1;
  fx.dispose(); return by;
};

describe('vfx-ltk root particle room', () => {
  it('a skill system that measures past ROOT_PARTICLES gets a quarter more, at most ROOT_PARTICLES_MOST; others keep ROOT_PARTICLES', () => {
    expect(ROOT_PARTICLES).toBe(150); expect(ROOT_PARTICLES_MOST).toBe(400);
    expect([0, 120, 150].map(rootRoomOf)).toEqual([150, 150, 150]);
    expect(rootRoomOf(151)).toBe(189); expect(rootRoomOf(275)).toBe(344); expect(rootRoomOf(320)).toBe(400); expect(rootRoomOf(604)).toBe(400);
  });

  it('a burst that would fill the pool leaves a place for each one-shot still to spawn, and only then', async () => {
    // Debris first, then a flash: the debris alone fills the 150 places, so the flash never spawned.
    const crowded = await prepare(system(oneShot('debris', 200), oneShot('flash', 1)));
    expect(born(crowded)).toEqual({ debris: 149, flash: 1 });
    // With room for both, nothing is held back.
    expect(born(crowded, 400)).toEqual({ debris: 200, flash: 1 });
    // A system that never fills is untouched.
    expect(born(await prepare(system(oneShot('debris', 100), oneShot('flash', 1))))).toEqual({ debris: 100, flash: 1 });
    // A one-shot that is itself a burst keeps at least one particle.
    expect(born(await prepare(system(oneShot('debris', 200), oneShot('flash', 1), oneShot('cloud', 5))))).toEqual({ debris: 148, flash: 1, cloud: 1 });
  });

  it('measures without the limit up to ROOT_PARTICLES_MOST', async () => {
    const prepared = await prepare(system(oneShot('debris', 300)));
    expect(measurePeak(prepared, 0.5)).toBe(150);
    expect(measurePeak(prepared, 0.5, undefined, ROOT_PARTICLES_MOST)).toBe(300);
  });

  it('the runtime gives a skill cue the room its system measured, and a plain attack cue ROOT_PARTICLES', async () => {
    built.length = 0;
    const cues: TimelineCue[] = [{ system: 'sample', event: 'cast-start', delay: 0, duration: 1 }, { system: 'sample', action: 'attack', event: 'cast-start', delay: 0, duration: 1 }];
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { probe: cues } }
      : system(oneShot('debris', 300), oneShot('flash', 1)), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map([['caster', { root: new Group(), body: null, alive: true }]]);
    const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
    await runtime.warm('probe');
    expect(runtime.play('probe', 'caster', ['caster'])).toBe(true);
    expect(runtime.play('probe', 'caster', ['caster'], 'attack')).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built.map(entry => entry.options.rootRoom)).toEqual([rootRoomOf(301), undefined]);
    runtime.dispose();
  });
});

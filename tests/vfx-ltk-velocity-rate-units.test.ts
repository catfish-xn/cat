import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { measurePeak, ROOT_PARTICLES_MOST } from '../src/rendering/three-mode/vfx-ltk/particles';
import { SKILL_FX_SIZE } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import { constant, num, struct, vec } from './vfx-ltk-synthetic';

// rateByVelocityFunction counts the speed in the system's own units (emit.ts rateOf, 11-19): a cue drawn at a scale below 1
// covers more of its own units for the same board travel, so a trail emitting by distance emits for that distance.
// Synthetic emitters, not exported game data.
const trail = (name: string, perUnit: number, cap?: number): VfxValue => struct('VfxEmitterDefinitionData', {
  emitterName: { type: 'string', value: name }, rate: constant(num(1)), particleLifetime: constant(num(2)),
  rateByVelocityFunction: struct('ValueVector2', { constantValue: vec(perUnit, 0), dynamics: { type: 'null' } }),
  ...(cap !== undefined ? { MaximumRateByVelocity: num(cap) } : {}),
  birthScale0: constant(vec(4, 4, 4)), texture: { type: 'asset', path: 'synthetic.tex', asset: null } });
const system = (...emitters: VfxValue[]): VfxSystem => ({ entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'),
  class: 'VfxSystemDefinitionData', materials: [], root: struct('VfxSystemDefinitionData', { complexEmitterDefinitionData: { type: 'container', items: emitters } }) });
const prepare = async (sys: VfxSystem) => {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { probe: [{ system: 'sample', event: 'cast-start', delay: 0, duration: 1 }] } }
    : sys, readTexture: async () => new Texture() });
  await library.load('sample'); return library.get('sample')!;
};

describe('rate by velocity counts the speed in the system\'s own units', () => {
  it('an uncapped trail emits about 1/scale as many particles for the same flight', async () => {
    // 0.05 a unit: a 0.3 s flight of MEASURE_FLIGHT (four cells) stays under the 300 default cap at either scale.
    const prepared = await prepare(system(trail('trail', 0.05)));
    const whole = measurePeak(prepared, 1, undefined, ROOT_PARTICLES_MOST, 0.3, 1);
    const arena = measurePeak(prepared, 1, undefined, ROOT_PARTICLES_MOST, 0.3, SKILL_FX_SIZE);
    expect(whole).toBeGreaterThan(10);
    // 1/SKILL_FX_SIZE is about 1.57; the engine truncates each step's birth count, so the ratio lands a little above it.
    expect(arena / whole).toBeGreaterThan(0.9 / SKILL_FX_SIZE);
    expect(arena / whole).toBeLessThan(1.4 / SKILL_FX_SIZE);
  });
  it('a trail at its cap emits the same at any scale', async () => {
    const prepared = await prepare(system(trail('capped', 1, 20)));
    expect(measurePeak(prepared, 1, undefined, ROOT_PARTICLES_MOST, 0.3, SKILL_FX_SIZE)).toBe(measurePeak(prepared, 1, undefined, ROOT_PARTICLES_MOST, 0.3, 1));
  });
  it('a system standing still emits the same at any scale', async () => {
    const prepared = await prepare(system(trail('still', 1)));
    expect(measurePeak(prepared, 1, undefined, ROOT_PARTICLES_MOST, undefined, SKILL_FX_SIZE)).toBe(measurePeak(prepared, 1, undefined, ROOT_PARTICLES_MOST, undefined, 1));
  });
});

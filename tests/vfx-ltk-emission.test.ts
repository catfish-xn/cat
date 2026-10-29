import { Camera, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { meshEmission } from '../src/rendering/three-mode/vfx-ltk/assets/emission';
import { readMeshBuffer } from '../src/rendering/three-mode/vfx-ltk/assets/meshBuffer';
import { Rng } from '../src/rendering/three-mode/vfx-ltk/engine/utils/Rng';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles } from '../src/rendering/three-mode/vfx-ltk/particles';
import { binaryFixture } from './vfx-ltk-binary-fixture';
import { constant, struct, syntheticSystem, vec } from './vfx-ltk-synthetic';
const output = () => ({ position: new Float32Array(3), normal: new Float32Array(3) });
describe('LTK static emission surfaces', () => {
  it('samples triangle area rather than vertices or triangle counts and preserves source coordinates', () => {
    const base = readMeshBuffer(binaryFixture('mesh', false));
    const sampler = meshEmission({ ...base, positions: new Float32Array([0,0,0, 2,0,0, 0,2,0, 10,0,0, 14,0,0, 10,2,0]), indices: new Uint32Array([0,1,2,3,4,5]), ranges: [] });
    const rng = new Rng(3), point = output(); let big = 0;
    for (let i = 0; i < 9000; i++) {
      sampler.sample(0, rng, point); const [x,y,z] = point.position;
      expect(z).toBe(0); expect([...point.normal]).toEqual([0,0,1]);
      if (x >= 10) { big++; expect((x - 10) / 4 + y / 2).toBeLessThanOrEqual(1.000001); }
      else expect(x / 2 + y / 2).toBeLessThanOrEqual(1.000001);
    }
    expect(big / 9000).toBeGreaterThan(.64); expect(big / 9000).toBeLessThan(.69);
    const a = output(), b = output(); sampler.sample(0, new Rng(7), a); sampler.sample(0, new Rng(7), b); expect(a).toEqual(b);
    expect(() => meshEmission({ ...base, positions: new Float32Array(9) })).toThrow('surface-empty');
    expect(() => meshEmission({ ...base, indices: new Uint32Array([0,1,99]) })).toThrow('surface-index');
  });
  it.each(['mesh', 'surface'])('loads a %s birth sampler and installs it in the running driver', async kind => {
    const asset = { type: 'asset' as const, path: 'triangle.scb', asset: null };
    const document = syntheticSystem({ birthVelocity: constant(vec(0,0,0)), birthScale0: constant(vec(1,1,1)),
      ...(kind === 'mesh' ? {emissionMeshName: asset} : {emissionSurfaceDefinition: struct('VfxEmissionMeshData', {meshName: asset})}) });
    const library = createVfxLibrary('/', { readJson: async url => url.endsWith('index.json') ? {version:1, systems:{s:'s.json'}, assets:{'synthetic.tex':'t.png','triangle.scb':'m.ltkg'}, skills:{}} : document,
      readTexture: async () => new Texture(), readBinary: async () => binaryFixture('mesh', false) });
    const prepared = await library.load('s'), held = prepared.surfaces?.get('')?.get(0);
    expect(kind === 'mesh' ? held?.mesh : held?.surface).toBeDefined();
    const anchor = { originAt: () => [0,0,0] as const, basisInto: (_t: number, out: Float32Array) => {out.set([1,0,0,0,1,0,0,0,1]);return out;} };
    const fx = createLtkParticles(prepared, {anchor,target:null,joints:()=>null,duration:1,seed:7});
    expect(fx.driver.surfaces()).toBe(prepared.surfaces); fx.update(.1, new Camera()); fx.dispose(); library.dispose();
  });
  it('keeps both the birth mesh and the emission surface when one emitter names both', async () => {
    const meshAsset = { type: 'asset' as const, path: 'triangle.scb', asset: null };
    const surfaceAsset = { type: 'asset' as const, path: 'surface.scb', asset: null };
    const document = syntheticSystem({ birthVelocity: constant(vec(0, 0, 0)), birthScale0: constant(vec(1, 1, 1)),
      emissionMeshName: meshAsset, emissionSurfaceDefinition: struct('VfxEmissionMeshData', { meshName: surfaceAsset }) });
    const reads: string[] = [];
    const library = createVfxLibrary('/', { readJson: async url => url.endsWith('index.json') ? { version: 1, systems: { s: 's.json' },
      assets: { 'synthetic.tex': 't.png', 'triangle.scb': 'm.ltkg', 'surface.scb': 's.ltkg' }, skills: {} } : document,
    readTexture: async () => new Texture(), readBinary: async url => { reads.push(url); return binaryFixture('mesh', false); } });
    const prepared = await library.load('s'), held = prepared.surfaces?.get('')?.get(0);
    expect(held?.mesh ?? null).not.toBeNull();
    expect(held?.surface ?? null).not.toBeNull();
    expect(reads).toHaveLength(2);
    const point = output();
    expect(held!.mesh!.sample(0, new Rng(1), point)).toBe(true);
    expect(held!.surface!.sample(0, new Rng(1), point)).toBe(true);
    library.dispose();
  });
  it('retains fallback for a missing mesh or an unposed skeletal surface', async () => {
    for (const value of [struct('VfxEmissionMeshData', {meshName:{type:'asset',path:'missing.scb',asset:null}}), struct('VfxEmissionSkeletonData', {})]) {
      const library = createVfxLibrary('/', {readJson: async url => url.endsWith('index.json') ? {version:1, systems:{s:'s.json'}, assets:{'synthetic.tex':'t.png'}, skills:{}} : syntheticSystem({emissionSurfaceDefinition:value}), readTexture: async()=>new Texture(), readBinary:async()=>binaryFixture('mesh',false)});
      await expect(library.load('s')).rejects.toThrow(); expect(library.get('s')).toBeUndefined(); library.dispose();
    }
  });
});

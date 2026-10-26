import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

const cue = (action: 'cast' | 'attack' = 'cast') => ({ system: 'same', event: 'cast-start', delay: 0, duration: 1, action });
describe('per champion converter catalogues', () => {
  it('loads lazily, isolates colliding system/texture IDs and releases child libraries', async () => {
    const textures: Texture[] = [];
    const readJson = vi.fn(async (url: string) => url === '/root/vfx-ltk/index.json'
      ? { version: 1, systems: {}, assets: {}, skills: {}, champions: { lux: 'tft13_lux/index.json', nami: 'tft13_nami/index.json' } }
      : url.endsWith('index.json') ? { version: 1, systems: { same: 'systems/same.json' }, assets: { 'synthetic.tex': 'textures/same.png' },
        skills: { [url.includes('lux') ? 'lux' : 'nami']: [cue(), cue('attack')] } } : syntheticSystem());
    const library = createVfxLibrary('/root/', { readJson, readTexture: async () => { const t = new Texture(); textures.push(t); return t; } });
    await library.ready; expect(readJson).toHaveBeenCalledTimes(1);
    const source = { root: new Group(), body: null, alive: true }, scene = new Scene();
    const runtime = createLtkRuntime(library, scene, () => source);
    expect(runtime.play('lux', 'source', [])).toBe(false);
    await runtime.warm('lux');
    expect(readJson.mock.calls.some(([url]) => url.includes('nami'))).toBe(false);
    expect(runtime.play('lux', 'source', [], 0, 'attack')).toBe(true);
    expect(runtime.play('nami', 'source', [])).toBe(false);
    await runtime.warm('nami');
    const lux = await library.champion('lux'), nami = await library.champion('nami');
    expect(lux?.get('same')).toBeDefined(); expect(lux?.get('same')).not.toBe(nami?.get('same'));
    const disposes = textures.map(t => vi.spyOn(t, 'dispose'));
    runtime.update(.01, new Camera()); expect(runtime.active).toBe(1);
    runtime.dispose();
    for (const dispose of disposes) expect(dispose).toHaveBeenCalledTimes(1); // Before renderer disposal or a microtask.
    await Promise.resolve();
    expect(scene.children).toHaveLength(0); expect(textures).toHaveLength(2);
    for (const dispose of disposes) expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('keeps a failed action on legacy while allowing an independent prepared attack', async () => {
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json') ? { version: 1, systems: { same: 'same.json', missing: 'missing.json' },
        assets: { 'synthetic.tex': 'same.png' }, skills: { lux: [cue('attack'), { ...cue(), system: 'missing' }] } }
        : url.endsWith('missing.json') ? Promise.reject(Error('404')) : syntheticSystem(), readTexture: async () => new Texture(),
    });
    const source = { root: new Group(), body: null, alive: true }, runtime = createLtkRuntime(library, new Scene(), () => source);
    await runtime.warm('lux');
    expect(runtime.play('lux', 'source', [])).toBe(false);
    expect(runtime.play('lux', 'source', [], 0, 'attack')).toBe(true); runtime.dispose();
  });
  it('rejects invalid catalogue paths and preserves per-index resource limits', () => {
    const root = { version: 1, systems: {}, assets: {}, skills: {} };
    for (const path of ['../secret/index.json', 'https://bad/index.json', '%2e%2e/index.json', 'file.json'])
      expect(() => parseIndex({ ...root, champions: { lux: path } })).toThrow();
    expect(() => parseIndex({ ...root, systems: Object.fromEntries(Array.from({ length: 129 }, (_, i) => [i, 'file.json'])) })).toThrow('index-limit');
  });
});

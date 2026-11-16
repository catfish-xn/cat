import { Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_WARMING } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// castcmp waits for LTK_WARMING.pending to reach 0 before a recorded cast, so the cast runs with its measured room.
describe('LTK_WARMING counts champion warms in flight', () => {
  it('rises while a warm loads and measures, falls back when it is done, and counts one warm per champion', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const library = createVfxLibrary('/root/', { readJson: async url => {
      if (url.endsWith('index.json')) return { version: 1, systems: { aaaa0001: 'systems/aaaa0001.json' }, assets: { 'synthetic.tex': 'texture.png' },
        skills: { lux: [{ system: 'aaaa0001', action: 'cast', event: 'cast-start', delay: 0, duration: 1 }] } };
      await gate; return syntheticSystem();
    }, readTexture: async () => new Texture() });
    const runtime = createLtkRuntime(library, new Scene(), () => ({ root: new Group(), body: null, alive: true }));
    const before = LTK_WARMING.pending;
    const warm = runtime.warm('lux'); void runtime.warm('lux');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(LTK_WARMING.pending).toBe(before + 1);
    release(); await warm; await new Promise(resolve => setTimeout(resolve, 0));
    expect(LTK_WARMING.pending).toBe(before);
    runtime.dispose();
  });
});

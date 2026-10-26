import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary, parseIndex, validateSystem, vfxUrl, VfxLoadError } from '../src/rendering/three-mode/vfx-ltk/loader';
import { syntheticIndex, syntheticSystem, num, struct } from './vfx-ltk-synthetic';

describe('LTK resolved JSON and asset boundary', () => {
  it('reads upstream-format JSON from /tmp, resolves paths under the 3D root and shares textures/documents', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'cat-vfx-ltk-'));
    try {
      writeFileSync(join(temp, 'sample.json'), JSON.stringify(syntheticSystem()));
      const texture = new Texture();
      const reader = { readJson: vi.fn(async (url: string) => url.endsWith('index.json') ? syntheticIndex() : JSON.parse(readFileSync(join(temp, 'sample.json'), 'utf8'))), readTexture: vi.fn(async () => texture) };
      const library = createVfxLibrary('/cat/assets3d-local/', reader);
      await library.ready;
      const [a, b] = await Promise.all([library.load('sample'), library.load('sample')]);
      expect(a).toBe(b); expect(a.model.emitters[0].name).toBe('synthetic-only');
      expect(a.samplers.get('0')?.base).toBe(texture);
      expect(reader.readJson.mock.calls.map(([url]) => url)).toEqual(['/cat/assets3d-local/vfx-ltk/index.json', '/cat/assets3d-local/vfx-ltk/systems/sample.json']);
      expect(reader.readTexture).toHaveBeenCalledTimes(1);
      const dispose = vi.spyOn(texture, 'dispose'); library.dispose(); library.dispose(); await Promise.resolve(); expect(dispose).toHaveBeenCalledTimes(1);
      await expect(library.load('sample')).rejects.toMatchObject({ reason: 'closed' });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
  it.each(['../escape', '/outside', 'https://host/file', 'a/../file', 'a\\file', '%2e%2e/file', 'file?query', 'a//b', 'a#fragment'])('rejects asset root escape %s', path => {
    expect(() => vfxUrl('/assets/', path)).toThrow(VfxLoadError);
  });
  it('validates malformed trees and duplicate hashes before parsing', () => {
    const broken = syntheticSystem(); broken.root = struct('root', { rate: num(1) });
    if (broken.root.type === 'struct') broken.root.fields.push(broken.root.fields[0]);
    expect(() => validateSystem(broken)).toThrow('invalid');
    expect(() => validateSystem({ ...syntheticSystem(), root: { type: 'vector', values: [NaN, 0] } })).toThrow('invalid');
    expect(() => validateSystem({ ...syntheticSystem(), root: null })).toThrow('invalid');
    expect(() => parseIndex({ ...syntheticIndex(), version: 2 })).toThrow('index');
    const index = syntheticIndex(); index.skills.jinx[0].delay = Infinity;
    expect(() => parseIndex(index)).toThrow('timeline-cue');
  });
  it('rejects deep child trees and invalid system paths', () => {
    let value: unknown = { type: 'none' };
    for (let i = 0; i < 70; i++) value = { type: 'container', items: [value] };
    expect(() => validateSystem({ ...syntheticSystem(), root: value })).toThrow('value-tree-limit');
    expect(() => parseIndex({ ...syntheticIndex(), systems: { sample: '../secret' } })).toThrow('asset-path');
  });
  it('reports missing files/textures and unsupported desktop-only shaders without preparing a replacement', async () => {
    for (const doc of [syntheticSystem({ distortionDefinition: struct('VfxDistortionDefinitionData', {}) }), { ...syntheticSystem(), materials: [{}] }]) {
      const library = createVfxLibrary('/assets/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : doc, readTexture: async () => new Texture() });
      await expect(library.load('sample')).rejects.toMatchObject({ reason: 'unsupported' });
      expect(library.get('sample')).toBeUndefined(); library.dispose();
    }
    const library = createVfxLibrary('/assets/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => { throw new Error('404'); } });
    await expect(library.load('sample')).rejects.toThrow('404'); expect(library.get('sample')).toBeUndefined(); library.dispose();
  });
  it('disposes a texture that finishes loading after the library closes', async () => {
    let finish!: (texture: Texture) => void;
    const library = createVfxLibrary('/assets/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: () => new Promise<Texture>(resolve => { finish = resolve; }) });
    const pending = library.load('sample');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    library.dispose(); const texture = new Texture(), dispose = vi.spyOn(texture, 'dispose'); finish(texture);
    await expect(pending).rejects.toMatchObject({ reason: 'closed' }); expect(dispose).toHaveBeenCalledTimes(1);
  });
});

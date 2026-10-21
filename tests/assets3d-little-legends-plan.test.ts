import { describe, expect, it } from 'vitest';
import { zstdCompressSync } from 'node:zlib';
// @ts-expect-error Pure offline Node utility.
import { defaultSkinCandidates, cachedEntryChoice, legendBindingSeeds, defaultModelReferences, missingWadChunks, selectedEntryChunkIds, traceDefaultDependencies } from '../scripts/assets3d/little-legends-plan.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Pure Node utility.
import { riotChunkId } from '../scripts/assets3d/chunk-hash.mjs';

function fixture() {
  const payloads = [Buffer.alloc(100, 1), Buffer.alloc(100, 2), Buffer.alloc(100, 3)];
  const packed = payloads.map(p => zstdCompressSync(p));
  const chunks = payloads.map((p, i) => ({ id: riotChunkId(p), bundleId: '0000000000000001',
    offset: i * 100, size: packed[i].length, targetSize: 100, fileOffset: i * 100 }));
  return { chunks, packed, files: [{ name: 'SyntheticOne.wad', size: 300, chunks },
    { name: 'SyntheticTwo.wad', size: 100, chunks: [{ ...chunks[1], fileOffset: 0 }] }] };
}

describe('offline conservative missing-block planning', () => {
  it('records concrete skin candidates without claiming their unread bindings are verified', () => {
    const candidates = [{ id: 'sprout', sourceName: 'sprout' }, { id: 'pebble', sourceName: 'pebble' }, { id: 'cloud', sourceName: 'cloud' }];
    const available = new Set(['data/characters/sprout/skins/skin0.bin', 'data/characters/sprout/skins/skin1.bin',
      'data/characters/pebble/skins/skin1.bin']);
    expect(defaultSkinCandidates(candidates, (p: string) => available.has(p))).toEqual([
      { id: 'sprout', skin: 'data/characters/sprout/skins/skin0.bin', status: 'candidate-binding-needs-verification' },
      { id: 'pebble', skin: 'data/characters/pebble/skins/skin1.bin', status: 'candidate-binding-needs-verification' },
      { id: 'cloud', skin: null, status: 'candidate-binding-needs-verification' }]);
  });
  it('includes the default bindings and graph for each requested synthetic companion', () => {
    const seeds = legendBindingSeeds([{ sourceName: 'sprout' }, { sourceName: 'pebble' }]);
    expect(seeds).toHaveLength(6);
    for (const name of ['sprout', 'pebble']) {
      expect(seeds).toContain(`data/characters/${name}/themes/base/tier1.bin`);
      expect(seeds).toContain(`data/characters/${name}/themes/base/root.bin`);
      expect(seeds).toContain(`data/characters/${name}/animations/base.bin`);
    }
  });
  it('uses a cached duplicate archive entry before requesting another copy', () => {
    const f = fixture();
    const entries = [{ wad: f.files[0].name, offset: 0, compressedSize: 100 },
      { wad: f.files[1].name, offset: 0, compressedSize: 100 }];
    expect(cachedEntryChoice(entries, f.files, new Set([f.chunks[1].id]))).toBe(entries[1]);
    expect(cachedEntryChoice(entries, f.files, new Set())).toBe(entries[0]);
    expect(cachedEntryChoice(undefined, f.files, new Set())).toBeUndefined();
  });
  it('keeps inherited model bindings and graph clips without variant VFX catalogues', () => {
    const field = (name: string, value: unknown) => ({ hash: fnv1a(name), value });
    const doc = { linked: ['Characters/Sprout', 'data/sprout/animations/base.bin', 'data/sprout/holiday.bin'],
      entries: [{ type: fnv1a('TftSkinCharacterDataProperties'), fields: [
        field('skinMeshProperties', { model: 'assets/sprout/model.skn', rig: 'assets/sprout/rig.skl', paint: 'assets/sprout/paint.tex' }),
        field('unrelatedCatalogue', 'assets/sprout/holiday.tex')] },
      { fields: [field('mClipDataMap', { clip: 'assets/sprout/idle.anm' })] },
      { type: fnv1a('StaticMaterialDef'), fields: [field('samplerValues', ['assets/sprout/diffuse.tex'])] },
      { type: fnv1a('ResourceResolver'), fields: [field('resources', ['assets/sprout/holiday-effect.tex'])] }] };
    expect(defaultModelReferences(doc).sort()).toEqual(['Characters/Sprout', 'data/sprout/animations/base.bin',
      'assets/sprout/model.skn', 'assets/sprout/rig.skl', 'assets/sprout/paint.tex',
      'assets/sprout/idle.anm', 'assets/sprout/diffuse.tex'].sort());
  });
  it('traverses extensionless character documents and their material references', async () => {
    const paths = ['data/sprout/default.bin', 'characters/sprout', 'assets/sprout/paint.tex'];
    const result = await traceDefaultDependencies({ seeds: [paths[0]],
      resolveEntry: (path: string) => ({ path }),
      readReferences: async (e: { path: string }) => e.path === paths[0] ? [paths[1]] : [paths[2]] });
    expect(result.entries.map((e: { path: string }) => e.path)).toEqual(paths);
    expect(result.scan.readBins).toEqual(paths.slice(0, 2));
    expect(result.scan.unavailableBins).toEqual([]);
    expect(result.scan.pendingAfterBound).toEqual([]);
  });
  it('follows only explicit default references across archives and terminates cycles', async () => {
    const paths = ['data/sprout/default.bin', 'data/sprout/animation.bin', 'assets/sprout/model.skn',
      'assets/sprout/idle.anm', 'assets/sprout/holiday.skn'];
    const entries = paths.map((path, i) => ({ path, hash: String(i), wad: i % 2 ? 'SyntheticTwo.wad' : 'SyntheticOne.wad' }));
    const references = new Map([[paths[0], [paths[1], paths[2]]], [paths[1], [paths[0], paths[3]]]]);
    const result = await traceDefaultDependencies({ seeds: [paths[0]],
      resolveEntry: (path: string) => entries.find(e => e.path === path),
      readReferences: async (e: { path: string }) => references.get(e.path) ?? [] });
    expect(result.entries.map((e: { path: string }) => e.path)).toEqual(paths.slice(0, 4));
    expect(result.scan.readBins).toEqual(paths.slice(0, 2));
    expect(result.scan.unavailableBins).toEqual([]);
    expect(result.scan.unresolvedReferences).toEqual([]);
    expect(result.scan.pendingAfterBound).toEqual([]);
  });
  it('retains unreadable binding entries as a frontier without adding unrelated variants', async () => {
    const path = 'data/sprout/default.bin', entry = { path, hash: '1', wad: 'SyntheticOne.wad' };
    const result = await traceDefaultDependencies({ seeds: [path, 'data/missing.bin'],
      resolveEntry: (p: string) => p === path ? entry : undefined,
      readReferences: async () => { throw new Error('missing-cached-chunks'); } });
    expect(result.entries).toEqual([entry]);
    expect(result.scan.unavailableBins).toEqual([{ path, reason: 'missing-cached-chunks' }]);
    expect(result.scan.unresolvedReferences).toEqual(['data/missing.bin']);
  });
  it('exposes dependencies left after the traversal bound instead of claiming closure', async () => {
    const result = await traceDefaultDependencies({ seeds: ['data/sprout/default.bin'], limit: 1,
      resolveEntry: (path: string) => ({ path }),
      readReferences: async () => ['data/sprout/animation.bin'] });
    expect(result.scan.pendingAfterBound).toEqual(['data/sprout/animation.bin']);
  });
  it('covers every overlapping selected entry range plus index, without unrelated chunks', () => {
    const f = fixture();
    expect(selectedEntryChunkIds(f.files[0], [{ offset: 150, compressedSize: 100 }, { offset: 200, compressedSize: 100 }], [f.chunks[0].id]))
      .toEqual(f.chunks.map(c => c.id));
    expect(selectedEntryChunkIds(f.files[0], [{ offset: 100, compressedSize: 100 }])).toEqual([f.chunks[1].id]);
    expect(() => selectedEntryChunkIds(f.files[0], [{ offset: 300, compressedSize: 100 }])).toThrow('invalid-rman-range');
  });
  it('includes every later missing block after a missing header, across all WADs', async () => {
    const f = fixture();
    const result = await missingWadChunks(f.files, async (id: string) => id === f.chunks[1].id ? f.packed[1] : undefined);
    expect(result.chunks.map((c: { id: string }) => c.id).sort()).toEqual([f.chunks[0].id, f.chunks[2].id].sort());
    expect(result.uniqueChunks).toBe(3);
    expect(result.cached.size).toBe(1);
    expect(result.downloadBytes).toBe(f.packed[0].length + f.packed[2].length);
    expect(result.chunks.every((c: object) => Object.keys(c).sort().join(',') === 'bundleId,id,offset,size,targetSize')).toBe(true);
  });
  it('treats a corrupt or same-size incorrect cached block as still missing', async () => {
    const f = fixture();
    const result = await missingWadChunks(f.files, async (id: string) => id === f.chunks[0].id ? Buffer.alloc(f.packed[0].length) : undefined);
    expect(result.chunks).toHaveLength(3);
    expect(result.invalidCache).toHaveLength(1);
    expect(result.cached.size).toBe(0);
  });
  it('continues on absent cache files and propagates permission failures', async () => {
    const f = fixture();
    const missing = () => Promise.reject(Object.assign(new Error('absent'), { code: 'ENOENT' }));
    expect((await missingWadChunks(f.files, missing)).chunks).toHaveLength(3);
    await expect(missingWadChunks(f.files, () => Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })))).rejects.toThrow('denied');
  });
  it('rejects incomplete coverage and conflicting bundle metadata', async () => {
    const f = fixture();
    await expect(missingWadChunks([{ ...f.files[0], size: 400 }], async () => undefined)).rejects.toThrow('incomplete-wad-chunk-coverage');
    await expect(missingWadChunks([{ ...f.files[0], chunks: [{ ...f.chunks[0], fileOffset: 100 }] }], async () => undefined)).rejects.toThrow('noncontiguous-wad-chunks');
    f.files[1].chunks[0].offset = 500;
    await expect(missingWadChunks(f.files, async () => undefined)).rejects.toThrow('conflicting-chunk-metadata');
  });
});

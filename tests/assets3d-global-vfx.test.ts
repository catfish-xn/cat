import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { zstdCompressSync } from 'node:zlib';
// @ts-expect-error Node offline adapter.
import { offlineArchiveReader, globalVfx, findGlobalSystems } from '../scripts/assets3d/global-vfx.mjs';
// @ts-expect-error Node chunk verifier.
import { riotChunkId } from '../scripts/assets3d/chunk-hash.mjs';
// @ts-expect-error Node BIN parser.
import { parseBin, fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Node VFX parser.
import { particleSourcesFromBins } from '../scripts/assets3d/particle-bin.mjs';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const str = (s: string) => Buffer.concat([u16(Buffer.byteLength(s)), Buffer.from(s)]);
const block = (b: Buffer) => Buffer.concat([u32(b.length), b]);
const field = (name: string, value: string) => Buffer.concat([u32(fnv1a(name)), Buffer.from([16]), str(value)]);
function globalBin(name: string) {
  const fields = [field('particlePath', `Particles/${name}`), field('particleName', name)];
  return Buffer.concat([Buffer.from('PROP'), u32(3), u32(0), u32(1), u32(fnv1a('VfxSystemDefinitionData')),
    block(Buffer.concat([u32(fnv1a(name)), u16(fields.length), ...fields]))]);
}
function fixture() {
  const wad = 'DATA/FINAL/GlobalSynthetic.wad.client';
  const payloads = [globalBin('TFT_Global_BA_Hit'), globalBin('TFT_Global_BA_Crit'), Buffer.from('synthetic texture')];
  const paths = ['data/shared/global-hit.bin', 'data/shared/global-crit.bin', 'assets/shared/hit.tex'];
  const bytes = Buffer.alloc(272 + payloads.length * 32 + payloads.reduce((s, b) => s + b.length, 0));
  bytes.write('RW'); bytes[2] = 3; bytes[3] = 4; bytes.writeUInt32LE(payloads.length, 268);
  let offset = 272 + payloads.length * 32;
  const entries = payloads.map((b, i) => {
    const at = 272 + i * 32; bytes.writeBigUInt64LE(BigInt(i + 1), at); bytes.writeUInt32LE(offset, at + 8);
    bytes.writeUInt32LE(b.length, at + 12); bytes.writeUInt32LE(b.length, at + 16); b.copy(bytes, offset);
    const entry = { hash: BigInt(i + 1).toString(16).padStart(16, '0'), path: paths[i], wad, offset, size: b.length, compressedSize: b.length, type: 0 };
    offset += b.length; return entry;
  });
  const cuts = [0, 272 + payloads.length * 32, entries[1].offset, bytes.length], packed = new Map<string, Buffer>();
  const chunks = cuts.slice(0, -1).map((at, i) => {
    const raw = bytes.subarray(at, cuts[i + 1]), b = zstdCompressSync(raw), id = riotChunkId(raw); packed.set(id, b);
    return { id, bundleId: '0000000000000001', offset: 100 + at, fileOffset: at, targetSize: raw.length, size: b.length };
  });
  const write = vi.fn(async (_path: string, _bytes: Buffer) => {});
  const options = { manifest: { files: [{ name: wad, size: bytes.length, chunks }] }, plan: { wads: [{ name: wad, entries }] },
    readChunk: async (id: string) => packed.get(id), readExtracted: async (_path: string): Promise<unknown> => undefined, write };
  return { wad, payloads, entries, chunks, packed, write, options };
}
describe('shared global VFX offline cache extraction', () => {
  it('resolves hashed global keys across BIN documents even when the particle name differs', () => {
    const target = parseBin(globalBin('unrelated-source-name'));
    const hash = target.entries[0].hash;
    const resolver = { patches: [], entries: [{ type: fnv1a('ResourceResolver'), hash: 42, fields: [
      { hash: fnv1a('resourceMap'), value: { entries: [[{ kind: 'hash', hash: fnv1a('TFT_Global_BA_Hit') }, { kind: 'link', hash }]] } },
    ] }] };
    const found = findGlobalSystems([resolver, target]);
    expect(Object.keys(found.systems)).toEqual(['ResolvedGlobals/TFT_Global_BA_Hit']);
    expect(found.resolvedKeys.TFT_Global_BA_Hit).toEqual({ sourcePath: 'Particles/unrelated-source-name', resolverTargetHash: hash });
  });
  it('extracts both actual synthetic PROP systems and a texture solely through cached WAD chunks', async () => {
    const f = fixture(), reader = offlineArchiveReader(f.options);
    const docs = [];
    for (let i = 0; i < 3; i++) {
      const bytes = await reader.extract(f.entries[i]); expect(bytes).toEqual(f.payloads[i]);
      if (i < 2) docs.push(parseBin(bytes));
    }
    expect(Object.keys(particleSourcesFromBins(docs))).toEqual(['Particles/TFT_Global_BA_Hit', 'Particles/TFT_Global_BA_Crit']);
    expect(reader.missing.size).toBe(0); expect(f.write.mock.calls.map(c => c[0])).toEqual(f.entries.map(e => `extracted/${e.path}`));
    expect(reader.files.every((f: { source: string }) => f.source === 'chunk-cache')).toBe(true);
  });
  it('copies verified extracted-cache bytes without requiring chunks or modifying cache', async () => {
    const f = fixture(), readChunk = vi.fn();
    f.options.readExtracted = async p => p === f.entries[0].path ? { bytes: f.payloads[0], size: f.payloads[0].length, sha256: sha(f.payloads[0]) } : undefined;
    const reader = offlineArchiveReader({ ...f.options, readChunk });
    expect(await reader.extract(f.entries[0])).toEqual(f.payloads[0]); expect(readChunk).not.toHaveBeenCalled();
    expect(reader.files[0].source).toBe('extracted-cache'); expect(f.write).toHaveBeenCalledTimes(1);
  });
  it('reports exact missing block IDs, bundle offsets and byte sizes, deduplicated across requests', async () => {
    const f = fixture(), missing = f.chunks[2]; f.packed.delete(missing.id);
    const reader = offlineArchiveReader(f.options);
    for (const e of f.entries.slice(1)) await expect(reader.extract(e)).rejects.toThrow('missing-cached-chunks');
    expect([...reader.missing.values()]).toEqual([{ ...missing, requiredBy: f.entries.slice(1).map(e => ({ wad: f.wad, role: e.path })) }]);
    expect(f.write).not.toHaveBeenCalled();
  });
  it('fails closed for corrupted cached chunks and extracted hashes before output', async () => {
    const f = fixture(); f.packed.set(f.chunks[0].id, Buffer.alloc(f.chunks[0].size, 5));
    const reader = offlineArchiveReader(f.options);
    await expect(reader.extract(f.entries[0])).rejects.toThrow('chunk-decompression-failed'); expect(f.write).not.toHaveBeenCalled();
    const other = offlineArchiveReader({ ...f.options, readExtracted: async () => ({ bytes: f.payloads[0], size: f.payloads[0].length, sha256: '0'.repeat(64) }) });
    await expect(other.extract(f.entries[0])).rejects.toThrow('source-hash-mismatch'); expect(f.write).not.toHaveBeenCalled();
  });
  it('rejects traversal and output into the four read-only inputs', async () => {
    const f = fixture(), reader = offlineArchiveReader(f.options);
    await expect(reader.extract({ ...f.entries[0], path: '../outside.bin' })).rejects.toThrow('unsafe-entry-path');
    for (const dir of ['trial', 'source-json', 'prepared', 'out']) await expect(globalVfx({ out: `assets3d-local/${dir}/global-vfx` })).rejects.toThrow(/unsafe-output-path|global-vfx-output-only/);
    expect(f.write).not.toHaveBeenCalled();
  });
});

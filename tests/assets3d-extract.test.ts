import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, zstdCompressSync } from 'node:zlib';
// @ts-expect-error Pure Node utility.
import { extractFromChunks, extractFromFiles, extractArguments, assertEntryPath } from '../scripts/assets3d/extract-from-chunks.mjs';
// @ts-expect-error Pure Node utility.
import { readWadIndex, extractWadEntry } from '../scripts/assets3d/wad.mjs';
// @ts-expect-error Pure Node utility.
import { xxh3_64 } from '../scripts/assets3d/xxh3.mjs';
// @ts-expect-error Pure Node utility.
import { riotChunkId } from '../scripts/assets3d/chunk-hash.mjs';
// @ts-expect-error Pure Node utility.
import { withinRoot, writeOutputFile } from '../scripts/assets3d/safe-path.mjs';

const roots: string[] = [], hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    withinRoot(resolve('assets3d-local'), root); expect(root).not.toBe(resolve('assets3d-local'));
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir('assets3d-local', { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/extract-test-')); roots.push(root);
  const source = join(root, 'source'), out = join(root, 'out'), wad = 'DATA/synthetic.wad.client';
  const raw = [Buffer.from('plain'), Buffer.from('gzip asset'), Buffer.from('zstd asset'),
    Buffer.concat([Buffer.from('raw segment'), Buffer.from('compressed segment '.repeat(40))])];
  const parts = [raw[3].subarray(0, 11), zstdCompressSync(raw[3].subarray(11))];
  const toc = Buffer.alloc(48); // firstSubchunk=1 exercises non-zero table offsets.
  parts.forEach((b, i) => {
    toc.writeUInt32LE(b.length, (i + 1) * 16); toc.writeUInt32LE(i ? raw[3].length - 11 : 11, (i + 1) * 16 + 4);
    toc.writeBigUInt64LE(xxh3_64(b), (i + 1) * 16 + 8);
  });
  const payloads = [raw[0], gzipSync(raw[1]), zstdCompressSync(raw[2]), Buffer.concat(parts), zstdCompressSync(toc)];
  const paths = ['assets/plain.bin', 'assets/gzip.bin', 'assets/zstd.bin', 'assets/chain.bin', 'data/synthetic.subchunktoc'];
  const bytes = Buffer.alloc(272 + 32 * 5 + payloads.reduce((n, b) => n + b.length, 0));
  bytes.write('RW'); bytes[2] = 3; bytes[3] = 4; bytes.writeUInt32LE(5, 268);
  let at = 432;
  payloads.forEach((b, i) => {
    const pos = 272 + i * 32; bytes.writeBigUInt64LE(BigInt(i + 1), pos);
    bytes.writeUInt32LE(at, pos + 8); bytes.writeUInt32LE(b.length, pos + 12);
    bytes.writeUInt32LE(i === 4 ? toc.length : raw[i].length, pos + 16);
    bytes[pos + 20] = [0, 1, 3, 0x24, 3][i]; if (i === 3) bytes.writeUInt16LE(1, pos + 22);
    b.copy(bytes, at); at += b.length;
  });
  const entries = readWadIndex(bytes).map((e: object, i: number) => ({ ...e, path: paths[i], wad }));
  // Boundary in the WAD index, boundary in a gzip payload, and boundary in a subchunk payload.
  const cuts = [0, 300, entries[1].offset + 4, entries[3].offset + 13, bytes.length];
  const chunks = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const data = bytes.subarray(cuts[i], cuts[i + 1]), packed = zstdCompressSync(data), id = riotChunkId(data);
    chunks.push({ id, bundleId: '0000000000000001', offset: 0, fileOffset: cuts[i], targetSize: data.length, size: packed.length });
    await writeOutputFile(join(source, 'chunks', `${id}.zst`), packed);
  }
  const manifest = { files: [{ name: wad, size: bytes.length, chunks }] };
  const plan = { units: { alpha: { cost: 1, entries: entries.slice(0, 2) }, beta: { cost: 3, entries: entries.slice(2, 4) } },
    wads: [{ name: wad, entries }], chunks };
  return { root, source, out, wad, raw, bytes, toc, entries, manifest, plan };
}
describe('offline cache-to-extraction pipeline', () => {
  it('assembles index/payload ranges, extracts all codecs, verifies SHA-256 and merges without changing old records', async () => {
    const f = await fixture(), old = { version: '14.24.6442327', arena: 'keep', files: [
      { wad: 'old', path: 'assets/old.bin', bytes: 1, sha256: hash(Buffer.from('x')), extra: 'keep' }] };
    await writeOutputFile(join(f.source, 'extracted/assets/old.bin'), Buffer.from('x'));
    await writeOutputFile(join(f.source, 'extraction.json'), JSON.stringify(old));
    const report = await extractFromChunks(f);
    expect(report).toMatchObject({ status: 'complete', totals: { entries: 5, written: 5, failed: 0 }, missingChunks: [] });
    const records = JSON.parse(await readFile(join(f.source, 'extraction.json'), 'utf8'));
    expect(records.arena).toBe('keep'); expect(records.files[0]).toEqual(old.files[0]);
    for (let i = 0; i < 4; i++) {
      expect(await readFile(join(f.source, 'extracted', f.entries[i].path))).toEqual(f.raw[i]);
      expect(records.files.find((r: { path: string }) => r.path === f.entries[i].path))
        .toEqual({ wad: f.wad, path: f.entries[i].path, bytes: f.raw[i].length, sha256: hash(f.raw[i]) });
    }
    const path = join(f.source, 'extracted', f.entries[0].path), before = await stat(path);
    expect((await extractFromChunks(f)).totals).toMatchObject({ skipped: 5, written: 0, failed: 0 });
    expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
    expect((await extractFromChunks({ ...f, verifyExisting: true })).totals).toMatchObject({ skipped: 5, written: 0, failed: 0 });
    expect(JSON.parse(await readFile(join(f.out, 'extract-report.json'), 'utf8')).status).toBe('complete');
  });
  it('reports all missing required blocks including shared TOC dependencies and continues independent entries', async () => {
    const f = await fixture();
    const chunk = f.manifest.files[0].chunks.at(-1)!;
    await rm(join(f.source, 'chunks', `${chunk.id}.zst`));
    const result = await extractFromChunks({ ...f, units: 'alpha,beta' });
    expect(result.units.alpha).toMatchObject({ success: 2, failed: 0 });
    expect(result.units.beta).toMatchObject({ success: 1, failed: 1 });
    expect(result.missingChunks).toEqual([expect.objectContaining({ id: chunk.id,
      requiredBy: [expect.objectContaining({ wad: f.wad, role: 'subchunk-toc' })] })]);
    expect(result.units.beta.files[1].reason).toContain('missing-cached-chunks:');
  });
  it('rejects corrupted RMAN chunks even when packed and unpacked sizes match', async () => {
    const f = await fixture(), chunk = f.manifest.files[0].chunks.at(-1)!;
    // Recompress different content with a valid size declaration, retaining the authoritative original ID.
    const packed = zstdCompressSync(Buffer.alloc(chunk.targetSize, 88)); chunk.size = packed.length;
    await writeOutputFile(join(f.source, 'chunks', `${chunk.id}.zst`), packed, { force: true });
    const report = await extractFromChunks({ ...f, units: 'beta' });
    expect(report.units.beta.files[1].reason).toBe('chunk-id-mismatch');
  });
  it('isolates bad paths, metadata and SHA-256; successful entries alone enter extraction.json', async () => {
    const f = await fixture();
    f.plan.units.alpha.entries[0].path = '../escape.bin';
    f.plan.units.alpha.entries[1].sha256 = '0'.repeat(64);
    f.plan.units.beta.entries[0].size++;
    const r = await extractFromChunks(f);
    expect(r.units.alpha.files.map((e: { reason: string }) => e.reason)).toEqual(['unsafe-entry-path', 'source-hash-mismatch']);
    expect(r.units.beta.files[0].reason).toBe('plan-wad-entry-mismatch');
    expect(r.units.beta.files[1].status).toBe('written');
    const records = JSON.parse(await readFile(join(f.source, 'extraction.json'), 'utf8'));
    expect(records.files).toHaveLength(2); // chain plus shared TOC
    await expect(stat(join(f.source, 'escape.bin'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('refuses to overwrite a baseline hash conflict, including verify-existing decoded bytes', async () => {
    const f = await fixture();
    await extractFromChunks({ ...f, units: 'alpha' });
    const path = join(f.source, 'extraction.json'), records = JSON.parse(await readFile(path, 'utf8'));
    records.files[0].sha256 = '0'.repeat(64);
    await writeOutputFile(path, JSON.stringify(records), { force: true });
    await rm(join(f.source, 'extracted', f.entries[0].path));
    const r = await extractFromChunks({ ...f, units: 'alpha', verifyExisting: true });
    expect(r.units.alpha.files[0].reason).toBe('source-hash-mismatch');
    expect(JSON.parse(await readFile(path, 'utf8')).files[0]).toEqual(records.files[0]);
    await writeOutputFile(join(f.source, 'extracted', f.entries[1].path), Buffer.from('corrupt'), { force: true });
    expect((await extractFromChunks({ ...f, units: 'alpha' })).units.alpha.files[1].reason).toBe('existing-file-hash-mismatch');
  });
  it('uses the build-all unit/cost intersection and rejects invalid CLI options or manifest hashes', async () => {
    const f = await fixture();
    const report = await extractFromChunks({ ...f, units: 'alpha,beta', cost: '3,4' });
    expect(Object.keys(report.units)).toEqual(['beta']); expect(report.shared.entries).toBe(0);
    expect(extractArguments(['--units', 'alpha,beta', '--cost', '3', '--verify-existing'])).toEqual({ units: 'alpha,beta', cost: '3', verifyExisting: true });
    for (const args of [['--units'], ['--exe', 'x'], ['--cost', '1', '--cost', '2']]) expect(() => extractArguments(args)).toThrow('invalid-argument');
    await writeOutputFile(join(f.source, '14.24.manifest'), Buffer.from('invalid'));
    const planPath = join(f.root, 'plan.json'); await writeOutputFile(planPath, JSON.stringify({ sourceManifest: { sha256: '0'.repeat(64) } }));
    await expect(extractFromFiles({ source: f.source, planPath })).rejects.toThrow('plan-manifest-sha256-mismatch');
  });
  it('enforces actual decoded lengths, subchunk checksums, complete TOC sums, and budgets before decoding', async () => {
    const f = await fixture(), e = f.entries[3];
    expect(extractWadEntry(f.bytes, e, { subchunkToc: f.toc })).toEqual(f.raw[3]);
    const bad = Buffer.from(f.toc); bad[24] ^= 1;
    expect(() => extractWadEntry(f.bytes, e, { subchunkToc: bad })).toThrow('wad-subchunk-hash-mismatch');
    const badSize = Buffer.from(f.toc); badSize.writeUInt32LE(1, 20);
    const decode = vi.fn();
    expect(() => extractWadEntry(f.bytes, e, { subchunkToc: badSize, decompressZstd: decode })).toThrow('wad-subchunk-size-mismatch');
    expect(decode).not.toHaveBeenCalled();
    expect(() => extractWadEntry(f.bytes, e, { subchunkToc: f.toc.subarray(0, 32) })).toThrow('invalid-wad-subchunk-toc');
    expect(() => extractWadEntry(f.bytes, e, { subchunkToc: f.toc, maxOutputBytes: 1, decompressZstd: decode })).toThrow('wad-output-budget');
    expect(() => extractWadEntry(f.bytes, e, { subchunkToc: f.toc, decompressZstd: () => Buffer.from('short') })).toThrow('wad-subchunk-size-mismatch');
    for (const i of [1, 2]) expect(() => extractWadEntry(f.bytes, { ...f.entries[i], size: f.raw[i].length + 1 })).toThrow('wad-size-mismatch');
  });
  it('retains the RMAN whole-block budget for tiny index reads', async () => {
    const f = await fixture(); f.manifest.files[0].chunks[0].targetSize = 16 * 1024 * 1024 + 1;
    const report = await extractFromChunks({ ...f, units: 'alpha' });
    expect(report.units.alpha.files.map((e: { reason: string }) => e.reason))
      .toEqual(['cached-chunk-output-budget', 'cached-chunk-output-budget']);
    expect(report.totals.written).toBe(0);
  });
  it('rejects absolute paths, alternate separators, ADS, Windows devices and dot segments', () => {
    for (const path of ['../escape', '/escape', 'C:/escape', 'assets/../../escape', 'assets\\escape', 'file:stream',
      'assets/CON.bin', 'assets/trailing.', 'assets/./escape', 'assets//escape'])
      expect(() => assertEntryPath(path)).toThrow('unsafe-entry-path');
  });
  it.each([['', '2d06800538d394c2'], ['a', 'e6c632b61e964e1f'], ['abc', '78af5f94892f3950']])('matches known XXH3-64 vector %j', (input, expected) => {
    expect(xxh3_64(Buffer.from(input)).toString(16).padStart(16, '0')).toBe(expected);
  });
});

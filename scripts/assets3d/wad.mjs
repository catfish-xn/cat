// WAD 3.x index reader. Hash-to-path lookup is supplied explicitly by the caller.
// Reference: https://www.communitydragon.org/docs/wad
import * as zlib from 'node:zlib';
import { BinaryReader } from './inspect-source.mjs';
import { xxh3_64 } from './xxh3.mjs';

export function readWadIndex(bytes, archiveSize = bytes.length) {
  const r = new BinaryReader(bytes);
  if (r.text(2) !== 'RW') throw new Error('invalid-wad');
  r.range(2, 2);
  if (bytes[2] !== 3 || bytes[3] > 4) throw new Error('unsupported-wad-version');
  r.seek(268); const count = r.u32(); r.range(r.offset, count * 32);
  if (!Number.isSafeInteger(archiveSize) || archiveSize < bytes.length) throw new Error('invalid-archive-size');
  const entries = [], hashes = new Set();
  for (let i = 0; i < count; i++) {
    const start = r.offset; r.range(start, 32);
    const hash = bytes.readBigUInt64LE(start).toString(16).padStart(16, '0'); r.skip(8);
    const offset = r.u32(), compressedSize = r.u32(), size = r.u32();
    const packedType = bytes[r.offset++], high = bytes[r.offset++], low = r.u16(); r.skip(8);
    const type = packedType & 15, subchunkCount = packedType >>> 4;
    if (hashes.has(hash) || offset < 272 + count * 32 || offset + compressedSize > archiveSize) throw new Error('invalid-wad-entry');
    // In 3.0–3.3 the high byte is a duplicate flag, not part of the TOC index.
    hashes.add(hash); entries.push({ hash, offset, compressedSize, size, type, subchunkCount, firstSubchunk: low + (bytes[3] >= 4 ? high << 16 : 0) });
  }
  return entries;
}
/** No redirects or path writes: a caller must resolve an allowed hash and safe path. */
export function extractWadEntry(bytes, entry, { maxOutputBytes = 64 * 1024 * 1024, decompressZstd = zlib.zstdDecompressSync, subchunkToc } = {}) {
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0 || !Number.isSafeInteger(entry.size)
    || entry.size < 0 || entry.size > maxOutputBytes) throw new Error('wad-output-budget');
  new BinaryReader(bytes).range(entry.offset, entry.compressedSize);
  const payload = bytes.subarray(entry.offset, entry.offset + entry.compressedSize);
  let result;
  if (entry.type === 0) {
    if (payload.length > maxOutputBytes) throw new Error('wad-output-budget');
    if (payload.length !== entry.size) throw new Error('wad-size-mismatch');
    result = Buffer.from(payload);
  }
  else if (entry.type === 1) result = zlib.gunzipSync(payload, { maxOutputLength: Math.max(1, entry.size) });
  else if (entry.type === 3) {
    if (!decompressZstd) throw new Error('zstd-decoder-required');
    result = decompressZstd(payload, { maxOutputLength: Math.max(1, entry.size) });
  } else if (entry.type === 4) {
    if (!subchunkToc) throw new Error('wad-subchunk-toc-required');
    const { firstSubchunk: first, subchunkCount: count } = entry;
    if (!Number.isSafeInteger(first) || first < 0 || !Number.isSafeInteger(count) || count < 1 || count > 15
      || subchunkToc.length % 16 || (first + count) * 16 > subchunkToc.length) throw new Error('invalid-wad-subchunk-toc');
    let packedTotal = 0, outputTotal = 0;
    const chunks = [];
    // WAD 3.x TOC: <compressed u32, uncompressed u32, XXH3-64 of packed data>.
    // Preflight the entire chain before decoding any part. No fallback on bad TOCs.
    for (let i = first; i < first + count; i++) {
      const compressed = subchunkToc.readUInt32LE(i * 16), size = subchunkToc.readUInt32LE(i * 16 + 4);
      packedTotal += compressed; outputTotal += size;
      if (!compressed || !size || packedTotal > payload.length || outputTotal > entry.size) throw new Error('wad-subchunk-size-mismatch');
      chunks.push({ compressed, size, checksum: subchunkToc.readBigUInt64LE(i * 16 + 8) });
    }
    if (packedTotal !== payload.length || outputTotal !== entry.size) throw new Error('wad-subchunk-size-mismatch');
    let offset = 0;
    result = Buffer.concat(chunks.map(c => {
      const part = payload.subarray(offset, offset + c.compressed); offset += c.compressed;
      if (xxh3_64(part) !== c.checksum) throw new Error('wad-subchunk-hash-mismatch');
      if (c.compressed === c.size) return part;
      if (!decompressZstd) throw new Error('zstd-decoder-required');
      const decoded = decompressZstd(part, { maxOutputLength: c.size });
      if (decoded.length !== c.size) throw new Error('wad-subchunk-size-mismatch');
      return decoded;
    }));
  } else throw new Error(`unsupported-wad-compression:${entry.type}`);
  if (result.length !== entry.size) throw new Error('wad-size-mismatch');
  return result;
}

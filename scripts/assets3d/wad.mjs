// WAD 3.x index reader. Hash-to-path lookup is supplied explicitly by the caller.
// Reference: https://www.communitydragon.org/docs/wad
import * as zlib from 'node:zlib';
import { BinaryReader } from './inspect-source.mjs';

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
    hashes.add(hash); entries.push({ hash, offset, compressedSize, size, type, subchunkCount, firstSubchunk: low + (high << 16) });
  }
  return entries;
}
/** No redirects or path writes: a caller must resolve an allowed hash and safe path. */
export function extractWadEntry(bytes, entry, { maxOutputBytes = 64 * 1024 * 1024, decompressZstd = zlib.zstdDecompressSync } = {}) {
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0 || !Number.isSafeInteger(entry.size)
    || entry.size < 0 || entry.size > maxOutputBytes) throw new Error('wad-output-budget');
  new BinaryReader(bytes).range(entry.offset, entry.compressedSize);
  const payload = bytes.subarray(entry.offset, entry.offset + entry.compressedSize);
  let result;
  if (entry.type === 0) result = Buffer.from(payload);
  else if (entry.type === 1) result = zlib.gunzipSync(payload, { maxOutputLength: maxOutputBytes });
  else if (entry.type === 3) {
    if (!decompressZstd) throw new Error('zstd-decoder-required');
    result = decompressZstd(payload, { maxOutputLength: maxOutputBytes });
  } else throw new Error(`unsupported-wad-compression:${entry.type}`);
  if (result.length !== entry.size) throw new Error('wad-size-mismatch');
  return result;
}

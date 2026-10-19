import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
// @ts-expect-error Node asset utility, intentionally JavaScript.
import { readWadIndex, extractWadEntry } from '../scripts/assets3d/wad.mjs';
function wad(type = 0) {
  const raw = Buffer.from('synthetic asset'), payload = type === 1 ? gzipSync(raw) : raw;
  const bytes = Buffer.alloc(304 + payload.length); bytes.write('RW'); bytes[2] = 3; bytes[3] = 1;
  bytes.writeUInt32LE(1, 268); bytes.writeBigUInt64LE(123n, 272);
  bytes.writeUInt32LE(304, 280); bytes.writeUInt32LE(payload.length, 284); bytes.writeUInt32LE(raw.length, 288); bytes[292] = type;
  payload.copy(bytes, 304); return { bytes, raw };
}
describe('bounded WAD index and entry extraction', () => {
  it.each([0, 1])('extracts generated type %i bytes using explicit path hashes', type => {
    const { bytes, raw } = wad(type), entries = readWadIndex(bytes);
    expect(entries[0].hash).toBe('000000000000007b'); expect(extractWadEntry(bytes, entries[0])).toEqual(raw);
  });
  it('can read only the downloaded index with a separately bounded archive length', () => {
    const { bytes } = wad(); expect(readWadIndex(bytes.subarray(0, 304), bytes.length)).toEqual(readWadIndex(bytes));
  });
  it('rejects huge index counts and entries pointing beyond the archive', () => {
    const { bytes } = wad(); bytes.writeUInt32LE(0xffffffff, 268); expect(() => readWadIndex(bytes)).toThrow('truncated-asset');
    const other = wad().bytes; other.writeUInt32LE(0xffffffff, 280); expect(() => readWadIndex(other)).toThrow('invalid-wad-entry');
  });
  it('enforces decompression budget before invoking a decoder', () => {
    const { bytes } = wad(3), entry = readWadIndex(bytes)[0], decode = vi.fn();
    expect(() => extractWadEntry(bytes, { ...entry, size: 1000000000 }, { decompressZstd: decode })).toThrow('wad-output-budget');
    expect(decode).not.toHaveBeenCalled();
    expect(() => extractWadEntry(bytes, entry, { decompressZstd: null })).toThrow('zstd-decoder-required');
  });
  it('does not silently treat redirects or subchunk data as ordinary payloads', () => {
    for (const type of [2, 4]) {
      const { bytes } = wad(type); expect(() => extractWadEntry(bytes, readWadIndex(bytes)[0])).toThrow(`unsupported-wad-compression:${type}`);
    }
  });
  it('rejects output size mismatches', () => {
    const { bytes } = wad(), entry = readWadIndex(bytes)[0];
    expect(() => extractWadEntry(bytes, { ...entry, size: entry.size + 1 })).toThrow('wad-size-mismatch');
  });
});

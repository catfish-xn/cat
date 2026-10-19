// RMAN 2.0/2.1 FlatBuffer tables; follows the locally supplied CDTB patcher.py.
import * as zlib from 'node:zlib';
import { BinaryReader } from './inspect-source.mjs';
export const MAX_CACHED_CHUNK_BYTES = 16 * 1024 * 1024;
export const MAX_CACHED_RANGE_BYTES = 64 * 1024 * 1024; // Whole blocks inflated for a single range, even for tiny slices.
export function readRman(bytes) {
    const r = new BinaryReader(bytes);
    r.range(0, 28);
    if (bytes.toString('ascii', 0, 4) !== 'RMAN' || bytes[4] !== 2 || ![0, 1].includes(bytes[5]) || !(bytes.readUInt16LE(6) & 512))
        throw new Error('unsupported-rman');
    const offset = bytes.readUInt32LE(8), length = bytes.readUInt32LE(12), size = bytes.readUInt32LE(24);
    r.range(offset, length);
    if (size > 256 * 1024 * 1024)
        throw new Error('rman-output-budget');
    if (typeof zlib.zstdDecompressSync !== 'function')
        throw new Error('node-zstd-decoder-required');
    const body = zlib.zstdDecompressSync(bytes.subarray(offset, offset + length), { maxOutputLength: size });
    if (body.length !== size)
        throw new Error('rman-size-mismatch');
    const b = new BinaryReader(body), u32 = o => {
        b.range(o, 4);
        return body.readUInt32LE(o);
    }, i32 = o => {
        b.range(o, 4);
        return body.readInt32LE(o);
    }, u64 = o => {
        b.range(o, 8);
        return body.readBigUInt64LE(o).toString(16).padStart(16, '0').toUpperCase();
    };
    function table(o) {
        const count = u32(o);
        b.range(o + 4, count * 4);
        return Array.from({ length: count }, (_, i) => o + 4 + i * 4 + i32(o + 4 + i * 4));
    }
    function field(o, index, type) {
        const v = o - i32(o);
        b.range(v, 4);
        const n = body.readUInt16LE(v);
        b.range(v, n);
        const rel = 4 + index * 2 < n ? body.readUInt16LE(v + 4 + index * 2) : 0;
        if (!rel)
            return null;
        const p = o + rel;
        if (type === 'u64')
            return u64(p);
        if (type === 'u32')
            return u32(p);
        if (type === 'offset')
            return p + i32(p);
        if (type === 'str') {
            const at = p + i32(p), n = u32(at);
            b.range(at + 4, n);
            return body.toString('utf8', at + 4, at + 4 + n);
        }
        throw new Error('invalid-rman-field');
    }
    const base = 4 + i32(0);
    b.range(base, 24);
    const offsets = Array.from({ length: 6 }, (_, i) => base + i * 4 + i32(base + i * 4));
    const chunks = new Map();
    for (const bundle of table(offsets[0])) {
        const bundleId = field(bundle, 0, 'u64');
        let offset = 0;
        for (const entry of table(field(bundle, 1, 'offset'))) {
            const id = field(entry, 0, 'u64'), size = field(entry, 1, 'u32'), targetSize = field(entry, 2, 'u32');
            chunks.set(id, { id, bundleId, offset, size, targetSize });
            offset += size;
        }
    }
    const dirs = new Map(table(offsets[3]).map(o => [field(o, 0, 'u64'), { parent: field(o, 1, 'u64'), name: field(o, 2, 'str') }]));
    const files = [];
    for (const entry of table(offsets[2])) {
        let name = field(entry, 3, 'str'), dir = field(entry, 1, 'u64');
        const seen = new Set();
        while (dir) {
            if (seen.has(dir) || !dirs.has(dir))
                throw new Error('invalid-rman-directory');
            seen.add(dir);
            const d = dirs.get(dir);
            name = `${d.name}/${name}`;
            dir = d.parent;
        }
        if (!/\.wad\.client$/i.test(name))
            continue;
        const o = field(entry, 7, 'offset'), count = u32(o);
        b.range(o + 4, count * 8);
        const fileChunks = [];
        let fileOffset = 0;
        for (let i = 0; i < count; i++) {
            const chunk = chunks.get(u64(o + 4 + i * 8));
            if (!chunk)
                throw new Error('missing-rman-chunk');
            fileChunks.push({ ...chunk, fileOffset });
            fileOffset += chunk.targetSize;
        }
        const size = field(entry, 2, 'u32');
        if (fileOffset !== size)
            throw new Error('rman-file-size-mismatch');
        files.push({ name, size, chunks: fileChunks });
    }
    return { files, bodyBytes: size, chunks: chunks.size };
}
export function chunksForRange(file, start, size) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size) || start < 0 || size < 0 || start + size > file.size)
        throw new Error('invalid-rman-range');
    return file.chunks.filter(c => size > 0 && c.fileOffset < start + size && c.fileOffset + c.targetSize > start);
}
export async function readCachedRange(file, start, size, readChunk) {
    const chunks = chunksForRange(file, start, size);
    let total = 0;
    // Preflight the complete range before reading or inflating even the first block.
    for (const c of chunks) {
        if (!Number.isSafeInteger(c.targetSize) || c.targetSize < 1 || c.targetSize > MAX_CACHED_CHUNK_BYTES)
            throw new Error('cached-chunk-output-budget');
        total += c.targetSize;
        if (total > MAX_CACHED_RANGE_BYTES)
            throw new Error('cached-range-output-budget');
    }
    if (size > MAX_CACHED_RANGE_BYTES)
        throw new Error('cached-range-output-budget');
    const parts = [];
    for (const c of chunks) {
        const packed = await readChunk(c.id);
        if (packed.length !== c.size)
            throw new Error('cached-chunk-size-mismatch');
        const bytes = zlib.zstdDecompressSync(packed, { maxOutputLength: c.targetSize });
        if (packed.length !== c.size || bytes.length !== c.targetSize)
            throw new Error('cached-chunk-size-mismatch');
        const lo = Math.max(start, c.fileOffset) - c.fileOffset, hi = Math.min(start + size, c.fileOffset + c.targetSize) - c.fileOffset;
        parts.push(bytes.subarray(lo, hi));
    }
    const result = Buffer.concat(parts);
    if (result.length !== size)
        throw new Error('missing-cached-range');
    return result;
}

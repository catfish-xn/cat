import { describe, expect, it } from 'vitest';
import * as zlib from 'node:zlib';
// @ts-expect-error Pure Node build utility.
import { readRman, readCachedRange } from '../scripts/assets3d/rman.mjs';
function fixture() {
    const b = Buffer.alloc(416), u = (o: number, n: number) => b.writeUInt32LE(n, o), id = (o: number, n: number) => b.writeBigUInt64LE(BigInt(n), o);
    // Six table offsets, then vectors of table-relative pointers.
    [28, 36, 40, 48, 56, 60].forEach((o, i) => u(4 + i * 4, o - (4 + i * 4)));
    u(28, 1);
    u(32, 64);
    u(40, 1);
    u(44, 172);
    u(48, 1);
    u(52, 300);
    function vtable(o: number, offsets: number[], objectSize: number) {
        b.writeUInt16LE(4 + offsets.length * 2, o);
        b.writeUInt16LE(objectSize, o + 2);
        offsets.forEach((n, i) => b.writeUInt16LE(n, o + 4 + i * 2));
    }
    vtable(80, [4, 12], 16);
    u(96, 16);
    id(100, 1);
    u(108, 12);
    u(120, 1);
    u(124, 36);
    vtable(144, [4, 12, 16], 20);
    u(160, 16);
    id(164, 2);
    u(172, 7);
    u(176, 10);
    vtable(180, [4, 12, 20, 24, 0, 0, 0, 36, 0, 0, 0, 0, 0], 40);
    u(216, 36);
    id(220, 3);
    id(228, 4);
    u(236, 10);
    u(240, 40);
    u(252, 52);
    const name = 'toy.wad.client';
    u(280, name.length);
    b.write(name, 284);
    u(304, 1);
    id(308, 2);
    vtable(336, [4, 0, 20], 24);
    u(352, 16);
    id(356, 4);
    u(372, 24);
    u(396, 4);
    b.write('DATA', 400);
    const pack = (body: Buffer) => {
        const compressed = zlib.zstdCompressSync(body), h = Buffer.alloc(28);
        h.write('RMAN');
        h[4] = 2;
        h[5] = 1;
        h.writeUInt16LE(512, 6);
        h.writeUInt32LE(28, 8);
        h.writeUInt32LE(compressed.length, 12);
        h.writeUInt32LE(body.length, 24);
        return Buffer.concat([h, compressed]);
    };
    return { body: b, pack };
}
describe('offline RMAN metadata and cached chunk ranges', () => {
    it('reads a compressed synthetic RMAN with bundles, directories and exact file chunk offsets', () => {
        const f = fixture(), r = readRman(f.pack(f.body));
        expect(r.files).toEqual([{ name: 'DATA/toy.wad.client', size: 10, chunks: [{ id: '0000000000000002', bundleId: '0000000000000001', offset: 0, size: 7, targetSize: 10, fileOffset: 0 }] }]);
        expect(r.chunks).toBe(1);
    });
    it('rejects a directory cycle and mismatched file size', () => {
        const f = fixture();
        f.body.writeUInt32LE(11, 236);
        expect(() => readRman(f.pack(f.body))).toThrow('rman-file-size-mismatch');
        const g = fixture();
        g.body.writeUInt16LE(12, 342);
        g.body.writeBigUInt64LE(4n, 364);
        expect(() => readRman(g.pack(g.body))).toThrow('invalid-rman-directory');
    });
    it('reconstructs a range crossing two local compressed chunks without fetching', async () => {
        const a = zlib.zstdCompressSync(Buffer.from('0123456789')), b = zlib.zstdCompressSync(Buffer.from('abcdefghij')), file = { size: 20, chunks: [{ id: 'a', fileOffset: 0, targetSize: 10, size: a.length }, { id: 'b', fileOffset: 10, targetSize: 10, size: b.length }] };
        const result = await readCachedRange(file, 8, 5, async (id: string) => id === 'a' ? a : b);
        expect(result.toString()).toBe('89abc');
        await expect(readCachedRange({ ...file, chunks: [{ ...file.chunks[0], size: 1 }, file.chunks[1]] }, 8, 5, async (id: string) => id === 'a' ? a : b)).rejects.toThrow('cached-chunk-size-mismatch');
    });
});

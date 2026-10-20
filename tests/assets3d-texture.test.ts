import { describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
// @ts-expect-error Pure Node build utility.
import { decodeBlocks, decodeTexture, encodePng, crc32 } from '../scripts/assets3d/texture.mjs';
function colorBlock(c0 = 0xf800, c1 = 0x001f) {
    const b = Buffer.alloc(8);
    b.writeUInt16LE(c0);
    b.writeUInt16LE(c1, 2);
    b.writeUInt32LE(0xe4e4e4e4, 4);
    return b;
}
describe('BC1/BC3 and embedded PNG production', () => {
    it.each([true, false])('reuses one pixel buffer across all PNG rows (Buffer input: %s)', bufferInput => {
        const width = 8, height = 64, rgba = bufferInput ? Buffer.alloc(width * height * 4, 17) : new Uint8Array(width * height * 4).fill(17);
        const from = vi.spyOn(Buffer, 'from');
        try {
            const png = encodePng({ width, height, rgba });
            const copies = from.mock.calls.filter(([input]) => input === rgba);
            expect(copies).toHaveLength(bufferInput ? 0 : 1);
            const idatOffset = 33, length = png.readUInt32BE(idatOffset);
            const scan = inflateSync(png.subarray(idatOffset + 8, idatOffset + 8 + length));
            for (let y = 0; y < height; y++) {
                expect(scan[y * (width * 4 + 1)]).toBe(0);
                expect(scan.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1))).toEqual(Buffer.alloc(width * 4, 17));
            }
        }
        finally { from.mockRestore(); }
    });
    it('decodes BC1 four-color RGB565 and selector order', () => {
        const d = decodeBlocks(colorBlock(), 4, 4, 'BC1');
        expect([...d.rgba.subarray(0, 16)]).toEqual([255, 0, 0, 255, 0, 0, 255, 255, 170, 0, 85, 255, 85, 0, 170, 255]);
    });
    it('decodes BC1 transparent palette and crops partial blocks', () => {
        const b = colorBlock(0, 0xffff);
        b.writeUInt32LE(0xffffffff, 4);
        const d = decodeBlocks(b, 3, 2, 'BC1');
        expect(d.rgba).toHaveLength(24);
        expect([...d.rgba]).toEqual(Array(24).fill(0));
    });
    it('decodes BC3 eight-alpha interpolation and 48-bit little-endian selectors', () => {
        const b = Buffer.alloc(16);
        b[0] = 255;
        b[1] = 0;
        let selectors = 0;
        for (let i = 0; i < 16; i++)
            selectors += (i % 8) * 2 ** (3 * i);
        b.writeUIntLE(selectors, 2, 6);
        colorBlock().copy(b, 8);
        const d = decodeBlocks(b, 4, 4, 'BC3');
        expect(Array.from({ length: 8 }, (_, i) => d.rgba[i * 4 + 3])).toEqual([255, 0, 218, 182, 145, 109, 72, 36]);
    });
    it('decodes the BC3 six-alpha case with explicit zero/one endpoints', () => {
        const b = Buffer.alloc(16);
        b[0] = 0;
        b[1] = 255;
        b.writeUIntLE(6 + 7 * 8, 2, 6);
        colorBlock().copy(b, 8);
        const d = decodeBlocks(b, 4, 4, 'BC3');
        expect(d.rgba[3]).toBe(0);
        expect(d.rgba[7]).toBe(255);
    });
    it.each(['DXT1', 'DXT5'])('loads DDS %s from the largest first mip', code => {
        const b = Buffer.alloc(code === 'DXT1' ? 136 : 144);
        b.write('DDS ');
        b.writeUInt32LE(124, 4);
        b.writeUInt32LE(4, 12);
        b.writeUInt32LE(4, 16);
        b.writeUInt32LE(32, 76);
        b.write(code, 84);
        colorBlock().copy(b, code === 'DXT1' ? 128 : 136);
        expect(decodeTexture(b).format).toBe(code === 'DXT1' ? 'BC1' : 'BC3');
    });
    it('loads TEX BC1 from the last, largest mip instead of the thumbnail', () => {
        const b = Buffer.alloc(28);
        b.write('TEX\0');
        b.writeUInt16LE(4, 4);
        b.writeUInt16LE(4, 6);
        b[8] = 1;
        b[9] = 10;
        b[11] = 1;
        colorBlock().copy(b, 20);
        expect(decodeTexture(b).rgba[0]).toBe(255);
    });
    it('loads TEX BC3 and rejects unsupported formats without substituting pixels', () => {
        const b = Buffer.alloc(28);
        b.write('TEX\0');
        b.writeUInt16LE(4, 4);
        b.writeUInt16LE(4, 6);
        b[8] = 1;
        b[9] = 12;
        b[12] = 255;
        colorBlock().copy(b, 20);
        expect(decodeTexture(b).rgba[3]).toBe(255);
        b[9] = 99;
        expect(() => decodeTexture(b)).toThrow('unsupported-texture-format:TEX-99');
    });
    it('writes PNG signature, dimensions, CRCs and lossless RGBA scanlines', () => {
        const rgba = Buffer.from([1, 2, 3, 4, 250, 251, 252, 253]), png = encodePng({ width: 1, height: 2, rgba });
        expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(png.readUInt32BE(16)).toBe(1);
        expect(png.readUInt32BE(20)).toBe(2);
        const idat: Buffer[] = [];
        let end = 8;
        for (; end < png.length;) {
            const n = png.readUInt32BE(end), type = png.toString('ascii', end + 4, end + 8);
            expect(png.readUInt32BE(end + 8 + n)).toBe(crc32(png.subarray(end + 4, end + 8 + n)));
            if (type === 'IDAT')
                idat.push(png.subarray(end + 8, end + 8 + n));
            end += 12 + n;
        }
        expect(inflateSync(Buffer.concat(idat))).toEqual(Buffer.from([0, 1, 2, 3, 4, 0, 250, 251, 252, 253]));
        expect(end).toBe(png.length);
        expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    });
    it('rejects truncated blocks, excessive dimensions and wrong RGBA length', () => {
        expect(() => decodeBlocks(Buffer.alloc(7), 4, 4, 'BC1')).toThrow('truncated-asset');
        expect(() => decodeBlocks(Buffer.alloc(8), 100000, 100000, 'BC1')).toThrow('texture-dimensions-budget');
        expect(() => encodePng({ width: 1, height: 1, rgba: Buffer.alloc(3) })).toThrow('invalid-rgba-length');
    });
});

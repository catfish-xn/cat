import { deflateSync } from 'node:zlib';
import { BinaryReader } from './inspect-source.mjs';
function dimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16777216)
        throw new Error('texture-dimensions-budget');
}
const rgb565 = n => [((n >>> 11) & 31) * 255 / 31, ((n >>> 5) & 63) * 255 / 63, (n & 31) * 255 / 31].map(Math.round);
export function decodeBlocks(bytes, width, height, format) {
    dimensions(width, height);
    if (!['BC1', 'BC3'].includes(format))
        throw new Error(`unsupported-texture-format:${format}`);
    const blockSize = format === 'BC1' ? 8 : 16, bx = Math.ceil(width / 4), by = Math.ceil(height / 4);
    new BinaryReader(bytes).range(0, bx * by * blockSize);
    const rgba = Buffer.alloc(width * height * 4);
    for (let yb = 0; yb < by; yb++)
        for (let xb = 0; xb < bx; xb++) {
            const start = (yb * bx + xb) * blockSize, o = start + (format === 'BC3' ? 8 : 0);
            const c0 = bytes.readUInt16LE(o), c1 = bytes.readUInt16LE(o + 2), colors = [rgb565(c0), rgb565(c1)];
            if (c0 > c1 || format === 'BC3') {
                colors.push(colors[0].map((c, k) => Math.floor((2 * c + colors[1][k]) / 3)), colors[0].map((c, k) => Math.floor((c + 2 * colors[1][k]) / 3)));
            }
            else
                colors.push(colors[0].map((c, k) => Math.floor((c + colors[1][k]) / 2)), [0, 0, 0]);
            const alpha = format === 'BC3' ? [bytes[start], bytes[start + 1]] : [];
            if (format === 'BC3') {
                if (alpha[0] > alpha[1])
                    for (let k = 1; k <= 6; k++)
                        alpha.push(Math.floor(((7 - k) * alpha[0] + k * alpha[1]) / 7));
                else {
                    for (let k = 1; k <= 4; k++)
                        alpha.push(Math.floor(((5 - k) * alpha[0] + k * alpha[1]) / 5));
                    alpha.push(0, 255);
                }
            }
            const indices = bytes.readUInt32LE(o + 4), alphaBits = format === 'BC3' ? bytes.readUIntLE(start + 2, 6) : 0;
            for (let p = 0; p < 16; p++) {
                const x = xb * 4 + p % 4, y = yb * 4 + Math.floor(p / 4);
                if (x >= width || y >= height)
                    continue;
                const ci = (indices >>> (p * 2)) & 3, dest = (y * width + x) * 4;
                rgba.set(colors[ci], dest);
                rgba[dest + 3] = format === 'BC3' ? alpha[Math.floor(alphaBits / 2 ** (p * 3)) % 8] : c0 <= c1 && ci === 3 ? 0 : 255;
            }
        }
    return { width, height, rgba, format };
}
export function decodeTexture(bytes) {
    const r = new BinaryReader(bytes);
    r.range(0, 12);
    let width, height, format, offset;
    if (bytes.toString('ascii', 0, 4) === 'TEX\0') {
        width = bytes.readUInt16LE(4);
        height = bytes.readUInt16LE(6);
        if (bytes[8] !== 1)
            throw new Error('unsupported-tex-version');
        format = ({ 10: 'BC1', 12: 'BC3' })[bytes[9]];
        if (!format)
            throw new Error(`unsupported-texture-format:TEX-${bytes[9]}`);
        // TEX stores the complete mip chain in ascending size; the largest mip is last.
        dimensions(width, height);
        offset = bytes.length - Math.ceil(width / 4) * Math.ceil(height / 4) * (format === 'BC1' ? 8 : 16);
        if (offset < 12)
            throw new Error('truncated-asset');
    }
    else if (bytes.toString('ascii', 0, 4) === 'DDS ') {
        r.range(0, 128);
        if (bytes.readUInt32LE(4) !== 124 || bytes.readUInt32LE(76) !== 32)
            throw new Error('invalid-dds');
        height = bytes.readUInt32LE(12);
        width = bytes.readUInt32LE(16);
        const code = bytes.toString('ascii', 84, 88);
        format = ({ DXT1: 'BC1', DXT5: 'BC3' })[code];
        if (!format)
            throw new Error(`unsupported-texture-format:DDS-${code}`);
        offset = 128;
    }
    else
        throw new Error('unsupported-texture-container');
    return decodeBlocks(bytes.subarray(offset), width, height, format);
}
export function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let k = 0; k < 8; k++)
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const t = Buffer.from(type), head = Buffer.alloc(4), tail = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    tail.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([head, t, data, tail]);
}
export function encodePng({ width, height, rgba }) {
    dimensions(width, height);
    if (rgba.length !== width * height * 4)
        throw new Error('invalid-rgba-length');
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    const scan = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++)
        Buffer.from(rgba).copy(scan, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

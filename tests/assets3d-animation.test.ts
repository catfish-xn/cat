import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node build utility.
import { decodeAnm, quaternion48, sampleSpline } from '../scripts/assets3d/animation.mjs';
function packedQuaternion(q: number[]) {
    const largest = q.map(Math.abs).indexOf(Math.max(...q.map(Math.abs))), sign = q[largest] < 0 ? -1 : 1;
    const parts = q.filter((_, i) => i !== largest).map(n => Math.round((n * sign / Math.SQRT2 + 0.5) * 32767));
    const b = Buffer.alloc(6);
    b.writeUIntLE(largest * 2 ** 45 + parts[0] * 2 ** 30 + parts[1] * 2 ** 15 + parts[2], 0, 6);
    return b;
}
function compressed(flags = 0) {
    // A single translation track with duplicate endpoint controls and a genuine
    // nonlinear intermediate value: key times 0,0,1/3,1,1, duration=3 seconds.
    const b = Buffer.alloc(182);
    b.write('r3d2canm');
    b.writeUInt32LE(1, 8);
    b.writeUInt32LE(flags, 20);
    b.writeUInt32LE(1, 24);
    b.writeUInt32LE(5, 28);
    b.writeFloatLE(3, 36);
    b.writeFloatLE(30, 40);
    for (let k = 0; k < 3; k++)
        b.writeFloatLE(10, 80 + k * 4);
    b.writeUInt32LE(116, 116);
    b.writeUInt32LE(166, 120);
    b.writeUInt32LE(166, 124);
    [0, 0, 21845, 65535, 65535].forEach((t, i) => {
        const o = 128 + i * 10;
        b.writeUInt16LE(t, o);
        b.writeUInt16LE(16384, o + 2);
        b.writeUInt16LE([0, 0, 65535, 0, 0][i], o + 4);
    });
    b.writeUInt32LE(123, 178);
    return b;
}
function uncompressed() {
    const b = Buffer.alloc(134);
    b.write('r3d2anmd');
    b.writeUInt32LE(5, 8);
    b.writeUInt32LE(1, 28);
    b.writeUInt32LE(2, 32);
    b.writeFloatLE(0.5, 36);
    b.writeUInt32LE(106, 40);
    b.writeUInt32LE(64, 52);
    b.writeUInt32LE(100, 56);
    b.writeUInt32LE(110, 60);
    [1, 1, 1, 2, 3, 4, 6, 7, 8].forEach((n, i) => b.writeFloatLE(n, 76 + i * 4));
    packedQuaternion([0, 0, 0, 1]).copy(b, 112);
    b.writeUInt32LE(123, 118);
    b.writeUInt16LE(1, 122);
    b.writeUInt16LE(2, 128);
    return b;
}
describe('raw ANM decoding', () => {
    it('decodes all four omitted quaternion components with unit norm', () => {
        for (const q of [[0.9, 0.1, 0.2, Math.sqrt(0.14)], [0.1, 0.9, 0.2, Math.sqrt(0.14)], [0.1, 0.2, 0.9, Math.sqrt(0.14)], [0.1, 0.2, Math.sqrt(0.14), 0.9]]) {
            const out = quaternion48(packedQuaternion(q), 0);
            expect(Math.hypot(...out)).toBeCloseTo(1, 10);
            q.forEach((n, i) => expect(out[i]).toBeCloseTo(n, 4));
        }
    });
    it('decodes compressed v1 keyed bounds and evaluates a nonlinear spline', () => {
        const a = decodeAnm(compressed());
        expect(a).toMatchObject({ format: 'compressed', duration: 3, fps: 30 });
        expect(a.tracks[0]).toMatchObject({ hash: 123, path: 'translation' });
        expect(a.sample(a.tracks[0], 0.5)[0]).toBeCloseTo(5.624895, 3);
        expect(a.sample(a.tracks[0], 1)[0]).toBeCloseTo(10, 6);
    });
    it('selects time-weighted tangents using source flag bit 4', () => {
        const a = decodeAnm(compressed(4));
        expect(a.sample(a.tracks[0], 0.5)[0]).toBeCloseTo(6.24989, 3);
    });
    it('preserves incoming-endpoint correction without changing the look-ahead hemisphere', () => {
        const keys = [{ time: 0, value: [0, 0, 0, 1] }, { time: 0, value: [0, 0, 0, 1] }, { time: 1, value: [0, 0, -0.6, -0.8] }, { time: 2, value: [0, 0, -0.8, -0.6] }];
        const q = sampleSpline(keys, 0.5, true, true);
        // Independent Hermite coefficients at t=1/2: [-1/8,9/16,5/8,-1/16]
        // using endpoint-corrected controls [q0,q1,-q2,q3].
        const z = 0.625 * 0.6 - 0.0625 * (-0.8), w = -0.125 + 0.5625 + 0.625 * 0.8 - 0.0625 * (-0.6), len = Math.hypot(z, w);
        expect(q[2]).toBeCloseTo(z / len, 6);
        expect(q[3]).toBeCloseTo(w / len, 6);
    });
    it('reads uncompressed v5 pools, hashes and frame-major records', () => {
        const a = decodeAnm(uncompressed());
        expect(a).toMatchObject({ format: 'uncompressed', version: 5, duration: 0.5 });
        expect(a.tracks.find((t: {
            path: string;
        }) => t.path === 'translation').keys).toEqual([{ time: 0, value: [2, 3, 4] }, { time: 0.5, value: [6, 7, 8] }]);
        expect(a.sample(a.tracks[0], 0)).toEqual(quaternion48(packedQuaternion([0, 0, 0, 1]), 0));
    });
    it('rejects truncated control arrays and pool indices outside their own table', () => {
        expect(() => decodeAnm(compressed().subarray(0, 175))).toThrow('truncated-asset');
        const b = uncompressed();
        b.writeUInt16LE(100, 122);
        expect(() => decodeAnm(b)).toThrow('invalid-anm-pool-index');
    });
    it('rejects unknown key types and nonpositive timing', () => {
        const b = compressed();
        b.writeUInt16LE(49152, 130);
        expect(() => decodeAnm(b)).toThrow('invalid-anm-track');
        const c = compressed();
        c.writeFloatLE(0, 36);
        expect(() => decodeAnm(c)).toThrow('invalid-anm-timing');
    });
});

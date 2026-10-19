import { BinaryReader, inspectAnm } from './inspect-source.mjs';
const paths = ['rotation', 'translation', 'scale'];
export function quaternion48(bytes, offset) {
    new BinaryReader(bytes).range(offset, 6);
    const packed = bytes.readUIntLE(offset, 6), largest = Math.floor(packed / 2 ** 45) & 3;
    const values = [30, 15, 0].map(shift => ((Math.floor(packed / 2 ** shift) % 32768) / 32767 - 0.5) * Math.SQRT2);
    values.splice(largest, 0, Math.sqrt(Math.max(0, 1 - values.reduce((sum, n) => sum + n * n, 0))));
    return values;
}
const normalized = v => {
    const len = Math.hypot(...v);
    if (!len)
        throw new Error('zero-quaternion');
    return v.map(n => n / len);
};
/** Four controls with uniform or time-weighted Catmull-Rom tangents.
 * Quaternion endpoint hemispheres follow the source spline cursor convention.
 */
export function sampleSpline(keys, time, rotation = false, timeAware = false) {
    if (!keys.length)
        throw new Error('empty-spline');
    let i = 1;
    while (i < keys.length - 2 && time > keys[i + 1].time)
        i++;
    const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[Math.min(i + 1, keys.length - 1)], d = keys[Math.min(i + 2, keys.length - 1)];
    const dt = c.time - b.time, t = dt <= 0 ? 0 : Math.max(0, Math.min(1, (time - b.time) / dt));
    const v = [a, b, c, d].map(k => [...k.value]);
    if (rotation) {
        // League's spline cursor corrects each incoming endpoint against the previous
        // endpoint. The look-ahead tangent control remains in its encoded hemisphere.
        // Preserve that distinction: correcting all four controls changes source clips.
        let previous = keys[0].value;
        for (let j = 1; j <= Math.min(i + 1, keys.length - 1); j++) {
            let current = keys[j].value;
            if (previous.reduce((s, x, k) => s + x * current[k], 0) < 0)
                current = current.map(x => -x);
            if (j >= i - 1)
                v[j - (i - 1)] = current;
            previous = current;
        }
    }
    const result = v[1].map((p, k) => {
        const m1 = (v[2][k] - v[0][k]) * (timeAware ? dt / (c.time - a.time || 1) : 0.5);
        const m2 = (v[3][k] - v[1][k]) * (timeAware ? dt / (d.time - b.time || 1) : 0.5);
        return (2 * t ** 3 - 3 * t * t + 1) * p + (t ** 3 - 2 * t * t + t) * m1 + (-2 * t ** 3 + 3 * t * t) * v[2][k] + (t ** 3 - t * t) * m2;
    });
    return rotation ? normalized(result) : result;
}
export function decodeAnm(bytes) {
    const info = inspectAnm(bytes), r = new BinaryReader(bytes);
    if (info.format === 'compressed' && info.version === 1) {
        r.seek(20);
        const flags = r.u32(), jointCount = r.u32(), keyCount = r.u32();
        r.u32();
        const duration = r.f32(), fps = r.f32();
        if (duration <= 0 || fps <= 0)
            throw new Error('invalid-anm-timing');
        r.seek(68);
        const bounds = Array.from({ length: 4 }, () => [r.f32(), r.f32(), r.f32()]);
        const keyOffset = r.u32() + 12;
        r.u32();
        const hashOffset = r.u32() + 12;
        r.range(keyOffset, keyCount * 10);
        r.range(hashOffset, jointCount * 4);
        const hashes = Array.from({ length: jointCount }, (_, i) => bytes.readUInt32LE(hashOffset + i * 4));
        const tracks = new Map();
        for (let i = 0; i < keyCount; i++) {
            const o = keyOffset + i * 10, time = bytes.readUInt16LE(o) / 65535 * duration, id = bytes.readUInt16LE(o + 2);
            const joint = id & 0x3fff, type = id >>> 14;
            if (joint >= jointCount || type > 2)
                throw new Error('invalid-anm-track');
            const key = `${joint}:${type}`;
            if (!tracks.has(key))
                tracks.set(key, { hash: hashes[joint], path: paths[type], keys: [] });
            const value = type === 0 ? quaternion48(bytes, o + 4) : [0, 1, 2].map(k => {
                const min = bounds[type === 1 ? 0 : 2][k], max = bounds[type === 1 ? 1 : 3][k];
                return min + (max - min) * bytes.readUInt16LE(o + 4 + k * 2) / 65535;
            });
            const keys = tracks.get(key).keys;
            if (keys.length && time < keys.at(-1).time)
                throw new Error('unordered-anm-keys');
            keys.push({ time, value });
        }
        return { ...info, flags, duration, fps, tracks: [...tracks.values()], sample: (track, time) => sampleSpline(track.keys, Math.floor(Math.max(0, Math.min(1, time / duration)) * 65535) / 65535 * duration, track.path === 'rotation', (flags & 4) !== 0) };
    }
    if (info.format === 'uncompressed' && info.version === 5) {
        r.seek(28);
        const jointCount = r.u32(), frameCount = r.u32(), step = r.f32(), hashOffset = r.u32() + 12;
        r.seek(52);
        const vectorOffset = r.u32() + 12, rotationOffset = r.u32() + 12, frameOffset = r.u32() + 12;
        if (frameCount < 1 || step <= 0)
            throw new Error('invalid-anm-timing');
        r.range(hashOffset, jointCount * 4);
        r.range(frameOffset, frameCount * jointCount * 6);
        const tracks = [];
        for (let j = 0; j < jointCount; j++) {
            const hash = bytes.readUInt32LE(hashOffset + j * 4);
            for (const [type, path] of paths.entries()) {
                const keys = [];
                for (let f = 0; f < frameCount; f++) {
                    const o = frameOffset + (f * jointCount + j) * 6;
                    const idx = bytes.readUInt16LE(o + (type === 0 ? 4 : type === 1 ? 0 : 2));
                    let value;
                    if (type === 0) {
                        if (rotationOffset + idx * 6 + 6 > hashOffset)
                            throw new Error('invalid-anm-pool-index');
                        r.range(rotationOffset + idx * 6, 6);
                        value = quaternion48(bytes, rotationOffset + idx * 6);
                    }
                    else {
                        if (vectorOffset + idx * 12 + 12 > rotationOffset)
                            throw new Error('invalid-anm-pool-index');
                        r.seek(vectorOffset + idx * 12);
                        value = [r.f32(), r.f32(), r.f32()];
                    }
                    keys.push({ time: Math.fround(f * step), value });
                }
                tracks.push({ hash, path, keys });
            }
        }
        return { ...info, duration: Math.fround((frameCount - 1) * step), fps: 1 / step, tracks,
            sample: (track, time) => track.keys[Math.min(frameCount - 1, Math.max(0, Math.round(time / step)))].value };
    }
    throw new Error(`unsupported-anm-decoder:${info.format}:${info.version}`);
}

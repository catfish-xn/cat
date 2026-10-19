import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
// @ts-expect-error Pure Node build utility.
import { makeModel, validateModel, readAccessor } from '../scripts/assets3d/model.mjs';
// @ts-expect-error Pure Node build utility.
import { readGlb, summarizeGlb, writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node build utility.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Pure Node build utility.
import { compareModels } from '../scripts/assets3d/compare.mjs';
function fixtures() {
    const mesh = Buffer.alloc(158 + 3 * 52);
    mesh.writeUInt32LE(0x00112233);
    mesh.writeUInt16LE(4, 4);
    mesh.writeUInt32LE(1, 8);
    mesh.write('Body', 12);
    mesh.writeUInt32LE(3, 80);
    mesh.writeUInt32LE(3, 88);
    mesh.writeUInt32LE(3, 96);
    mesh.writeUInt32LE(3, 100);
    mesh.writeUInt32LE(52, 104);
    [0, 1, 2].forEach((n, i) => mesh.writeUInt16LE(n, 152 + i * 2));
    [[1, 3, 1], [3, 3, 1], [1, 5, 1]].forEach((p, i) => {
        const o = 158 + i * 52;
        p.forEach((v, k) => mesh.writeFloatLE(v, o + k * 4));
        mesh.writeFloatLE(1, o + 16);
        mesh.writeFloatLE(1, o + 36);
    });
    const rig = Buffer.alloc(171);
    rig.writeUInt32LE(rig.length);
    rig.writeUInt32LE(0x22fd4fc3, 4);
    rig.writeUInt16LE(1, 14);
    rig.writeUInt32LE(1, 16);
    rig.writeInt32LE(64, 20);
    rig.writeInt32LE(164, 28);
    rig.writeInt16LE(-1, 68);
    rig.writeUInt32LE(123, 72);
    [1, 3, 1, 1, 1, 1, 0, 0, 0, 1, -1, -3, -1, 1, 1, 1, 0, 0, 0, 1].forEach((v, i) => rig.writeFloatLE(v, 80 + i * 4));
    rig.writeInt32LE(6, 160);
    rig.write('root\0', 166);
    const anm = Buffer.alloc(134);
    anm.write('r3d2anmd');
    anm.writeUInt32LE(5, 8);
    anm.writeUInt32LE(1, 28);
    anm.writeUInt32LE(2, 32);
    anm.writeFloatLE(0.5, 36);
    anm.writeUInt32LE(106, 40);
    anm.writeUInt32LE(64, 52);
    anm.writeUInt32LE(100, 56);
    anm.writeUInt32LE(110, 60);
    [1, 1, 1, 1, 3, 1, 2, 4, 1].forEach((v, i) => anm.writeFloatLE(v, 76 + i * 4));
    anm.writeUIntLE(3 * 2 ** 45 + 16383 * 2 ** 30 + 16383 * 2 ** 15 + 16383, 112, 6);
    anm.writeUInt32LE(123, 118);
    anm.writeUInt16LE(1, 122);
    anm.writeUInt16LE(2, 128);
    const png = encodePng({ width: 1, height: 1, rgba: Buffer.from([255, 0, 0, 255]) });
    return { mesh, rig, anm, png };
}
function converted() {
    const f = fixtures();
    return makeModel(f.mesh, f.rig, [{ name: 'source_idle', bytes: f.anm }], { Body: f.png });
}
describe('raw skinned GLB assembly', () => {
    it('embeds PNG, preserves native size, mirrors winding and places the origin at the centered foot', () => {
        const r = converted(), p = readGlb(r.glb), d = p.document;
        expect(validateModel(r.glb)).toMatchObject({ passed: true, animations: 1 });
        expect(summarizeGlb(r.glb)).toMatchObject({ vertices: 3, bones: 1, textures: 1 });
        expect(r.report.bbox).toEqual({ min: [-1, 0, 0], max: [1, 2, 0], height: 2 });
        expect(d.nodes[0].scale).toBeUndefined();
        expect(d.nodes[0].translation).toBeUndefined();
        const primitive = d.meshes[0].primitives[0];
        expect(readAccessor(p, primitive.attributes.POSITION)).toEqual([[1, 0, 0], [-1, 0, 0], [1, 2, 0]]);
        expect(readAccessor(p, primitive.indices).flat()).toEqual([0, 2, 1]);
        const image = d.images[0], v = d.bufferViews[image.bufferView];
        expect(p.binary.subarray(v.byteOffset, v.byteOffset + v.byteLength)).toEqual(fixtures().png);
    });
    it('moves the root animation and adjusts inverse binds consistently with rebased geometry', () => {
        const p = readGlb(converted().glb), d = p.document, root = d.nodes[1], a = d.animations[0], channel = a.channels.find((c: {
            target: {
                path: string;
            };
        }) => c.target.path === 'translation');
        expect(readAccessor(p, a.samplers[channel.sampler].output)).toEqual([[1, 0, 0], [0, 1, 0]]);
        const bind = new Matrix4().compose(new Vector3(...root.translation), new Quaternion(...root.rotation), new Vector3(...root.scale)), inverse = new Matrix4().fromArray(readAccessor(p, d.skins[0].inverseBindMatrices)[0]);
        expect(bind.multiply(inverse).toArray()).toEqual(new Matrix4().toArray());
        expect(root.children).toBeUndefined();
        expect(a.name).toBe('source_idle');
    });
    it('rejects missing material textures instead of producing an untextured substitute', () => {
        const f = fixtures();
        expect(() => makeModel(f.mesh, f.rig, [], {})).toThrow('missing-material-texture:Body');
    });
    it('rejects malformed animation times and missing skin nodes during structure validation', () => {
        const p = readGlb(converted().glb), d = p.document;
        d.skins[0].joints = [1000];
        expect(() => validateModel(writeGlb(d, p.binary))).toThrow('invalid-gltf-skin');
        const other = readGlb(converted().glb), a = other.document.accessors[other.document.animations[0].samplers[0].input], view = other.document.bufferViews[a.bufferView];
        other.binary.writeFloatLE(0, view.byteOffset + 4);
        expect(() => validateModel(writeGlb(other.document, other.binary))).toThrow('invalid-animation-time');
    });
    it('checks reference world poses under a declared reflection, and detects a rotation regression', () => {
        function model(target: boolean, broken = false) {
            const parts: Buffer[] = [], views: object[] = [], accessors: object[] = [];
            let offset = 0;
            function acc(values: number[], type: string, size: number) {
                const b = Buffer.from(new Float32Array(values).buffer), i = accessors.length;
                views.push({ buffer: 0, byteOffset: offset, byteLength: b.length });
                offset += b.length;
                parts.push(b);
                accessors.push({ bufferView: i, componentType: 5126, count: values.length / size, type });
                return i;
            }
            const pos = acc(target ? [1, 0, 0, -1, 0, 0, 1, 2, 0] : [0, 0, 0, 2, 0, 0, 0, 2, 0], 'VEC3', 3), input = acc([0, 1], 'SCALAR', 1), translation = acc(target ? [1, 0, 0, -1, 0, 0] : [0, 0, 0, 2, 0, 0], 'VEC3', 3), rotation = acc([0, 0, 0, 1, 0, 0, broken ? 0 : (target ? -1 : 1) * Math.SQRT1_2, broken ? 1 : Math.SQRT1_2], 'VEC4', 4);
            const doc = { asset: { version: '2.0' }, buffers: [{ byteLength: offset }], bufferViews: views, accessors, nodes: [{ name: 'mesh', mesh: 0, skin: 0, children: [1] }, { name: 'root' }], skins: [{ joints: [1] }], meshes: [{ primitives: [{ attributes: { POSITION: pos } }] }], animations: [{ name: target ? 'source_idle' : 'idle', samplers: [{ input, output: translation }, { input, output: rotation }], channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }, { sampler: 1, target: { node: 1, path: 'rotation' } }] }] };
            return writeGlb(doc, Buffer.concat(parts));
        }
        const c = compareModels(model(true), model(false), { idle: 'source_idle' }, { translation: [1, 0, 0] });
        expect(c.passed).toBe(true);
        expect(c.maxTranslation).toBeLessThan(1e-6);
        expect(c.vertices.maxPositionError).toBe(0);
        const bad = compareModels(model(true, true), model(false), { idle: 'source_idle' }, { translation: [1, 0, 0] });
        expect(bad.passed).toBe(false);
        expect(bad.maxRotationDegrees).toBeCloseTo(90, 4);
    });
});

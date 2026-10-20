import { describe, expect, it, vi } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
// @ts-expect-error Pure Node build utility.
import { makeModel, validateModel, readAccessor, MAX_ANIMATION_FRAMES, MAX_ACCESSOR_ELEMENTS } from '../scripts/assets3d/model.mjs';
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
function locatorRig() {
    const names = ['root', 'Locator', 'LOCATOR'], bytes = names.reduce((n, s) => n + Buffer.byteLength(s) + 1, 0);
    const rig = Buffer.alloc(368 + bytes); rig.writeUInt32LE(rig.length); rig.writeUInt32LE(0x22fd4fc3, 4);
    rig.writeUInt16LE(3, 14); rig.writeUInt32LE(2, 16); rig.writeInt32LE(64, 20); rig.writeInt32LE(364, 28);
    rig.writeInt16LE(0, 364); rig.writeInt16LE(1, 366);
    let nameAt = 368;
    names.forEach((name, i) => {
        const at = 64 + i * 100; rig.writeUInt16LE(i, at + 2); rig.writeInt16LE(i === 0 ? -1 : 0, at + 4);
        rig.writeUInt32LE(i === 0 ? 123 : 77, at + 8);
        [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1].forEach((v, k) => rig.writeFloatLE(v, at + 16 + k * 4));
        rig.writeInt32LE(nameAt - (at + 96), at + 96); rig.write(name + '\0', nameAt); nameAt += name.length + 1;
    });
    return rig;
}
function threeTrackAnm(original: Buffer, hashes: number[]) {
    const b = Buffer.alloc(118 + hashes.length * 4 + hashes.length * 12); original.copy(b, 0, 0, 118);
    b.writeUInt32LE(hashes.length, 28); b.writeUInt32LE(118 + hashes.length * 4 - 12, 60);
    hashes.forEach((h, j) => b.writeUInt32LE(h, 118 + j * 4));
    for (let f = 0; f < 2; f++) for (let j = 0; j < hashes.length; j++) b.writeUInt16LE(f + 1, 118 + hashes.length * 4 + (f * hashes.length + j) * 6);
    return b;
}
function converted() {
    const f = fixtures();
    return makeModel(f.mesh, f.rig, [{ name: 'source_idle', bytes: f.anm }], { Body: f.png });
}
describe('raw skinned GLB assembly', () => {
    it.each([0, 32, 44])('rejects nonfinite source position/normal/UV at vertex offset %s', offset => {
        for (const value of [NaN, Infinity, -Infinity, 1e39]) {
            const f = fixtures(); f.mesh.writeFloatLE(value, 158 + offset);
            expect(() => makeModel(f.mesh, f.rig, [], { Body: f.png })).toThrow('nonfinite-asset');
        }
    });
    it('rejects finite transformed positions that overflow when stored as Float32', () => {
        const f = fixtures();
        f.mesh.writeFloatLE(-3e38, 158 + 4);
        f.mesh.writeFloatLE(3e38, 158 + 52 + 4);
        expect(() => makeModel(f.mesh, f.rig, [], { Body: f.png })).toThrow('nonfinite-float32-accessor');
    });
    it('retains bind pose for ambiguous unweighted leaf locators, rejects deforming ambiguity, and clears zero-weight indices', () => {
        const f = fixtures(), rig = locatorRig(), anm = threeTrackAnm(f.anm, [123, 77, 77]);
        // Second influence points to a valid nonzero joint, but has zero weight.
        f.mesh[158 + 13] = 1;
        const result = makeModel(f.mesh, rig, [{ name: 'idle', bytes: anm }], { Body: f.png });
        const glb = readGlb(result.glb);
        expect(result.report.animations[0].bindPoseLocatorHashes).toEqual(['4d']);
        expect(glb.document.animations[0].channels).toHaveLength(3);
        expect(readAccessor(glb, glb.document.meshes[0].primitives[0].attributes.JOINTS_0)[0]).toEqual([0, 0, 0, 0]);
        expect(validateModel(result.glb).passed).toBe(true);
        f.mesh[158 + 12] = 1;
        expect(() => makeModel(f.mesh, rig, [{ name: 'idle', bytes: anm }], { Body: f.png })).toThrow('ambiguous-deforming-animation-bone');
    });
    it('reports omission of tracks whose source bone is absent from this skin rig', () => {
        const f = fixtures(), anm = threeTrackAnm(f.anm, [123, 456]);
        const result = makeModel(f.mesh, f.rig, [{ name: 'idle', bytes: anm }], { Body: f.png });
        expect(result.report.animations[0]).toMatchObject({ omittedUnboundTracks: 3, omittedBoneHashes: ['1c8'] });
        expect(readGlb(result.glb).document.animations[0].channels).toHaveLength(3);
    });

    it('reconstructs zero normals from winding, zeros unused joint indices, and omits declared hidden primitives', () => {
        const f = fixtures();
        for (let i = 0; i < 3; i++) f.mesh.fill(0, 158 + i * 52 + 32, 158 + i * 52 + 44);
        const result = makeModel(f.mesh, f.rig, [], { Body: f.png }), p = readGlb(result.glb);
        expect(readAccessor(p, p.document.meshes[0].primitives[0].attributes.NORMAL)).toEqual([[0, 0, 1], [0, 0, 1], [0, 0, 1]]);
        expect(result.report.normalRepair).toEqual({ reconstructed: 3, isolatedFallback: 0 });
        const hidden = readGlb(makeModel(f.mesh, f.rig, [], {}, { hiddenSubmeshes: ['Body'] }).glb);
        expect(hidden.document.meshes[0].primitives).toEqual([]);
    });
    it('reports foreign animation tracks and rejects a clip with no matching rig tracks', () => {
        const f = fixtures(); f.anm.writeUInt32LE(456, 118);
        expect(() => makeModel(f.mesh, f.rig, [{ name: 'foreign', bytes: f.anm }], { Body: f.png })).toThrow('animation-has-no-rig-tracks');
    });
    it('uses an explicit procedural material approximation without inventing a texture', () => {
        const f = fixtures(), factor = [0.2, 0.4, 0.6, 1];
        const p = readGlb(makeModel(f.mesh, f.rig, [], {}, { solidMaterials: { Body: { factor } } }).glb);
        expect(p.document.materials[0].pbrMetallicRoughness.baseColorFactor).toEqual(factor);
        expect(p.document.images).toEqual([]);
    });

    it.each([MAX_ANIMATION_FRAMES + 1, 1_000_000_000])('rejects a tiny compressed ANM declaring %s frames before creating the frame array', frames => {
        const f = fixtures(), anm = Buffer.alloc(128);
        anm.write('r3d2canm');
        anm.writeUInt32LE(1, 8);
        anm.writeFloatLE(frames, 36);
        anm.writeFloatLE(1, 40);
        // Zero controls/hashes: only the declaration could induce a large array.
        const original = Array.from, from = vi.spyOn(Array, 'from');
        from.mockImplementation(((input: ArrayLike<unknown>, ...rest: unknown[]) => {
            if (input.length > MAX_ANIMATION_FRAMES)
                throw new Error('unexpected-large-allocation');
            return Reflect.apply(original, Array, [input, ...rest]);
        }) as typeof Array.from);
        try {
            expect(() => makeModel(f.mesh, f.rig, [{ name: 'huge', bytes: anm }], { Body: f.png })).toThrow('animation-frame-budget');
            expect(from.mock.calls.some(([input]) => (input as ArrayLike<unknown>).length > MAX_ANIMATION_FRAMES)).toBe(false);
        }
        finally { from.mockRestore(); }
    });
    it.each([
        [{ count: 1_000_000_000 }, {}, 'accessor-elements-budget'],
        [{ count: Math.floor(MAX_ACCESSOR_ELEMENTS / 3) + 1 }, {}, 'accessor-elements-budget'],
        ...[-1, 0, 0.5, NaN, Infinity].map(count => [{ count }, {}, 'invalid-accessor-count']),
        ...[0, 8, 13, 256, 1e15].map(byteStride => [{}, { byteStride }, 'invalid-accessor-stride']),
        [{ byteOffset: -1 }, {}, 'invalid-accessor-span'],
        [{ byteOffset: 4 }, {}, 'invalid-accessor-span'],
        [{}, { byteLength: 20 }, 'invalid-accessor-span'],
        [{}, { byteOffset: 120 }, 'invalid-accessor-span'],
        [{}, { byteStride: 16, byteLength: 24 }, 'invalid-accessor-span'],
    ] as [object, object, string][])('preflights accessor count, stride and full view/binary span: %j %j', (accessor, view, reason) => {
        const parsed = { document: { accessors: [{ bufferView: 0, type: 'VEC3', componentType: 5126, count: 2, ...(accessor as object) }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 24, ...(view as object) }] }, binary: Buffer.alloc(128) };
        const from = vi.spyOn(Array, 'from').mockImplementation(() => { throw new Error('unexpected-accessor-allocation'); });
        try {
            expect(() => readAccessor(parsed, 0)).toThrow(reason as string);
            expect(from).not.toHaveBeenCalled();
        }
        finally { from.mockRestore(); }
    });
    it('accepts an interleaved accessor ending exactly at its view boundary', () => {
        const binary = Buffer.alloc(32);
        [1, 2, 3].forEach((n, k) => binary.writeFloatLE(n, 4 + k * 4));
        [4, 5, 6].forEach((n, k) => binary.writeFloatLE(n, 20 + k * 4));
        expect(readAccessor({ document: { accessors: [{ bufferView: 0, type: 'VEC3', componentType: 5126, count: 2 }], bufferViews: [{ buffer: 0, byteOffset: 4, byteLength: 28, byteStride: 16 }] }, binary }, 0)).toEqual([[1, 2, 3], [4, 5, 6]]);
    });
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

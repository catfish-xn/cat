import { Matrix4, Quaternion, Vector3 } from 'three';
import { BinaryReader, inspectSkn, inspectSkl } from './inspect-source.mjs';
import { writeGlb, readGlb } from './glb.mjs';
import { decodeAnm } from './animation.mjs';
import { assertAnimationBudget, MAX_ACCESSOR_ELEMENTS } from './animation-budget.mjs';
export { MAX_ANIMATION_FRAMES, MAX_ACCESSOR_ELEMENTS, MAX_ANIMATION_ELEMENTS } from './animation-budget.mjs';
const mirrorVector = v => [-v[0], v[1], v[2]];
const mirrorRotation = q => [q[0], -q[1], -q[2], q[3]];
const quat = q => new Quaternion(...q).normalize().toArray();
export function makeModel(skn, skl, animationSources, textures) {
    const mesh = inspectSkn(skn), rig = inspectSkl(skl), r = new BinaryReader(skn);
    const positions = [], normals = [], uv = [], joints = [], weights = [];
    const jointIndex = new Map(rig.joints.map((j, i) => [j.id, i]));
    for (let i = 0; i < mesh.vertices; i++) {
        r.seek(mesh.vertexOffset + i * mesh.stride);
        positions.push(...mirrorVector([r.f32(), r.f32(), r.f32()]));
        r.range(r.offset, 4);
        const indices = [...skn.subarray(r.offset, r.offset + 4)];
        r.skip(4);
        const w = [r.f32(), r.f32(), r.f32(), r.f32()], sum = w.reduce((s, n) => s + n, 0);
        if (w.some(n => n < 0) || sum <= 0)
            throw new Error('invalid-skin-weights');
        for (let k = 0; k < 4; k++) {
            const id = jointIndex.get(rig.influences[indices[k]]);
            if (id === undefined && w[k] > 0)
                throw new Error('invalid-skin-joint');
            joints.push(id ?? 0);
            weights.push(w[k] / sum);
        }
        normals.push(...new Vector3(...mirrorVector([r.f32(), r.f32(), r.f32()])).normalize().toArray());
        uv.push(r.f32(), r.f32());
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) {
        const k = i % 3;
        min[k] = Math.min(min[k], positions[i]);
        max[k] = Math.max(max[k], positions[i]);
    }
    const body = mesh.submeshes.find(s => s.name === 'Body'), pivotMin = [...min], pivotMax = [...max];
    if (body) {
        pivotMin.fill(Infinity);
        pivotMax.fill(-Infinity);
        for (let i = body.startVertex; i < body.startVertex + body.vertexCount; i++)
            for (let k = 0; k < 3; k++) {
                pivotMin[k] = Math.min(pivotMin[k], positions[i * 3 + k]);
                pivotMax[k] = Math.max(pivotMax[k], positions[i * 3 + k]);
            }
    }
    const offset = [-(pivotMin[0] + pivotMax[0]) / 2, -pivotMin[1], -(pivotMin[2] + pivotMax[2]) / 2];
    for (let i = 0; i < positions.length; i++)
        positions[i] += offset[i % 3];
    const roots = new Set(rig.joints.filter(j => j.parent === -1).map(j => jointIndex.get(j.id) + 1));
    const doc = { asset: { version: '2.0', generator: 'D7 pure Node SKN/SKL/ANM' }, scene: 0, scenes: [{ nodes: [0] }],
        nodes: [{ name: 'unit', mesh: 0, skin: 0, children: [...roots] }],
        meshes: [{ primitives: [] }], skins: [{ joints: rig.joints.map((_, i) => i + 1) }], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], animations: [], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] };
    const parts = [];
    let byteOffset = 0;
    function view(bytes, target) {
        const index = doc.bufferViews.length;
        doc.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...(target ? { target } : {}) });
        const pad = Buffer.alloc((4 - bytes.length % 4) % 4);
        parts.push(bytes, pad);
        byteOffset += bytes.length + pad.length;
        return index;
    }
    function accessor(values, type, componentType = 5126, target, range = false) {
        const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type], Typed = componentType === 5126 ? Float32Array : Uint16Array;
        const typed = new Typed(values), a = { bufferView: view(Buffer.from(typed.buffer), target), componentType, count: values.length / size, type };
        if (range) {
            a.min = Array.from({ length: size }, (_, k) => {
                let n = Infinity;
                for (let i = k; i < typed.length; i += size)
                    n = Math.min(n, typed[i]);
                return n;
            });
            a.max = Array.from({ length: size }, (_, k) => {
                let n = -Infinity;
                for (let i = k; i < typed.length; i += size)
                    n = Math.max(n, typed[i]);
                return n;
            });
        }
        doc.accessors.push(a);
        return doc.accessors.length - 1;
    }
    const attributes = { POSITION: accessor(positions, 'VEC3', 5126, 34962, true), NORMAL: accessor(normals, 'VEC3', 5126, 34962), TEXCOORD_0: accessor(uv, 'VEC2', 5126, 34962), JOINTS_0: accessor(joints, 'VEC4', 5123, 34962), WEIGHTS_0: accessor(weights, 'VEC4', 5126, 34962) };
    const ibm = [];
    for (const j of rig.joints) {
        const t = j.transform, rotation = quat(mirrorRotation(t.slice(6, 10))), translation = mirrorVector(t.slice(0, 3)), scale = t.slice(3, 6);
        if (j.parent === -1)
            for (let k = 0; k < 3; k++)
                translation[k] += offset[k];
        const children = rig.joints.filter(c => c.parent === j.id).map(c => jointIndex.get(c.id) + 1);
        doc.nodes.push({ name: j.name, translation, rotation, scale, ...(children.length ? { children } : {}) });
        ibm.push(...new Matrix4().compose(new Vector3(...mirrorVector(t.slice(10, 13))), new Quaternion(...quat(mirrorRotation(t.slice(16, 20)))), new Vector3(...t.slice(13, 16))).multiply(new Matrix4().makeTranslation(...offset.map(n => -n))).toArray());
    }
    doc.skins[0].inverseBindMatrices = accessor(ibm, 'MAT4');
    const embedded = new Map();
    for (const s of mesh.submeshes) {
        const png = textures[s.name];
        if (!png)
            throw new Error(`missing-material-texture:${s.name}`);
        if (!embedded.has(png)) {
            const image = doc.images.length;
            doc.images.push({ mimeType: 'image/png', bufferView: view(png) });
            doc.textures.push({ source: image, sampler: 0 });
            embedded.set(png, image);
        }
        const material = doc.materials.length;
        doc.materials.push({ name: s.name, pbrMetallicRoughness: { baseColorTexture: { index: embedded.get(png) }, metallicFactor: 0, roughnessFactor: 1 } });
        const idx = [];
        for (let i = s.startIndex; i < s.startIndex + s.indexCount; i += 3)
            idx.push(skn.readUInt16LE(mesh.indexOffset + i * 2), skn.readUInt16LE(mesh.indexOffset + (i + 2) * 2), skn.readUInt16LE(mesh.indexOffset + (i + 1) * 2));
        doc.meshes[0].primitives.push({ attributes, indices: accessor(idx, 'SCALAR', 5123, 34963), material });
    }
    const animationReport = [];
    for (const { name, bytes } of animationSources) {
        const animation = decodeAnm(bytes), step = Math.fround(1 / animation.fps), count = animation.format === 'compressed' ? Math.round(animation.duration * animation.fps) : animation.tracks[0].keys.length;
        assertAnimationBudget(count, animation.tracks.reduce((sum, track) => sum + (track.path === 'rotation' ? 4 : 3), 0));
        const times = Array.from({ length: count }, (_, i) => Math.fround(i * step)), input = accessor(times, 'SCALAR', 5126, undefined, true), channels = [], samplers = [];
        const byHash = new Map(rig.joints.map((j, i) => [j.nameHash, i + 1]));
        for (const track of animation.tracks) {
            const node = byHash.get(track.hash);
            if (node === undefined)
                throw new Error('animation-joint-not-in-rig');
            let previous;
            const values = [];
            for (const time of times) {
                let v = animation.sample(track, time);
                v = track.path === 'rotation' ? quat(mirrorRotation(v)) : track.path === 'translation' ? mirrorVector(v) : v;
                if (track.path === 'translation' && roots.has(node))
                    v = v.map((n, k) => n + offset[k]);
                if (track.path === 'rotation' && previous && v.reduce((s, n, k) => s + n * previous[k], 0) < 0)
                    v = v.map(n => -n);
                previous = v;
                values.push(...v);
            }
            const sampler = samplers.length;
            samplers.push({ input, output: accessor(values, track.path === 'rotation' ? 'VEC4' : 'VEC3'), interpolation: 'LINEAR' });
            channels.push({ sampler, target: { node, path: track.path } });
        }
        doc.animations.push({ name, channels, samplers });
        animationReport.push({ name, format: animation.format, version: animation.version, sourceDuration: animation.duration, duration: times.at(-1), frames: count });
    }
    doc.buffers[0].byteLength = byteOffset;
    return { glb: writeGlb(doc, Buffer.concat(parts)), report: { vertices: mesh.vertices, triangles: mesh.triangles, bones: rig.bones, bbox: { min: min.map((n, k) => n + offset[k]), max: max.map((n, k) => n + offset[k]), height: max[1] - min[1] }, coordinateTransform: { mirror: 'X', translation: offset, originBasis: body ? 'Body bind-mesh minimum Y and XZ bounds center (prop submeshes retained)' : 'complete bind-mesh minimum Y and XZ bounds center', scale: 1, units: 'League native', forward: '+Z', up: '+Y' }, animations: animationReport } };
}
export function readAccessor({ document: d, binary: b }, index) {
    const a = d.accessors?.[index], v = d.bufferViews?.[a?.bufferView], size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a?.type], width = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a?.componentType];
    if (!v || !size || !width)
        throw new Error('invalid-accessor');
    if (!Number.isSafeInteger(a.count) || a.count < 1)
        throw new Error('invalid-accessor-count');
    if (a.count > Math.floor(MAX_ACCESSOR_ELEMENTS / size))
        throw new Error('accessor-elements-budget');
    const packed = size * width, stride = v.byteStride ?? packed, viewOffset = v.byteOffset ?? 0, offset = a.byteOffset ?? 0;
    if (!Number.isSafeInteger(stride) || stride < packed || stride % width !== 0 ||
        (v.byteStride !== undefined && (stride > 252 || stride % 4 !== 0)))
        throw new Error('invalid-accessor-stride');
    const span = (a.count - 1) * stride + packed;
    if (v.buffer !== 0 || a.sparse || ![viewOffset, offset, v.byteLength, span].every(n => Number.isSafeInteger(n) && n >= 0) ||
        offset % width !== 0 || viewOffset % width !== 0 || offset > v.byteLength - span || viewOffset > b.length - v.byteLength)
        throw new Error('invalid-accessor-span');
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, k) => {
        const o = viewOffset + offset + i * stride + k * width;
        return a.componentType === 5126 ? b.readFloatLE(o) : b.readUIntLE(o, width);
    }));
}
/** In addition to GLB framing, check references, finite accessors, skin and time domains. */
export function validateModel(glb) {
    const parsed = readGlb(glb), d = parsed.document;
    if (d.extensionsRequired?.length)
        throw new Error('unsupported-gltf-extension');
    for (let i = 0; i < d.accessors.length; i++) {
        const values = readAccessor(parsed, i);
        if (values.flat().some(n => !Number.isFinite(n)))
            throw new Error('nonfinite-accessor');
    }
    for (const mesh of d.meshes)
        for (const p of mesh.primitives) {
            const n = d.accessors[p.attributes.POSITION].count;
            if (readAccessor(parsed, p.indices).some(([i]) => i >= n))
                throw new Error('invalid-gltf-index');
        }
    for (const a of d.animations)
        for (const c of a.channels) {
            if (!d.nodes[c.target.node] || !['rotation', 'scale', 'translation'].includes(c.target.path))
                throw new Error('invalid-animation-target');
            const s = a.samplers[c.sampler], times = readAccessor(parsed, s.input).flat();
            if (times.some((t, i) => t < 0 || (i > 0 && t <= times[i - 1])) || times.length !== d.accessors[s.output].count)
                throw new Error('invalid-animation-time');
        }
    for (const s of d.skins) {
        if (s.joints.some(i => !d.nodes[i]) || d.accessors[s.inverseBindMatrices].count !== s.joints.length)
            throw new Error('invalid-gltf-skin');
    }
    for (const i of d.images ?? [])
        if (i.mimeType !== 'image/png' || !d.bufferViews[i.bufferView])
            throw new Error('invalid-gltf-image');
    return { passed: true, accessors: d.accessors.length, animations: d.animations.length };
}

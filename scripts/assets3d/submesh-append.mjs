// Submesh append: a grafted model's appended primitives carried onto the base root's model, the base kept byte for byte.
// The graft step (submesh-graft.mjs) recompresses the whole model, which re-quantises every animation key and reorders the
// body's indices, so the unit's existing look changes slightly. This step instead takes the base model as it is (every JSON
// entry and every binary byte kept) and appends only the new primitives with their material, texture and image, decoded
// from the grafted model's meshopt views and stored uncompressed.
// The two models share a skeleton but not a mesh space: mesh quantisation folds each model's own position scale and offset
// into its inverse bind matrices. The appended positions are therefore moved from the grafted model's mesh space into the
// base's (through inverse(baseIbm) * graftedIbm, which must be one and the same transform for every joint) and stored as
// floats. Normals and the other attributes are copied as they are, so that transform may only scale uniformly and move.
// Usage: node scripts/assets3d/submesh-append.mjs <base model.glb> <grafted model.glb> <out model.glb>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MeshoptDecoder } from 'meshoptimizer';

const GLB_MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const READ = { 5120: 'readInt8', 5121: 'readUInt8', 5122: 'readInt16LE', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

function parseGlb(bytes) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.readUInt32LE(0) !== GLB_MAGIC || b.readUInt32LE(16) !== JSON_CHUNK) throw new Error('submesh-append-not-glb');
  const jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8')), o = 20 + jl;
  if (b.readUInt32LE(o + 4) !== BIN_CHUNK) throw new Error('submesh-append-no-bin');
  return { json, bin: b.subarray(o + 8, o + 8 + b.readUInt32LE(o)) };
}

/** A view's bytes as stored, its meshopt stream decoded when it has one. */
function viewBytes(glb, index) {
  const view = glb.json.bufferViews[index], meshopt = view.extensions?.EXT_meshopt_compression;
  if (!meshopt) return Buffer.from(glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  const out = new Uint8Array(meshopt.count * meshopt.byteStride);
  MeshoptDecoder.decodeGltfBuffer(out, meshopt.count, meshopt.byteStride,
    glb.bin.subarray(meshopt.byteOffset ?? 0, (meshopt.byteOffset ?? 0) + meshopt.byteLength), meshopt.mode, meshopt.filter ?? 'NONE');
  return Buffer.from(out);
}

/** An accessor's elements as stored (`raw`, with its stride) and as numbers, normalised integers taken to [-1, 1] / [0, 1]. */
function readAccessor(glb, index) {
  const accessor = glb.json.accessors[index], view = glb.json.bufferViews[accessor.bufferView];
  const all = viewBytes(glb, accessor.bufferView), size = SIZE[accessor.componentType], elem = size * COUNT[accessor.type];
  const isIndex = view.target === 34963, stride = isIndex ? elem : (view.byteStride ?? view.extensions?.EXT_meshopt_compression?.byteStride ?? elem);
  const start = accessor.byteOffset ?? 0, raw = all.subarray(start, start + (accessor.count - 1) * stride + elem);
  const values = [];
  for (let i = 0; i < accessor.count; i++) for (let c = 0; c < COUNT[accessor.type]; c++) {
    const v = raw[READ[accessor.componentType]](i * stride + c * size);
    values.push(accessor.normalized ? Math.max(v / NORM[accessor.componentType], -1) : v);
  }
  return { accessor, raw: Buffer.from(raw), stride, elem, values, isIndex };
}

/** Column-major 4 × 4 product. */
const multiply = (a, b) => { const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return out; };
/** Inverse of a column-major affine 4 × 4. */
function invert(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m, det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  if (Math.abs(det) < 1e-12) throw new Error('submesh-append-singular-ibm');
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, 0, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, 0,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det, 0, 0, 0, 0, 1];
  for (let row = 0; row < 3; row++) r[12 + row] = -(r[row] * m[12] + r[4 + row] * m[13] + r[8 + row] * m[14]);
  return r;
}

/**
 * The transform from the grafted model's mesh space into the base's, read off the two skins' inverse bind matrices. It
 * must be the same for every joint (both are one skeleton) and only scale uniformly and move, so normals carry over.
 */
export function meshSpaceTransform(baseIbm, graftedIbm, tolerance = 1e-4) {
  if (baseIbm.length !== graftedIbm.length || baseIbm.length % 16 || !baseIbm.length) throw new Error('submesh-append-skin-mismatch');
  let first = null;
  for (let j = 0; j < baseIbm.length; j += 16) {
    const k = multiply(invert(baseIbm.slice(j, j + 16)), graftedIbm.slice(j, j + 16));
    first ??= k;
    const scale = Math.max(...first.map(Math.abs), 1);
    if (k.some((v, i) => Math.abs(v - first[i]) > tolerance * scale)) throw new Error('submesh-append-ibm-disagree');
  }
  const s = first[0];
  if ([first[5], first[10]].some(v => Math.abs(v - s) > tolerance * Math.abs(s)) || [1, 2, 4, 6, 8, 9].some(i => Math.abs(first[i]) > tolerance * Math.abs(s)))
    throw new Error('submesh-append-not-uniform-scale');
  return first;
}

/** The base model with the grafted model's primitives past its first appended (see the file comment). Await MeshoptDecoder.ready first. */
export function appendSubmeshes(baseBytes, graftedBytes) {
  const A = parseGlb(baseBytes), B = parseGlb(graftedBytes), J = structuredClone(A.json);
  if (A.json.meshes?.length !== 1 || B.json.meshes?.length !== 1 || A.json.meshes[0].primitives.length !== 1 || B.json.meshes[0].primitives.length < 2
    || A.json.skins?.length !== 1 || B.json.skins?.length !== 1) throw new Error('submesh-append-unsupported-model');
  const ibm = glb => readAccessor(glb, glb.json.skins[0].inverseBindMatrices).values;
  const toBase = meshSpaceTransform(ibm(A), ibm(B));
  let bin = Buffer.from(A.bin.subarray(0, A.json.buffers[0].byteLength));
  const pad4 = () => { if (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]); };
  const addView = (bytes, extra) => { pad4(); J.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length, ...extra }); bin = Buffer.concat([bin, bytes]); return J.bufferViews.length - 1; };
  const copyAccessor = index => {
    const { accessor, raw, stride, elem, isIndex } = readAccessor(B, index);
    const view = addView(raw, isIndex ? { target: 34963 } : { target: 34962, ...(stride !== elem ? { byteStride: stride } : {}) });
    const { bufferView, byteOffset, ...rest } = accessor; J.accessors.push({ ...rest, bufferView: view, byteOffset: 0 }); return J.accessors.length - 1;
  };
  const movedPositions = index => {
    const { accessor, values } = readAccessor(B, index), out = Buffer.alloc(accessor.count * 12);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < accessor.count; i++) {
      const [x, y, z] = values.slice(i * 3, i * 3 + 3);
      for (let r = 0; r < 3; r++) {
        const v = Math.fround(toBase[r] * x + toBase[4 + r] * y + toBase[8 + r] * z + toBase[12 + r]);
        out.writeFloatLE(v, i * 12 + r * 4); min[r] = Math.min(min[r], v); max[r] = Math.max(max[r], v);
      }
    }
    J.accessors.push({ type: 'VEC3', componentType: 5126, count: accessor.count, min, max, bufferView: addView(out, { target: 34962 }), byteOffset: 0 });
    return J.accessors.length - 1;
  };
  for (const prim of B.json.meshes[0].primitives.slice(1)) {
    if (prim.targets || prim.extensions || (prim.mode ?? 4) !== 4) throw new Error('submesh-append-unsupported-primitive');
    const material = B.json.materials[prim.material], texture = B.json.textures?.[material.pbrMetallicRoughness?.baseColorTexture?.index];
    if (!texture?.extensions?.KHR_texture_basisu || texture.sampler === undefined
      || JSON.stringify(B.json.samplers?.[texture.sampler]) !== JSON.stringify(A.json.samplers?.[texture.sampler])) throw new Error('submesh-append-unsupported-texture');
    const attributes = Object.fromEntries(Object.entries(prim.attributes).map(([name, index]) => [name, name === 'POSITION' ? movedPositions(index) : copyAccessor(index)]));
    const indices = copyAccessor(prim.indices);
    const image = B.json.images[texture.extensions.KHR_texture_basisu.source];
    J.images.push({ ...image, bufferView: addView(viewBytes(B, image.bufferView), {}) });
    J.textures.push({ ...texture, extensions: { KHR_texture_basisu: { source: J.images.length - 1 } } });
    J.materials.push({ ...material, pbrMetallicRoughness: { ...material.pbrMetallicRoughness, baseColorTexture: { ...material.pbrMetallicRoughness.baseColorTexture, index: J.textures.length - 1 } } });
    J.meshes[0].primitives.push({ ...prim, attributes, indices, material: J.materials.length - 1 });
  }
  pad4(); J.buffers[0].byteLength = bin.length;
  let json = Buffer.from(JSON.stringify(J), 'utf8'); if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(GLB_MAGIC, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
  const chunk = (length, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(length, 0); c.writeUInt32LE(type, 4); return c; };
  return new Uint8Array(Buffer.concat([header, chunk(json.length, JSON_CHUNK), json, chunk(bin.length, BIN_CHUNK), bin]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, grafted, out] = process.argv.slice(2);
  if (!base || !grafted || !out) { console.error('usage: submesh-append.mjs <base model.glb> <grafted model.glb> <out model.glb>'); process.exit(2); }
  await MeshoptDecoder.ready;
  writeFileSync(out, appendSubmeshes(readFileSync(base), readFileSync(grafted)));
  console.log('wrote', out);
}

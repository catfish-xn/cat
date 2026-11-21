// Submesh append: a grafted model's appended primitives carried onto the base root's model byte for byte.
// The graft step (submesh-graft.mjs) recompresses the whole model, which re-quantises every animation key and reorders the
// body's indices, so the unit's existing look changes slightly. This step instead takes the base model as it is (its JSON
// entries and binary bytes untouched) and appends only the new primitives, their material, texture and image from the
// grafted model, decoded from its meshopt views and stored uncompressed. Usage:
//   node scripts/assets3d/submesh-append.mjs <base model.glb> <grafted model.glb> <out model.glb>
// Only a single-mesh model whose base has one primitive is supported; the appended primitives keep the grafted model's
// accessors (quantised in the same mesh space, since the graft keeps the base's nodes and skin).
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const [aPath, bPath, outPath] = process.argv.slice(2);
const parse = p => { const b = readFileSync(p); const jl = b.readUInt32LE(12); const J = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const o = 20 + jl; const bl = b.readUInt32LE(o); if (b.readUInt32LE(o + 4) !== 0x004e4942) throw new Error('no BIN'); return { J, bin: b.subarray(o + 8, o + 8 + bl) }; };
const A = parse(aPath), B = parse(bPath);
const viewBytes = (G, i) => { const v = G.J.bufferViews[i], m = v.extensions?.EXT_meshopt_compression;
  if (!m) return Buffer.from(G.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  const out = new Uint8Array(m.count * m.byteStride); const src = G.bin.subarray(m.byteOffset ?? 0, (m.byteOffset ?? 0) + m.byteLength);
  MeshoptDecoder.decodeGltfBuffer(out, m.count, m.byteStride, src, m.mode, m.filter ?? 'NONE'); return Buffer.from(out); };
const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
if (A.J.meshes.length !== 1 || B.J.meshes.length !== 1 || A.J.meshes[0].primitives.length !== 1 || B.J.meshes[0].primitives.length < 2) throw new Error('submesh-append-unsupported-model');
const added = B.J.meshes[0].primitives.slice(1);
let bin = Buffer.from(A.bin.subarray(0, A.J.buffers[0].byteLength)); const pad4 = () => { while (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(1)]); };
const J = A.J; const addView = (bytes, extra) => { pad4(); const view = { buffer: 0, byteOffset: bin.length, byteLength: bytes.length, ...extra }; bin = Buffer.concat([bin, bytes]); J.bufferViews.push(view); return J.bufferViews.length - 1; };
const copyAccessor = i => { const a = B.J.accessors[i], v = B.J.bufferViews[a.bufferView], all = viewBytes(B, a.bufferView);
  const stride = v.byteStride ?? v.extensions?.EXT_meshopt_compression?.byteStride, elem = SIZE[a.componentType] * N[a.type];
  const isIndex = v.target === 34963, s = isIndex ? elem : stride, off = a.byteOffset ?? 0;
  const bytes = all.subarray(off, off + (a.count - 1) * s + elem);
  const view = addView(Buffer.from(bytes), isIndex ? { target: 34963 } : { target: 34962, ...(s !== elem ? { byteStride: s } : {}) });
  const { bufferView, byteOffset, ...rest } = a; J.accessors.push({ ...rest, bufferView: view, byteOffset: 0 }); return J.accessors.length - 1; };
for (const prim of added) {
  const material = B.J.materials[prim.material], texture = B.J.textures[material.pbrMetallicRoughness.baseColorTexture.index];
  const attributes = Object.fromEntries(Object.entries(prim.attributes).map(([k, i]) => [k, copyAccessor(i)]));
  const indices = copyAccessor(prim.indices);
  const image = B.J.images[texture.extensions.KHR_texture_basisu.source];
  J.images.push({ ...image, bufferView: addView(viewBytes(B, image.bufferView), {}) });
  J.textures.push({ ...texture, extensions: { KHR_texture_basisu: { source: J.images.length - 1 } } });
  J.materials.push({ ...material, pbrMetallicRoughness: { ...material.pbrMetallicRoughness,
    baseColorTexture: { ...material.pbrMetallicRoughness.baseColorTexture, index: J.textures.length - 1 } } });
  J.meshes[0].primitives.push({ ...prim, attributes, indices, material: J.materials.length - 1 });
}
pad4(); J.buffers[0].byteLength = bin.length;
let json = Buffer.from(JSON.stringify(J), 'utf8'); while (json.length % 4) json = Buffer.concat([json, Buffer.from(' ')]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
writeFileSync(outPath, Buffer.concat([header, ch(json.length, 0x4e4f534a), json, ch(bin.length, 0x004e4942), bin]));
console.log('wrote', outPath, 'accessors', J.accessors.length, 'bufferViews', J.bufferViews.length, 'bin', bin.length);

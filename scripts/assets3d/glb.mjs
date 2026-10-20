// Self-contained GLB preparation. No network or third-party executables.
const JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
function check(condition, message) { if (!condition) throw new Error(message); }
export function readGlb(bytes) {
  check(Buffer.isBuffer(bytes) && bytes.length >= 28, 'invalid-glb-header');
  check(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, 'unsupported-glb');
  check(bytes.readUInt32LE(8) === bytes.length, 'invalid-glb-length');
  const chunks = []; let offset = 12;
  while (offset < bytes.length) {
    check(offset + 8 <= bytes.length, 'truncated-glb-chunk');
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    check(size % 4 === 0 && size <= bytes.length - offset - 8, 'invalid-glb-chunk');
    chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + size) }); offset += 8 + size;
  }
  check(chunks.length === 2 && chunks[0].type === JSON_CHUNK && chunks[1].type === BIN_CHUNK, 'unsupported-glb-chunks');
  const document = JSON.parse(chunks[0].bytes.toString('utf8'));
  check(document.asset?.version === '2.0' && document.buffers?.length === 1, 'unsupported-gltf');
  const length = document.buffers[0].byteLength;
  check(Number.isSafeInteger(length) && length >= 0 && length <= chunks[1].bytes.length
    && chunks[1].bytes.length - length <= 3 && !document.buffers[0].uri, 'invalid-glb-buffer');
  for (const image of document.images ?? []) check(!image.uri, 'external-glb-image');
  for (const view of document.bufferViews ?? []) {
    const start = view.byteOffset ?? 0;
    check(view.buffer === 0 && Number.isSafeInteger(start) && start >= 0 && Number.isSafeInteger(view.byteLength)
      && view.byteLength >= 0 && start + view.byteLength <= length, 'invalid-glb-buffer-view');
  }
  return { document, binary: chunks[1].bytes.subarray(0, length) };
}
export function writeGlb(document, binary) {
  const json = Buffer.from(JSON.stringify(document)), jsonPad = Buffer.alloc((4 - json.length % 4) % 4, 32);
  const binPad = Buffer.alloc((4 - binary.length % 4) % 4), header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + jsonPad.length + binary.length + binPad.length, 8);
  header.writeUInt32LE(json.length + jsonPad.length, 12); header.writeUInt32LE(JSON_CHUNK, 16);
  binHeader.writeUInt32LE(binary.length + binPad.length); binHeader.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([header, json, jsonPad, binHeader, binary, binPad]);
}
/** Add an embedded diffuse image without touching any geometry/skin/animation bytes. */
export function embedDiffuse(glb, png) {
  check(png.length >= 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'invalid-png');
  const { document: doc, binary } = readGlb(glb);
  check((doc.materials?.length ?? 0) > 0, 'missing-material');
  const alignment = Buffer.alloc((4 - binary.length % 4) % 4), offset = binary.length + alignment.length;
  const view = doc.bufferViews.length;
  doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: png.length });
  const image = (doc.images ??= []).length;
  doc.images.push({ bufferView: view, mimeType: 'image/png' });
  const sampler = (doc.samplers ??= []).length;
  doc.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
  const texture = (doc.textures ??= []).length;
  doc.textures.push({ source: image, sampler });
  for (const material of doc.materials) {
    material.pbrMetallicRoughness = { ...material.pbrMetallicRoughness,
      baseColorTexture: { index: texture }, metallicFactor: 0, roughnessFactor: 1 };
  }
  const output = Buffer.concat([binary, alignment, png]); doc.buffers[0].byteLength = output.length;
  return writeGlb(doc, output);
}
export function summarizeGlb(glb) {
  const { document: doc } = readGlb(glb);
  const positions = new Set(); let triangles = 0;
  for (const mesh of doc.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    check((primitive.mode ?? 4) === 4, 'unsupported-primitive-mode');
    const position = primitive.attributes?.POSITION, accessor = doc.accessors?.[position];
    check(accessor?.type === 'VEC3' && Number.isSafeInteger(accessor.count) && accessor.count >= 0, 'invalid-position-accessor');
    positions.add(position);
    const count = primitive.indices === undefined ? accessor.count : doc.accessors?.[primitive.indices]?.count;
    check(Number.isSafeInteger(count) && count >= 0 && count % 3 === 0, 'invalid-triangle-count'); triangles += count / 3;
  }
  return { vertices: [...positions].reduce((n, i) => n + doc.accessors[i].count, 0), triangles,
    bones: (doc.skins ?? []).reduce((n, s) => n + s.joints.length, 0),
    animations: (doc.animations ?? []).map(a => a.name), textures: doc.images?.length ?? 0, bytes: glb.length };
}

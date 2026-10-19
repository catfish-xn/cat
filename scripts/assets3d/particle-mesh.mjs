import { writeGlb } from './glb.mjs';

export const MESH_LIMITS = Object.freeze({ maxBytes: 16 * 1024 * 1024, maxVertices: 100000, maxFaces: 100000,
  maxOutputBytes: 32 * 1024 * 1024 });
function check(ok, message) { if (!ok) throw new Error(message); }
function budgetCount(n, max) { check(Number.isSafeInteger(n) && n > 0 && n <= max, 'mesh-count-budget'); }
function readScb(b, limits) {
  let at = 0;
  function need(n) { check(at <= b.length - n, 'mesh-truncated'); }
  function u32() { need(4); const v = b.readUInt32LE(at); at += 4; return v; }
  function floats(n) { need(n * 4); const v = Array.from({ length: n }, (_, i) => b.readFloatLE(at + i * 4)); at += n * 4;
    check(v.every(Number.isFinite), 'mesh-nonfinite'); return v; }
  need(152); check(b.toString('ascii', 0, 8) === 'r3d2Mesh', 'unsupported-scb-magic');
  const major = b.readUInt16LE(8), minor = b.readUInt16LE(10);
  check([2, 3].includes(major) && minor === 2, 'unsupported-scb-version');
  at = 140; const nv = u32(), nf = u32(), flags = u32();
  budgetCount(nv, limits.maxVertices); budgetCount(nf, limits.maxFaces);
  // Vertex colors and unrecognized flags have no particle GLB material equivalent.
  check(flags === 0 || flags === 2, 'unsupported-scb-flags');
  floats(6); // file bounding box; recompute from actual output vertices
  if (major === 3) check(u32() === 0, 'unsupported-scb-vertex-colors');
  check(b.length === at + nv * 12 + 12 + nf * 100, 'invalid-scb-length');
  const vertices = Array.from({ length: nv }, () => floats(3));
  check(floats(3).every(v => v === 0), 'unsupported-mesh-pivot');
  const faces = [];
  for (let i = 0; i < nf; i++) {
    const indices = [u32(), u32(), u32()];
    need(64); at += 64; // source material name is replaced by emitter material
    const uv = floats(6); faces.push({ indices, uv: [0, 1, 2].map(j => [uv[j], uv[j + 3]]) });
  }
  return { vertices, faces };
}
function readSco(b, limits) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(b);
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let at = 0;
  const line = () => { check(at < lines.length, 'mesh-truncated'); return lines[at++]; };
  const numbers = (s, n) => { const v = s.trim().split(/\s+/).map(Number); check(v.length === n && v.every(Number.isFinite), 'invalid-sco-number'); return v; };
  check(line() === '[ObjectBegin]', 'unsupported-sco-magic');
  check(/^Name\s*=/.test(line()), 'invalid-sco-name');
  const center = line().match(/^CentralPoint\s*=\s*(.*)$/);
  check(center && numbers(center[1], 3).every(v => v === 0), 'unsupported-mesh-pivot');
  const n = line().match(/^Verts\s*=\s*(\d+)$/); check(n, 'invalid-sco-vertices');
  const nv = Number(n[1]); budgetCount(nv, limits.maxVertices);
  const vertices = Array.from({ length: nv }, () => numbers(line(), 3));
  const f = line().match(/^Faces\s*=\s*(\d+)$/); check(f, 'invalid-sco-faces');
  const nf = Number(f[1]); budgetCount(nf, limits.maxFaces);
  const faces = Array.from({ length: nf }, () => {
    const v = line().split(/\s+/); check(v.length === 11 && v[0] === '3', 'unsupported-sco-face');
    const uv = numbers(v.slice(5).join(' '), 6);
    return { indices: v.slice(1, 4).map(Number), uv: [0, 1, 2].map(j => uv.slice(j * 2, j * 2 + 2)) };
  });
  check(line() === '[ObjectEnd]' && at === lines.length, 'invalid-sco-tail');
  return { vertices, faces };
}
/** Bounded static, UV-bearing triangle mesh. No skinning/material approximation.
 * Reflect X and reverse winding exactly as the model pipeline. UVs are unchanged. */
export function convertParticleMesh(bytes, extension, options = {}) {
  const limits = { ...MESH_LIMITS, ...options };
  check(Object.values(limits).every(v => Number.isSafeInteger(v) && v >= 0), 'invalid-mesh-budget');
  check(Buffer.isBuffer(bytes) && bytes.length <= limits.maxBytes, 'mesh-byte-budget');
  check(['.scb', '.sco'].includes(extension.toLowerCase()), 'unsupported-mesh-extension');
  const { vertices, faces } = extension.toLowerCase() === '.scb' ? readScb(bytes, limits) : readSco(bytes, limits);
  // Deindex to preserve per-face UV seams. Check before allocating output buffers.
  const count = faces.length * 3, length = count * 20;
  check(length + 4096 <= limits.maxOutputBytes, 'mesh-output-budget');
  const positions = Buffer.alloc(count * 12), texcoords = Buffer.alloc(count * 8);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let index = 0;
  for (const face of faces) for (const j of [0, 2, 1]) {
    const vi = face.indices[j]; check(Number.isSafeInteger(vi) && vi >= 0 && vi < vertices.length, 'invalid-mesh-index');
    const p = [-vertices[vi][0], vertices[vi][1], vertices[vi][2]], uv = face.uv[j];
    p.forEach((v, k) => { positions.writeFloatLE(v, index * 12 + k * 4); min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); });
    uv.forEach((v, k) => texcoords.writeFloatLE(v, index * 8 + k * 4)); index++;
  }
  const doc = { asset: { version: '2.0', generator: 'assets3d-static-particle-mesh' }, scene: 0,
    scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, mode: 4 }] }],
    buffers: [{ byteLength: length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: texcoords.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count, type: 'VEC2' }] };
  const glb = writeGlb(doc, Buffer.concat([positions, texcoords]));
  check(glb.length <= limits.maxOutputBytes, 'mesh-output-budget');
  return { glb, report: { vertices: count, triangles: faces.length, sourceVertices: vertices.length, bytes: glb.length } };
}

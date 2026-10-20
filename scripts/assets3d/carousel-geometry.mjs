import { writeGlb } from './glb.mjs';

const check = (ok, reason) => { if (!ok) throw new Error(reason); };
/** Bounded MAPG v17 profile, derived from the cached 14.24 S13 carousel.
 * Reject other layouts instead of scanning arbitrary binary for geometry.
 * Spatial acceleration/nav/light grids after the mesh table are not geometry. */
export function readCarouselGeometry(b) {
  check(Buffer.isBuffer(b) && b.length <= 32 * 1024 * 1024, 'mapgeo-byte-budget');
  let at = 0;
  const need = n => check(n >= 0 && at + n <= b.length, 'mapgeo-truncated');
  const u8 = () => { need(1); return b[at++]; };
  const u = () => { need(4); const v = b.readUInt32LE(at); at += 4; return v; };
  const f = () => { need(4); const v = b.readFloatLE(at); at += 4; check(Number.isFinite(v), 'mapgeo-nonfinite'); return v; };
  const count = max => { const n = u(); check(n <= max, 'mapgeo-count-budget'); return n; };
  const str = () => { const n = count(4096); need(n); const s = b.toString('utf8', at, at + n); at += n; check(!s.includes('\0'), 'mapgeo-string'); return s; };
  check(u() === 0x4d47454f && u() === 17, 'unsupported-carousel-mapgeo');
  const channels = Array.from({ length: count(4) }, () => ({ channel: u(), name: str() }));
  const declarations = Array.from({ length: count(32) }, () => {
    check(u() === 0, 'mapgeo-declaration-stream'); const n = count(15);
    const elements = Array.from({ length: 15 }, () => ({ usage: u(), format: u() })).slice(0, n);
    let stride = 0;
    for (const e of elements) {
      check([2, 7, 8].includes(e.format), 'mapgeo-vertex-format');
      e.offset = stride; stride += ({ 2: 12, 7: 4, 8: 8 })[e.format];
    }
    return { elements, stride };
  });
  const buffers = () => Array.from({ length: count(128) }, () => {
    const visibility = u8(), n = count(16 * 1024 * 1024); need(n);
    const bytes = b.subarray(at, at + n); at += n; return { visibility, bytes };
  });
  const vertexBuffers = buffers(), indexBuffers = buffers();
  const meshes = Array.from({ length: count(128) }, (_, id) => {
    const vertexCount = count(100000); check(u() === 1, 'mapgeo-multistream');
    const declaration = declarations[u()], vb = vertexBuffers[u()], indexCount = count(300000), ib = indexBuffers[u()];
    check(declaration && vb && ib && vertexCount > 0 && indexCount > 0 && indexCount % 3 === 0, 'mapgeo-buffer-reference');
    check(vb.bytes.length === vertexCount * declaration.stride && ib.bytes.length === indexCount * 2, 'mapgeo-buffer-size');
    const visibility = u8(), flags = u();
    const ranges = Array.from({ length: count(128) }, () => {
      const hash = u(), material = str(), start = u(), count = u(), min = u(), max = u();
      check(start + count <= indexCount && start % 3 === 0 && count % 3 === 0 && min <= max && max < vertexCount, 'mapgeo-index-range');
      return { hash, material, start, count, min, max };
    });
    const flip = u8(); check(flip <= 1, 'mapgeo-flip-flag');
    const bbox = Array.from({ length: 6 }, f), matrix = Array.from({ length: 16 }, f), renderFlags = u();
    check(matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1, 'mapgeo-nonaffine');
    const baked = Array.from({ length: 3 }, () => ({ path: str(), scaleBias: Array.from({ length: 4 }, f) }));
    const position = declaration.elements.find(e => e.usage === 0 && e.format === 2);
    const uv = declaration.elements.find(e => e.usage === 7 && e.format === 7);
    check(position && uv && ranges.length > 0, 'mapgeo-missing-attributes');
    const vertices = Array.from({ length: vertexCount }, (_, i) => {
      const offset = i * declaration.stride;
      const p = [0, 1, 2].map(k => vb.bytes.readFloatLE(offset + position.offset + k * 4));
      const texcoord = [0, 1].map(k => halfFloat(vb.bytes.readUInt16LE(offset + uv.offset + k * 2)));
      check([...p, ...texcoord].every(Number.isFinite), 'mapgeo-nonfinite-vertex');
      return { p, uv: texcoord };
    });
    const indices = Array.from({ length: indexCount }, (_, i) => ib.bytes.readUInt16LE(i * 2));
    check(indices.every(i => i < vertexCount), 'mapgeo-index-out-of-bounds');
    for (const r of ranges) check(indices.slice(r.start, r.start + r.count).every(i => i >= r.min && i <= r.max), 'mapgeo-range-bounds');
    return { id, vertices, indices, ranges, bbox, matrix, visibility, flags, flip, renderFlags, baked };
  });
  return { version: 17, channels, meshes, meshTableEnd: at, ignoredSpatialBytes: b.length - at };
}

export function halfFloat(h) {
  const sign = h & 0x8000 ? -1 : 1, e = h >>> 10 & 31, m = h & 1023;
  return sign * (e === 31 ? m ? NaN : Infinity : e === 0 ? m * 2 ** -24 : (1 + m / 1024) * 2 ** (e - 15));
}

/** Source affine transform, then recenter and reflect X, matching the model pipeline. */
export function carouselPoint(p, matrix, origin = [7500, 0, 7500]) {
  const world = [0, 1, 2].map(k => matrix[k] * p[0] + matrix[4 + k] * p[1] + matrix[8 + k] * p[2] + matrix[12 + k] - origin[k]);
  return [-world[0], world[1], world[2]].map(v => v === 0 ? 0 : v);
}

/** One baked material range per GLB; embedded diffuse, deliberately unlit.
 * No shader/parallax/reflection equivalence is implied. */
export function carouselRangeGlb(mesh, range, png, { origin = [7500, 0, 7500], opacity = 1 } = {}) {
  check(opacity > 0 && opacity <= 1, 'invalid-carousel-opacity');
  check(png?.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'invalid-carousel-png');
  const ids = mesh.indices.slice(range.start, range.start + range.count);
  const n = ids.length, positions = Buffer.alloc(n * 12), uv = Buffer.alloc(n * 8);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const j = i - i % 3 + [0, 2, 1][i % 3], v = mesh.vertices[ids[j]], p = carouselPoint(v.p, mesh.matrix, origin);
    check([...p, ...v.uv].every(Number.isFinite), 'carousel-output-nonfinite');
    p.forEach((x, k) => { check(Number.isFinite(Math.fround(x)), 'carousel-output-overflow'); positions.writeFloatLE(x, i * 12 + k * 4); min[k] = Math.min(min[k], x); max[k] = Math.max(max[k], x); });
    v.uv.forEach((x, k) => uv.writeFloatLE(x, i * 8 + k * 4));
  }
  const offset = positions.length + uv.length, binary = Buffer.concat([positions, uv, png]);
  const material = { name: range.material, doubleSided: true, extensions: { KHR_materials_unlit: {} },
    pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [1, 1, 1, opacity], metallicFactor: 0, roughnessFactor: 1 },
    ...(opacity < 1 ? { alphaMode: 'BLEND' } : {}) };
  const doc = { asset: { version: '2.0', generator: 'assets3d-carousel-v17' }, extensionsUsed: ['KHR_materials_unlit'], scene: 0,
    scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0, mode: 4 }] }],
    buffers: [{ byteLength: binary.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: uv.length }, { buffer: 0, byteOffset: offset, byteLength: png.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: n, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5126, count: n, type: 'VEC2' }],
    materials: [material], images: [{ bufferView: 2, mimeType: 'image/png' }], textures: [{ source: 0, sampler: 0 }], samplers: [{ wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987 }] };
  return { glb: writeGlb(doc, binary), bounds: { min, max }, triangles: n / 3 };
}

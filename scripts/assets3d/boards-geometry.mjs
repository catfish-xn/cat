import { writeGlb, readGlb } from './glb.mjs';
import { carouselRangeGlb } from './carousel-geometry.mjs';
import { boardAlphaMaterials } from './boards-materials.mjs';

const check = (ok, reason) => { if (!ok) throw new Error(reason); };
/** Bounded MAPG v13/v17 profiles, with split vertex streams and colour data.
 * Reject other layouts instead of scanning arbitrary binary for geometry.
 * Spatial acceleration/nav/light grids after the mesh table are not geometry. */
export function readBoardGeometry(b) {
  check(Buffer.isBuffer(b) && b.length <= 32 * 1024 * 1024, 'mapgeo-byte-budget');
  let at = 0;
  const need = n => check(n >= 0 && at + n <= b.length, 'mapgeo-truncated');
  const u8 = () => { need(1); return b[at++]; };
  const u = () => { need(4); const v = b.readUInt32LE(at); at += 4; return v; };
  const f = () => { need(4); const v = b.readFloatLE(at); at += 4; check(Number.isFinite(v), 'mapgeo-nonfinite'); return v; };
  const count = max => { const n = u(); check(n <= max, `mapgeo-count-budget:${at - 4}:${n}:${max}`); return n; };
  const str = () => { const n = count(4096); need(n); const s = b.toString('utf8', at, at + n); at += n; check(!s.includes('\0'), 'mapgeo-string'); return s; };
  check(u() === 0x4d47454f, 'unsupported-board-mapgeo');
  const version = u(); check([13, 17].includes(version), 'unsupported-board-mapgeo-version');
  const channels = version === 17 ? Array.from({ length: count(4) }, () => ({ channel: u(), name: str() })) : [{ channel: 0, name: str() }, { channel: 1, name: str() }];
  const declarations = Array.from({ length: count(32) }, () => {
    check(u() === 0, 'mapgeo-declaration-stream'); const n = count(15);
    const elements = Array.from({ length: 15 }, () => ({ usage: u(), format: u() })).slice(0, n);
    let stride = 0;
    for (const e of elements) {
      check([2, 4, 7, 8].includes(e.format), 'mapgeo-vertex-format');
      e.offset = stride; stride += ({ 2: 12, 4: 4, 7: 4, 8: 8 })[e.format];
    }
    return { elements, stride };
  });
  const buffers = () => Array.from({ length: count(1024) }, () => {
    const visibility = u8(), n = count(16 * 1024 * 1024); need(n);
    const bytes = b.subarray(at, at + n); at += n; return { visibility, bytes };
  });
  const vertexBuffers = buffers(), indexBuffers = buffers();
  const meshes = Array.from({ length: count(1024) }, (_, id) => {
    const vertexCount = count(100000), streams = count(8), declarationId = u();
    const vertexBufferIds = Array.from({length: streams}, u);
    const vertexStreams = vertexBufferIds.map((id,i)=>({declaration:declarations[declarationId+i],vb:vertexBuffers[id]}));
    const indexCount = count(300000), ib = indexBuffers[u()];
    check(streams > 0 && vertexStreams.every(s=>s.declaration && s.vb) && ib && vertexCount > 0 && indexCount > 0 && indexCount % 3 === 0, 'mapgeo-buffer-reference');
    check(vertexStreams.every(s=>s.vb.bytes.length === vertexCount*s.declaration.stride) && ib.bytes.length === indexCount * 2, 'mapgeo-buffer-size');
    const visibility = u8(), flags = version >= 17 ? u() : 0;
    const ranges = Array.from({ length: count(128) }, () => {
      const hash = u(), material = str(), start = u(), count = u(), min = u(), max = u();
      check(start + count <= indexCount && start % 3 === 0 && count % 3 === 0 && min <= max && max < vertexCount, 'mapgeo-index-range');
      return { hash, material, start, count, min, max };
    });
    const flip = u8(); check(flip <= 1, 'mapgeo-flip-flag');
    const bbox = Array.from({ length: 6 }, f), matrix = Array.from({ length: 16 }, f);
    let renderFlags;
    if (version >= 17) renderFlags = u();
    else { need(2); renderFlags = b.readUInt16LE(at); at += 2; }
    check(matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1, `mapgeo-nonaffine:${at}:${JSON.stringify({bbox,matrix,ranges})}`);
    const baked = Array.from({ length: 3 }, () => ({ path: str(), scaleBias: Array.from({ length: 4 }, f) }));
    const attributes = vertexStreams.flatMap(s=>s.declaration.elements.map(e=>({...e,vb:s.vb,stride:s.declaration.stride})));
    const position = attributes.find(e => e.usage === 0 && e.format === 2);
    const uv = attributes.find(e => e.usage === 7 && e.format === 7);
    const color = attributes.find(e=>e.usage === 4 && e.format === 4);
    check(position && uv && ranges.length > 0, 'mapgeo-missing-attributes');
    const vertices = Array.from({ length: vertexCount }, (_, i) => {
      const p = [0, 1, 2].map(k => position.vb.bytes.readFloatLE(i*position.stride + position.offset + k * 4));
      const texcoord = [0, 1].map(k => halfFloat(uv.vb.bytes.readUInt16LE(i*uv.stride + uv.offset + k * 2)));
      check([...p, ...texcoord].every(Number.isFinite), 'mapgeo-nonfinite-vertex');
      return { p, uv: texcoord, ...(color?{color:[2,1,0,3].map(k=>color.vb.bytes[i*color.stride+color.offset+k]/255)}:{}) };
    });
    const indices = Array.from({ length: indexCount }, (_, i) => ib.bytes.readUInt16LE(i * 2));
    check(indices.every(i => i < vertexCount), 'mapgeo-index-out-of-bounds');
    for (const r of ranges) check(indices.slice(r.start, r.start + r.count).every(i => i >= r.min && i <= r.max), 'mapgeo-range-bounds');
    return { id, vertices, indices, ranges, bbox, matrix, visibility, flags, flip, renderFlags, baked };
  });
  return { version, channels, meshes, meshTableEnd: at, ignoredSpatialBytes: b.length - at };
}

export function boardRangeGlb(mesh,range,png,options){
  const converted=carouselRangeGlb(mesh,range,png,options);
  const {document:d,binary:b}=readGlb(converted.glb),ids=mesh.indices.slice(range.start,range.start+range.count),colors=Buffer.alloc(ids.length*16);
  boardAlphaMaterials(d,b);
  if(!mesh.vertices.some(v=>v.color))return {...converted,glb:writeGlb(d,b)};
  ids.forEach((_,i)=>{const j=i-i%3+[0,2,1][i%3],c=mesh.vertices[ids[j]].color??[1,1,1,1];c.forEach((v,k)=>colors.writeFloatLE(v,i*16+k*4));});
  const pad=Buffer.alloc((4-b.length%4)%4),offset=b.length+pad.length;
  d.bufferViews.push({buffer:0,byteOffset:offset,byteLength:colors.length});
  d.accessors.push({bufferView:d.bufferViews.length-1,componentType:5126,count:ids.length,type:'VEC4'});
  // The source shader uses these channels as deformation/material masks.
  // Retain the attribute without silently treating it as a glTF colour tint.
  d.meshes[0].primitives[0].attributes._SOURCE_COLOR=d.accessors.length-1;
  d.buffers[0].byteLength=offset+colors.length;
  d.asset.extras={boardBgraCorrected:true};
  return {...converted,glb:writeGlb(d,Buffer.concat([b,pad,colors]))};
}

function halfFloat(h) {
  const sign = h & 0x8000 ? -1 : 1, e = h >>> 10 & 31, m = h & 1023;
  return sign * (e === 31 ? m ? NaN : Infinity : e === 0 ? m * 2 ** -24 : (1 + m / 1024) * 2 ** (e - 15));
}


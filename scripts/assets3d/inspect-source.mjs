// Format references: wiki.leaguetoolkit.dev/reference/file-formats/{skn,skl,anm}/
// Bounds are derived from supplied bytes before any count-dependent allocation.
export class BinaryReader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; }
  range(offset, size) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0
      || offset > this.bytes.length - size) throw new Error('truncated-asset');
  }
  seek(offset) { this.range(offset, 0); this.offset = offset; }
  skip(size) { this.range(this.offset, size); this.offset += size; }
  read(method, size) { this.range(this.offset, size); const value = this.bytes[method](this.offset); this.offset += size; return value; }
  u16() { return this.read('readUInt16LE', 2); }
  i16() { return this.read('readInt16LE', 2); }
  u32() { return this.read('readUInt32LE', 4); }
  i32() { return this.read('readInt32LE', 4); }
  f32() { const value = this.read('readFloatLE', 4); if (!Number.isFinite(value)) throw new Error('nonfinite-asset'); return value; }
  text(size) { this.range(this.offset, size); const value = this.bytes.toString('utf8', this.offset, this.offset + size).split('\0')[0]; this.offset += size; return value; }
}
export function inspectSkn(bytes) {
  const r = new BinaryReader(bytes);
  if (r.u32() !== 0x00112233 || r.u16() !== 4) throw new Error('unsupported-skn');
  const minor = r.u16(), count = r.u32(); r.range(r.offset, count * 80);
  const submeshes = [];
  for (let i = 0; i < count; i++) submeshes.push({ name: r.text(64), startVertex: r.u32(), vertexCount: r.u32(), startIndex: r.u32(), indexCount: r.u32() });
  const flags = r.u32(), indices = r.u32(), vertices = r.u32(), stride = r.u32(), vertexType = r.u32();
  if (stride < 52 || indices % 3) throw new Error('invalid-skn-layout');
  r.skip(40); const indexOffset = r.offset;
  r.range(indexOffset, indices * 2); const vertexOffset = indexOffset + indices * 2; r.range(vertexOffset, vertices * stride);
  for (const s of submeshes) if (s.startVertex + s.vertexCount > vertices || s.startIndex + s.indexCount > indices || s.indexCount % 3) throw new Error('invalid-skn-submesh');
  for (let i = 0; i < indices; i++) if (r.u16() >= vertices) throw new Error('invalid-skn-index');
  return { version: `4.${minor}`, flags, vertices, triangles: indices / 3, stride, vertexType, submeshes, indexOffset, vertexOffset };
}
export function inspectSkl(bytes) {
  const r = new BinaryReader(bytes);
  if (r.u32() !== bytes.length || r.u32() !== 0x22fd4fc3 || r.u32() !== 0) throw new Error('unsupported-skl');
  const flags = r.u16(), count = r.u16(), influenceCount = r.u32(), jointOffset = r.i32();
  r.i32(); const influenceOffset = r.i32();
  r.range(0, 64); r.range(jointOffset, count * 100); r.range(influenceOffset, influenceCount * 2);
  const joints = [], ids = new Set();
  for (let i = 0; i < count; i++) {
    const start = jointOffset + i * 100; r.seek(start);
    const jointFlags = r.u16(), id = r.u16(), parent = r.i16(); r.u16(); const nameHash = r.u32(), radius = r.f32();
    const transform = Array.from({ length: 20 }, () => r.f32());
    const nameField = r.offset, nameOffset = nameField + r.i32(); r.range(nameOffset, 1);
    const end = bytes.indexOf(0, nameOffset);
    if (end < 0 || end - nameOffset > 4096 || ids.has(id) || parent === id) throw new Error('invalid-skl-joint');
    ids.add(id); joints.push({ id, parent, name: bytes.toString('utf8', nameOffset, end), nameHash, flags: jointFlags, radius, transform });
  }
  const byId = new Map(joints.map(j => [j.id, j]));
  for (const joint of joints) {
    const seen = new Set(); let cursor = joint;
    while (cursor.parent !== -1) {
      if (seen.has(cursor.id) || !byId.has(cursor.parent)) throw new Error('invalid-skl-hierarchy');
      seen.add(cursor.id); cursor = byId.get(cursor.parent);
    }
  }
  r.seek(influenceOffset); const influences = [];
  for (let i = 0; i < influenceCount; i++) { const id = r.i16(); if (!byId.has(id)) throw new Error('invalid-skl-influence'); influences.push(id); }
  return { flags, bones: count, joints, influences };
}
/** Detection only: compressed spline tracks are not silently treated as linear clips. */
export function inspectAnm(bytes) {
  const r = new BinaryReader(bytes), magic = r.text(8), version = r.u32();
  if (magic === 'r3d2canm' && [1, 2, 3].includes(version)) return { format: 'compressed', version, bytes: bytes.length, requiresSplineDecoder: true };
  if (magic === 'r3d2anmd' && [3, 4, 5].includes(version)) return { format: 'uncompressed', version, bytes: bytes.length, requiresSplineDecoder: false };
  throw new Error('unsupported-anm');
}

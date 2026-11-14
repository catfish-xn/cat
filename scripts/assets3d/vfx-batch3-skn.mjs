/** Lossless v2 -> v4 envelope for the original Elise spiderling's 52-byte vertices.
 * Keep the strict v4 inspector untouched; never rewrite the source cache. */
import { inspectSkn } from './inspect-source.mjs';
export function normalizeSpiderSkn(bytes) {
  if (bytes.length < 12 || bytes.readUInt32LE() !== 0x00112233) throw Error('spider-skn-magic');
  if (bytes.readUInt16LE(4) === 4) { inspectSkn(bytes); return bytes; }
  if (bytes.readUInt16LE(4) !== 2 || bytes.readUInt16LE(6) !== 1) throw Error('spider-skn-version');
  const count = bytes.readUInt32LE(8), after = 12 + count * 80;
  if (count > 1024 || after + 8 > bytes.length) throw Error('spider-skn-ranges');
  const indices = bytes.readUInt32LE(after), vertices = bytes.readUInt32LE(after + 4);
  if (indices % 3 || vertices > 65536 || bytes.length < after + 8 + indices * 2 + vertices * 52) throw Error('spider-skn-layout');
  const header = Buffer.alloc(after + 60); bytes.copy(header, 0, 0, after); header.writeUInt16LE(4, 4);
  header.writeUInt32LE(indices, after + 4); header.writeUInt32LE(vertices, after + 8); header.writeUInt32LE(52, after + 12);
  const result = Buffer.concat([header, bytes.subarray(after + 8)]); inspectSkn(result); return result;
}

import { describe, expect, it } from 'vitest';
// @ts-expect-error Node asset utility, intentionally JavaScript.
import { BinaryReader, inspectSkn, inspectSkl, inspectAnm } from '../scripts/assets3d/inspect-source.mjs';
function skn() {
  const b = Buffer.alloc(72 + 6 + 3 * 52); b.writeUInt32LE(0x00112233); b.writeUInt16LE(4, 4);
  b.writeUInt32LE(3, 16); b.writeUInt32LE(3, 20); b.writeUInt32LE(52, 24);
  b.writeUInt16LE(0, 72); b.writeUInt16LE(1, 74); b.writeUInt16LE(2, 76); return b;
}
function skl() {
  const b = Buffer.alloc(171); b.writeUInt32LE(b.length); b.writeUInt32LE(0x22fd4fc3, 4);
  b.writeUInt16LE(1, 14); b.writeUInt32LE(1, 16); b.writeInt32LE(64, 20); b.writeInt32LE(164, 28);
  b.writeInt16LE(-1, 68); b.writeInt32LE(6, 160); b.write('root\0', 166); return b;
}
describe('bounds-checked raw asset inspection', () => {
  it('reads generated SKN counts and byte ranges', () => {
    expect(inspectSkn(skn())).toMatchObject({ vertices: 3, triangles: 1, indexOffset: 72, vertexOffset: 78, stride: 52 });
  });
  it('rejects huge counts, truncated vertices and out-of-range indices', () => {
    const huge = skn(); huge.writeUInt32LE(0xffffffff, 8);
    expect(() => inspectSkn(huge)).toThrow('truncated-asset');
    expect(() => inspectSkn(skn().subarray(0, 80))).toThrow('truncated-asset');
    const wrongIndex = skn(); wrongIndex.writeUInt16LE(3, 72);
    expect(() => inspectSkn(wrongIndex)).toThrow('invalid-skn-index');
  });
  it('reads modern SKL relative names and influence mapping', () => {
    const value = inspectSkl(skl()); expect(value.bones).toBe(1); expect(value.influences).toEqual([0]);
    expect(value.joints[0]).toMatchObject({ id: 0, parent: -1, name: 'root' });
  });
  it('rejects self-parenting, unknown influences and out-of-range name offsets', () => {
    const cycle = skl(); cycle.writeInt16LE(0, 68); expect(() => inspectSkl(cycle)).toThrow('invalid-skl-joint');
    const influence = skl(); influence.writeInt16LE(3, 164); expect(() => inspectSkl(influence)).toThrow('invalid-skl-influence');
    const name = skl(); name.writeInt32LE(0x7fffffff, 160); expect(() => inspectSkl(name)).toThrow('truncated-asset');
  });
  it('distinguishes compressed ANM from uncompressed without pretending to decode tracks', () => {
    const b = Buffer.alloc(12); b.write('r3d2canm'); b.writeUInt32LE(1, 8);
    expect(inspectAnm(b)).toMatchObject({ format: 'compressed', requiresSplineDecoder: true });
    b.write('r3d2anmd'); b.writeUInt32LE(5, 8);
    expect(inspectAnm(b)).toMatchObject({ format: 'uncompressed', version: 5 });
    b.writeUInt32LE(99, 8); expect(() => inspectAnm(b)).toThrow('unsupported-anm');
  });
  it('rejects nonfinite float fields and invalid seek offsets', () => {
    const b = Buffer.alloc(4); b.writeFloatLE(Infinity); expect(() => new BinaryReader(b).f32()).toThrow('nonfinite-asset');
    expect(() => new BinaryReader(b).seek(-1)).toThrow('truncated-asset');
  });
});

import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline asset converter is an ESM script without a declaration.
import { normalizeSpiderSkn } from '../scripts/assets3d/vfx-batch3-skn.mjs';
describe('original spiderling SKN v2 envelope conversion', () => {
  it('preserves indices/vertices byte for byte while validating the v4 result', () => {
    const b = Buffer.alloc(12+80+8+6+3*52); b.writeUInt32LE(0x00112233); b.writeUInt16LE(2,4); b.writeUInt16LE(1,6); b.writeUInt32LE(1,8);
    b.write('body',12); b.writeUInt32LE(3,80); b.writeUInt32LE(3,88); b.writeUInt32LE(3,92); b.writeUInt32LE(3,96);
    b.writeUInt16LE(1,102); b.writeUInt16LE(2,104); b.writeFloatLE(1.25,106);
    const original = Buffer.from(b), v4 = normalizeSpiderSkn(b);
    expect(v4.readUInt16LE(4)).toBe(4); expect(v4.readUInt32LE(104)).toBe(52); expect(v4.subarray(152)).toEqual(b.subarray(100)); expect(b).toEqual(original);
    expect(normalizeSpiderSkn(v4)).toBe(v4);
    const broken = Buffer.from(b); broken.writeUInt16LE(99,100); expect(()=>normalizeSpiderSkn(broken)).toThrow('invalid-skn-index');
    expect(()=>normalizeSpiderSkn(b.subarray(0,20))).toThrow(); const unknown=Buffer.from(b);unknown.writeUInt16LE(3,4);expect(()=>normalizeSpiderSkn(unknown)).toThrow('version');
  });
});

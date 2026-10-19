import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node utility.
import { decodeAnm } from '../scripts/assets3d/animation.mjs';
// A single joint, two v4 frames, shared vector and full float quaternion pools.
function v4() {
  const b = Buffer.alloc(152); b.write('r3d2anmd'); b.writeUInt32LE(4, 8);
  b.writeUInt32LE(1, 28); b.writeUInt32LE(2, 32); b.writeFloatLE(0.5, 36);
  b.writeUInt32LE(64, 52); b.writeUInt32LE(100, 56); b.writeUInt32LE(116, 60);
  [1, 1, 1, 2, 3, 4, 6, 7, 8].forEach((n, i) => b.writeFloatLE(n, 76 + i * 4));
  [0, 0, 0, 1].forEach((n, i) => b.writeFloatLE(n, 112 + i * 4));
  b.writeUInt32LE(123, 128); b.writeUInt16LE(1, 132);
  b.writeUInt32LE(123, 140); b.writeUInt16LE(2, 144);
  return b;
}
describe('ANM v4 compatibility', () => {
  it('reads frame hashes, vector indices and full float quaternions independently of v5 packing', () => {
    const a = decodeAnm(v4()); expect(a.version).toBe(4); expect(a.duration).toBe(0.5); expect(a.fps).toBe(2);
    expect(a.tracks.map((t: { hash: number; path: string }) => [t.hash, t.path])).toEqual([[123, 'rotation'], [123, 'translation'], [123, 'scale']]);
    expect(a.sample(a.tracks[0], 0.5)).toEqual([0, 0, 0, 1]);
    expect(a.sample(a.tracks[1], 0)).toEqual([2, 3, 4]); expect(a.sample(a.tracks[1], 0.5)).toEqual([6, 7, 8]);
    expect(a.sample(a.tracks[2], 0.5)).toEqual([1, 1, 1]);
  });
  it('rejects pool overflow, changing hashes, truncation and frame expansion before allocating keys', () => {
    let b = v4(); b.writeUInt16LE(3, 144); expect(() => decodeAnm(b)).toThrow('invalid-anm-pool-index');
    b = v4(); b.writeUInt32LE(456, 140); expect(() => decodeAnm(b)).toThrow('anm-v4-frame-hash-mismatch');
    expect(() => decodeAnm(v4().subarray(0, -1))).toThrow('truncated-asset');
    b = v4(); b.writeUInt32LE(0xffffffff, 32); expect(() => decodeAnm(b)).toThrow('animation-frame-budget');
  });
});

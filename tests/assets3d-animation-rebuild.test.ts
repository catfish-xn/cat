import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node utility.
import { writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node utility.
import { compareAnimationRebuild } from '../scripts/assets3d/verify-animation-rebuild.mjs';

function sample(addCast = false, texture = 3, pose = 4) {
  const bytes = Buffer.from([1, 2, texture, pose, 5, 6]);
  const doc = { asset: { version: '2.0' }, buffers: [{ byteLength: bytes.length }],
    nodes: [{ name: 'bone' }], materials: [{ name: 'body' }], images: [{ bufferView: 1 }],
    bufferViews: Array.from({ length: addCast ? 6 : 4 }, (_, i) => ({ buffer: 0, byteOffset: i, byteLength: 1 })),
    accessors: [0, 2, 3, ...(addCast ? [4, 5] : [])].map(bufferView => ({ bufferView, componentType: 5121, count: 1, type: 'SCALAR' })),
    animations: [{ name: 'idle', channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }], samplers: [{ input: 1, output: 2 }] },
      ...(addCast ? [{ name: 'cast', channels: [], samplers: [{ input: 3, output: 4 }] }] : [])] };
  return writeGlb(doc, bytes);
}
describe('animation rebuild model/texture guard', () => {
  it('accepts new animation bytes while checking unchanged prior curves and model content', () => {
    expect(compareAnimationRebuild(sample(), sample(true), false)).toMatchObject({ nonAnimationEqual: true, priorAnimationsEqual: true });
    expect(compareAnimationRebuild(sample(), sample(), true).wholeGlbEqual).toBe(true);
    expect(compareAnimationRebuild(sample(), sample(true), true).wholeGlbEqual).toBe(false);
  });
  it('detects embedded image changes and prior animation changes separately', () => {
    // Byte 2 is the prior animation input, while byte 1 is the image.
    const textureChange = sample(true); const normal = sample(true);
    const jsonLength = textureChange.readUInt32LE(12), binStart = 28 + jsonLength;
    textureChange[binStart + 1] = 99;
    expect(compareAnimationRebuild(normal, textureChange, false).nonAnimationEqual).toBe(false);
    expect(compareAnimationRebuild(sample(), sample(true, 99), false).priorAnimationsEqual).toBe(false);
    expect(compareAnimationRebuild(sample(), sample(true, 3, 99), false).priorAnimationsEqual).toBe(false);
  });
});

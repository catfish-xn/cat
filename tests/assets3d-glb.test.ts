import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error Build-time Node utility intentionally ships as JavaScript.
import { writeGlb, readGlb, embedDiffuse, summarizeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Build-time Node utility intentionally ships as JavaScript.
import { prepareExisting } from '../scripts/assets3d/prepare-existing.mjs';

function synthetic() {
  const binary = Buffer.alloc(36); binary.writeFloatLE(1, 12); binary.writeFloatLE(1, 28);
  const document = { asset: { version: '2.0' }, buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], materials: [{ name: 'skin' }],
    nodes: [{ name: 'root' }], skins: [{ joints: [0] }],
    animations: ['idle', 'move', 'attack', 'cast', 'death'].map(name => ({ name, channels: [], samplers: [] })) };
  return { document, binary, glb: writeGlb(document, binary) };
}
// A test-only PNG header. Real PNG decoding belongs to the image loader, not GLB packing.
function png() { const b = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); return b; }
describe('local-only GLB asset preparation', () => {
  it('roundtrips a generated minimal mesh and reports unique vertices', () => {
    const { document, binary, glb } = synthetic();
    expect(readGlb(glb)).toEqual({ document, binary });
    expect(summarizeGlb(glb)).toMatchObject({ vertices: 3, triangles: 1, bones: 1, textures: 0 });
  });
  it('embeds texture bytes without altering geometry, skeleton or animation payload', () => {
    const { document, binary, glb } = synthetic(), image = png();
    const result = readGlb(embedDiffuse(glb, image));
    expect(result.binary.subarray(0, binary.length)).toEqual(binary);
    expect(result.binary.subarray(binary.length)).toEqual(image);
    for (const field of ['meshes', 'skins', 'animations', 'nodes', 'accessors']) {
      expect(result.document[field]).toEqual(document[field as keyof typeof document]);
    }
    expect(result.document.images).toEqual([{ bufferView: 1, mimeType: 'image/png' }]);
    expect(result.document.materials[0].pbrMetallicRoughness.baseColorTexture.index).toBe(0);
  });
  it('rejects truncated, oversized, misaligned and unsupported chunks before accessing data', () => {
    const { glb } = synthetic();
    expect(() => readGlb(glb.subarray(0, 15))).toThrow('invalid-glb-header');
    const badLength = Buffer.from(glb); badLength.writeUInt32LE(0xffffffff, 8);
    expect(() => readGlb(badLength)).toThrow('invalid-glb-length');
    const badChunk = Buffer.from(glb); badChunk.writeUInt32LE(0xfffffffc, 12);
    expect(() => readGlb(badChunk)).toThrow('invalid-glb-chunk');
    const misaligned = Buffer.from(glb); misaligned.writeUInt32LE(3, 12);
    expect(() => readGlb(misaligned)).toThrow('invalid-glb-chunk');
  });
  it('rejects external URIs and out-of-bounds buffer views', () => {
    const { document, binary } = synthetic();
    expect(() => readGlb(writeGlb({ ...document, images: [{ uri: 'https://example.invalid/x.png' }] }, binary))).toThrow('external-glb-image');
    expect(() => readGlb(writeGlb({ ...document, bufferViews: [{ buffer: 0, byteOffset: 35, byteLength: 2 }] }, binary))).toThrow('invalid-glb-buffer-view');
    expect(() => embedDiffuse(writeGlb(document, binary), Buffer.alloc(24))).toThrow('invalid-png');
  });
  it('creates the D8 manifest deterministically, leaving source files unchanged', async () => {
    await mkdir(resolve('assets3d-local'), { recursive: true });
    const root = await mkdtemp(resolve('assets3d-local/assets3d-test-'));
    try {
      const source = join(root, 'source'), dir = join(source, 'public/assets/jinx'), out = join(root, 'out');
      await mkdir(dir, { recursive: true }); const { glb } = synthetic();
      await writeFile(join(dir, 'rigged.glb'), glb); await writeFile(join(dir, 'diffuse.png'), png());
      const path = 'assets/characters/tft13_jinx/texture.png', raw = join(source, '.local/extracted', path);
      await mkdir(join(source, '.local/extracted/assets/characters/tft13_jinx'), { recursive: true });
      await writeFile(raw, png());
      await writeFile(join(source, '.local/extraction.json'), JSON.stringify({ version: '14.24.6442327',
        files: [{ path, bytes: png().length, sha256: createHash('sha256').update(png()).digest('hex') }] }));
      const first = await prepareExisting(source, out, ['jinx']);
      const firstBytes = await readFile(join(out, 'models/jinx/model.glb'));
      await expect(prepareExisting(source, out, ['jinx'])).rejects.toThrow('output-exists-use-force');
      const second = await prepareExisting(source, out, ['jinx'], { force: true });
      expect(second).toEqual(first); expect(await readFile(join(out, 'models/jinx/model.glb'))).toEqual(firstBytes);
      expect(await readFile(join(dir, 'rigged.glb'))).toEqual(glb);
      expect(first.manifest).toMatchObject({ schemaVersion: 1, models: { jinx: { path: 'models/jinx/model.glb', animations: { cast: 'cast' } } } });
      await expect(prepareExisting(source, source, ['jinx'])).rejects.toThrow('output-must-not-modify-source');
      await expect(prepareExisting(source, resolve('src'), ['jinx'], { force: true })).rejects.toThrow('unsafe-output-path');
      await expect(prepareExisting(source, out, ['../escape'])).rejects.toThrow('invalid-hero-selection');
      // Check every destination before writing any of them, including manifest collisions.
      await rm(join(out, 'models/jinx/model.glb'));
      await writeFile(join(out, 'manifest.json'), 'user-owned');
      await expect(prepareExisting(source, out, ['jinx'])).rejects.toThrow('output-exists-use-force');
      await expect(readFile(join(out, 'models/jinx/model.glb'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(join(out, 'manifest.json'), 'utf8')).toBe('user-owned');
      await writeFile(raw, Buffer.alloc(24));
      await expect(prepareExisting(source, out, ['jinx'])).rejects.toThrow('source-hash-mismatch');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

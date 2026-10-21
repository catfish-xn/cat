import { afterEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile, readdir, symlink, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { read as readKTX, KHR_DF_MODEL_ETC1S, KHR_DF_MODEL_UASTC } from 'ktx-parse';
import sharp from 'sharp';
// @ts-expect-error Node script.
import { compressAssets, compressionIO } from '../scripts/assets3d/compress.mjs';
// @ts-expect-error Node script.
import { withinRoot } from '../scripts/assets3d/safe-path.mjs';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    withinRoot(resolve('assets3d-local'), root);
    expect(root).not.toBe(resolve('assets3d-local'));
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir(resolve('assets3d-local'), { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/compress-test-')); roots.push(root);
  const input = join(root, 'input'), output = join(root, 'output');
  async function put(path: string, bytes: string | Uint8Array) {
    await mkdir(dirname(join(input, path)), { recursive: true });
    await writeFile(join(input, path), bytes);
  }
  const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 1 } } }).png().toBuffer();
  const doc = new Document(), buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer);
  const color = doc.createTexture('color').setImage(png).setMimeType('image/png');
  const normal = doc.createTexture('normal').setImage(png).setMimeType('image/png');
  const material = doc.createMaterial().setBaseColorTexture(color).setNormalTexture(normal);
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', positions).setMaterial(material));
  const node = doc.createNode().setMesh(mesh); doc.createScene().addChild(node);
  const times = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1, 2])).setBuffer(buffer);
  const values = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0])).setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(values);
  doc.createAnimation('move').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler));
  await put('models/sample/model.glb', await new NodeIO().writeBinary(doc));
  await put('textures/spark.png', png);
  await put('textures/broken.png', 'synthetic-invalid-image');
  await put('notes.txt', 'synthetic-copy');
  await put('effects/spark.json', JSON.stringify({ schemaVersion: 2, emitters: [
    { texture: 'textures/spark.png', distortion: { normalMap: 'textures/spark.png' } }, { texture: 'textures/broken.png' },
  ] }));
  await put('manifest.json', JSON.stringify({ schemaVersion: 1, models: { sample: { path: 'models/sample/model.glb', animations: { move: 'move' } } }, effects: { spark: { path: 'effects/spark.json' } } }));
  return { input, output, put };
}
it('compresses synthetic geometry, animation and typed textures; rewrites effects and hashes exact output', async () => {
  const { input, output } = await fixture();
  const before = await readFile(join(input, 'models/sample/model.glb'));
  const report = await compressAssets({ from: input, out: output });
  expect(report.ready).toBe(true);
  expect(report.converted).toEqual({ etc1s: 1, uastc: 1, webp: 1 });
  expect(report.fallbacks).toHaveLength(1);
  const io = await compressionIO(), bytes = await readFile(join(output, 'models/sample/model.glb'));
  const doc = await io.readBinary(bytes);
  expect(doc.getRoot().listExtensionsRequired().map((e: { extensionName: string }) => e.extensionName)).toContain('EXT_meshopt_compression');
  expect(doc.getRoot().listAnimations()[0].getName()).toBe('move');
  expect(doc.getRoot().listAnimations()[0].listSamplers()[0].getInput()!.getCount()).toBe(2);
  const material = doc.getRoot().listMaterials()[0];
  expect(readKTX(material.getBaseColorTexture()!.getImage()!).dataFormatDescriptor[0].colorModel).toBe(KHR_DF_MODEL_ETC1S);
  expect(readKTX(material.getNormalTexture()!.getImage()!).dataFormatDescriptor[0].colorModel).toBe(KHR_DF_MODEL_UASTC);
  const effect = JSON.parse(await readFile(join(output, 'effects/spark.json'), 'utf8'));
  expect(effect.emitters[0]).toEqual({ texture: 'textures/spark.webp', distortion: { normalMap: 'textures/spark.webp' } });
  expect(effect.emitters[1].texture).toBe('textures/broken.png');
  expect((await sharp(await readFile(join(output, 'textures/spark.webp'))).metadata()).format).toBe('webp');
  expect(await readFile(join(output, 'notes.txt'), 'utf8')).toBe('synthetic-copy');
  const index = JSON.parse(await readFile(join(output, 'precache.json'), 'utf8'));
  expect(index.files.map((f: { path: string }) => f.path)).toEqual(['effects/spark.json', 'models/sample/model.glb', 'textures/broken.png', 'textures/spark.webp']);
  for (const f of index.files) {
    const data = await readFile(join(output, f.path));
    expect(f).toEqual({ path: f.path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  }
  const all = await readdir(output, { recursive: true, withFileTypes: true });
  let total = 0;
  for (const e of all) if (e.isFile()) total += (await readFile(join(e.parentPath, e.name))).length;
  expect(report.afterBytes).toBe(total);
  expect(await readFile(join(input, 'models/sample/model.glb'))).toEqual(before);
  await expect(compressAssets({ from: input, out: output })).rejects.toThrow('compression-output-exists');
}, 30000);
it('rejects source descendants and texture destination collisions before writes', async () => {
  const { input, output, put } = await fixture();
  await expect(compressAssets({ from: input, out: join(input, 'child') })).rejects.toThrow('overlaps-source');
  await put('textures/spark.webp', 'synthetic-collision');
  await expect(compressAssets({ from: input, out: output })).rejects.toThrow('compression-path-collision');
});
it('writes to a new real output outside assets3d-local', async () => {
  const root = await mkdtemp(resolve('compression-output-test-'));
  try {
    const input = join(root, 'input'), output = join(root, 'nested', 'output');
    await mkdir(input);
    await writeFile(join(input, 'manifest.json'), JSON.stringify({ schemaVersion: 1, models: {}, effects: {} }));
    await writeFile(join(input, 'notes.txt'), 'synthetic-copy');
    expect((await compressAssets({ from: input, out: output })).ready).toBe(true);
    expect(await readFile(join(output, 'notes.txt'), 'utf8')).toBe('synthetic-copy');
    await expect(compressAssets({ from: input, out: output })).rejects.toThrow('compression-output-exists');
  } finally {
    withinRoot(resolve('.'), root);
    expect(root).not.toBe(resolve('.'));
    await rm(root, { recursive: true, force: true });
  }
});
it('reads nested input junctions and refuses an existing output junction', async () => {
  const { input, output } = await fixture();
  const linked = join(dirname(input), 'linked');
  await mkdir(linked);
  await symlink(join(input, 'models'), join(linked, 'models'), 'junction');
  await symlink(join(input, 'textures'), join(linked, 'textures'), 'junction');
  await symlink(join(input, 'effects'), join(linked, 'effects'), 'junction');
  await writeFile(join(linked, 'manifest.json'), await readFile(join(input, 'manifest.json')));
  expect((await compressAssets({ from: linked, out: output })).ready).toBe(true);
  expect((await lstat(output)).isSymbolicLink()).toBe(false);
  const alias = join(dirname(input), 'alias');
  await symlink(output, alias, 'junction');
  await expect(compressAssets({ from: linked, out: alias })).rejects.toThrow('merge-output-link');
}, 30000);

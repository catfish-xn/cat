import { afterEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile, readdir, symlink, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { Document, NodeIO } from '@gltf-transform/core';
import { read as readKTX, KHR_DF_MODEL_ETC1S, KHR_DF_MODEL_UASTC } from 'ktx-parse';
import sharp from 'sharp';
// @ts-expect-error Node script.
import { compressAssets, compressionIO } from '../scripts/assets3d/compress.mjs';
// @ts-expect-error Node script.
import { withinRoot } from '../scripts/assets3d/safe-path.mjs';
// @ts-expect-error Node script.
import { buildAssetRoot } from '../scripts/assets3d/build-asset-root.mjs';
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
it.each([false, true])('preserves an animated rig without vertices and skips meshopt (empty mesh: %s)', async emptyMesh => {
  const { input, output, put } = await fixture();
  const doc = new Document(), buffer = doc.createBuffer();
  const root = doc.createNode('rig'), joint = doc.createNode('joint').setTranslation([1, 2, 3]);
  root.addChild(joint);
  if (emptyMesh) root.setMesh(doc.createMesh('empty'));
  doc.createScene().addChild(root);
  const times = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1, 2])).setBuffer(buffer);
  const values = doc.createAccessor().setType('VEC3').setArray(new Float32Array([1, 2, 3, 2, 2, 3, 3, 2, 3])).setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(values);
  doc.createAnimation('move').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(joint).setTargetPath('translation').setSampler(sampler));
  await put('models/sample/model.glb', await new NodeIO().writeBinary(doc));
  const before = await readFile(join(input, 'models/sample/model.glb'));
  const report = await compressAssets({ from: input, out: output });
  expect(report.ready).toBe(true);
  expect(report.fallbacks).toContainEqual({ path: 'models/sample/model.glb', reason: 'empty-geometry-rig-preserved-without-meshopt' });
  const result: Document = await (await compressionIO()).readBinary(await readFile(join(output, 'models/sample/model.glb')));
  expect(result.getRoot().listExtensionsUsed().map((e: { extensionName: string }) => e.extensionName)).not.toContain('EXT_meshopt_compression');
  const nodes = result.getRoot().listNodes();
  expect(nodes.find(n => n.getName() === 'rig')!.listChildren().map(n => n.getName())).toEqual(['joint']);
  expect(nodes.find(n => n.getName() === 'joint')!.getTranslation()).toEqual([1, 2, 3]);
  const animation = result.getRoot().listAnimations()[0];
  expect(animation.getName()).toBe('move');
  expect(animation.listChannels()[0].getTargetNode()!.getName()).toBe('joint');
  expect(Array.from(animation.listSamplers()[0].getInput()!.getArray()!)).toEqual([0, 2]);
  expect(Array.from(animation.listSamplers()[0].getOutput()!.getArray()!)).toEqual([1, 2, 3, 3, 2, 3]);
  expect(await readFile(join(input, 'models/sample/model.glb'))).toEqual(before);
}, 30000);
it('rejects source descendants and texture destination collisions before writes', async () => {
  const { input, output, put } = await fixture();
  await expect(compressAssets({ from: input, out: join(input, 'child') })).rejects.toThrow('overlaps-source');
  await put('textures/spark.webp', 'synthetic-collision');
  await expect(compressAssets({ from: input, out: output })).rejects.toThrow('compression-path-collision');
});
it.each(['compress', 'build'] as const)('%s refuses unignored worktree output and allows ignored or external output', async tool => {
  const root = await mkdtemp(join(tmpdir(), 'compression-output-test-'));
  try {
    const input = join(root, 'input');
    await mkdir(input);
    await writeFile(join(input, 'manifest.json'), JSON.stringify({ schemaVersion: 1, models: {}, effects: {} }));
    const run = (out: string) => tool === 'compress' ? compressAssets({ from: input, out }) : buildAssetRoot({ roots: [input], out });
    const reason = tool === 'compress' ? 'compression-output-not-ignored' : 'merge-output-not-ignored';
    // Rejected paths are never created, so no cleanup under source/document/public trees.
    for (const directory of ['src', 'docs', 'public', '.']) {
      const output = resolve(directory, `compression-output-test-${root.split(/[\\/]/).pop()}`);
      await expect(run(output)).rejects.toThrow(reason);
      await expect(lstat(output)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    await mkdir(resolve('assets3d-local'), { recursive: true });
    const ignored = await mkdtemp(resolve('assets3d-local/compress-test-')); roots.push(ignored);
    for (const output of [join(ignored, 'output'), join(root, 'nested', 'output')]) {
      expect((await run(output)).ready).toBe(true);
      expect(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).models).toEqual({});
    }
  } finally {
    withinRoot(tmpdir(), root);
    expect(root).not.toBe(resolve(tmpdir()));
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

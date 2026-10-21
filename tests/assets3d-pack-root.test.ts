import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error Offline Node script.
import { packRoot, packArguments } from '../scripts/assets3d/pack-root.mjs';
// @ts-expect-error Shared output policy.

const temporary: string[] = [];
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    expect(root.startsWith(join(tmpdir(), 'asset-pack-'))).toBe(true);
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'asset-pack-')); temporary.push(dir);
  const root = join(dir, 'input');
  const files = [];
  for (const [i, path] of [
    'roots/0/models/unit-a/body.glb', 'roots/0/units/unit-a/skin.ktx2',
    'models/unit-b/body.glb', 'effects/spark.json', 'textures/glow.webp',
    'meshes/spark.glb', 'board/tile.glb', 'action-bindings.json',
  ].entries()) {
    const data = Buffer.alloc(8, i + 1);
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), data);
    files.push({ path, bytes: data.length, sha256: hash(data) });
  }
  const index = { schemaVersion: 1, files };
  await writeFile(join(root, 'manifest.json'), '{}');
  await writeFile(join(root, 'precache.json'), JSON.stringify(index));
  return { dir, root, index };
}
it('covers the index exactly once; every offset and both hashes match bytes', async () => {
  const { dir, root, index } = await fixture(), out = join(dir, 'packed');
  const result = await packRoot({ root, out });
  expect(result.schemaVersion).toBe(1);
  expect(result.packs.map((p: any) => p.name)).toEqual(['board', 'effects', 'models', 'other']);
  const actual = [];
  for (const pack of result.packs) {
    expect(pack.path).toBe(`packs/${pack.name}.bin`);
    const data = await readFile(join(out, pack.path));
    expect(data.length).toBe(pack.bytes); expect(hash(data)).toBe(pack.sha256);
    let end = 0;
    for (const file of pack.files) {
      expect(file.offset).toBe(end);
      const slice = data.subarray(file.offset, file.offset + file.bytes);
      expect(slice).toEqual(await readFile(join(root, file.path)));
      expect(hash(slice)).toBe(file.sha256);
      actual.push({ path: file.path, bytes: file.bytes, sha256: file.sha256 });
      end += file.bytes;
    }
    expect(end).toBe(pack.bytes);
  }
  expect(actual.sort((a, b) => a.path.localeCompare(b.path))).toEqual(
    [...index.files].sort((a, b) => a.path.localeCompare(b.path)));
  expect((await readdir(out)).sort()).toEqual(['packs', 'packs.json']);
  expect(JSON.parse(await readFile(join(out, 'packs.json'), 'utf8'))).toEqual(result);
});
it('is byte deterministic even when precache entries are reordered', async () => {
  const { dir, root, index } = await fixture();
  const first = await packRoot({ root, out: join(dir, 'a'), maxBytes: 16 });
  await writeFile(join(root, 'precache.json'), JSON.stringify({ ...index, files: [...index.files].reverse() }));
  const second = await packRoot({ root, out: join(dir, 'b'), maxBytes: 16 });
  expect(second).toEqual(first);
  for (const path of ['packs.json', ...first.packs.map((p: any) => p.path)]) {
    expect(await readFile(join(dir, 'a', path))).toEqual(await readFile(join(dir, 'b', path)));
  }
  expect(first.packs.filter((p: any) => p.name.startsWith('models')).map((p: any) => [p.name, p.bytes]))
    .toEqual([['models-1', 16], ['models-2', 8]]);
  expect(first.packs.every((p: any) => p.bytes <= 16)).toBe(true);
});
it('supports in-place output without changing the original files and refuses overwrite', async () => {
  const { root, index } = await fixture();
  const before = await readFile(join(root, 'precache.json'));
  await packRoot({ root });
  expect(await readFile(join(root, 'precache.json'))).toEqual(before);
  for (const f of index.files) expect(hash(await readFile(join(root, f.path)))).toBe(f.sha256);
  await expect(packRoot({ root })).rejects.toThrow('pack-output-exists');
});
it.each(['bytes', 'sha256', 'missing', 'duplicate', 'traversal', 'metadata', 'schema', 'oversized'])(
  'rejects %s before creating output', async failure => {
    const { dir, root, index } = await fixture(), out = join(dir, 'out');
    if (failure === 'bytes') index.files[0]!.bytes++;
    if (failure === 'sha256') await writeFile(join(root, index.files[0]!.path), Buffer.alloc(8, 99));
    if (failure === 'missing') await rm(join(root, index.files[0]!.path));
    if (failure === 'duplicate') index.files.push(index.files[0]!);
    if (failure === 'traversal') index.files[0]!.path = '../escape.bin';
    if (failure === 'metadata') index.files[0]!.path = 'manifest.json';
    if (failure === 'schema') index.schemaVersion = 2;
    await writeFile(join(root, 'precache.json'), JSON.stringify(index));
    await expect(packRoot({ root, out, maxBytes: failure === 'oversized' ? 4 : 16 })).rejects.toThrow();
    await expect(readdir(out)).rejects.toThrow();
  });
it('packs only into a repository directory that .gitignore covers', async () => {
  const { root } = await fixture();
  await expect(packRoot({ root, out: resolve('src/synthetic-pack-policy') })).rejects.toThrow('not-ignored');
  await expect(readdir(resolve('src/synthetic-pack-policy'))).rejects.toThrow();
});
it('parses explicit flags and rejects invalid limits and arguments', async () => {
  expect(packArguments(['--root', 'a', '--out', 'b', '--max-bytes', '16']))
    .toEqual({ root: 'a', out: 'b', maxBytes: 16 });
  expect(() => packArguments(['--root'])).toThrow('usage');
  expect(() => packArguments(['--unknown', 'x'])).toThrow('usage');
  for (const maxBytes of [0, -1, 1.5, NaN]) await expect(packRoot({ root: 'x', maxBytes })).rejects.toThrow('invalid-max-bytes');
});

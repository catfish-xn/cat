import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
// @ts-expect-error Pure Node utility.
import { mergeManifests, mergeArguments } from '../scripts/assets3d/merge-manifests.mjs';
// @ts-expect-error Pure Node utility.
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
  const root = await mkdtemp(resolve('assets3d-local/merge-test-')); roots.push(root);
  return root;
}
async function unit(root: string, batch: string, id: string, effects: Record<string, { path: string }> = {}) {
  const dir = join(root, batch, 'units', id);
  const manifest = { schemaVersion: 1, models: { [id]: { path: `models/${id}/model.glb`, animations: { cast: 'spell1' } } }, effects };
  await put(dir, `models/${id}/model.glb`, `synthetic-${id}`);
  await put(dir, 'manifest.json', JSON.stringify(manifest));
  return { dir, manifest };
}
async function put(root: string, path: string, bytes: string) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), bytes);
}
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

describe('batch manifest merge', () => {
  it('parses multiple roots and repeated --from flags', () => {
    expect(mergeArguments(['--from', 'a', 'b', '--from', 'c', '--out', 'd'])).toEqual({ from: ['a', 'b', 'c'], out: 'd' });
    for (const args of [[], ['--from'], ['--out', 'x'], ['--from', 'a', '--force']])
      expect(() => mergeArguments(args)).toThrow();
  });
  it('merges models, effects and their nested texture/mesh/normal references; skips identical reruns', async () => {
    const root = await fixture(), a = await unit(root, 'a', 'one', { spark: { path: 'effects/one.json' } });
    const b = await unit(root, 'b', 'two', { glow: { path: 'effects/two.json' } });
    const effect = { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [
      { kind: 'mesh', mesh: 'meshes/shared.glb', texture: 'textures/shared.png', emission: { mode: 'burst', count: 1 }, lifetime: 1 },
      { kind: 'screenDistortion', distortion: { normalMap: 'textures/normal.png', strength: 1 }, emission: { mode: 'burst', count: 1 }, lifetime: 1 },
    ] };
    for (const f of [a, b]) {
      await put(f.dir, Object.values(f.manifest.effects)[0].path, JSON.stringify(effect));
      for (const path of ['meshes/shared.glb', 'textures/shared.png', 'textures/normal.png']) await put(f.dir, path, 'shared');
    }
    const args = { from: [join(root, 'a'), join(root, 'b')], out: join(root, 'merged') };
    const first = await mergeManifests(args);
    expect(first).toMatchObject({ ready: true, models: 2, effects: 2, files: 7, written: 7, skipped: 0, missing: [] });
    const manifest = await json(join(args.out, 'manifest.json'));
    expect(manifest.schemaVersion).toBe(1); expect(Object.keys(manifest.models)).toEqual(['one', 'two']);
    expect(Object.keys(manifest.effects)).toEqual(['spark', 'glow']);
    const path = join(args.out, 'models/one/model.glb'), before = (await stat(path)).mtimeMs;
    expect(await readFile(path, 'utf8')).toBe('synthetic-one');
    const second = await mergeManifests(args);
    expect(second).toMatchObject({ ready: true, written: 0, skipped: 7, writtenBytes: 0, bytes: first.bytes });
    expect((await stat(path)).mtimeMs).toBe(before);
  });
  it('rejects duplicate model/effect ids before copying anything', async () => {
    for (const collision of ['model', 'effect']) {
      const root = await fixture();
      await unit(root, 'a', 'one', collision === 'effect' ? { same: { path: 'effects/a.json' } } : {});
      await unit(root, 'b', collision === 'model' ? 'one' : 'two', collision === 'effect' ? { same: { path: 'effects/b.json' } } : {});
      const args = { from: [join(root, 'a'), join(root, 'b')], out: join(root, 'merged') };
      await expect(mergeManifests(args)).rejects.toThrow(`duplicate-${collision}-id`);
      await expect(stat(args.out)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });
  it('refuses traversal, external writes, link escapes and source/output overlaps', async () => {
    const root = await fixture(), u = await unit(root, 'batch', 'one');
    for (const out of ['src/invalid-merge-output', `${root}/merged/../escape`, join(root, 'batch')])
      await expect(mergeManifests({ from: [join(root, 'batch')], out })).rejects.toThrow(/unsafe|overlaps/);
    for (const path of ['../escape.json', '/escape.json', 'effects/../../escape.json', 'effects/%2e%2e/x.json', 'C:/escape.json']) {
      await put(u.dir, 'manifest.json', JSON.stringify({ ...u.manifest, effects: { bad: { path } } }));
      await expect(mergeManifests({ from: [join(root, 'batch')], out: join(root, 'merged') })).rejects.toThrow(/invalid-asset-path|unsafe-merge-path/);
    }
    await put(u.dir, 'manifest.json', JSON.stringify(u.manifest));
    await symlink(resolve('scripts'), join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(mergeManifests({ from: [join(root, 'batch')], out: join(root, 'escape') })).rejects.toThrow('unsafe-output-path');
  });
  it('reports missing dependencies without publishing a manifest or partial model tree', async () => {
    const root = await fixture(), u = await unit(root, 'a', 'one', { missing: { path: 'effects/missing.json' } });
    const args = { from: [join(root, 'a')], out: join(root, 'merged') };
    const report = await mergeManifests(args);
    expect(report).toMatchObject({ ready: false, models: 1, written: 0, missing: [{ root: u.dir, path: 'effects/missing.json' }] });
    await expect(stat(join(args.out, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await json(join(args.out, 'merge-report.json'))).ready).toBe(false);
  });
  it('rejects existing output with different content and preserves it', async () => {
    const root = await fixture(); await unit(root, 'a', 'one');
    const out = join(root, 'merged'); await put(out, 'models/one/model.glb', 'user-owned');
    await expect(mergeManifests({ from: [join(root, 'a')], out })).rejects.toThrow('output-content-conflict');
    expect(await readFile(join(out, 'models/one/model.glb'), 'utf8')).toBe('user-owned');
  });
});

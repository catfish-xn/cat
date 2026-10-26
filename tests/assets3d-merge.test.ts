import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { readFile, rm, stat, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
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
  mkdirSync(resolve('assets3d-local'), { recursive: true });
  const root = mkdtempSync(resolve('assets3d-local/merge-test-')); roots.push(root);
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
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), bytes);
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
    const precache = await json(join(args.out, 'precache.json'));
    const paths = ['models/one/model.glb', 'models/two/model.glb', 'effects/one.json', 'effects/two.json',
      'meshes/shared.glb', 'textures/shared.png', 'textures/normal.png'].sort();
    expect(precache.schemaVersion).toBe(1);
    expect(precache.files.map((file: { path: string }) => file.path)).toEqual(paths);
    for (const file of precache.files) {
      const bytes = await readFile(join(args.out, file.path));
      expect(file).toEqual({ path: file.path, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex') });
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(file.path).not.toContain('\\');
    }
    expect(precache.files.reduce((sum: number, file: { bytes: number }) => sum + file.bytes, 0)).toBe(first.bytes);
    const indexBefore = await readFile(join(args.out, 'precache.json'));
    const path = join(args.out, 'models/one/model.glb'), before = (await stat(path)).mtimeMs;
    expect(await readFile(path, 'utf8')).toBe('synthetic-one');
    const second = await mergeManifests(args);
    expect(second).toMatchObject({ ready: true, written: 0, skipped: 7, writtenBytes: 0, bytes: first.bytes });
    expect((await stat(path)).mtimeMs).toBe(before);
    expect(await readFile(join(args.out, 'precache.json'))).toEqual(indexBefore);
  });
  it('accepts a flat merged root, excludes metadata, and preflights index conflicts before copying', async () => {
    const root = await fixture(), u = await unit(root, 'a', 'sample');
    await put(u.dir, 'action-bindings.json', '{}');
    const out = join(root, 'merged');
    await put(out, 'precache.json', '{}');
    await expect(mergeManifests({ from: [u.dir], out })).rejects.toThrow('output-content-conflict:precache.json');
    await expect(stat(join(out, 'models'))).rejects.toMatchObject({ code: 'ENOENT' });
    const clean = join(root, 'clean');
    expect(await mergeManifests({ from: [u.dir], out: clean })).toMatchObject({ ready: true, files: 1 });
    expect((await json(join(clean, 'precache.json'))).files.map((f: { path: string }) => f.path)).toEqual(['models/sample/model.glb']);
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
    await expect(stat(join(args.out, 'precache.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await json(join(args.out, 'merge-report.json'))).ready).toBe(false);
  });
  it('rejects existing output with different content and preserves it', async () => {
    const root = await fixture(); await unit(root, 'a', 'one');
    const out = join(root, 'merged'); await put(out, 'models/one/model.glb', 'user-owned');
    await expect(mergeManifests({ from: [join(root, 'a')], out })).rejects.toThrow('output-content-conflict');
    expect(await readFile(join(out, 'models/one/model.glb'), 'utf8')).toBe('user-owned');
  });
});

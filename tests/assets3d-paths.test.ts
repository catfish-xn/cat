import { afterEach, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
// @ts-expect-error Build-time JavaScript utility.
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from '../scripts/assets3d/safe-path.mjs';
// @ts-expect-error Build-time JavaScript utility.
import { verifySource } from '../scripts/assets3d/verify-source.mjs';

const sourceMap = { jinx: { base: 'assets/characters/demo_jinx/skins/base' }, vi: { base: 'assets/characters/demo_vi/skins/base' } };
const cleanup: string[] = [];
async function temporary(local = false) {
  const base = local ? resolve('assets3d-local') : tmpdir();
  if (local) await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'assets3d-path-test-')); cleanup.push(root); return root;
}
afterEach(async () => {
  for (const root of cleanup.splice(0)) {
    // Every recursive cleanup target is an absolute mkdtemp result beneath these test parents.
    expect([resolve('assets3d-local'), tmpdir()].some(parent => {
      try { withinRoot(parent, root); return root !== parent; } catch { return false; }
    })).toBe(true);
    await rm(root, { recursive: true, force: true });
  }
});
async function linkDirectory(target: string, link: string) {
  await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}
async function record(root: string, paths: string[]) {
  await mkdir(join(root, '.local'), { recursive: true });
  const bytes = Buffer.from('synthetic texture');
  await writeFile(join(root, '.local/extraction.json'), JSON.stringify({ version: '14.24.6442327',
    files: paths.map(path => ({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })) }));
  return bytes;
}

describe('assets3d filesystem boundaries', () => {
  it('checks containment by path components without relying on links', async () => {
    const root = await temporary(), file = join(root, 'inside.txt'); await writeFile(file, 'inside');
    expect(withinRoot(root, file)).toBe(file);
    expect(() => withinRoot(root, `${root}-sibling/file`)).toThrow('path-outside-root');
    expect(() => withinRoot(root, resolve(root, '../outside'))).toThrow('path-outside-root');
    expect(await safeInputPath(root, file)).toBe(await realpath(file));
    await expect(safeInputPath(root, resolve(root, '../outside'))).rejects.toThrow('unsafe-source-path');
  });
  it('rejects traversal, absolute escapes and sibling prefixes even with force', async () => {
    for (const path of ['src/style.css', 'assets3d-local/../src/style.css', 'assets3d-local\\..\\src\\style.css',
      resolve('src/style.css'), resolve('assets3d-local-sibling/file'), join(tmpdir(), 'outside-assets3d.json')]) {
      await expect(safeOutputPath(path, { force: true })).rejects.toThrow('unsafe-output-path');
    }
    const root = await temporary(true), file = join(root, 'nested/report.json');
    expect(await safeOutputPath(file)).toBe(file);
  });
  it('requires force before overwriting any file, and creates nested safe parents', async () => {
    const root = await temporary(true), path = join(root, 'nested/report.json');
    await writeOutputFile(path, 'user-owned');
    await expect(writeOutputFile(path, 'replacement')).rejects.toThrow('output-exists-use-force');
    expect(await readFile(path, 'utf8')).toBe('user-owned');
    await writeOutputFile(path, 'replacement', { force: true });
    expect(await readFile(path, 'utf8')).toBe('replacement');
  });
  it('blocks a directory link escaping output before creating external parents', async () => {
    const root = await temporary(true), external = await temporary(), link = join(root, 'escape');
    await linkDirectory(external, link);
    await expect(writeOutputFile(join(link, 'new/file.json'), '{}', { force: true })).rejects.toThrow('unsafe-output-path');
    await expect(readFile(join(external, 'new/file.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('does not trust assets3d-local itself when it is an external directory link', async () => {
    const repo = await temporary(), external = await temporary(), scripts = join(repo, 'scripts/assets3d');
    await mkdir(scripts, { recursive: true });
    // Isolated copy retains the production rule: the repository is derived from the module location.
    const modulePath = join(scripts, 'safe-path.mjs');
    await copyFile(resolve('scripts/assets3d/safe-path.mjs'), modulePath);
    await linkDirectory(external, join(repo, 'assets3d-local'));
    const isolated = await import(pathToFileURL(modulePath).href);
    await expect(isolated.safeOutputPath('assets3d-local/report.json', { force: true })).rejects.toThrow('unsafe-output-path');
  });
  it('particle CLI refuses repository files and supports explicit safe overwrites', async () => {
    const root = await temporary(true), source = join(root, 'source.json'), output = join(root, 'nested/report.json');
    await writeFile(source, '{}');
    const cli = (...args: string[]) => spawnSync(process.execPath, [resolve('scripts/assets3d/particle-inventory.mjs'), source, ...args], { encoding: 'utf8' });
    const style = await readFile(resolve('src/style.css'));
    const escaped = cli('src/style.css', '--force');
    expect(escaped.status).not.toBe(0); expect(escaped.stderr).toContain('unsafe-output-path');
    expect(await readFile(resolve('src/style.css'))).toEqual(style);
    expect(cli(output).status).toBe(0);
    await writeFile(output, 'user-owned');
    expect(cli(output).stderr).toContain('output-exists-use-force');
    expect(await readFile(output, 'utf8')).toBe('user-owned');
    expect(cli(output, '--force').status).toBe(0);
    expect(JSON.parse(await readFile(output, 'utf8')).format).toBe('d7-lossless-particle-inventory-v1');
  });
  it('verifies normal source paths and rejects escaping manifest paths without links', async () => {
    const root = await temporary(), path = 'assets/characters/demo_jinx/texture.png';
    const bytes = await record(root, [path]);
    await mkdir(join(root, '.local/extracted/assets/characters/demo_jinx'), { recursive: true });
    await writeFile(join(root, '.local/extracted', path), bytes);
    expect((await verifySource(root, ['jinx'], sourceMap)).units.jinx.files).toBe(1);
    // Even unselected entries must be checked; traversal cannot hide behind hero filtering.
    for (const escape of ['../../../outside', resolve(root, '../outside')]) {
      await record(root, [path, escape]);
      await expect(verifySource(root, ['jinx'], sourceMap)).rejects.toThrow('unsafe-source-path');
    }
  });
  it('rejects an extracted source root pointing outside the input root', async () => {
    const root = await temporary(), external = await temporary();
    await record(root, []);
    await linkDirectory(external, join(root, '.local/extracted'));
    await expect(verifySource(root, [], sourceMap)).rejects.toThrow('unsafe-source-path');
  });
  it('checks actual manifest entry paths, including entries for unselected heroes', async () => {
    const root = await temporary(), external = await temporary(), path = 'assets/characters/demo_vi/texture.png';
    const bytes = await record(root, [path]);
    const parent = join(root, '.local/extracted/assets/characters'); await mkdir(parent, { recursive: true });
    await writeFile(join(external, 'texture.png'), bytes);
    await linkDirectory(external, join(parent, 'demo_vi'));
    await expect(verifySource(root, [], sourceMap)).rejects.toThrow('unsafe-source-path');
  });
  it('checks the extraction record file itself before reading it', async context => {
    const root = await temporary(), external = await temporary();
    await mkdir(join(root, '.local/extracted'), { recursive: true });
    await writeFile(join(external, 'extraction.json'), '{}');
    try { await symlink(join(external, 'extraction.json'), join(root, '.local/extraction.json'), 'file'); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform === 'win32' && code === 'EPERM') {
        context.skip('Windows 当前权限不允许创建文件符号链接 (EPERM)；safeInputPath 有无链接测试');
      }
      throw error;
    }
    await expect(verifySource(root, [], sourceMap)).rejects.toThrow('unsafe-source-path');
  });
});

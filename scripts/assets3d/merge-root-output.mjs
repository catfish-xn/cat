// This opt-in output policy is only for full asset-root merges, not converters.
import { lstat, readdir, readFile, mkdir, writeFile, rename, rm, realpath } from 'node:fs/promises';
import { dirname, join, parse, relative, resolve, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

export const ROOT_GENERATOR = 'assets3d/build-asset-root';

export const contains = (root, path) => {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
};
export async function realOutput(path, directory = true) {
  if (!path || path.split(/[\\/]/).some(p => p === '..' || p.toLowerCase() === '.git')) throw new Error('unsafe-merge-output');
  const target = resolve(path), base = parse(target).root;
  if (target === base) throw new Error('unsafe-merge-output');
  let current = base;
  const parts = relative(base, target).split(sep);
  for (const [i, part] of parts.entries()) {
    current = join(current, part);
    let info;
    try { info = await lstat(current); } catch (e) { if (e.code === 'ENOENT') return join(current, ...parts.slice(i + 1)); throw e; }
    if (info.isSymbolicLink()) throw new Error('merge-output-link');
    current = await realpath(current);
    if (i < parts.length - 1 || directory) {
      if (!info.isDirectory()) throw new Error('merge-output-not-directory');
    } else if (!info.isFile()) throw new Error('merge-output-not-file');
  }
  return current;
}
/** Asset payloads inside this worktree must be covered by a .gitignore rule.
 * check-ignore is read-only; --no-index also checks already tracked paths.
 */
export async function ignoredOutput(path, reason = 'merge-output-not-ignored') {
  const output = await realOutput(path);
  const workspace = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  if (!contains(workspace, output)) return output;
  const rel = relative(workspace, output).split(sep).join('/');
  if (!rel) throw new Error(reason);
  let stdout;
  try {
    const check = promisify(execFile)('git', [
      '-c', 'core.excludesFile=', 'check-ignore', '--no-index', '--verbose', '-z', '--stdin',
    ], { cwd: workspace, windowsHide: true });
    check.child.stdin.end(`${rel}/\0`);
    ({ stdout } = await check);
  } catch (e) {
    if (e.code === 1) throw new Error(reason);
    throw new Error(`${reason}:ignore-check-failed`, { cause: e });
  }
  const [source, , pattern] = stdout.split('\0');
  // Do not accept .git/info/exclude or a negated rule as repository protection.
  if (!/(^|[\\/])\.gitignore$/.test(source) || !pattern || pattern.startsWith('!')) throw new Error(reason);
  return output;
}
async function checkTree(path) {
  await realOutput(path);
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink()) throw new Error('merge-output-link');
    if (entry.isDirectory()) await checkTree(child);
    else await realOutput(child, false);
  }
}
async function checkReplacement(output, force) {
  await checkTree(output);
  if (!force) throw new Error('output-exists-use-force');
  if (!(await readdir(output)).length) return;
  let report;
  try { report = JSON.parse(await readFile(join(output, 'merge-report.json'), 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'EISDIR' && !(e instanceof SyntaxError)) throw e;
  }
  if (report?.generator !== ROOT_GENERATOR) throw new Error('refuse-force-foreign-output');
}
/** All input validation happens before this call. Stage, then replace; restore on failure. */
export async function publishRoot(output, files, force) {
  let exists = false;
  try { await lstat(output); exists = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (exists) {
    await checkReplacement(output, force);
  }
  const staging = `${output}.building-${randomUUID()}`, backup = `${output}.backup-${randomUUID()}`;
  await realOutput(staging); await realOutput(backup);
  let saved = false, published = false;
  try {
    await mkdir(dirname(staging), { recursive: true });
    await realOutput(staging); await mkdir(staging);
    for (const [path, data] of files) {
      const target = join(staging, path);
      await realOutput(target, false);
      await mkdir(dirname(target), { recursive: true });
      await realOutput(target, false);
      await writeFile(target, data, { flag: 'wx' });
    }
    await realOutput(output);
    if (exists) { await checkReplacement(output, force); await rename(output, backup); saved = true; }
    else {
      // Detect a destination created while staging instead of replacing it.
      try { await lstat(output); throw new Error('merge-output-changed'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    await rename(staging, output); published = true;
  } catch (e) {
    if (saved && !published) await rename(backup, output);
    throw e;
  } finally {
    // Only remove our checked, generated siblings, never an input or output path.
    for (const path of [staging, ...(saved && published ? [backup] : [])]) {
      try { await checkTree(path); await rm(path, { recursive: true }); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
}

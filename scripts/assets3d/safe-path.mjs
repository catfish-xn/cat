import { lstat, mkdir, realpath, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));

/** Component-aware containment, also usable without filesystem links. */
export function withinRoot(root, candidate, reason = 'path-outside-root') {
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(reason);
  return candidate;
}

/** Both the supplied root and the resolved file must remain inside the input. */
export async function safeInputPath(root, candidate) {
  withinRoot(resolve(root), resolve(candidate), 'unsafe-source-path');
  const input = await realpath(root);
  return withinRoot(input, await realpath(candidate), 'unsafe-source-path');
}

/** Resolved assets3d-local directory; follows a repo-root symlink to a real directory. */
async function assets3dLocalBound(repo) {
  const logical = join(repo, 'assets3d-local');
  try {
    const info = await lstat(logical);
    if (!info.isSymbolicLink() && !info.isDirectory()) throw new Error('unsafe-output-path');
    const resolved = await realpath(logical);
    if (!(await lstat(resolved)).isDirectory()) throw new Error('unsafe-output-path');
    return resolved;
  } catch (error) {
    if (error.code === 'ENOENT') return logical;
    throw error;
  }
}

/** Resolve existing ancestors before any mkdir/write. The trust root is never caller supplied. */
export async function safeOutputPath(output, { force = false, directory = false } = {}) {
  const repo = await realpath(repository);
  const localLogical = join(repo, 'assets3d-local');
  const localBound = await assets3dLocalBound(repo);
  if (typeof output !== 'string' || !output || output.split(/[\\/]/).includes('..')) throw new Error('unsafe-output-path');
  const candidate = resolve(isAbsolute(output) ? output : join(repo, output));
  let target;
  try {
    target = withinRoot(localLogical, candidate, 'unsafe-output-path');
  } catch (error) {
    if (localBound === localLogical) throw error;
    target = withinRoot(localBound, candidate, 'unsafe-output-path');
  }
  if (target === localLogical && !directory) throw new Error('unsafe-output-path');
  // Walk from the repository, or from the bound tree when the root is an external directory link.
  let current;
  let parts;
  try {
    withinRoot(localLogical, target, 'unsafe-output-path');
    current = repo;
    parts = relative(repo, target).split(sep).filter(Boolean);
  } catch {
    current = localBound;
    parts = relative(localBound, target).split(sep).filter(Boolean);
  }
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return join(current, ...parts.slice(i + 1));
    }
    current = withinRoot(localBound, await realpath(current), 'unsafe-output-path');
    const last = i === parts.length - 1;
    if (!last || directory) {
      if (!(await lstat(current)).isDirectory()) throw new Error('output-not-directory');
    } else {
      if (info.isSymbolicLink()) throw new Error('output-symlink');
      if (!info.isFile()) throw new Error('output-not-file');
      if (!force) throw new Error('output-exists-use-force');
    }
  }
  return current;
}

export async function writeOutputFile(output, data, options = {}) {
  const target = await safeOutputPath(output, options);
  await mkdir(dirname(target), { recursive: true });
  const checked = await safeOutputPath(target, options);
  await writeFile(checked, data, { flag: options.force ? 'w' : 'wx' });
}

/** A complete validated payload becomes visible in one rename; no partial cache files. */
export async function writeOutputFileAtomic(output, data, options = {}) {
  const target = await safeOutputPath(output, options);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeOutputFile(temporary, data);
    await rename(await safeOutputPath(temporary, { force: true }), await safeOutputPath(target, options));
  } finally {
    try { await unlink(await safeOutputPath(temporary, { force: true })); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

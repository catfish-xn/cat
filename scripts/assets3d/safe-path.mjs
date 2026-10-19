import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
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

/** Resolve existing ancestors before any mkdir/write. The trust root is never caller supplied. */
export async function safeOutputPath(output, { force = false, directory = false } = {}) {
  const repo = await realpath(repository), local = join(repo, 'assets3d-local');
  if (typeof output !== 'string' || !output || output.split(/[\\/]/).includes('..')) throw new Error('unsafe-output-path');
  const target = withinRoot(local, resolve(repo, output), 'unsafe-output-path');
  if (target === local && !directory) throw new Error('unsafe-output-path');
  // Walk from the repository so assets3d-local itself cannot become a new trust root via a link.
  let current = repo;
  const parts = relative(repo, target).split(sep);
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return join(current, ...parts.slice(i + 1));
    }
    current = withinRoot(local, await realpath(current), 'unsafe-output-path');
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

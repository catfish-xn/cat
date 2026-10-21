import { readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { realOutput, ignoredOutput, publishRoot } from './merge-root-output.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const metadata = new Set(['manifest.json', 'precache.json', 'packs.json']);
function validPath(path) {
  return typeof path === 'string' && path.length > 0 &&
    path.split('/').every(p => p && p !== '.' && p !== '..' && p.toLowerCase() !== '.git') &&
    !/[\\:\x00-\x1f]/.test(path) && !metadata.has(basename(path)) && !path.startsWith('packs/');
}
/** Nested merged roots retain their module directory. Board takes precedence,
 * then effects (including standalone meshes/textures), then model/unit trees. */
export function packGroup(path) {
  const parts = path.toLowerCase().split('/');
  if (parts.some(p => ['board', 'boards'].includes(p))) return 'board';
  if (parts.some(p => ['effects', 'meshes', 'textures'].includes(p))) {
    if (!parts.some(p => ['models', 'units', 'champions', 'neutrals', 'little-legends'].includes(p))) return 'effects';
  }
  if (parts.some(p => ['models', 'units', 'champions', 'neutrals', 'little-legends'].includes(p))) return 'models';
  return 'other';
}
async function absent(path) {
  try { await lstat(path); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  throw new Error(`pack-output-exists:${path}`);
}
/** --out contains packs only; source files are never copied or changed. */
export async function packRoot({ root, out, maxBytes = 16 * 1024 * 1024 }) {
  if (!root) throw new Error('missing-root');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('invalid-max-bytes');
  const input = await realOutput(root);
  const target = await ignoredOutput(out ?? root);
  const inPlace = target === input;
  if (!inPlace) await absent(target);
  else { await absent(join(target, 'packs')); await absent(join(target, 'packs.json')); }
  const index = JSON.parse(await readFile(join(input, 'precache.json'), 'utf8'));
  if (index.schemaVersion !== 1 || !Array.isArray(index.files)) throw new Error('invalid-precache');
  const seen = new Set(), groups = new Map();
  // Validate all source bytes before publishing anything.
  for (const f of index.files) {
    if (!validPath(f.path) || seen.has(f.path.toLowerCase()) || !Number.isSafeInteger(f.bytes) || f.bytes < 0 ||
        typeof f.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error(`invalid-precache-file:${f.path}`);
    seen.add(f.path.toLowerCase());
    const path = await realOutput(join(input, f.path), false);
    const data = await readFile(path);
    if (data.length !== f.bytes || hash(data) !== f.sha256) throw new Error(`precache-mismatch:${f.path}`);
    if (data.length > maxBytes) throw new Error(`file-exceeds-max-bytes:${f.path}`);
    const group = packGroup(f.path);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ path: f.path, bytes: f.bytes, sha256: f.sha256, data });
  }
  const manifest = { schemaVersion: 1, packs: [] }, payloads = new Map();
  for (const group of [...groups.keys()].sort(compare)) {
    const chunks = [];
    let files = [], bytes = 0;
    for (const f of groups.get(group).sort((a, b) => compare(a.path, b.path))) {
      if (files.length && bytes + f.bytes > maxBytes) { chunks.push(files); files = []; bytes = 0; }
      files.push(f); bytes += f.bytes;
    }
    if (files.length) chunks.push(files);
    chunks.forEach((chunk, i) => {
      const name = chunks.length === 1 ? group : `${group}-${i + 1}`;
      const data = Buffer.concat(chunk.map(f => f.data));
      let offset = 0;
      const files = chunk.map(f => {
        const entry = { path: f.path, offset, bytes: f.bytes, sha256: f.sha256 };
        offset += f.bytes; return entry;
      });
      const path = `packs/${name}.bin`;
      manifest.packs.push({ name, path, bytes: data.length, sha256: hash(data), files });
      payloads.set(path, data);
    });
  }
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (inPlace) {
    await publishRoot(join(target, 'packs'), new Map([...payloads].map(([p, b]) => [p.slice(6), b])), false);
    await writeFile(await realOutput(join(target, 'packs.json'), false), json, { flag: 'wx' });
  } else {
    payloads.set('packs.json', json);
    await publishRoot(target, payloads, false);
  }
  return manifest;
}
export function packArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = { '--root': 'root', '--out': 'out', '--max-bytes': 'maxBytes' }[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--') || key in options) throw new Error('usage: --root <root> [--out <new-directory>] [--max-bytes <integer>]');
    options[key] = key === 'maxBytes' ? Number(args[++i]) : args[++i];
  }
  return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packRoot(packArguments(process.argv.slice(2))).then(m => {
    for (const p of m.packs) console.log(`${p.path}: ${p.bytes} bytes (${p.files.length} files)`);
    console.log(`${m.packs.length} packs, ${m.packs.reduce((n, p) => n + p.files.length, 0)} files`);
  }).catch(e => { console.error(e.message); process.exitCode = 1; });
}

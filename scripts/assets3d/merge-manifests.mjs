import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { contracts } from './runtime.mjs';

const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function assetPath(path) {
  if (typeof path !== 'string' || !path || /[\\:%?#\x00-\x1f]/.test(path) || path.startsWith('/') ||
      path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('unsafe-merge-path');
  return path;
}
function rootPath(path) {
  if (typeof path !== 'string' || !path || path.split(/[\\/]/).includes('..')) throw new Error('unsafe-merge-root');
  return resolve(path);
}
const contains = (root, path) => {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
};
/** Every reference is relative to units/<id>, including particle textures and meshes.
 * Preflight all inputs, conflicts and destinations before copying any payload.
 * Existing identical content is skipped; different content is never overwritten. */
export async function mergeManifests({ from, out } = {}) {
  if (!Array.isArray(from) || !from.length) throw new Error('missing-merge-from');
  const output = await safeOutputPath(rootPath(out), { directory: true });
  const { assertManifest, parseParticleDocument } = await contracts();
  const models = Object.create(null), effects = Object.create(null), plans = new Map(), folded = new Map();
  const report = { schemaVersion: 1, ready: false, batches: from, models: 0, effects: 0,
    modelBytes: 0, bytes: 0, files: 0, written: 0, skipped: 0, writtenBytes: 0, missing: [] };
  let schemaVersion;
  async function plan(root, path) {
    assetPath(path);
    if (['manifest.json', 'action-bindings.json', 'merge-report.json', 'precache.json'].includes(path.toLowerCase())) throw new Error('reserved-merge-path');
    // Refuse case-only aliases on all platforms, so a Linux merge is safe on Windows too.
    const lower = path.toLowerCase();
    if (folded.has(lower) && folded.get(lower) !== path) throw new Error(`merge-path-case-conflict:${path}`);
    folded.set(lower, path);
    let bytes, source;
    try {
      source = await safeInputPath(root, join(root, path));
      if (!(await stat(source)).isFile()) throw new Error(`merge-input-not-file:${path}`);
      bytes = await readFile(source);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      report.missing.push({ root, path }); return null;
    }
    const sha256 = hash(bytes), previous = plans.get(path);
    if (previous && previous.sha256 !== sha256) throw new Error(`merge-path-conflict:${path}`);
    plans.set(path, { source, root, bytes: bytes.length, sha256 });
    return bytes;
  }
  function entries(target, incoming, kind) {
    for (const [id, entry] of Object.entries(incoming ?? {})) {
      if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new Error(`invalid-${kind}-id:${id}`);
      if (Object.hasOwn(target, id)) throw new Error(`duplicate-${kind}-id:${id}`);
      target[id] = entry;
    }
  }
  for (const input of from) {
    const batch = rootPath(input), realBatch = await safeInputPath(batch, batch);
    if (contains(realBatch, output) || contains(output, realBatch)) throw new Error('merge-output-overlaps-source');
    let roots;
    try {
      const units = await safeInputPath(batch, join(batch, 'units'));
      roots = await Promise.all((await readdir(units)).sort().map(dir => {
        assetPath(dir); return safeInputPath(units, join(units, dir));
      }));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      roots = [realBatch]; // An already merged asset root is also a valid input.
    }
    for (const root of roots) {
      if (!(await stat(root)).isDirectory()) throw new Error(`merge-unit-not-directory:${root}`);
      let manifest;
      try { manifest = JSON.parse(await readFile(await safeInputPath(root, join(root, 'manifest.json')), 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        report.missing.push({ root, path: 'manifest.json' }); continue;
      }
      assertManifest(manifest);
      if (schemaVersion !== undefined && schemaVersion !== manifest.schemaVersion) throw new Error('merge-schema-mismatch');
      schemaVersion = manifest.schemaVersion;
      entries(models, manifest.models, 'model'); entries(effects, manifest.effects, 'effect');
      for (const [id, model] of Object.entries(manifest.models)) {
        if (model.path !== `models/${id}/model.glb`) throw new Error('invalid-merge-model-path');
        await plan(root, model.path);
      }
      for (const effect of Object.values(manifest.effects ?? {})) {
        const bytes = await plan(root, effect.path);
        if (!bytes) continue;
        const doc = parseParticleDocument(JSON.parse(bytes.toString('utf8')));
        const refs = new Set(doc.emitters.flatMap(e => [e.texture, e.mesh, e.distortion?.normalMap]).filter(Boolean));
        for (const ref of refs) await plan(root, ref);
      }
    }
  }
  report.models = Object.keys(models).length; report.effects = Object.keys(effects).length;
  report.files = plans.size; report.bytes = [...plans.values()].reduce((sum, p) => sum + p.bytes, 0);
  report.modelBytes = Object.values(models).reduce((sum, m) => sum + (plans.get(m.path)?.bytes ?? 0), 0);
  const manifest = { schemaVersion: schemaVersion ?? 1, models, effects };
  assertManifest(manifest);
  const manifestBytes = json(manifest);
  const precacheBytes = json({ schemaVersion: 1, files: [...plans].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([path, p]) => ({ path, bytes: p.bytes, sha256: p.sha256 })) });
  async function destination(path, sha256) {
    const dest = await safeOutputPath(join(output, path), { force: true });
    try {
      if (hash(await readFile(dest)) !== sha256) throw new Error(`output-content-conflict:${path}`);
      return true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
  }
  const skipped = new Map();
  for (const [path, p] of plans) skipped.set(path, await destination(path, p.sha256));
  const manifestExists = await destination('manifest.json', hash(manifestBytes));
  const precacheExists = await destination('precache.json', hash(precacheBytes));
  await safeOutputPath(join(output, 'merge-report.json'), { force: true });
  if (!report.missing.length && report.models > 0) {
    for (const [path, p] of plans) {
      if (skipped.get(path)) { report.skipped++; continue; }
      const bytes = await readFile(await safeInputPath(p.root, p.source));
      if (hash(bytes) !== p.sha256) throw new Error(`merge-input-changed:${path}`);
      await writeOutputFileAtomic(join(output, path), bytes);
      report.written++; report.writtenBytes += bytes.length;
    }
    if (!manifestExists) await writeOutputFileAtomic(join(output, 'manifest.json'), manifestBytes);
    if (!precacheExists) await writeOutputFileAtomic(join(output, 'precache.json'), precacheBytes);
    report.ready = true;
  }
  // bytes/files count unique runtime payloads, excluding manifest and this report.
  report.manifestBytes = manifestBytes.length;
  await writeOutputFileAtomic(join(output, 'merge-report.json'), json(report), { force: true });
  return report;
}
export function mergeArguments(args) {
  const result = { from: [], out: undefined };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') {
      const start = result.from.length;
      while (args[i + 1] && !args[i + 1].startsWith('--')) result.from.push(args[++i]);
      if (result.from.length === start) throw new Error('missing-merge-from');
    } else if (args[i] === '--out' && args[i + 1] && !args[i + 1].startsWith('--') && !result.out) result.out = args[++i];
    else throw new Error(`invalid-merge-argument:${args[i]}`);
  }
  if (!result.from.length || !result.out) throw new Error('usage: --from <batch> [<batch> ...] --out <new-root>');
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await mergeManifests(mergeArguments(process.argv.slice(2)));
    console.log(JSON.stringify(report)); if (!report.ready) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

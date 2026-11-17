// Snapshot add: put new models and new vfx-ltk systems into a registered local snapshot (an asset root that is not on the
// test server: asset-local-register writes its .local-snapshot), adding only. Every existing manifest entry, index entry
// and file stays byte for byte; anything that would change one is refused before a byte is written.
//
//   node scripts/assets3d/snapshot-add.mjs --root <snapshot dir> --tag <name> [--models <built root>]
//     [--vfx-pack <pack dir in root, e.g. vfx-ltk/set13/tft13_x> --vfx-from <vfx export dir> [--systems id,id]] [--dry]
//
// --models: every models[id] in <built root>/manifest.json (a build-all/compress output) is added as a new id; its model
//   file is copied to roots/add-<tag>/<path> and the entry's path points there. Precache gains the copied files.
// --vfx-pack/--vfx-from: the export's systems (all, or --systems) go into the pack's systems/ and index.systems; its assets
//   not yet in the pack go to add-<tag>/<file> and index.assets. The pack's skills are not touched. A pack that does not
//   exist yet is created (no champions mapping: wiring it to a unit is a separate step). Precache gains the new pack files
//   only when the pack already has files in precache (or, for a new pack, never). A file this run rewrites (a pack's
//   index.json) gets its precache line updated and leaves its pack's file list in packs.json (the .bin is not touched).
// After a real run the manifest is checked with assertManifest (src/rendering3d/contracts.ts) and the old and new
// manifest sha256 and the counts are printed. Re-register the snapshot afterwards (asset-local-register): its id changes.
import { readFile, writeFile, mkdir, copyFile, stat, realpath, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from './runtime.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async path => { try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const json = value => `${JSON.stringify(value, null, 2)}\n`;
/** Roots this tool must never write: the server's own tree, plus any in ASSETS3D_REFUSED_ROOTS (colon separated). A live
 * copy of the server is refused by its .live-snapshot marker wherever it is. */
export const REFUSED_ROOTS = Object.freeze(['/srv/', ...(process.env.ASSETS3D_REFUSED_ROOTS ?? '').split(':').filter(Boolean)]);
const TAG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const SAFE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/]+$/;

function fail(reason) { throw new Error(`snapshot-add: ${reason}`); }
const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** A relative path from an input index or manifest, checked before it is joined to anything (join would fold `..`). */
const relative = (path, what) => { if (typeof path !== 'string' || !SAFE.test(path)) fail(`unsafe ${what} path ${path}`); return path; };
/** The deepest existing ancestor of `path`, resolved: a symbolic link inside the root must not lead a new file outside it. */
async function insideRoot(root, path) {
  let at = dirname(path);
  for (;;) { try { const real = await realpath(at); if (real !== root && !real.startsWith(root + sep)) fail(`${path} would be written outside the root (through ${at})`); return; }
    catch (error) { if (error.code !== 'ENOENT') throw error; at = dirname(at); } }
}

/** A root this tool may write: registered as a local snapshot and none of REFUSED_ROOTS. */
export async function assertLocalSnapshot(root, refused = REFUSED_ROOTS) {
  const real = await realpath(root);
  for (const bad of refused) if (real === bad.replace(/\/$/, '') || real.startsWith(bad.endsWith('/') ? bad : bad + sep)) fail(`refusing ${real} (live root or test server)`);
  if (await exists(join(real, '.live-snapshot'))) fail(`${real} is a live copy (.live-snapshot), not a local snapshot`);
  if (!(await exists(join(real, '.local-snapshot')))) fail(`${real} is not a registered local snapshot (asset-local-register)`);
  return real;
}

/** The additions, planned without writing: files to copy (from, to, bytes, sha256) and the new manifest / indexes. */
export async function planAdd({ root, tag, models, vfxPack, vfxFrom, systems }) {
  if (!TAG.test(tag ?? '')) fail('--tag must be lowercase letters, digits and dashes');
  if (!models && !vfxPack) fail('nothing to add: give --models and/or --vfx-pack with --vfx-from');
  if (Boolean(vfxPack) !== Boolean(vfxFrom)) fail('--vfx-pack and --vfx-from go together');
  const files = [], addedModels = [], addedSystems = [], addedAssets = [], planned = new Map();
  const want = async (from, to) => {
    if (!SAFE.test(to)) fail(`unsafe target path ${to}`);
    const bytes = await readFile(from), sum = sha256(bytes), target = join(root, to);
    // Two inputs naming one file (assets deduplicated in an export): one copy, one precache line; different bytes are refused.
    if (planned.has(to)) { const seen = planned.get(to); if (seen.sha256 !== sum) fail(`${to} planned twice with different content`); return seen; }
    await insideRoot(root, target);
    if (await exists(target)) {
      if (sha256(await readFile(target)) !== sum) fail(`${to} exists with different content`);
      return { to, bytes: bytes.length, sha256: sum, existed: true };
    }
    const entry = { from, to, bytes: bytes.length, sha256: sum, existed: false }; files.push(entry); planned.set(to, entry); return entry;
  };
  const manifestBefore = await readFile(join(root, 'manifest.json'), 'utf8'), manifest = JSON.parse(manifestBefore);
  if (models) {
    const built = JSON.parse(await readFile(join(models, 'manifest.json'), 'utf8'));
    for (const [id, entry] of Object.entries(built.models ?? {})) {
      if (Object.hasOwn(manifest.models, id)) fail(`model id ${id} already in the snapshot`);
      if (!ID.test(id)) fail(`unsafe model id ${id}`);
      relative(entry.path, `model ${id}`);
      const to = posix.join('roots', `add-${tag}`, entry.path);
      await want(join(models, entry.path), to);
      manifest.models[id] = { ...entry, path: to }; addedModels.push(id);
    }
  }
  let pack = null;
  if (vfxPack) {
    if (!SAFE.test(vfxPack) || !vfxPack.startsWith('vfx-ltk/')) fail('--vfx-pack must be a vfx-ltk/... directory inside the root');
    const from = JSON.parse(await readFile(join(vfxFrom, 'index.json'), 'utf8'));
    const indexPath = join(root, vfxPack, 'index.json'), created = !(await exists(indexPath));
    const indexBefore = created ? null : await readFile(indexPath, 'utf8');
    const index = created ? { version: from.version ?? 1, systems: {}, assets: {}, skills: {} } : JSON.parse(indexBefore);
    const pick = systems ? systems.split(',') : Object.keys(from.systems ?? {});
    for (const id of pick) {
      if (!ID.test(id)) fail(`unsafe system id ${id}`);
      const rel = from.systems?.[id]; if (!rel) fail(`system ${id} is not in the export`);
      relative(rel, `system ${id}`);
      const to = `systems/${id}.json`;
      if (Object.hasOwn(index.systems, id)) {
        // Already in the pack: only an identical file is allowed (nothing to add).
        if (sha256(await readFile(join(root, vfxPack, index.systems[id]))) !== sha256(await readFile(join(vfxFrom, rel)))) fail(`system ${id} already in ${vfxPack} with different content`);
        continue;
      }
      await want(join(vfxFrom, rel), posix.join(vfxPack, to)); index.systems[id] = to; addedSystems.push(id);
    }
    for (const [key, rel] of Object.entries(from.assets ?? {})) {
      relative(rel, `asset ${key}`);
      if (Object.hasOwn(index.assets, key)) {
        if (sha256(await readFile(join(root, vfxPack, index.assets[key]))) !== sha256(await readFile(join(vfxFrom, rel)))) fail(`asset ${key} already in ${vfxPack} with different content`);
        continue;
      }
      const to = posix.join(`add-${tag}`, rel);
      await want(join(vfxFrom, rel), posix.join(vfxPack, to)); index.assets[key] = to; addedAssets.push(key);
    }
    pack = { dir: vfxPack, created, indexBefore, index };
  }
  return { manifestBefore, manifest, pack, files, addedModels, addedSystems, addedAssets };
}

/** Precache with the new files appended, in the existing file's order (vfx files only for an already precached pack), and
 * the entries of files this run rewrites (`changed`: path → {bytes, sha256}, e.g. a pack's index.json) brought up to date. */
export function precacheWith(precache, files, pack, changed = new Map()) {
  precache = { ...precache, files: precache.files.map(f => changed.has(f.path) ? { ...f, ...changed.get(f.path) } : f) };
  const seen = new Set(precache.files.map(f => f.path));
  const packPrecached = pack && !pack.created && precache.files.some(f => f.path.startsWith(pack.dir + '/'));
  const extra = files.filter(f => !f.to.startsWith('vfx-ltk/') || packPrecached).map(({ to, bytes, sha256 }) => ({ path: to, bytes, sha256 }));
  for (const f of extra) if (seen.has(f.path)) fail(`precache already lists ${f.path}`);
  return { ...precache, files: [...precache.files, ...extra] };
}

/** packs.json with every file in `rewritten` taken out of its pack's file list (the pack's .bin is left as it is), as the
 * submesh patch does for changed models: a pack line that no longer matches its file would make readPackList drop all packs. */
export function packsWithout(packs, rewritten) {
  const list = Array.isArray(packs) ? packs : packs.packs, removed = [];
  const next = list.map(pack => ({ ...pack, files: pack.files.filter(file => { const hit = rewritten.has(file.path); if (hit) removed.push(`${pack.path}:${file.path}`); return !hit; }) }));
  return { packs: Array.isArray(packs) ? next : { ...packs, packs: next }, removed };
}

export async function snapshotAdd({ root, tag, models, vfxPack, vfxFrom, systems, dry = false, refused, validate } = {}) {
  root = await assertLocalSnapshot(root, refused);
  const plan = await planAdd({ root, tag, models, vfxPack, vfxFrom, systems });
  const precacheBefore = await readFile(join(root, 'precache.json'), 'utf8');
  const changed = new Map();
  const packIndexText = plan.pack ? json(plan.pack.index) : null;
  if (plan.pack && !plan.pack.created && packIndexText !== plan.pack.indexBefore)
    changed.set(`${plan.pack.dir}/index.json`, { bytes: Buffer.byteLength(packIndexText), sha256: sha256(packIndexText) });
  const manifestText = plan.addedModels.length ? json(plan.manifest) : plan.manifestBefore;
  if (manifestText !== plan.manifestBefore) changed.set('manifest.json', { bytes: Buffer.byteLength(manifestText), sha256: sha256(manifestText) });
  const precache = precacheWith(JSON.parse(precacheBefore), plan.files, plan.pack, changed);
  const precacheChanged = JSON.stringify(precache) !== JSON.stringify(JSON.parse(precacheBefore));
  const packsPath = join(root, 'packs.json'), packsBefore = await exists(packsPath) ? JSON.parse(await readFile(packsPath, 'utf8')) : null;
  const { packs, removed: packsRemoved } = packsBefore ? packsWithout(packsBefore, new Set(changed.keys())) : { packs: null, removed: [] };
  if (plan.pack) await insideRoot(root, join(root, plan.pack.dir, 'index.json'));
  // Only additions: every model that was there is unchanged as JSON, and nothing else at the top level changed.
  const before = JSON.parse(plan.manifestBefore);
  for (const [id, entry] of Object.entries(before.models)) if (JSON.stringify(entry) !== JSON.stringify(plan.manifest.models[id])) fail(`model ${id} would change`);
  for (const key of Object.keys(before)) if (key !== 'models' && JSON.stringify(before[key]) !== JSON.stringify(plan.manifest[key])) fail(`manifest ${key} would change`);
  validate ??= (await contracts()).assertManifest;
  validate(plan.manifest);
  const manifestAfter = manifestText;
  const report = { root, tag, dry, addedModels: plan.addedModels, addedSystems: plan.addedSystems, addedAssets: plan.addedAssets.length,
    files: plan.files.map(({ to, bytes, sha256 }) => ({ path: to, bytes, sha256 })),
    manifest: { before: sha256(plan.manifestBefore), after: sha256(manifestAfter) },
    precacheAdded: precache.files.length - JSON.parse(precacheBefore).files.length, precacheUpdated: [...changed.keys()].filter(p => JSON.parse(precacheBefore).files.some(f => f.path === p)), packsRemoved, pack: plan.pack ? { dir: plan.pack.dir, created: plan.pack.created } : null };
  if (dry) return report;
  for (const f of plan.files) { await mkdir(dirname(join(root, f.to)), { recursive: true }); await copyFile(f.from, join(root, f.to)); }
  const put = async (path, text) => { const tmp = `${path}.tmp-snapshot-add`; await mkdir(dirname(path), { recursive: true }); await writeFile(tmp, text); await rename(tmp, path); };
  if (plan.pack) await put(join(root, plan.pack.dir, 'index.json'), packIndexText);
  if (precacheChanged) await put(join(root, 'precache.json'), json(precache));
  if (packsRemoved.length) await put(packsPath, json(packs));
  if (plan.addedModels.length) await put(join(root, 'manifest.json'), manifestAfter);
  return report;
}

export function snapshotAddArguments(argv) {
  const names = { '--root': 'root', '--tag': 'tag', '--models': 'models', '--vfx-pack': 'vfxPack', '--vfx-from': 'vfxFrom', '--systems': 'systems' }, options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry') { options.dry = true; continue; }
    const key = names[argv[i]], value = argv[i + 1];
    if (!key || !value || value.startsWith('--') || options[key] !== undefined) fail(`bad argument ${argv[i]}`);
    options[key] = value; i++;
  }
  if (!options.root) fail('--root is required');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await snapshotAdd(snapshotAddArguments(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    if (!report.dry) console.log('assertManifest ok; re-register the snapshot now (asset-local-register): its id changes');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

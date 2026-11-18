// Replace one existing model's whole entry in an assets3d manifest.json; every other model and every top-level key must
// stay the same as JSON. The new manifest is checked with assertManifest (src/rendering3d/contracts.ts) before it is
// written; backups of the manifest before and after go to --backup-dir.
//   node scripts/assets3d/replace-entry.mjs --manifest <file> --hero <id> --entry <json: {<id>: {...}} or {...}>
//     --backup-dir <dir> [--dry]
// It never adds a model (that is snapshot-add.mjs) and never writes anything but the manifest it is given.
import { readFile, writeFile, copyFile, mkdir, rename } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from './runtime.mjs';

/** The manifest with `hero` replaced by `entry`, and the fields that change ({key: [before, after]}); refuses anything else. */
export function replaceEntry(before, hero, entry) {
  if (!before.models?.[hero]) throw new Error(`replace-entry: no models.${hero}`);
  if (!entry || typeof entry !== 'object' || !entry.path || !entry.animations) throw new Error('replace-entry: entry lacks path/animations, refusing a partial entry');
  const after = structuredClone(before); after.models[hero] = entry;
  for (const id of Object.keys(before.models)) if (id !== hero && JSON.stringify(before.models[id]) !== JSON.stringify(after.models[id])) throw new Error(`replace-entry: other model changed: ${id}`);
  const old = before.models[hero], changes = {};
  for (const key of new Set([...Object.keys(old), ...Object.keys(entry)]))
    if (JSON.stringify(old[key]) !== JSON.stringify(entry[key])) changes[key] = [old[key] ?? null, entry[key] ?? null];
  return { after, changes };
}

export async function replaceEntryFile({ manifest, hero, entry, backupDir, dry = false, validate } = {}) {
  for (const [name, value] of Object.entries({ manifest, hero, entry, backupDir })) if (!value) throw new Error(`replace-entry: --${name} is required`);
  const before = JSON.parse(await readFile(manifest, 'utf8')), given = JSON.parse(await readFile(entry, 'utf8'));
  const { after, changes } = replaceEntry(before, hero, given[hero] && Object.keys(given).length === 1 ? given[hero] : given);
  validate ??= (await contracts()).assertManifest;
  validate(after);
  if (dry) return { dry: true, changes };
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
  await mkdir(backupDir, { recursive: true });
  const pre = join(backupDir, `${basename(manifest)}.before-${hero}-${stamp}`), post = join(backupDir, `${basename(manifest)}.after-${hero}-${stamp}`);
  await copyFile(manifest, pre);
  const tmp = `${manifest}.tmp-replace-entry`; await writeFile(tmp, `${JSON.stringify(after, null, 2)}\n`); await rename(tmp, manifest);
  await copyFile(manifest, post);
  return { dry: false, changes, backups: [pre, post] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = { '--manifest': 'manifest', '--hero': 'hero', '--entry': 'entry', '--backup-dir': 'backupDir' }, options = {};
  const argv = process.argv.slice(2);
  try {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--dry') { options.dry = true; continue; }
      const key = names[argv[i]]; if (!key || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`replace-entry: bad argument ${argv[i]}`);
      options[key] = argv[++i];
    }
    const result = await replaceEntryFile(options);
    for (const [key, [a, b]] of Object.entries(result.changes)) console.log(`${options.hero}.${key}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    console.log(result.dry ? 'assertManifest ok; dry run, nothing written' : `assertManifest ok; backups: ${result.backups.join(' ')}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

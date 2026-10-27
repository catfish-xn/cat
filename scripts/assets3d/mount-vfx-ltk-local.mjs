/** Local trial root only. Symlinks assets; writes only a local manifest, never changes the export. */
import { readFile, writeFile, mkdir, readdir, symlink, lstat, realpath } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
if (!args.export || !args.models) throw new Error('--export=<vfx-tool/out> --models=<existing 3D root> required');
const trial = resolve(args.trial ?? 'assets3d-local/trial'), ignored = resolve('assets3d-local') + sep;
await mkdir(trial, { recursive: true });
if (!(await realpath(trial)).startsWith(ignored)) throw new Error('trial must be a real directory under ignored assets3d-local');
execFileSync('git', ['check-ignore', '--quiet', join(trial, 'vfx-ltk')]);
const link = async (source, target) => {
  try { await lstat(target); if (await realpath(target) !== await realpath(source)) throw new Error(`refusing existing path ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await symlink(resolve(source), target); }
};
await link(args.export, join(trial, 'vfx-ltk'));
const modelRoot = resolve(args.models);
if (modelRoot === trial) throw new Error('model source must be outside destination');
for (const entry of await readdir(modelRoot)) if (!['manifest.json', 'vfx-ltk'].includes(entry)) await link(join(modelRoot, entry), join(trial, entry));
const manifest = JSON.parse(await readFile(join(modelRoot, 'manifest.json'), 'utf8'));
if (!manifest.models?.jinx || !manifest.models?.vi) throw new Error('model root must include Jinx and Vi');
manifest.models.jinx.castVariants = { ...manifest.models.jinx.castVariants,
  rotate: ['tft13_jinx_spell_zap', 'tft13_jinx_spell_flamechompers', 'tft13_jinx_spell_deathrocket'] };
await writeFile(join(trial, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${trial}: models and vfx-ltk ready; export unchanged`);

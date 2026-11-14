/** Offline only: verified Rust LTK exports -> isolated child catalogues + merged release lists.
 * Never contacts or writes a server; baseline files must be obtained read-only beforehand. */
import { readFile, writeFile, mkdir, copyFile, mkdtemp, realpath } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const stage = resolve(args.stage ?? '/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch2-stage');
const source = resolve(args.source ?? '/tmp/vfx4-set13');
if (!stage.includes('/assets3d-local/') && !stage.startsWith('/tmp/')) throw Error('stage must stay outside tracked assets');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const expected = {
  'manifest.json': 'c70837476b0ecf586c7a57b735bc07a6153d837f57018d50cd18f1b01b359d28',
  'precache.json': '5a3429ddf48cb86e7a7de57b546ac4a8a1b4eed8fd219fb51d529e4cc7b79d89',
  'vfx-ltk-index.json': 'bdc2ca200ef05235aac5c7cbed62c8dcfac4b2e719fd5065f67625947089e1fb',
};
const baseline = {};
for (const [name, digest] of Object.entries(expected)) {
  const b = await readFile(join(stage, 'baseline', name));
  if (sha(b) !== digest) throw Error(`baseline changed: ${name}`);
  baseline[name] = JSON.parse(b);
}
const scratch = await mkdtemp('/tmp/vfx-batch2-stage-');
await build({ stdin: { resolveDir: process.cwd(), contents: ['jayce','sevika','viktor','jinx','mel','warwick'].map(c =>
  `export { ${c}Skills } from './src/rendering/three-mode/vfx-ltk/champions/${c}';`).join('\n') +
  `\nexport { parseIndex } from './src/rendering/three-mode/vfx-ltk/loader';`, loader: 'ts' },
  outfile: join(scratch, 'profiles.mjs'), format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
const profiles = await import(pathToFileURL(join(scratch, 'profiles.mjs')));
const root = structuredClone(baseline['vfx-ltk-index.json']); root.champions ??= {};
const added = [], heroes = [], sources = { jayce: 'jayce', sevika: 'lieutenant', viktor: 'viktor', jinx: 'jinx', mel: 'missmage', warwick: 'warwick' };
for (const [champion, name] of Object.entries(sources)) {
  const folder = join(source, `tft13_${name}`), src = await realpath(folder);
  const index = JSON.parse(await readFile(join(src, 'index.json')));
  index.skills = profiles[`${champion}Skills`];
  profiles.parseIndex(index); // Includes the unchanged twelve-cue, 128-system and 2048-asset bounds.
  const prefix = `vfx-ltk/batch2/tft13_${name}`, destination = join(stage, prefix);
  const paths = new Set([...Object.values(index.systems), ...Object.values(index.assets)]);
  for (const rel of paths) {
    if (typeof rel !== 'string' || rel.startsWith('/') || rel.split('/').includes('..')) throw Error(`unsafe path ${rel}`);
    const from = await realpath(join(src, rel));
    if (relative(src, from).startsWith('..')) throw Error('source escapes export');
    const to = join(destination, rel); await mkdir(dirname(to), { recursive: true }); await copyFile(from, to);
    added.push(`${prefix}/${rel}`);
  }
  await json(join(destination, 'index.json'), index); added.push(`${prefix}/index.json`);
  root.champions[champion] = `batch2/tft13_${name}/index.json`;
  heroes.push({ champion, folder: `tft13_${name}`, systems: Object.keys(index.systems).length, assets: Object.keys(index.assets).length,
    files: paths.size + 1, profiles: Object.fromEntries(Object.entries(index.skills).map(([k,v]) => [k, v.length])) });
}
profiles.parseIndex(root);
await mkdir(join(stage, 'vfx-ltk'), { recursive: true }); await json(join(stage, 'vfx-ltk/index.json'), root); added.push('vfx-ltk/index.json');
// LTK discovery uses its own root index. The existing model manifest needs no further changes (Jinx is already W/E/R).
await copyFile(join(stage, 'baseline/manifest.json'), join(stage, 'manifest.json'));
await json(join(stage, 'manifest.delta.json'), { changed: {}, reason: 'LTK uses vfx-ltk/index.json; preserve all deployed model/effect entries byte for byte.' });
await json(join(stage, 'vfx-ltk-index.delta.json'), { champions: Object.fromEntries(Object.keys(sources).map(k => [k, root.champions[k]])) });
const precache = structuredClone(baseline['precache.json']), files = new Map(precache.files.map(e => [e.path, e]));
const delta = [];
for (const path of added.sort()) {
  const b = await readFile(join(stage, path)); const entry = { path, bytes: b.length, sha256: sha(b) }; files.set(path, entry); delta.push(entry);
}
precache.files = [...files.values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
await json(join(stage, 'precache.json'), precache); await json(join(stage, 'precache.delta.json'), { schemaVersion: precache.schemaVersion, files: delta });
await json(join(stage, 'release-summary.json'), { baselineSha256: expected, heroes, ltkFiles: added.length,
  payloadFiles: added.filter(p => !p.endsWith('/index.json')).length, indexFiles: added.filter(p => p.endsWith('/index.json')).length,
  ltkBytes: delta.reduce((n,e) => n + e.bytes, 0), precacheFiles: files.size,
  preservedPrecacheEntries: baseline['precache.json'].files.length - 1,
  outputSha256: Object.fromEntries(await Promise.all(['manifest.json','precache.json','vfx-ltk/index.json'].map(async p => [p, sha(await readFile(join(stage,p)))]))) });
console.log(JSON.stringify({ stage, heroes, ltkFiles: added.length, precacheFiles: files.size }));

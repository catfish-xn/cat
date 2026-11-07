/** Build a payload closure and additive catalogues. Does not upload or modify Git. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const stage = resolve(args.stage ?? 'assets3d-local/vfx-batch3-stage'), exported = resolve(args.exported ?? '/tmp/vfxb3-export');
const sha = b => createHash('sha256').update(b).digest('hex');
const save = async (p, value) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(value, null, 2) + '\n'); };
const read = async p => JSON.parse(await readFile(p));
for (const [file, digest] of Object.entries({ 'manifest.json': 'c70837476b0ecf586c7a57b735bc07a6153d837f57018d50cd18f1b01b359d28',
  'precache.json': '5a3429ddf48cb86e7a7de57b546ac4a8a1b4eed8fd219fb51d529e4cc7b79d89', 'index.json': 'bdc2ca200ef05235aac5c7cbed62c8dcfac4b2e719fd5065f67625947089e1fb' }))
  if (sha(await readFile(join(stage, 'baseline', file))) !== digest) throw Error('baseline-changed:' + file);
const bundle = '/tmp/vfxb3-timelines.mjs';
await build({ entryPoints: ['src/rendering/three-mode/vfx-ltk/batch3/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'silent' });
const { batch3Timelines } = await import(pathToFileURL(bundle));
const root = await read(join(stage, 'baseline/index.json')), manifest = await read(join(stage, 'baseline/manifest.json')),
  precache = await read(join(stage, 'baseline/precache.json')), delta = { version: 1, champions: {} }, files = new Map();
const register = async rel => { const b = await readFile(join(stage, rel)); files.set(rel, { path: rel, bytes: b.length, sha256: sha(b) }); };
const copy = async (from, rel) => { const path = join(stage, rel); await mkdir(dirname(path), { recursive: true }); await copyFile(from, path); await register(rel); };
for (const [hero, skills] of Object.entries(batch3Timelines)) {
  const source = 'tft13_' + (hero === 'g23-sion' ? 'sion' : hero === 'loris' ? 'beardy' : hero);
  const folder = ['sion', 'elise', 'swain'].some(c => source === 'tft13_' + c) ? join(exported, source) : join('/tmp/vfx4-set13', source);
  const index = await read(join(folder, 'index.json')); index.skills = skills;
  for (const cues of Object.values(skills)) for (const cue of cues) if (!index.systems[cue.system]) throw Error('missing-system:' + hero + ':' + cue.system);
  const prefix = 'vfx-ltk/batch3/' + source + '/';
  for (const rel of new Set([...Object.values(index.systems), ...Object.values(index.assets)])) {
    if (typeof rel !== 'string' || rel.startsWith('/') || rel.split('/').includes('..')) throw Error('asset-path');
    await copy(join(folder, rel), prefix + rel);
  }
  await save(join(stage, prefix, 'index.json'), index); await register(prefix + 'index.json');
  const path = 'batch3/' + source + '/index.json';
  if (root.champions?.[hero] && root.champions[hero] !== path) throw Error('champion-conflict:' + hero);
  delta.champions[hero] = path;
}
const models = await read('/tmp/vfxb3-models/manifest.delta.json');
for (const [id, model] of Object.entries(models.models)) {
  if (manifest.models[id]) throw Error('model-conflict:' + id);
  await copy('/tmp/vfxb3-models/' + model.path, model.path); manifest.models[id] = model;
}
root.champions = { ...root.champions, ...delta.champions };
await save(join(stage, 'vfx-ltk/index.json'), root); await register('vfx-ltk/index.json');
await save(join(stage, 'manifest.json'), manifest);
const byPath = new Map(precache.files.map(e => [e.path, e]));
for (const [path, file] of files) byPath.set(path, file);
precache.files = [...byPath.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
await save(join(stage, 'precache.json'), precache);
await save(join(stage, 'index.delta.json'), delta);
await save(join(stage, 'manifest.delta.json'), models);
await save(join(stage, 'precache.delta.json'), { schemaVersion: 1, files: [...files.values()] });
await save(join(stage, 'payload-files.json'), [...files.values()].filter(f => f.path !== 'vfx-ltk/index.json'));
await writeFile(join(stage, 'payload-paths.txt'), [...files.keys()].filter(p => p !== 'vfx-ltk/index.json').sort().join('\n') + '\n');
await register('manifest.json'); await register('precache.json');
await save(join(stage, 'delivery-files.json'), [...files.values()]);
const summary = { heroes: Object.keys(batch3Timelines), ltkFiles: [...files.keys()].filter(p => p.startsWith('vfx-ltk/')).length,
  modelFiles: Object.keys(models.models).length, payloadFiles: files.size - 3, publishFiles: files.size,
  precacheFiles: precache.files.length, payloadBytes: [...files.values()].filter(f => !['manifest.json', 'precache.json', 'vfx-ltk/index.json'].includes(f.path)).reduce((n, f) => n + f.bytes, 0),
  sha256: Object.fromEntries(['vfx-ltk/index.json', 'manifest.json', 'precache.json'].map(p => [p, files.get(p).sha256])) };
await save(join(stage, 'summary.json'), summary); console.log(JSON.stringify(summary, null, 2));

/** CPU validation of the staged original assets. No browser, network or uploads. */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';
sharp.concurrency(4);
const stage = resolve(process.argv[2] ?? 'assets3d-local/vfx-batch3-stage'), bundle = '/tmp/vfxb3-verify.mjs';
await build({ stdin: { contents: `export {createVfxLibrary, parseIndex} from './src/rendering/three-mode/vfx-ltk/loader';
export {createLtkParticles} from './src/rendering/three-mode/vfx-ltk/particles';
export {DataTexture, PerspectiveCamera} from 'three';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: bundle, logLevel: 'silent' });
const { createVfxLibrary, createLtkParticles, parseIndex, DataTexture, PerspectiveCamera } = await import(bundle);
const json = async p => JSON.parse(await readFile(join(stage, p)));
const report = { files: 0, systems: 0, accepted: 0, failures: [], heroes: [] };
for (const f of await json('delivery-files.json')) {
  const b = await readFile(join(stage, f.path));
  if (b.length !== f.bytes || createHash('sha256').update(b).digest('hex') !== f.sha256) throw Error('payload-digest:' + f.path); report.files++;
}
for (const [oldName, newName] of [['manifest.json', 'manifest.json'], ['index.json', 'vfx-ltk/index.json']]) {
  const old = await json('baseline/' + oldName), next = await json(newName);
  for (const [key, value] of Object.entries(old)) {
    if (typeof value === 'object' && value !== null) {
      for (const [id, entry] of Object.entries(value)) if (!isDeepStrictEqual(entry, next[key][id])) throw Error('lost-baseline:' + oldName + ':' + id);
    } else if (value !== next[key]) throw Error('baseline-value:' + key);
  }
}
const before = await json('baseline/precache.json'), after = new Map((await json('precache.json')).files.map(f => [f.path, f]));
for (const entry of before.files) if (entry.path !== 'vfx-ltk/index.json' && !isDeepStrictEqual(entry, after.get(entry.path))) throw Error('lost-precache:' + entry.path);
parseIndex(await json('vfx-ltk/index.json'));
const camera = new PerspectiveCamera(); camera.position.set(0, 200, 300); camera.updateMatrixWorld();
const anchor = { originAt: () => [0, 0, 0], basisInto(_t, out) { out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return out; } };
for (const [hero, path] of Object.entries((await json('index.delta.json')).champions)) {
  const prefix = 'http://local/vfx-ltk/';
  const local = url => { if (!url.startsWith(prefix)) throw Error('outside-root'); return join(stage, 'vfx-ltk', url.slice(prefix.length)); };
  const library = createVfxLibrary('http://local/', {
    readJson: async url => JSON.parse(await readFile(local(url))),
    readBinary: async url => { const b = await readFile(local(url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); },
    readTexture: async url => { const {data, info} = await sharp(local(url)).ensureAlpha().raw().toBuffer({resolveWithObject:true}); return new DataTexture(new Uint8Array(data), info.width, info.height); },
  }, { groundPass: true, directory: path.slice(0, -'index.json'.length) });
  const index = await library.ready; if (!index) throw Error('invalid-index:' + hero);
  const accepted = new Set();
  for (const id of Object.keys(index.systems)) {
    report.systems++;
    try {
      const prepared = await library.load(id), fx = createLtkParticles(prepared, { anchor, target: anchor, joints: () => anchor, duration: 1, seed: 1 });
      try { for (let i = 0; i < 30; i++) fx.update(1 / 30, camera); } finally { fx.dispose(); }
      accepted.add(id); report.accepted++;
    } catch (e) { report.failures.push({ hero, id, error: String(e) }); }
  }
  const variants = Object.fromEntries(Object.entries(index.skills).map(([variant, cues]) => [variant, {cues: cues.length, ready: cues.every(c => accepted.has(c.system))}]));
  report.heroes.push({hero, systems: Object.keys(index.systems).length, accepted: accepted.size, variants}); library.dispose();
}
await writeFile(join(stage, 'validation.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;

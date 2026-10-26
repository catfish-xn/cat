/** Node-only real loader/particle-driver audit. No browser or GPU; game files never become fixtures. */
import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
sharp.concurrency(4);
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
if (!args.root || !args.out) throw new Error('--root=<asset root containing vfx-ltk/> --out=<report.json> required');
const scratch = await mkdtemp(join(tmpdir(), 'cat-ltk-local-'));
try {
  const outfile = join(scratch, 'audit.mjs');
  await build({ stdin: { contents: `export { createVfxLibrary } from './src/rendering/three-mode/vfx-ltk/loader';
    export { createLtkParticles } from './src/rendering/three-mode/vfx-ltk/particles';
    export { DataTexture, PerspectiveCamera } from 'three';`, resolveDir: process.cwd(), loader: 'ts' },
    outfile, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  const { createVfxLibrary, createLtkParticles, DataTexture, PerspectiveCamera } = await import(pathToFileURL(outfile));
  const root = resolve(args.root) + '/', library = createVfxLibrary(root, {
    readJson: async url => JSON.parse(await readFile(url, 'utf8')),
    readBinary: async url => { const bytes = await readFile(url); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
    readTexture: async url => { const { data, info } = await sharp(url).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return new DataTexture(new Uint8Array(data), info.width, info.height); },
  });
  const index = await library.ready; if (!index) throw new Error('index failed');
  const results = [], camera = new PerspectiveCamera(); camera.position.set(0, 200, 300); camera.updateMatrixWorld();
  const anchor = { originAt: () => [0, 0, 0], basisInto: (_time, out) => { out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return out; } };
  for (const id of Object.keys(index.systems)) {
    try {
      const prepared = await library.load(id);
      const fx = createLtkParticles(prepared, { anchor, target: null, joints: () => anchor, duration: 2, seed: 1 });
      try { for (let frame = 0; frame < 60; frame++) fx.update(1 / 30, camera); }
      finally { fx.dispose(); }
      results.push({ id, status: prepared.empty ? 'empty-noop' : 'loaded', emitters: prepared.drawn.length,
        meshes: prepared.meshes.size, skinned: prepared.poses?.size ?? 0 });
    } catch (error) { results.push({ id, status: 'rejected', error: String(error) }); }
  }
  library.dispose();
  const report = { root, total: results.length, loaded: results.filter(r => r.status === 'loaded').length,
    empty: results.filter(r => r.status === 'empty-noop').length, rejected: results.filter(r => r.status === 'rejected').length,
    timelines: index.skills, results, gpuVerified: false };
  await writeFile(args.out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, loaded: report.loaded, empty: report.empty, rejected: report.rejected }));
  for (const row of results.filter(r => r.status === 'rejected')) console.error(row.id, row.error);
  if (report.rejected) process.exitCode = 1;
} finally { await rm(scratch, { recursive: true, force: true }); }

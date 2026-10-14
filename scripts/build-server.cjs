const fs = require('node:fs/promises');
const path = require('node:path');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '..');

(async () => {
  const outdir = path.join(root, 'dist-server');
  await fs.rm(outdir, { recursive: true, force: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: { index: 'src/server-entry/index.ts', 'run-battle': 'scripts/run-server-battle.mjs' },
    outdir, outExtension: { '.js': '.mjs' }, chunkNames: 'chunks/[name]-[hash]',
    bundle: true, splitting: true, platform: 'node', target: 'node22.12', format: 'esm',
    metafile: true, logLevel: 'info',
  });
  const inputs = Object.keys(result.metafile.inputs);
  if (inputs.some(input => /src\/(rendering|presentation|persistence|replay|server)\/|node_modules\/phaser\//.test(input))) {
    throw new Error('Non-rule implementation reached the server entry');
  }
  await fs.writeFile(path.join(outdir, 'metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
  console.log(`Server ESM built: ${inputs.length} inputs; Node >=22.12; dist-server/index.mjs, dist-server/run-battle.mjs`);
})().catch(error => { console.error(error); process.exitCode = 1; });

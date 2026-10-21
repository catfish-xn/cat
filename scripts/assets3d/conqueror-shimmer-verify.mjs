import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validatePropRoot } from './conqueror-shimmer.mjs';
import { contracts } from './runtime.mjs';
import { writeOutputFileAtomic } from './safe-path.mjs';
import { compressionIO } from './compress.mjs';
import { Matrix4, Vector3 } from 'three';

const { assertManifest, parseParticleDocument } = await contracts(), results = [];
const io = await compressionIO();
for (const root of ['assets3d-local/conqueror-shimmer/root', 'assets3d-local/conqueror-shimmer-compressed']) {
  const readJson = async p => JSON.parse(await readFile(join(root, p), 'utf8'));
  const manifest = await readJson('manifest.json'), precache = await readJson('precache.json'), bindings = await readJson('action-bindings.json');
  assertManifest(manifest);
  const files = new Map();
  async function walk(dir = '') {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const p = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(p);
      else if (!['manifest.json', 'precache.json', 'compression-report.json'].includes(p)) files.set(p, await readFile(join(root, p)));
    }
  }
  await walk(); validatePropRoot(manifest, bindings, precache, files);
  for (const [p, bytes] of files) if (p.endsWith('.glb')) {
    const document = await io.readBinary(bytes);
    if (p === manifest.models['shimmer-flask'].path) {
      const main = document.getRoot().listNodes().find(n => n.getName() === 'Main');
      const wrapper = document.getRoot().listNodes().find(n => n.getName() === 'shimmer-upright-export');
      if (!main || !wrapper) throw Error('missing-shimmer-upright-node');
      const up = new Vector3(0, 1, 0).transformDirection(new Matrix4().fromArray(main.getWorldMatrix()));
      if (up.distanceTo(new Vector3(0, 1, 0)) > 1e-5) throw Error('shimmer-default-not-upright');
    }
  }
  for (const effect of Object.values(manifest.effects)) parseParticleDocument(await readJson(effect.path));
  results.push({ root, valid: true, payloadFiles: files.size, payloadBytes: [...files.values()].reduce((s, b) => s + b.length, 0),
    models: Object.keys(manifest.models), effects: Object.keys(manifest.effects) });
}
await writeOutputFileAtomic('assets3d-local/conqueror-shimmer/verification.json', JSON.stringify(results, null, 2) + '\n', { force: true });
console.log(JSON.stringify(results));

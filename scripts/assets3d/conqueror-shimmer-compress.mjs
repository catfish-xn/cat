import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { writeOutputFileAtomic } from './safe-path.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { compressAssets } from './compress.mjs';
const destination = 'assets3d-local/conqueror-shimmer-compressed';
const report = process.argv.includes('--finalize-only') ? JSON.parse(await readFile(destination + '/compression-report.json', 'utf8'))
  : await compressAssets({ from: 'assets3d-local/conqueror-shimmer/root', out: destination, onProgress: p => console.log(JSON.stringify(p)) });
// The shared compressor indexes only manifest-reachable resources. This pack also
// ships independent UI action bindings; include every shipped payload, with hashes.
const files = new Map();
async function walk(dir = '') {
  for (const e of await readdir(destination + '/' + dir, { withFileTypes: true })) {
    const p = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(p);
    else if (!['manifest.json', 'precache.json', 'compression-report.json'].includes(p)) {
      const b = await readFile(destination + '/' + p);
      files.set(p, { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') });
    }
  }
}
await walk();
const precache = JSON.stringify(createPrecache(files), null, 2) + '\n';
await writeOutputFileAtomic(destination + '/precache.json', precache, { force: true });
const baseBytes = [...files.values()].reduce((s, f) => s + f.bytes, 0) + Buffer.byteLength(precache) + (await readFile(destination + '/manifest.json')).length;
report.runtimeBytes = [...files.values()].reduce((s, f) => s + f.bytes, 0);
report.precachePolicy = 'all-shipped-payloads-including-action-bindings';
for (let i = 0; i < 10; i++) { report.afterBytes = baseBytes + Buffer.byteLength(JSON.stringify(report, null, 2) + '\n'); report.ratio = Number((report.afterBytes / report.beforeBytes).toFixed(6)); }
await writeOutputFileAtomic(destination + '/compression-report.json', JSON.stringify(report, null, 2) + '\n', { force: true });
await writeOutputFileAtomic('assets3d-local/conqueror-shimmer/compression-source.json', JSON.stringify({ upstream: 'scripts/assets3d/compress.mjs', sha256: createHash('sha256').update(await readFile(new URL('./compress.mjs', import.meta.url))).digest('hex'), directImport: true, beforeBytes: report.beforeBytes, afterBytes: report.afterBytes }, null, 2) + '\n', { force: true });
console.log(JSON.stringify(report));

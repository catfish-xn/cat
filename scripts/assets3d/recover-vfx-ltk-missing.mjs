/** Offline missing-reference recovery from the pinned 14.24 chunk cache; never downloads. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, join, dirname } from 'node:path';
import { readRman } from './rman.mjs';
import { offlineArchiveReader } from './global-vfx.mjs';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
if (!args.source || !args.out || !resolve(args.out).startsWith('/tmp/')) throw Error('--source=<cache root> --out=/tmp/<export> required');
const root = resolve(args.source), out = resolve(args.out), wanted = new Map();
for (const name of await readdir(out)) {
  if (!name.startsWith('tft13_')) continue;
  try {
    const inventory = JSON.parse(await readFile(join(out, name, 'inventory.json')));
    for (const failure of inventory.failures) if (failure.kind === 'asset' && failure.reason === 'not in extracted asset root')
      wanted.set(failure.path.toLowerCase(), { path: failure.path, champion: name });
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const paths = new Map(), toc = new Map();
for await (const line of createInterface({ input: createReadStream(join(root, 'hashes/hashes.game.txt')), crlfDelay: Infinity })) {
  const hash = line.slice(0,16), path = line.slice(17), lower = path.toLowerCase();
  if (wanted.has(lower)) paths.set(lower, { hash, path });
  if (lower.endsWith('.subchunktoc')) toc.set(hash, path);
}
const manifest = readRman(await readFile(join(root, '14.24.manifest'))), plan = { wads: [] };
const reader = offlineArchiveReader({ manifest, plan, readChunk: id => readFile(join(root, 'chunks', `${id}.zst`)),
  write: async (path, bytes) => { const destination = join(out, '_overlay', path.slice('extracted/'.length));
    await mkdir(dirname(destination), { recursive:true }); await writeFile(destination, bytes); } });
const results = [];
for (const [key, wantedAsset] of wanted) {
  const named = paths.get(key); let recovered = false, reason = 'not-in-name-table';
  if (named) {
    const candidates = ['DATA/FINAL/Maps/Shipping/Map22.wad.client', ...manifest.files.filter(f => f.name.toLowerCase().endsWith('/'+wantedAsset.champion+'.wad.client')).map(f=>f.name)];
    for (const wad of candidates) {
      try {
        const archive = await reader.archive(wad), entry = archive.index.find(e => e.hash === named.hash);
        if (!entry) { reason = 'not-in-cached-wad-index'; continue; }
        if (!plan.wads.some(w => w.name === wad)) plan.wads.push({name:wad,entries:archive.index.filter(e=>toc.has(e.hash)).map(e=>({...e,path:toc.get(e.hash)}))});
        await reader.extract({ ...entry, path: named.path, wad }); recovered = true; break;
      } catch (error) { reason = String(error); }
    }
  }
  results.push({ ...wantedAsset, recovered, ...(!recovered ? { reason } : {}) });
}
await writeFile(join(out, 'missing-recovery.json'), JSON.stringify({results, missingChunks:[...reader.missing.values()],files:reader.files},null,2));
console.log(JSON.stringify({wanted:wanted.size,recovered:results.filter(r=>r.recovered).length,missing:results.filter(r=>!r.recovered)}));

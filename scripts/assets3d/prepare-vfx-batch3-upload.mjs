/** Merge current remote catalogues with this batch. Only reads/writes local files. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
const sha = b => createHash('sha256').update(b).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export function mergeBatch3(manifest, index, precache, modelDelta, championDelta, files) {
  manifest = structuredClone(manifest); index = structuredClone(index); precache = structuredClone(precache);
  if (manifest.schemaVersion !== 1 || precache.schemaVersion !== 1 || index.version !== 1 || !Array.isArray(precache.files)) throw Error('catalogue-version');
  const insert = (target, delta, label) => { for (const [id, value] of Object.entries(delta)) {
    if (Object.hasOwn(target, id) && !isDeepStrictEqual(target[id], value)) throw Error(label + '-conflict:' + id);
    target[id] = value;
  } };
  insert(manifest.models, modelDelta.models, 'model');
  index.champions ??= {}; insert(index.champions, championDelta.champions, 'champion');
  const root = encode(index), entries = new Map(precache.files.map(e => [e.path, e]));
  for (const file of files) if (file.path !== 'vfx-ltk/index.json') {
    const old = entries.get(file.path); if (old && !isDeepStrictEqual(old, file)) throw Error('payload-conflict:' + file.path);
    entries.set(file.path, file);
  }
  entries.set('vfx-ltk/index.json', { path: 'vfx-ltk/index.json', bytes: root.length, sha256: sha(root) });
  if (entries.has('manifest.json')) { const bytes = encode(manifest); entries.set('manifest.json', { path: 'manifest.json', bytes: bytes.length, sha256: sha(bytes) }); }
  precache.files = [...entries.values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { manifest: encode(manifest), index: root, precache: encode(precache) };
}
async function main() {
  const stage = resolve(process.argv[2] ?? 'assets3d-local/vfx-batch3-stage');
  const read = p => readFile(join(stage, p)), json = async p => JSON.parse(await read(p));
  const previous = await Promise.all(['manifest', 'precache', 'index'].map(id => read('fresh/' + id + '.json')));
  const result = mergeBatch3(JSON.parse(previous[0]), JSON.parse(previous[2]), JSON.parse(previous[1]), await json('manifest.delta.json'), await json('index.delta.json'), (await json('precache.delta.json')).files);
  await mkdir(join(stage, 'publish/vfx-ltk'), { recursive: true });
  await writeFile(join(stage, 'publish/manifest.json'), result.manifest); await writeFile(join(stage, 'publish/precache.json'), result.precache); await writeFile(join(stage, 'publish/vfx-ltk/index.json'), result.index);
  const expected = (await json('payload-files.json')).concat(Object.entries(result).map(([name, bytes]) => ({ path: name === 'index' ? 'vfx-ltk/index.json' : name + '.json', bytes: bytes.length, sha256: sha(bytes) })));
  await writeFile(join(stage, 'publish/expected-files.json'), encode(expected));
  const report = { before: Object.fromEntries(['manifest', 'precache', 'index'].map((id,i) => [id + '.json', sha(previous[i])])),
    after: Object.fromEntries(Object.entries(result).map(([id,bytes]) => [id + '.json', sha(bytes)])), precacheFiles: JSON.parse(result.precache).files.length };
  await writeFile(join(stage, 'publish/merge-report.json'), encode(report)); console.log(JSON.stringify(report,null,2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

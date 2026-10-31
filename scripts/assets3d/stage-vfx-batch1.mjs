/** Local-only material staging. Never uploads; only reads the pinned remote snapshots. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';

export const BATCH1_BASELINE = {
  'manifest.json': 'c70837476b0ecf586c7a57b735bc07a6153d837f57018d50cd18f1b01b359d28',
  'precache.json': '5a3429ddf48cb86e7a7de57b546ac4a8a1b4eed8fd219fb51d529e4cc7b79d89',
  'ltk-index.json': 'bdc2ca200ef05235aac5c7cbed62c8dcfac4b2e719fd5065f67625947089e1fb',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const safe = path => {
  if (typeof path !== 'string' || isAbsolute(path) || /[\\?#:%]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('unsafe-path:' + path);
  return path;
};
export async function stageVfxBatch1({ stage, source = '/tmp/vfx4-set13', expected = BATCH1_BASELINE,
  timelineFile = resolve('src/rendering/three-mode/vfx-ltk/batch1-timelines.ts') }) {
  stage = resolve(stage); source = resolve(source);
  const baseline = {};
  for (const [name, digest] of Object.entries(expected)) {
    const bytes = await readFile(resolve(stage, 'baseline', name));
    if (sha(bytes) !== digest) throw Error('baseline-changed:' + name);
    baseline[name] = bytes;
  }
  const { code } = await transform(await readFile(timelineFile, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022' });
  const { BATCH1_DIRECTORIES, BATCH1_TIMELINES } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const root = JSON.parse(baseline['ltk-index.json']), before = JSON.parse(baseline['precache.json']);
  root.champions = { ...root.champions };
  const files = new Map();
  for (const entry of before.files) {
    safe(entry.path);
    if (files.has(entry.path)) throw Error('duplicate-precache:' + entry.path);
    files.set(entry.path, entry);
  }
  const additions = [], payload = [], childIndexes = [], champions = [];
  async function put(rel, bytes) {
    safe(rel);
    const entry = { path: rel, bytes: bytes.length, sha256: sha(bytes) }, old = files.get(rel);
    if (old && rel !== 'vfx-ltk/index.json' && (old.sha256 !== entry.sha256 || old.bytes !== entry.bytes)) throw Error('existing-payload-changed:' + rel);
    const target = resolve(stage, rel); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
    files.set(rel, entry); additions.push(entry);
  }
  for (const [champion, directory] of Object.entries(BATCH1_DIRECTORIES)) {
    safe(directory);
    const sourceIndex = await readFile(resolve(source, directory, 'index.json'));
    const child = JSON.parse(sourceIndex);
    const paths = [...new Set([...Object.values(child.systems), ...Object.values(child.assets)])].sort();
    const cues = BATCH1_TIMELINES[champion];
    for (const cue of cues) if (!Object.hasOwn(child.systems, cue.system)) throw Error('missing-system:' + champion + ':' + cue.system);
    for (const path of paths) {
      safe(path);
      const rel = directory + '/' + path;
      await put('vfx-ltk/' + rel, await readFile(resolve(source, directory, path))); payload.push(rel);
    }
    // Keep upstream system/asset maps, replace only this champion's presentation timeline.
    child.skills = { ...child.skills, [champion]: cues };
    const rel = directory + '/index.json'; await put('vfx-ltk/' + rel, Buffer.from(json(child))); childIndexes.push(rel);
    if (root.champions[champion] && root.champions[champion] !== rel) throw Error('existing-champion-changed:' + champion);
    root.champions[champion] = rel;
    champions.push({ champion, directory, systems: Object.keys(child.systems).length, assets: Object.keys(child.assets).length, files: paths.length + 1, sourceIndexSha256: sha(sourceIndex) });
  }
  await put('vfx-ltk/index.json', Buffer.from(json(root)));
  // LTK discovery uses its fixed root URL; manifest has no LTK registration field.
  await copyFile(resolve(stage, 'baseline/manifest.json'), resolve(stage, 'manifest.json'));
  await writeFile(resolve(stage, 'manifest.delta.json'), '{}\n');
  await writeFile(resolve(stage, 'precache.json'), json({ ...before, files: [...files.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) }));
  await writeFile(resolve(stage, 'precache.delta.json'), json({ schemaVersion: before.schemaVersion, files: additions }));
  await writeFile(resolve(stage, 'payload-files.txt'), payload.sort().join('\n') + '\n');
  await writeFile(resolve(stage, 'child-index-files.txt'), childIndexes.sort().join('\n') + '\n');
  await writeFile(resolve(stage, 'baseline.sha256'), Object.entries(expected).map(([name, digest]) => `${digest}  ${name === 'ltk-index.json' ? 'vfx-ltk/index.json' : name}`).join('\n') + '\n');
  const summary = { champions, payloadFiles: payload.length, childIndexFiles: childIndexes.length, rootIndexFiles: 1,
    ltkFiles: additions.length, ltkBytes: additions.reduce((sum, f) => sum + f.bytes, 0),
    oldPrecacheFiles: before.files.length, precacheFiles: files.size, addedPrecacheFiles: files.size - before.files.length,
    totalPrecacheBytes: [...files.values()].reduce((sum, f) => sum + f.bytes, 0),
    baseline: expected, output: Object.fromEntries(await Promise.all(['manifest.json', 'precache.json', 'vfx-ltk/index.json'].map(async name => [name, sha(await readFile(resolve(stage, name)))]))),
    manifestDelta: 'none; byte-for-byte preserved', stage: relative(process.cwd(), stage) };
  const checks = [...additions, ...await Promise.all(['manifest.json', 'precache.json'].map(async path => {
    const bytes = await readFile(resolve(stage, path)); return { path, bytes: bytes.length, sha256: sha(bytes) };
  }))];
  // Claude may pipe this into remote python after publishing. Generating it makes no network calls.
  await writeFile(resolve(stage, 'verify-upload.py'), [
    'import concurrent.futures, hashlib, json, urllib.request',
    `checks = json.loads(${JSON.stringify(JSON.stringify(checks))})`,
    'base = "http://127.0.0.1:5190/assets3d/"',
    'def verify(entry):',
    '    request = urllib.request.Request(base + entry["path"], headers={"Cache-Control": "no-cache"})',
    '    with urllib.request.urlopen(request, timeout=10) as response:',
    '        data = response.read()',
    '    if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:',
    '        raise RuntimeError("HTTP hash mismatch: " + entry["path"])',
    '    if entry["path"].endswith(".json"): json.loads(data)',
    'with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:',
    '    list(pool.map(verify, checks))',
    'print("Verified HTTP files:", len(checks))',
    '',
  ].join('\n'));
  await writeFile(resolve(stage, 'summary.json'), json(summary)); return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw Error('usage: node scripts/assets3d/stage-vfx-batch1.mjs <stage> [source]');
  console.log(json(await stageVfxBatch1({ stage: process.argv[2], ...(process.argv[3] ? { source: process.argv[3] } : {}) })));
}

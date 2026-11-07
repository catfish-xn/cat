/** CPU-only real-payload verification; bundle with esbuild before running. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Camera, Group, Scene, Texture } from 'three';
import sharp from 'sharp';
import { createVfxLibrary } from '../../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../../src/rendering/three-mode/vfx-ltk/runtime';
import { BATCH1_DIRECTORIES, BATCH1_TIMELINES } from '../../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import type { TimelineAction, TimelineVariant } from '../../src/rendering/three-mode/vfx-ltk/timeline';

const stage = resolve(process.argv[2]);
const read = async (url: string) => {
  if (!url.startsWith('/verify/vfx-ltk/')) throw Error('invalid-url');
  const path = url.slice('/verify/'.length);
  if (path.split('/').some(p => p === '..' || !p)) throw Error('invalid-path');
  return readFile(resolve(stage, path));
};
const delta = JSON.parse(await readFile(resolve(stage, 'precache.delta.json'), 'utf8'));
const baselineRoot = JSON.parse(await readFile(resolve(stage, 'baseline/ltk-index.json'), 'utf8'));
const root = JSON.parse(await readFile(resolve(stage, 'vfx-ltk/index.json'), 'utf8'));
for (const key of ['systems', 'assets', 'skills']) if (JSON.stringify(root[key]) !== JSON.stringify(baselineRoot[key])) throw Error('existing-root-changed:' + key);
for (const [name, path] of Object.entries(baselineRoot.champions ?? {})) if (root.champions[name] !== path) throw Error('existing-champion-changed:' + name);
if (!(await readFile(resolve(stage, 'manifest.json'))).equals(await readFile(resolve(stage, 'baseline/manifest.json')))) throw Error('manifest-changed');
const before = JSON.parse(await readFile(resolve(stage, 'baseline/precache.json'), 'utf8'));
const after = JSON.parse(await readFile(resolve(stage, 'precache.json'), 'utf8'));
const precache = new Map(after.files.map((item: { path: string }) => [item.path, item]));
for (const item of before.files) if (item.path !== 'vfx-ltk/index.json' && JSON.stringify(precache.get(item.path)) !== JSON.stringify(item)) throw Error('existing-precache-changed:' + item.path);
for (const item of delta.files) {
  const bytes = await readFile(resolve(stage, item.path));
  if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error('hash-mismatch:' + item.path);
}
const library = createVfxLibrary('/verify/', {
  readJson: async url => JSON.parse((await read(url)).toString()),
  readTexture: async url => {
    const bytes = await read(url), { info, data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const texture = new Texture(); texture.image = { width: info.width, height: info.height, data: new Uint8Array(data) }; return texture;
  },
  readBinary: async url => { const bytes = await read(url); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; },
}, { groundPass: true });
const source = { root: new Group(), body: null, alive: true }, target = { root: new Group(), body: null, alive: true };
target.root.position.x = 100;
const scene = new Scene(), runtime = createLtkRuntime(library, scene, id => id === 'source' ? source : id === 'target' ? target : undefined);
const camera = new Camera(), results = [];
for (const champion of Object.keys(BATCH1_DIRECTORIES) as (keyof typeof BATCH1_DIRECTORIES)[]) {
  const catalog = await library.champion(champion); if (!catalog?.index) throw Error('missing-champion:' + champion);
  const systems = [];
  for (const id of Object.keys(catalog.index.systems)) {
    const loaded = await catalog.load(id);
    systems.push({ id, emitters: loaded.drawn.length, empty: !!loaded.empty });
  }
  await runtime.warm(champion);
  const forms = [...new Set(BATCH1_TIMELINES[champion].map(c => `${c.action}:${c.variant ?? ''}`))], playback = [];
  for (const form of forms) {
    runtime.clear();
    const [action, variant] = form.split(':') as [TimelineAction, TimelineVariant | ''];
    const targets = variant === 'self' ? ['source'] : action === 'cast' && champion !== 'lux' || action === 'end' ? [] : ['target'];
    if (!runtime.play(champion, 'source', targets, 0, action, variant || undefined)) throw Error('form-not-covered:' + champion + ':' + form);
    const started = new Set<string>();
    for (let i = 0; i < 240; i++) {
      runtime.update(1 / 30, camera);
      for (const object of scene.children) started.add(String(object.userData.ltkSystem));
    }
    const expected = BATCH1_TIMELINES[champion].filter(c => c.action === action && c.variant === (variant || undefined)).map(c => c.system);
    for (const id of expected) if (!catalog.get(id)?.empty && !started.has(id)) throw Error('cue-never-started:' + champion + ':' + form + ':' + id);
    if (runtime.active || runtime.queued) throw Error('unclean-form:' + champion + ':' + form);
    playback.push({ form, systemsStarted: [...started] });
  }
  results.push({ champion, systems, playback });
}
runtime.dispose();
if (scene.children.length) throw Error('scene-leak');
const report = { method: 'Current loader, decoded real PNGs and LTK binary readers; CPU timeline/particle execution; no browser/GPU',
  preservedPrecacheEntries: before.files.length - 1, hashedFiles: delta.files.length, systems: results.reduce((n, r) => n + r.systems.length, 0),
  forms: results.reduce((n, r) => n + r.playback.length, 0), results };
await writeFile(resolve(stage, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, results: undefined }));

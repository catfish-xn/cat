/**
 * Read-only audit of the systems that hold an AttachedMesh emitter: does each load with the old (base) and new (branch)
 * loader, is it reached by a skill cue, and did the fix move it from the legacy path to the new engine.
 *
 * node scripts/assets3d/audit-attached-mesh.mjs --root=/data/aiapps/fx-compare-root/vfx-ltk --old=<repo at base> --new=<repo at branch> --out=<dir>
 * Writes <out>/attached-audit.json and <out>/attached-audit.md. Reads nothing outside --root, writes only --out.
 */
import { build } from 'esbuild';
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
for (const k of ['root', 'old', 'new', 'out']) if (!args[k]) throw Error(`--${k}= required`);
const root = resolve(args.root), out = resolve(args.out);
await mkdir(out, { recursive: true });

async function engine(repo, tag) {
  const outfile = join(out, `_engine-${tag}.mjs`);
  await build({ stdin: { contents: `export { createVfxLibrary } from './src/rendering/three-mode/vfx-ltk/loader';
 export { readVfxSystem } from './src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
 export { QUAD_TYPE } from './src/rendering/three-mode/vfx-ltk/engine/model/enums';
 export { DataTexture } from 'three';`, resolveDir: resolve(repo), loader: 'ts' },
    outfile, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  return import(pathToFileURL(outfile).href + `?${tag}`);
}
const OLD = await engine(args.old, 'old'), NEW = await engine(args.new, 'new');
const sharp = createRequire(join(resolve(args.new), 'package.json'))('sharp'); sharp.concurrency(4);

// Folders holding an index.json, one or two levels under root (set13/tft13_x, batch2/tft13_x).
async function folders(dir, depth = 0) {
  const found = [];
  try { await stat(join(dir, 'index.json')); found.push(dir); } catch {}
  if (depth >= 2) return found;
  for (const entry of await readdir(dir, { withFileTypes: true })) if (entry.isDirectory()) found.push(...await folders(join(dir, entry.name), depth + 1));
  return found;
}
const fieldOf = (node, name) => node?.type === 'struct' ? node.fields.find(f => f.name === name)?.value ?? null : null;
function* walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'struct') { yield node; for (const f of node.fields) yield* walk(f.value); }
  else if (node.type === 'container') for (const item of node.items) yield* walk(item);
  else if (node.type === 'map') for (const e of node.entries) yield* walk(e.value);
}
// Raw fields of every AttachedMesh emitter, independent of either loader.
function attachedEmitters(doc) {
  const rows = [];
  for (const node of walk(doc.root)) {
    if (node.class !== 'VfxEmitterDefinitionData') continue;
    const primitive = fieldOf(node, 'primitive');
    if (primitive?.class !== 'VfxPrimitiveAttachedMesh') continue;
    const mesh = fieldOf(primitive, 'mMesh');
    const lock = fieldOf(mesh, 'mLockMeshToAttachment');
    const subs = fieldOf(mesh, 'mSubmeshesToDraw'), always = fieldOf(mesh, 'mSubmeshesToDrawAlways');
    rows.push({ name: fieldOf(node, 'emitterName')?.value ?? null,
      lock: lock ? !!lock.value : null,
      skn: fieldOf(mesh, 'mMeshName')?.path ?? null, simple: fieldOf(mesh, 'mSimpleMeshName')?.path ?? null,
      submeshes: [...(subs?.items ?? []), ...(always?.items ?? [])].map(i => i.value ?? i.path ?? String(i.hash ?? '?')),
      reflection: !!fieldOf(node, 'reflectionDefinition'), erosion: !!fieldOf(node, 'erosionDefinition') });
  }
  return rows;
}
async function loadWith(E, folder, id) {
  const prefix = 'http://local/vfx-ltk/';
  const local = url => { if (!url.startsWith(prefix)) throw Error('outside-root'); return join(folder, url.slice(prefix.length)); };
  const library = E.createVfxLibrary('http://local/', {
    readJson: async url => JSON.parse(await readFile(local(url))),
    readBinary: async url => { const b = await readFile(local(url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
    readTexture: async url => { const { data, info } = await sharp(local(url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return new E.DataTexture(new Uint8Array(data), info.width, info.height); },
  }, { groundPass: true });
  try {
    const index = await library.ready;
    const cued = !!index && Object.values(index.skills).some(cues => cues?.some(c => c.system === id));
    try { const p = await library.load(id); return { ok: true, empty: !!p.empty, drawn: p.drawn.length, notes: p.notes ?? [], cued }; }
    catch (error) { return { ok: false, error: String(error.message ?? error), cued }; }
  } finally { library.dispose(); }
}

const warn = console.warn; console.warn = () => {};
const rows = [];
for (const folder of await folders(root)) {
  const index = JSON.parse(await readFile(join(folder, 'index.json')));
  for (const [id, path] of Object.entries(index.systems ?? {})) {
    let doc; try { doc = JSON.parse(await readFile(join(folder, path))); } catch { continue; }
    const emitters = attachedEmitters(doc);
    if (!emitters.length) continue;
    const before = await loadWith(OLD, folder, id), after = await loadWith(NEW, folder, id);
    rows.push({ folder: folder.slice(root.length + 1), id, system: String(doc.name ?? '').split('/').pop(), emitters, before, after,
      switched: !!after.cued && after.ok && !after.empty && !(before.ok && !before.empty) });
  }
}
console.warn = warn;
await writeFile(join(out, 'attached-audit.json'), JSON.stringify(rows, null, 2));
const cell = r => r.ok ? (r.empty ? '空' : `ok(${r.drawn})`) : `失败 ${r.error.replace(/\|/g, '/')}`;
const md = ['| 目录 | id | 系统 | 附着发射器（lock/部件） | 被技能点到 | 修前 | 修后 | 切到新引擎 | 降级/跳过 |', '|---|---|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.folder} | ${r.id} | ${r.system} | ${r.emitters.map(e => `${e.name}(${e.lock ?? '-'}${e.submeshes.length ? '/' + e.submeshes.join('+') : ''}${e.simple ? '/静态' : ''})`).join(', ')} | ${r.after.cued ? '是' : '否'} | ${cell(r.before)} | ${cell(r.after)} | ${r.switched ? '**是**' : ''} | ${(r.after.notes ?? []).join(', ')} |`)];
const totals = { systems: rows.length, cued: rows.filter(r => r.after.cued).length, beforeOk: rows.filter(r => r.before.ok).length,
  afterOk: rows.filter(r => r.after.ok).length, switched: rows.filter(r => r.switched).length,
  reflectionFallback: rows.filter(r => r.after.notes?.some(n => n.startsWith('reflection-cube'))).map(r => r.id) };
md.unshift(`# 附着网格核对表\n\n实测方式：node + 真实加载器（esbuild 打包 src），贴图用 sharp 解码成像素（DataTexture），不是浏览器解码；素材根 ${root}。浏览器里的贴图解码、显卡相关问题此表查不到。\n\n${JSON.stringify(totals)}\n`);
await writeFile(join(out, 'attached-audit.md'), md.join('\n') + '\n');
console.log(JSON.stringify(totals));

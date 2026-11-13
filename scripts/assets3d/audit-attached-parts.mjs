/**
 * Read-only: for each AttachedMesh emitter in the attached audit, what it draws on its host's real model.
 * Before the part filter every attached emitter covered the whole body; with it, an emitter naming parts covers only
 * the host materials whose name hashes to one of them, and nothing when none does.
 *
 * node scripts/assets3d/audit-attached-parts.mjs --audit=<attached-audit.json> --models=<dir with champion .glb> --out=<dir>
 * A host is the .glb under --models with a path segment equal to the champion (tft13_x -> x, through ALIASES or
 * --alias=export:model,...), else the first whose path holds it.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
for (const k of ['audit', 'models', 'out']) if (!args[k]) throw Error(`--${k}= required`);
const out = resolve(args.out); await mkdir(out, { recursive: true });
// Export folder names that the model folders call by the champion's own name.
const ALIASES = { beardy: 'loris', blue: 'powder', chainsaw: 'renni', fish: 'steb', flyguy: 'scar', gremlin: 'smeech', lieutenant: 'sevika',
  nunuwillump: 'nunu', prime: 'vander', red: 'violet', renataglasc: 'renata', shooter: 'maddie', missmage: 'mel',
  ...Object.fromEntries((args.alias ?? '').split(',').filter(Boolean).map(pair => pair.split(':'))) };
const fnv = text => { let h = 0x811c9dc5; for (const b of new TextEncoder().encode(text.toLowerCase())) { h ^= b; h = Math.imul(h, 0x01000193); } return `0x${(h >>> 0).toString(16).padStart(8, '0')}`; };

async function glbs(dir, found = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await glbs(p, found); else if (e.name.toLowerCase().endsWith('.glb')) found.push(p);
  }
  return found;
}
async function gltfOf(path) {
  const b = await readFile(path); const length = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + length).toString('utf8'));
}
// Names a three.js skinned mesh exposes: each primitive's material name, and the node name of a single-material mesh.
function hostParts(gltf) {
  const parts = [];
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined || node.skin === undefined) continue;
    const prims = gltf.meshes[node.mesh].primitives;
    for (const prim of prims) {
      const material = prim.material !== undefined ? gltf.materials?.[prim.material]?.name ?? '' : '';
      parts.push({ node: node.name ?? '', material, single: prims.length === 1 });
    }
  }
  return parts;
}
// The reviewed exceptions of the checked-out code (cue-overrides.ts): those emitters keep the whole body.
const overridesFile = join(out, '_cue-overrides.mjs');
await build({ entryPoints: [resolve('src/rendering/three-mode/vfx-ltk/cue-overrides.ts')], outfile: overridesFile, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { ATTACHED_WHOLE_BODY = {} } = await import(pathToFileURL(overridesFile).href);
const all = await glbs(resolve(args.models));
const rows = JSON.parse(await readFile(resolve(args.audit), 'utf8'));
const report = [];
for (const row of rows) {
  const champion = (row.folder.split('/').pop() || row.system.split('_')[1] || '').replace(/^tft13_/, '').toLowerCase();
  const name = ALIASES[champion] ?? champion, root = resolve(args.models);
  const model = all.find(p => p.slice(root.length + 1).toLowerCase().split(/[/._-]/).includes(name))
    ?? all.find(p => p.slice(root.length + 1).toLowerCase().includes(name)) ?? null;
  let parts = null; try { parts = model ? hostParts(await gltfOf(model)) : null; } catch { parts = null; }
  for (const e of row.emitters) {
    let now = 'whole-body', next = 'whole-body', matched = [];
    if (e.simple) now = next = 'not-drawn(static)';
    else if (e.submeshes.length && ATTACHED_WHOLE_BODY[row.id]?.includes(e.name)) next = 'whole-body(exception)';
    else if (e.submeshes.length) {
      const wanted = new Set(e.submeshes.map(h => String(h).toLowerCase()));
      matched = (parts ?? []).filter(p => wanted.has(fnv(p.material)) || (p.single && wanted.has(fnv(p.node)))).map(p => p.material || p.node);
      next = parts === null ? 'unknown(no-model)' : matched.length ? 'parts' : 'not-drawn(parts-missing)';
    }
    report.push({ folder: row.folder, id: row.id, system: row.system, cued: row.after.cued, emitter: e.name, submeshes: e.submeshes,
      model: model?.slice(resolve(args.models).length + 1) ?? null, hostParts: parts?.map(p => p.material || p.node) ?? null, matched, before: now, after: next });
  }
}
await writeFile(join(out, 'attached-parts.json'), JSON.stringify(report, null, 2));
const label = { 'whole-body': '整身罩一层', 'whole-body(exception)': '整身罩一层（例外表）', parts: '只画部件', 'not-drawn(parts-missing)': '没画（部件名对不上）', 'not-drawn(static)': '没画（自带静态网格）', 'unknown(no-model)': '未知（没找到模型）' };
const md = ['| 目录 | id | 系统 | 被点到 | 发射器 | 修前 | 修后 | 命中部件 | 宿主部件 |', '|---|---|---|---|---|---|---|---|---|',
  ...report.map(r => `| ${r.folder} | ${r.id} | ${r.system} | ${r.cued ? '是' : '否'} | ${r.emitter} | ${label[r.before]} | ${label[r.after]} | ${r.matched.join('+')} | ${(r.hostParts ?? []).join('+')} |`)];
const changed = report.filter(r => r.cued && r.before !== r.after.replace('(exception)', ''));
md.unshift(`# 附着发射器实际画法\n\n实测方式：只读 glb 的 JSON（材质名、节点名）按名字哈希比对，不渲染；"只画部件"表示名字对上，画面是否正确要看录像。\n\n被点到且画面会变：${changed.length} 个发射器（${[...new Set(changed.map(r => r.id))].join(', ')}）\n`);
await writeFile(join(out, 'attached-parts.md'), md.join('\n') + '\n');
console.log(JSON.stringify({ emitters: report.length, changed: changed.length, noModel: report.filter(r => !r.model).length }));

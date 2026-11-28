/**
 * Read-only: which cued systems with an AttachedMesh emitter drew their overlay shrunk by the cue size before 545adb69.
 * Until then the cue scale (fx-size.ts cueSize: 1 on a weapon or hand bone, SKILL_FX_SIZE 0.638 for any other cue)
 * also scaled an attached emitter's particle size, which an overlay applies to the whole host mesh about the unit's root.
 *
 * node scripts/assets3d/audit-attached-scale.mjs --root=<asset root>/vfx-ltk --out=<dir>
 * Cues are the index's after the checked-out code's CUE_OVERRIDES / CUE_ADDITIONS (loader.ts withCueOverrides), plus the
 * code-held batch3 timelines (Sion, Silco, Elise, Illaoi, Swain, Rell, Loris), matched to whichever folder lists the system.
 * Reads JSON only: no texture, mesh or render; "shrunk" is what the old code computed, not what was seen.
 */
import { build } from 'esbuild';
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
for (const k of ['root', 'out']) if (!args[k]) throw Error(`--${k}= required`);
const root = resolve(args.root), out = resolve(args.out);
await mkdir(out, { recursive: true });
const bundle = join(out, '_scale-engine.mjs');
await build({ stdin: { contents: `export { withCueOverrides } from './src/rendering/three-mode/vfx-ltk/loader';
 export { cueSize } from './src/rendering/three-mode/vfx-ltk/fx-size';
 export { batch3Timelines } from './src/rendering/three-mode/vfx-ltk/batch3/index';`, resolveDir: resolve('.'), loader: 'ts' },
  outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const E = await import(pathToFileURL(bundle).href);

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
const attachedNames = doc => [...walk(doc.root)].filter(n => n.class === 'VfxEmitterDefinitionData' && fieldOf(n, 'primitive')?.class === 'VfxPrimitiveAttachedMesh')
  .map(n => fieldOf(n, 'emitterName')?.value ?? '?');

const rows = [], all = [];
for (const folder of await folders(root)) {
  const raw = JSON.parse(await readFile(join(folder, 'index.json')));
  all.push({ folder, index: E.withCueOverrides({ ...raw, skills: raw.skills ?? {}, systems: raw.systems ?? {} }) });
}
const code = Object.values(E.batch3Timelines).flatMap(hero => Object.entries(hero));
for (const { folder, index } of all) {
  const listed = [...Object.entries(index.skills), ...code.map(([skill, cues]) => [`${skill} (batch3)`, cues.filter(cue => Object.hasOwn(index.systems, cue.system))])];
  for (const [skill, cues] of listed) for (const cue of cues ?? []) {
    const path = index.systems[cue.system]; if (!path) continue;
    let doc; try { doc = JSON.parse(await readFile(join(folder, path))); } catch { continue; }
    const emitters = attachedNames(doc); if (!emitters.length) continue;
    const size = E.cueSize(cue), scale = (cue.scale ?? 1) * size;
    rows.push({ folder: relative(root, folder), skill, system: cue.system, action: cue.action ?? 'cast', event: cue.event, bone: cue.bone ?? null,
      emitters, cueScale: +scale.toFixed(4), shrunk: scale !== 1 });
  }
}
const shrunk = rows.filter(r => r.shrunk);
const heroes = [...new Set(shrunk.map(r => r.folder.split('/').pop()))].sort();
await writeFile(join(out, 'attached-scale.json'), JSON.stringify({ cues: rows.length, shrunkCues: shrunk.length,
  shrunkSystems: [...new Set(shrunk.map(r => `${r.folder}:${r.system}`))].length, heroes, rows }, null, 2));
const md = [`# 附着层旧缩放（修前按 cue 尺寸缩小）`, '', '只读 index 与系统 JSON，按检出代码的 cueSize 计算，不渲染。', '',
  `被点到的附着 cue ${rows.length} 条，其中缩小的 ${shrunk.length} 条，涉及 ${heroes.length} 个英雄：${heroes.join('、')}`, '',
  '| 目录 | 技能 | 系统 | 事件 | 骨骼 | 旧缩放 | 附着发射器 |', '|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.folder} | ${r.skill} | ${r.system} | ${r.event} | ${r.bone ?? ''} | ${r.cueScale} | ${r.emitters.join(', ')} |`)];
await writeFile(join(out, 'attached-scale.md'), md.join('\n') + '\n');
console.log(JSON.stringify({ cues: rows.length, shrunkCues: shrunk.length, heroes }));

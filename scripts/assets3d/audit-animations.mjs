import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBin, fnv1a } from './bin.mjs';
import { animationClips, canonicalAsset, selectAnimations, skinBindings } from './bin-bindings.mjs';
import { safeInputPath } from './safe-path.mjs';

/** Read-only audit of the actual bound skin graph, not the WAD filename inventory.
 * PROP hash keys are not strings; unrecovered keys remain explicitly unknown. */
export async function auditAnimations({ source = 'assets3d-local/trial/local',
  batches = ['assets3d-local/out/batch-cost12', 'assets3d-local/out/batch-cost345'] } = {}) {
  const map = JSON.parse(await readFile(new URL('./unit-map.json', import.meta.url), 'utf8'));
  const root = resolve(source), raw = await safeInputPath(root, join(root, 'extracted'));
  const records = JSON.parse(await readFile(await safeInputPath(root, join(root, 'extraction.json')), 'utf8'));
  const byPath = new Map(records.files.map(r => [canonicalAsset(r.path), r]));
  async function read(path) {
    const record = byPath.get(canonicalAsset(path));
    if (!record) throw new Error(`missing-source-record:${path}`);
    const bytes = await readFile(await safeInputPath(raw, join(raw, record.path)));
    if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256)
      throw new Error(`source-hash-mismatch:${path}`);
    return { document: parseBin(bytes), record };
  }
  const baseline = {};
  for (const batch of batches) Object.assign(baseline, JSON.parse(await readFile(await safeInputPath(resolve(batch), join(resolve(batch), 'build-report.json')), 'utf8')).units);
  const units = {};
  for (const [id, old] of Object.entries(baseline)) {
    const config = map[id], docs = [], inputs = [];
    for (const path of [`data/characters/${config.sourceName}/skins/skin0.bin`,
      `data/characters/${config.sourceName}/skins/root.bin`, `characters/${config.sourceName}`]) {
      if (!byPath.has(canonicalAsset(path))) continue;
      const input = await read(path); docs.push(input.document); inputs.push(input.record);
    }
    const binding = skinBindings(docs, []), graphDocs = [...docs];
    const linked = [...new Set(docs.flatMap(d => d.linked).filter(p => /\/animations\/.*\.bin$/i.test(p)))];
    for (const path of linked) {
      const input = await read(path); graphDocs.push(input.document); inputs.push(input.record);
    }
    const entries = graphDocs.flatMap(d => d.entries).filter(e => e.hash === binding.animationGraphHash);
    if (entries.length !== 1) throw new Error(`missing-or-ambiguous-animation-graph:${id}`);
    const clips = animationClips([{ entries, patches: [] }]);
    const selection = selectAnimations(clips, map.$animationRules, config.animations);
    units[id] = { baseline: old.animations.mapped, mapped: selection.mapped, decisions: selection.decisions,
      changed: Object.keys(map.$animationRules).filter(a => old.animations.mapped[a] !== selection.mapped[a]),
      inputs: inputs.map(({ path, sha256 }) => ({ path, sha256 })), clips };
  }
  const coverage = field => Object.fromEntries(Object.keys(map.$animationRules).map(a => [a,
    Object.values(units).filter(u => u[field][a]).length]));
  return { units, before: coverage('baseline'), after: coverage('mapped') };
}
export function animationAppendix(audit) {
  const names = new Map();
  function remember(name) {
    if (!name) return;
    const hash = fnv1a(name), previous = names.get(hash);
    if (!previous || previous.toLowerCase() === name.toLowerCase()) names.set(hash, name);
  }
  for (const action of ['idle', 'run', 'walk', 'attack', 'crit', 'death', 'spell', 'cast', 'hit', 'hurt', 'flinch', 'knockup', 'dance', 'taunt', 'celebration']) {
    remember(action);
    for (let i = 1; i <= 4; i++) remember(action + i);
    for (const suffix of ['in', 'out', 'start', 'end', 'intro', 'loop', 'idle', 'run', 'attack', 'first', 'activate', 'hit', 'damage']) {
      remember(`${action}_${suffix}`);
      for (let i = 1; i <= 4; i++) remember(`${action}${i}_${suffix}`);
    }
  }
  for (const u of Object.values(audit.units)) for (const c of u.clips) {
    if (!c.path) continue;
    const stem = c.path.split('/').at(-1).replace(/(?:\.tft_set13)?\.anm$/i, '');
    const parts = stem.split('_');
    for (let i = 0; i < parts.length; i++) remember(parts.slice(i).join('_'));
  }
  const lines = ['# 动画源图附录（只读审计）', '',
    '来源为 extraction.json SHA-256 校验后的绑定皮肤图（跟随 AnimationGraphData，Amumu 为 skin1）。覆盖全部 60 个单位，包含原缺 cast 的 23 个单位及全部 hit 检查。', '',
    'PROP mClipDataMap 键实际保存 32 位 hash；“图键候选”是本地通用动作词/文件名后缀经 FNV-1a 匹配得到，原始拼写不可恢复，不能视作源字符串。未知键保留 hash；“文件 clip 名”取真实 ANM basename。非 Atomic 项没有直接 ANM，不拼接或冒充动作。', '',
    `源图选择覆盖（尚非 GLB 重建验收）：cast ${audit.before.cast} → ${audit.after.cast}；hit ${audit.before.hit} → ${audit.after.hit}。`, ''];
  for (const [id, u] of Object.entries(audit.units)) {
    lines.push(`## ${id}${u.baseline.cast ? '' : '（原缺 cast）'}`, '',
      `cast：${u.mapped.cast ?? `${u.decisions.cast.sourceStatus === 'no-source-action' ? '源数据无此动作' : '无法判定'} / ${u.decisions.cast.reason}`}；hit：${u.mapped.hit ?? `${u.decisions.hit.sourceStatus === 'no-source-action' ? '源数据无此动作' : '无法判定'} / ${u.decisions.hit.reason}`}。`, '');
    for (const i of u.inputs) lines.push(`- 源：\`${i.path}\`；SHA-256：\`${i.sha256}\``);
    lines.push('', '| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |', '| --- | --- | --- | --- | --- |');
    for (const c of u.clips) lines.push(`| ${c.name ?? names.get(c.hash) ?? '未知'} | \`${c.hash.toString(16).padStart(8, '0')}\` | ${c.atomic ? 'Atomic' : `非 Atomic 0x${c.type.toString(16)}`} | ${c.path ? `\`${c.path.split('/').at(-1)}\`` : '无直接 ANM'} | ${c.path ? `\`${c.path}\`` : '—'} |`);
    lines.push('');
  }
  return lines.join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(a => a !== '--markdown')) throw new Error('usage: audit-animations.mjs [--markdown]');
    const audit = await auditAnimations();
    console.log(process.argv.includes('--markdown') ? animationAppendix(audit) : JSON.stringify(audit, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

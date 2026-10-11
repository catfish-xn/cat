#!/usr/bin/env node
'use strict';
/** B10 coverage matrix for the 44 M8 equipment definitions (M8_PLAN §7.2): contentId → source convention →
 * tests that name it, split by layer. Mechanical: a test is listed only when its source names the quoted id,
 * so a missing cell is a real gap, not a judgement. Writes docs/evidence/m8-b10/item-coverage.md (or --out). */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = (process.argv.find(arg => arg.startsWith('--out=')) || '').slice(6) || path.join(root, 'docs/evidence/m8-b10/item-coverage.md');

async function definitions() {
  const { build } = require('esbuild');
  const result = await build({ stdin: { contents: "export { ITEM_DEFINITIONS } from './src/simulation/content/items';", resolveDir: root, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
  return Object.values(module.exports.ITEM_DEFINITIONS);
}
// Layers by file name; a file may count for several. Order is the matrix column order; the first three are the
// M8_PLAN §7.1 columns (independentTest → combatTest → save/replayTest), acquisition is informational only.
// m8-b4-<group> files hold both the hand-computed vector and the real-combat trigger (docs/M8_B4_STATUS.md 逐件表).
const LAYERS = [
  ['独立数值', file => /^m8-b4-(sword|bow|belt|rod|cloak|vest|gloves|tear)\./.test(file) || /^m8-g\d+/.test(file), true],
  ['实战触发', file => /^m8-b4-(sword|bow|belt|rod|cloak|vest|gloves|tear|integration|trigger-ledger|r3b-lifecycle|audit-regressions)\.|^m8-b3-|^m8-b8-(equipment|combat-input)/.test(file), true],
  ['存档/回放', file => /restore|replay|golden|^m6-|^m8-b9-/.test(file), true],
  ['获取/经济（参考）', file => /^m8-b5-|^m8-b8-(acquisition|live-|loot|resource|command-oracle|oracle)/.test(file), false],
];
// Tests that iterate the whole frozen catalog instead of naming ids; each is checked to still do so.
const CATALOG_WIDE = [
  { file: 'm8-b4-catalog.test.ts', layers: ['独立数值'], marker: /all44 base coefficients/ },
  { file: 'm8-b10-item-save-replay.test.ts', layers: ['实战触发', '存档/回放'], marker: /toHaveLength\(44\)/ },
];
function testSources() {
  const dir = path.join(root, 'tests');
  return fs.readdirSync(dir).filter(file => /\.test\.(ts|js|mjs)$/.test(file)).sort()
    .map(file => ({ file, text: fs.readFileSync(path.join(dir, file), 'utf8') }));
}
(async () => {
  const items = await definitions(), sources = testSources();
  if (items.length !== 44) throw new Error(`Expected 44 M8 equipment definitions, found ${items.length}`);
  for (const wide of CATALOG_WIDE) {
    const source = sources.find(entry => entry.file === wide.file);
    if (!source || !wide.marker.test(source.text) || !/ITEM_DEFINITIONS/.test(source.text)) throw new Error(`${wide.file} no longer iterates the whole catalog`);
  }
  const rows = [], gaps = [];
  for (const item of items.sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'component' ? -1 : 1))) {
    const pattern = new RegExp(`['"\`]${item.id}['"\`]`);
    const wideFiles = new Set(CATALOG_WIDE.map(wide => wide.file));
    const files = sources.filter(source => !wideFiles.has(source.file) && pattern.test(source.text)).map(source => source.file);
    const cells = LAYERS.map(([name, match]) => [...files.filter(match),
      ...CATALOG_WIDE.filter(wide => wide.layers.includes(name)).map(wide => `${wide.file}*`)]);
    LAYERS.forEach(([name, , required], index) => { if (required && !cells[index].length) gaps.push(`${item.id}:${name}`); });
    rows.push(`| \`${item.id}\` | ${item.kind} | ${(item.conventionIds || []).join(', ') || '—'} | ${cells.map(list => list.length ? `${list.length}：${list.slice(0, 3).map(f => f.replace(/\.test\.\w+/, '')).join('、')}${list.length > 3 ? '…' : ''}` : '**缺**').join(' | ')} | ${files.length} |`);
  }
  const lines = [
    '# M8 B10 装备覆盖矩阵（自动生成）', '',
    `由 \`node scripts/m8-b10-item-coverage.cjs\` 生成；按测试源码统计，不运行测试；测试是否通过以同 SHA 的 \`npm test\` 为准。共 ${items.length} 件，${sources.length} 个测试文件。`,
    '带 * 的文件遍历整个冻结目录（脚本校验其仍遍历 44 件）；其余文件按名提到该装备。前三列是 M8_PLAN §7.1 要求的 independentTest → combatTest → save/replayTest，“缺”即缺口；获取/经济列仅供参考（获取由通用组件池/掉落规则覆盖，不按件要求）。', '',
    `| contentId | 类型 | 来源约定 | ${LAYERS.map(([name]) => name).join(' | ')} | 按名文件数 |`,
    `| --- | --- | --- | ${LAYERS.map(() => '---').join(' | ')} | ---: |`, ...rows, '',
    `缺格（${gaps.length}）：${gaps.length ? gaps.join('、') : '无'}`, '',
  ];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  console.log(JSON.stringify({ items: items.length, tests: sources.length, gaps: gaps.length, out: path.relative(root, out) }));
})().catch(error => { console.error(error); process.exit(1); });

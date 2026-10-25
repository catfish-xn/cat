#!/usr/bin/env node
'use strict';
// Independent, offline audit. Only Node built-ins; never execute/import game code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const STAGES = ['2-1', '3-2', '4-2'];
// P 2026-10-25: preserve the documented inference, not a decoded Riot identifier.
const TAGS = ['{d02ae323}', '{d12ae4b6}', '{d22ae649}'];
const DEFAULT_DATA = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const DEFAULT_CROSS = '/home/aiapps/workspace/augment-crossversion-research-2026-10-24';
const KNOWN = {
  TFT13_Augment_CabalCrest: ['2-1'], TFT13_Augment_CabalCrown: ['2-1'],
  TFT9_Augment_RiskyMoves: ['3-2', '4-2'], TFT11_Augment_Epoch: ['3-2', '4-2'],
  TFT11_Augment_EpochPlus: ['2-1', '4-2'], TFT13_Augment_Watcher: STAGES,
  TFT_Augment_Placebo: ['3-2', '4-2'], TFT_Augment_PlaceboPlus: ['2-1', '4-2'],
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bans = tags => STAGES.filter((_, i) => tags.includes(TAGS[i]));
const canonical = table => JSON.stringify(Object.fromEntries(Object.keys(table).sort().map(k => [k, STAGES.filter(s => table[k].includes(s))])));
function tokens(text) {
  const result = [];
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?|[^\s]/g;
  let offset = 0, line = 1;
  for (const m of text.matchAll(re)) {
    line += (text.slice(offset, m.index).match(/\n/g) || []).length;
    offset = m.index;
    if (m[0].startsWith('/*') || m[0].startsWith('//')) continue;
    const raw = m[0];
    const value = raw[0] === '"' ? JSON.parse(raw) : raw[0] === "'" ? raw.slice(1, -1).replace(/\\(['\\])/g, '$1') : raw;
    result.push({ raw, value, line });
  }
  return result;
}
// Parse a deliberately small literal grammar. Reject duplicates and expressions;
// do not use eval, vm, TypeScript, or production imports.
function literal(ts, start) {
  let i = start;
  function read() {
    const t = ts[i++];
    if (!t) throw Error('unexpected end of literal');
    if (t.raw === '{') {
      const out = Object.create(null);
      while (ts[i]?.raw !== '}') {
        const key = ts[i++].value;
        if (Object.hasOwn(out, key)) throw Error(`duplicate key ${key}`);
        if (ts[i++]?.raw !== ':') throw Error(`expected colon for ${key}`);
        out[key] = read();
        if (ts[i]?.raw === ',') i++; else if (ts[i]?.raw !== '}') throw Error('expected comma');
      }
      i++; return out;
    }
    if (t.raw === '[') {
      const out = [];
      while (ts[i]?.raw !== ']') {
        out.push(read());
        if (ts[i]?.raw === ',') i++; else if (ts[i]?.raw !== ']') throw Error('expected comma');
      }
      i++; return out;
    }
    if (/^["']/.test(t.raw)) return t.value;
    throw Error(`non-literal ${t.raw} at line ${t.line}`);
  }
  return read();
}
function audit(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const data = options.data || DEFAULT_DATA;
  const cross = options.crossversion || DEFAULT_CROSS;
  const result = { errors: [], warnings: [], sources: [], knownCases: [], coverage: [], crossVersionDifferences: [], proposedChanges: [] };
  const error = (code, detail) => result.errors.push({ code, ...detail });
  function json(file, required = false, decode = bytes => JSON.parse(bytes)) {
    if (!fs.existsSync(file)) {
      (required ? result.errors : result.warnings).push({ code: 'SOURCE_MISSING', file }); return null;
    }
    const bytes = fs.readFileSync(file);
    result.sources.push({ file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    try { return decode(bytes); } catch (e) { error('SOURCE_INVALID', { file, message: e.message }); return null; }
  }
  const content = path.join(root, 'src/simulation/content');
  const tableFile = path.join(content, 'augment-stage-bans.ts');
  let shipped;
  try {
    const ts = tokens(fs.readFileSync(tableFile, 'utf8'));
    const start = ts.findIndex((t, i) => t.value === 'freezeContent' && ts[i + 1]?.raw === '(' && ts[i + 2]?.raw === '{');
    if (start < 0) throw Error('missing freezeContent object');
    shipped = literal(ts, start + 2);
    for (const [apiName, nodes] of Object.entries(shipped)) {
      if (!Array.isArray(nodes) || !nodes.length || nodes.some(n => !STAGES.includes(n)) || new Set(nodes).size !== nodes.length) {
        error('INVALID_TABLE_ROW', { apiName, nodes });
      }
    }
    if (result.errors.length) return result;
  } catch (e) { error('TABLE_PARSE', { file: tableFile, message: e.message }); return result; }
  const rows = json(data, true);
  if (!Array.isArray(rows)) { if (rows) error('SOURCE_INVALID', { file: data, message: 'expected record array' }); return result; }
  const source = new Map();
  rows.forEach((r, index) => {
    if (!r || typeof r.apiName !== 'string' || !Array.isArray(r.item_tags_raw) || r.item_tags_raw.some(t => typeof t !== 'string')) {
      error('SOURCE_ROW_INVALID', { file: data, index }); return;
    }
    if (source.has(r.apiName)) error('SOURCE_DUPLICATE', { apiName: r.apiName, index });
    source.set(r.apiName, { ...r, index });
  });
  const pool = new Map();
  function add(apiName, file, line, enabled) {
    if (!pool.has(apiName)) pool.set(apiName, []);
    pool.get(apiName).push({ file: path.relative(root, file), line, enabled });
  }
  // Inspect lexical property names, including disabled inventory rows. Comments
  // and unrelated apiName mentions cannot create fake coverage.
  for (const fileName of fs.readdirSync(content).filter(f => /^augment-pool.*\.ts$/.test(f)).sort()) {
    const file = path.join(content, fileName), ts = tokens(fs.readFileSync(file, 'utf8'));
    let count = 0;
    for (let i = 0; i < ts.length; i++) {
      if (ts[i].value !== 'apiName' || ts[i + 1]?.raw !== ':' || !/^["']/.test(ts[i + 2]?.raw || '')) continue;
      let depth = 0, enabled = true;
      for (let j = i + 3; j < ts.length; j++) {
        if (depth === 0 && ts[j].raw === '}') break;
        if (depth === 0 && ts[j].value === 'enabled' && ts[j + 1]?.raw === ':') enabled = ts[j + 2]?.value !== 'false';
        if (['{', '['].includes(ts[j].raw)) depth++;
        if (['}', ']'].includes(ts[j].raw)) depth--;
      }
      add(ts[i + 2].value, file, ts[i].line, enabled); count++;
    }
    if (!count && ts.some(t => t.value === 'apiName')) error('POOL_PARSE', { file });
  }
  const manifestFile = path.join(content, 'source-manifest.ts');
  const mt = tokens(fs.readFileSync(manifestFile, 'utf8'));
  const mi = mt.findIndex((t, i) => t.value === 'augmentApiNames' && mt[i + 1]?.raw === ':');
  if (mi < 0) error('MANIFEST_PARSE', { file: manifestFile });
  else for (const apiName of Object.values(literal(mt, mi + 2))) add(apiName, manifestFile, mt[mi].line, true);
  if (!pool.size) error('EMPTY_POOL', {});
  // Scope is the union of the requested inventory and existing shipped rows.
  // Extra shipped rows remain checked; source augments outside this scope are
  // listed separately, never mistaken for currently shipped pool entries.
  const scope = [...new Set([...pool.keys(), ...Object.keys(shipped)])].sort();
  const generated = Object.create(null);
  for (const apiName of scope) {
    const r = source.get(apiName);
    if (!r) { error('SOURCE_AUGMENT_MISSING', { apiName }); continue; }
    const expected = bans(r.item_tags_raw);
    if (expected.length) generated[apiName] = expected;
    const actual = shipped[apiName] || [];
    if (!equal(expected, STAGES.filter(s => actual.includes(s)))) {
      const detail = { apiName, expected, actual, recordIndex: r.index, locations: pool.get(apiName) || [] };
      error('TABLE_MISMATCH', detail); result.proposedChanges.push(detail);
    }
    if (pool.has(apiName)) result.coverage.push({ apiName, status: expected.length ? (Object.hasOwn(shipped, apiName) ? 'restricted' : 'missing-ban') : 'explicitly-unrestricted', tags: r.item_tags_raw, recordIndex: r.index, locations: pool.get(apiName) });
  }
  result.canonical = { generated: canonical(generated), shipped: canonical(shipped), equal: canonical(generated) === canonical(shipped) };
  result.outOfScope = rows.filter(r => !scope.includes(r.apiName)).map(r => r.apiName);
  for (const [apiName, expected] of Object.entries(KNOWN)) {
    const r = source.get(apiName), actual = shipped[apiName];
    const ok = !!r && equal(bans(r.item_tags_raw), expected) && Array.isArray(actual) && equal(STAGES.filter(s => actual.includes(s)), expected);
    result.knownCases.push({ apiName, expected, ok });
    if (!ok) error('KNOWN_CASE_MISMATCH', { apiName, expected, source: r ? bans(r.item_tags_raw) : null, shipped: actual || null });
  }
  function checkTags(file, records, nameKey, tagKey) {
    const byName = new Map();
    for (const r of records) if (r && typeof r[nameKey] === 'string' && source.has(r[nameKey])) {
      if (byName.has(r[nameKey])) error('CROSS_SOURCE_DUPLICATE', { file, apiName: r[nameKey] });
      byName.set(r[nameKey], r);
    }
    for (const r of rows) {
      const other = byName.get(r.apiName);
      if (!other || !Array.isArray(other[tagKey])) error('CROSS_SOURCE_ROW_MISSING', { file, apiName: r.apiName });
      else if (!equal(bans(r.item_tags_raw), bans(other[tagKey]))) error('CROSS_14_24_CONTRADICTION', { file, apiName: r.apiName, expected: bans(r.item_tags_raw), actual: bans(other[tagKey]) });
    }
  }
  const nodesFile = path.join(path.dirname(data), 'map22-augment-item-nodes.json');
  const nodes = json(nodesFile);
  if (nodes) checkTags(nodesFile, Object.values(nodes.nodes || {}), 'mName', 'ItemTags');
  const rawFile = path.join(cross, 'raw/common/14.24-map22.bin.json');
  // Decode only cited top-level item nodes from the 53 MB map. Matching
  // hashes come from the independent research records; quoted braces in JSON
  // strings cannot terminate an object. Missing nodes fail coverage.
  const raw = json(rawFile, false, bytes => {
    const text = bytes.toString('utf8');
    const wanted = new Map(rows.map(r => [r.map22_node, r.apiName]));
    const nodes = [];
    const keys = /"(\{[0-9a-f]{8}\})"\s*:\s*\{/g;
    for (const m of text.matchAll(keys)) {
      if (!wanted.has(m[1])) continue;
      const start = m.index + m[0].lastIndexOf('{');
      const scan = /"(?:\\.|[^"\\])*"|[{}]/g;
      scan.lastIndex = start + 1;
      let depth = 1, end;
      for (let t; (t = scan.exec(text));) {
        if (t[0] === '{') depth++;
        if (t[0] === '}' && --depth === 0) { end = scan.lastIndex; break; }
      }
      if (!end) throw Error(`unterminated node ${m[1]}`);
      const node = JSON.parse(text.slice(start, end));
      if (node.mName !== wanted.get(m[1])) error('RAW_NODE_IDENTITY', { file: rawFile, node: m[1], expected: wanted.get(m[1]), actual: node.mName });
      nodes.push(node);
    }
    return nodes;
  });
  if (raw) checkTags(rawFile, raw, 'mName', 'ItemTags');
  const excerptFile = path.join(cross, 'excerpts/stages/14.24-active-augment-tags-with-s13-crosscheck.json');
  const excerpt = json(excerptFile);
  if (excerpt) checkTags(excerptFile, excerpt.records || [], 'apiName', 'raw_ItemTags');
  const officialFile = path.join(cross, 'excerpts/stage-audit/official-stage-changes.json');
  const official = json(officialFile);
  const facts = official?.records || [];
  result.patchFacts = facts.map(f => ({ apiName: f.api_name, version: f.source_version, stage: f.stage, change: f.change_type, url: f.source_url }));
  for (const f of facts) {
    // Only explicitly versioned 14.24 facts can contradict this snapshot.
    if (!/\b14[.-]24(?:b)?\b/.test(f.source_version || '') || !source.has(f.api_name)) continue;
    const expected = bans(source.get(f.api_name).item_tags_raw);
    if (STAGES.includes(f.stage) && typeof f.offered_at_this_stage_after_change === 'boolean' && expected.includes(f.stage) === f.offered_at_this_stage_after_change) {
      error('PATCH_14_24_CONTRADICTION', { file: officialFile, apiName: f.api_name, fact: f });
    }
  }
  const tacticsFile = path.join(cross, 'excerpts/stages/tactics-tools-s13-augment-stage-records.json');
  const tactics = json(tacticsFile);
  if (tactics) {
    if (!equal(tactics.stage_index_order, STAGES)) error('CROSS_STAGE_ORDER', { file: tacticsFile });
    for (const r of rows) {
      const key = r.apiName.replace(/^TFT(\d*)_Augment_/, '$1');
      const t = tactics.records?.[key];
      if (!t || !Array.isArray(t.picks) || t.picks.length !== 3 || t.picks.some(p => typeof p !== 'boolean')) {
        error('CROSS_PICKS_MISSING', { file: tacticsFile, apiName: r.apiName }); continue;
      }
      const expected = bans(r.item_tags_raw), actual = STAGES.filter((_, i) => !t.picks[i]);
      if (!equal(expected, actual)) {
        const later = facts.filter(f => f.api_name === r.apiName && /13\.[0-9]/.test(f.source_version || '') && ((STAGES.includes(f.stage) && f.offered_at_this_stage_after_change === false && actual.includes(f.stage) && !expected.includes(f.stage)) || (f.change_type === 'disable_augment' && actual.length === 3)));
        result.crossVersionDifferences.push({ apiName: r.apiName, expected14_24: expected, archiveBans: actual, inPool: pool.has(r.apiName), laterOfficialFacts: later.map(f => f.id), conclusion: later.length ? 'later-patch-same-direction; exact archive patch unconfirmed' : 'unexplained; do not override 14.24' });
      }
    }
  }
  const sheetFile = path.join(cross, 'excerpts/stages/s13-community-stage-sheet-excerpt.json');
  const sheet = json(sheetFile);
  result.communityDifferences = [];
  if (sheet) {
    const names = new Map();
    for (const r of rows) {
      if (!names.has(r.name_en_us)) names.set(r.name_en_us, []);
      names.get(r.name_en_us).push(r);
    }
    for (const r of sheet.records || []) {
      const matches = names.get(r.name_en) || [];
      if (matches.length !== 1) {
        result.warnings.push({ code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: r.name_en, matches: matches.length }); continue;
      }
      if (!Array.isArray(r.raw_stage_cells) || r.raw_stage_cells.length !== 3 || r.raw_stage_cells.some((v, i) => v !== '-' && v !== STAGES[i])) {
        error('SHEET_CELLS_INVALID', { file: sheetFile, name: r.name_en }); continue;
      }
      const src = matches[0], expected = bans(src.item_tags_raw), actual = STAGES.filter((_, i) => r.raw_stage_cells[i] === '-');
      if (!equal(expected, actual)) result.communityDifferences.push({ apiName: src.apiName, expected14_24: expected, sheetBans: actual, sheetRow: r.sheet_row, version: sheet.source_version });
    }
  }
  // The local research report transcribes 14.24 official patch restrictions;
  // record its hash and line, and check both Black Rose statements separately.
  // Rigged Shop is not silently mapped onto the distinct RiggedShopPlus API.
  const patchTextFile = path.resolve(path.dirname(data), '../report.zh-CN.md');
  result.patchTextChecks = [];
  if (fs.existsSync(patchTextFile)) {
    const bytes = fs.readFileSync(patchTextFile);
    result.sources.push({ file: patchTextFile, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    const lines = bytes.toString('utf8').split('\n');
    for (const [name, apiName] of [['黑色玫瑰之徽', 'TFT13_Augment_CabalCrest'], ['黑色玫瑰之冕', 'TFT13_Augment_CabalCrown']]) {
      const line = lines.findIndex(s => s.startsWith(`| ${name} |`));
      const ok = line >= 0 && /不(?:再)?于\s*2-1\s*提供/.test(lines[line]) && bans(source.get(apiName)?.item_tags_raw || []).includes('2-1') && shipped[apiName]?.includes('2-1');
      result.patchTextChecks.push({ apiName, file: patchTextFile, line: line + 1, ok, scope: 'local paraphrase of official 14.24 notes; not original tag decoding' });
      if (!ok) error('PATCH_TEXT_MISMATCH', { file: patchTextFile, apiName, line: line + 1 });
    }
  } else result.warnings.push({ code: 'SOURCE_MISSING', file: patchTextFile });
  result.summary = { sourceRows: rows.length, poolAugments: pool.size, shippedRows: Object.keys(shipped).length, regeneratedRows: Object.keys(generated).length, unrestricted: result.coverage.filter(r => r.status === 'explicitly-unrestricted').length, errors: result.errors.length, crossVersionDifferences: result.crossVersionDifferences.length, communityDifferences: result.communityDifferences.length };
  return result;
}
function report(r) {
  const lines = ['【完成】独立离线阶段禁用审计（P，2026-10-25）；不修改生产表、规则或存档。', `统计：${JSON.stringify(r.summary || {})}`, ''];
  lines.push(`规范化字节一致：${r.canonical?.equal ?? false}；范围外研究记录：${r.outOfScope?.length ?? 0}。`, '', '已知案例（独立预期）：');
  for (const c of r.knownCases) lines.push(`- ${JSON.stringify(c)}`);
  lines.push('', '【未完成】禁用表修订按任务仅列提案，未应用：');
  for (const e of r.errors) lines.push(`- ${e.code}: ${JSON.stringify(e)}`);
  if (!r.errors.length) lines.push('- 无。');
  lines.push('', '【需要我决定】无需补充决定；建议待规则修改获授权后按 expected 修表。', '', '【风险】标签读法仍为 P；14.24 目录快照不自动证明 14.24b 服务端热修。跨版本差异不得直接用于覆盖 14.24：');
  for (const d of [...r.crossVersionDifferences, ...(r.communityDifferences || [])]) lines.push(`- ${JSON.stringify(d)}`);
  for (const d of r.patchTextChecks || []) lines.push(`- 14.24补丁转述校验 ${JSON.stringify(d)}`);
  for (const w of r.warnings) lines.push(`- ${JSON.stringify(w)}`);
  lines.push('', '【下一步】修表后重跑 node scripts/audit-augment-stage-bans.cjs；退出码 1 表示审计发现错误，2 表示执行失败。', '', '证据文件（SHA-256）：');
  for (const s of r.sources) lines.push(`- ${s.file}: ${s.sha256}`);
  lines.push('', '逐项池覆盖（零基 source recordIndex；无阶段标签才明确列为 unrestricted）：');
  for (const c of r.coverage) lines.push(`- ${JSON.stringify(c)}`);
  return lines.join('\n') + '\n';
}
module.exports = { audit, report };
if (require.main === module) {
  try {
    const options = {}; let out;
    for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (!['--root', '--data', '--crossversion', '--out', '-o'].includes(arg) || !process.argv[i + 1]) throw Error(`invalid argument ${arg}`);
      const value = process.argv[++i];
      if (arg === '--out' || arg === '-o') out = value; else options[arg.slice(2)] = value;
    }
    const result = audit(options);
    if (out) fs.writeFileSync(out, report(result));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (e) { process.stderr.write(e.stack + '\n'); process.exitCode = 2; }
}

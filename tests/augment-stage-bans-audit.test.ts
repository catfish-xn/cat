import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/audit-augment-stage-bans.cjs');
const research = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const crossversion = '/home/aiapps/workspace/augment-crossversion-research-2026-10-24';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

// Handwritten mini-source and expected vectors. No game/production imports.
const cases = [
  ['TFT13_Augment_CabalCrest', ['{d02ae323}'], ['2-1']],
  ['TFT13_Augment_CabalCrown', ['{d02ae323}'], ['2-1']],
  ['TFT9_Augment_RiskyMoves', ['{d12ae4b6}', '{d22ae649}'], ['3-2', '4-2']],
  ['TFT11_Augment_Epoch', ['{d12ae4b6}', '{d22ae649}'], ['3-2', '4-2']],
  ['TFT11_Augment_EpochPlus', ['{d02ae323}', '{d22ae649}'], ['2-1', '4-2']],
  ['TFT13_Augment_Watcher', ['{d02ae323}', '{d12ae4b6}', '{d22ae649}'], ['2-1', '3-2', '4-2']],
  ['TFT_Augment_Placebo', ['{d12ae4b6}', '{d22ae649}'], ['3-2', '4-2']],
  ['TFT_Augment_PlaceboPlus', ['{d02ae323}', '{d22ae649}'], ['2-1', '4-2']],
] as const;
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stage-bans-audit-')); dirs.push(root);
  function put(file: string, value: string | object) {
    const full = join(root, file); mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const table: Record<string, string[]> = Object.fromEntries(cases.map(([name, , bans]) => [name, [...bans]]));
  const rows: { apiName: string; name_en_us: string; item_tags_raw: string[]; map22_node: string }[] = cases.map(([apiName, tags], i) => ({ apiName, name_en_us: apiName, item_tags_raw: [...tags] as string[], map22_node: `{${i.toString(16).padStart(8, '0')}}` }));
  rows.push({ apiName: 'TFT_Augment_Free', name_en_us: 'Free', item_tags_raw: ['unrelated-tag'], map22_node: '{000000ff}' });
  const content = 'src/simulation/content/';
  const saveTable = () => put(content + 'augment-stage-bans.ts', `import { freezeContent } from './never-execute';\nexport const AUGMENT_STAGE_BANS = freezeContent(${JSON.stringify(table)});\nthrow Error('must not execute production');`);
  const saveRows = () => put('research/data/augments-14.24.json', rows);
  saveTable(); saveRows();
  put(content + 'augment-pool-mini.ts', `// apiName:'FakeFromComment'\nconst x = { a: {apiName:'TFT_Augment_Free'}, b:{apiName:'TFT11_Augment_Epoch',enabled:false} };`);
  put(content + 'source-manifest.ts', `const SOURCE_MANIFEST = { augmentApiNames:{placebo:'TFT_Augment_Placebo'} };`);
  put('research/data/map22-augment-item-nodes.json', { nodes: Object.fromEntries(rows.map(r => [r.map22_node, { mName: r.apiName, ItemTags: r.item_tags_raw }])) });
  put('cross/raw/common/14.24-map22.bin.json', Object.fromEntries(rows.map(r => [r.map22_node, { mName: r.apiName, nested: { text: 'braces } { and escaped " quote' }, ItemTags: r.item_tags_raw }])));
  put('cross/excerpts/stages/14.24-active-augment-tags-with-s13-crosscheck.json', { records: rows.map(r => ({ apiName: r.apiName, raw_ItemTags: r.item_tags_raw })) });
  put('cross/excerpts/stage-audit/official-stage-changes.json', { records: [] });
  put('cross/excerpts/stages/tactics-tools-s13-augment-stage-records.json', {
    stage_index_order: ['2-1', '3-2', '4-2'],
    records: Object.fromEntries(rows.map(r => [r.apiName.replace(/^TFT(\d*)_Augment_/, '$1'), { picks: Object.hasOwn(table, r.apiName) ? ['2-1', '3-2', '4-2'].map(n => !table[r.apiName].includes(n)) : [true, true, true] }])),
  });
  put('cross/excerpts/stages/s13-community-stage-sheet-excerpt.json', { records: [{ name_en: 'Free', raw_stage_cells: ['2-1', '3-2', '4-2'] }] });
  put('research/report.zh-CN.md', '| 黑色玫瑰之徽 | 不再于 2-1 提供。 |\n| 黑色玫瑰之冕 | 重新启用，但不于 2-1 提供。 |');
  function run() {
    const out = join(root, 'report.txt');
    const p = spawnSync(process.execPath, [script, '--root', root, '--data', join(root, 'research/data/augments-14.24.json'), '--crossversion', join(root, 'cross'), '-o', out], { encoding: 'utf8' });
    expect(p.error).toBeUndefined(); expect(p.stderr).toBe('');
    return { status: p.status, result: JSON.parse(p.stdout), report: readFileSync(out, 'utf8') };
  }
  return { root, put, table, rows, saveTable, saveRows, run, content };
}

it('runs the independent CLI, compares canonical bytes, and explicitly accounts for unrestricted and disabled rows', () => {
  const f = fixture();
  const { status, result, report } = f.run();
  expect(status).toBe(0); expect(result.errors).toEqual([]); expect(result.warnings).toEqual([]);
  expect(result.canonical.equal).toBe(true); expect(result.canonical.generated).toBe(result.canonical.shipped);
  expect(result.knownCases.map((c: { ok: boolean }) => c.ok)).toEqual(Array(8).fill(true));
  expect(result.coverage.map((r: { apiName: string; status: string }) => [r.apiName, r.status])).toEqual([
    ['TFT11_Augment_Epoch', 'restricted'], ['TFT_Augment_Free', 'explicitly-unrestricted'], ['TFT_Augment_Placebo', 'restricted'],
  ]);
  expect(result.coverage[0].locations[0].enabled).toBe(false);
  expect(report).toContain('【完成】'); expect(report).toContain('【风险】');
  // Reordering object properties/ban arrays changes presentation, not meaning.
  f.table.TFT11_Augment_Epoch.reverse(); f.saveTable();
  const reordered = f.run(); expect(reordered.status).toBe(0); expect(reordered.result.canonical.equal).toBe(true);
});

it('reports every missing/extra/wrong ban without writing any production file', () => {
  const f = fixture();
  delete f.table.TFT11_Augment_Epoch;
  f.table.TFT9_Augment_RiskyMoves = ['2-1'];
  f.table.TFT_Augment_Free = ['4-2']; f.saveTable();
  const before = readFileSync(join(f.root, f.content + 'augment-stage-bans.ts'), 'utf8');
  const { status, result } = f.run();
  expect(status).toBe(1);
  expect(result.proposedChanges.map((e: { apiName: string }) => e.apiName)).toEqual(['TFT11_Augment_Epoch', 'TFT9_Augment_RiskyMoves', 'TFT_Augment_Free']);
  expect(result.errors.filter((e: { code: string }) => e.code === 'KNOWN_CASE_MISMATCH')).toHaveLength(2);
  expect(readFileSync(join(f.root, f.content + 'augment-stage-bans.ts'), 'utf8')).toBe(before);
});

it('rejects unknown pool identities and missing stage restrictions, including disabled inventory', () => {
  const f = fixture();
  f.put(f.content + 'augment-pool-extra.ts', "const x={a:{apiName:'TFT_Augment_Missing'},b:{apiName:'TFT_Augment_Disabled',enabled:false}};");
  f.rows.push({ apiName: 'TFT_Augment_Disabled', name_en_us: 'Disabled', item_tags_raw: ['{d02ae323}'], map22_node: '{000000ee}' }); f.saveRows();
  const { status, result } = f.run();
  expect(status).toBe(1);
  expect(result.errors).toContainEqual({ code: 'SOURCE_AUGMENT_MISSING', apiName: 'TFT_Augment_Missing' });
  expect(result.proposedChanges.map((e: { apiName: string }) => e.apiName)).toEqual(['TFT_Augment_Disabled']);
  expect(result.proposedChanges[0].locations[0].enabled).toBe(false);
});

it.each([
  ['duplicate key', "{'A':['2-1'],'A':['3-2']}", 'TABLE_PARSE'],
  ['unknown node', "{'A':['5-1']}", 'INVALID_TABLE_ROW'],
  ['duplicate node', "{'A':['2-1','2-1']}", 'INVALID_TABLE_ROW'],
  ['expression', "{'A':process.exit()}", 'TABLE_PARSE'],
])('fails closed for %s', (_, table, code) => {
  const f = fixture(); f.put(f.content + 'augment-stage-bans.ts', `const x=freezeContent(${table});`);
  const { status, result } = f.run(); expect(status).toBe(1); expect(result.errors.map((e: { code: string }) => e.code)).toEqual([code]);
});

it('detects raw 14.24 contradictions and separates later patch evidence from a 14.24 contradiction', () => {
  const f = fixture();
  const raw = Object.fromEntries(f.rows.map(r => [r.map22_node, { mName: r.apiName, ItemTags: r.apiName === 'TFT_Augment_Free' ? ['{d02ae323}'] : r.item_tags_raw }]));
  f.put('cross/raw/common/14.24-map22.bin.json', raw);
  f.put('cross/excerpts/stage-audit/official-stage-changes.json', { records: [
    { id: 'later', api_name: 'TFT_Augment_Free', source_version: 'S13 / 13.4 (2025)', stage: '2-1', offered_at_this_stage_after_change: false },
    { id: 'same', api_name: 'TFT_Augment_Free', source_version: '14.24', stage: '3-2', offered_at_this_stage_after_change: false },
  ] });
  f.put('cross/excerpts/stages/s13-community-stage-sheet-excerpt.json', { source_version: 'patch unspecified', records: [{ name_en: 'Free', sheet_row: 1, raw_stage_cells: ['-', '3-2', '4-2'] }] });
  const { status, result } = f.run(); expect(status).toBe(1);
  expect(result.errors.map((e: { code: string }) => e.code)).toEqual(['CROSS_14_24_CONTRADICTION', 'PATCH_14_24_CONTRADICTION']);
  expect(result.errors[1].fact.id).toBe('same'); expect(result.communityDifferences).toHaveLength(1);
});

it('reports missing research as an error rather than claiming an empty audit passed', () => {
  const f = fixture(); rmSync(join(f.root, 'research/data/augments-14.24.json'));
  const { status, result } = f.run(); expect(status).toBe(1); expect(result.errors[0].code).toBe('SOURCE_MISSING');
});

// Characterize findings, not a waiver: the CLI must exit 1 for the five defects.
// Synthetic tests above always run on CI without the external research bundle.
it.skipIf(!existsSync(research) || !existsSync(join(crossversion, 'raw/common/14.24-map22.bin.json')))('audits the actual 14.24 archive and reports the exact unresolved discrepancies', () => {
  const p = spawnSync(process.execPath, [script], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  expect(p.error).toBeUndefined(); expect(p.stderr).toBe(''); expect(p.status).toBe(1);
  const r = JSON.parse(p.stdout);
  // H11 adds two pool apiNames: unrestricted Scavenger and 2-1-banned Sponging;
  // the five previously characterized defects are unchanged.
  expect(r.summary).toMatchObject({ sourceRows: 312, poolAugments: 209, shippedRows: 161, regeneratedRows: 166, unrestricted: 70, errors: 5, crossVersionDifferences: 8 });
  expect(r.errors.map((e: { code: string; apiName: string; expected: string[] }) => [e.code, e.apiName, e.expected])).toEqual([
    ['TABLE_MISMATCH', 'TFT13_Augment_Academy', ['4-2']],
    ['TABLE_MISMATCH', 'TFT13_Augment_Cabal', ['2-1', '4-2']],
    ['TABLE_MISMATCH', 'TFT13_Augment_Experiment', ['2-1']],
    ['TABLE_MISMATCH', 'TFT13_Augment_Formswapper', ['2-1']],
    ['TABLE_MISMATCH', 'TFT13_TeamupAugment_BloodBrothers', ['2-1', '4-2']],
  ]);
  expect(r.knownCases.every((c: { ok: boolean }) => c.ok)).toBe(true);
  expect(r.crossVersionDifferences.map((d: { apiName: string }) => d.apiName).sort()).toEqual([
    'TFT13_Augment_AnotherAnomaly', 'TFT9_Augment_PandorasRadiantBox', 'TFT9_Augment_YoungAndWildAndFree', 'TFT_Augment_GlassCannonI', 'TFT_Augment_GlassCannonII', 'TFT_Augment_ShopGlitch', 'TFT_Augment_TableScraps', 'TFT_Augment_TwoMuchValue',
  ]);
  expect(r.communityDifferences.map((d: { apiName: string }) => d.apiName)).toEqual(['TFT13_Augment_CabalCrest', 'TFT_Augment_TableScraps']);
  expect(r.warnings).toEqual([
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: 'A Change of Fate', matches: 0 },
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: "Dragon's Spirit", matches: 0 },
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: 'I Hope This Works', matches: 0 },
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: 'Phreaky Friday+', matches: 0 },
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: 'Rigged Shop', matches: 0 },
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: 'Salvage Bin', matches: 2 },
    { code: 'SHEET_NAME_UNMATCHED_OR_AMBIGUOUS', name: 'Void Swarm', matches: 2 },
  ]);
});

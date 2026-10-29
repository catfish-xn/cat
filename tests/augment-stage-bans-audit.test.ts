import { afterEach, expect, it } from 'vitest';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/audit-augment-stage-bans.cjs');
const research = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const crossversion = '/home/aiapps/workspace/augment-crossversion-research-2026-10-24';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

// Capture the real CLI through files: sandboxed Node may forbid the sockets used
// by spawnSync's default pipes. Preserve the exit, stderr and stdout assertions.
function runAudit(args: string[], root: string) {
  const stdout = join(root, 'stdout.txt'), stderr = join(root, 'stderr.txt');
  const out = openSync(stdout, 'w'), err = openSync(stderr, 'w');
  try {
    const result = spawnSync(process.execPath, [script, ...args], { stdio: ['ignore', out, err] });
    return { ...result, stdout: readFileSync(stdout, 'utf8'), stderr: readFileSync(stderr, 'utf8') };
  } finally { closeSync(out); closeSync(err); }
}

// Handwritten mini-source and expected vectors. No game/production imports.
const cases = [
  ['TFT13_Augment_CabalCrest', ['{d02ae323}'], ['2-1']],
  ['TFT13_Augment_CabalCrown', ['{d02ae323}'], ['2-1']],
  ['TFT9_Augment_RiskyMoves', ['{d12ae4b6}', '{d22ae649}'], ['3-2', '4-2']],
  ['TFT11_Augment_FineVintage', ['{d02ae323}', '{d12ae4b6}', '{d22ae649}'], ['3-2', '4-2']],
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
  put(content + 'augment-pool-mini.ts', `// apiName:'FakeFromComment'\nconst x = { a: {apiName:'TFT_Augment_Free'}, b:{apiName:'TFT11_Augment_Epoch',enabled:false}, c:{apiName:'TFT11_Augment_FineVintage'} };`);
  put(content + 'source-manifest.ts', `const SOURCE_MANIFEST = { augmentApiNames:{placebo:'TFT_Augment_Placebo'} };`);
  put('research/data/map22-augment-item-nodes.json', { nodes: Object.fromEntries(rows.map(r => [r.map22_node, { mName: r.apiName, ItemTags: r.item_tags_raw }])) });
  put('cross/raw/common/14.24-map22.bin.json', Object.fromEntries(rows.map(r => [r.map22_node, { mName: r.apiName, nested: { text: 'braces } { and escaped " quote' }, ItemTags: r.item_tags_raw }])));
  put('cross/excerpts/stages/14.24-active-augment-tags-with-s13-crosscheck.json', { records: rows.map(r => ({ apiName: r.apiName, raw_ItemTags: r.item_tags_raw })) });
  put('cross/excerpts/stage-audit/official-stage-changes.json', { records: [] });
  put('cross/excerpts/stages/tactics-tools-s13-augment-stage-records.json', {
    stage_index_order: ['2-1', '3-2', '4-2'],
    records: Object.fromEntries(rows.map(r => [r.apiName.replace(/^TFT(\d*)_Augment_/, '$1'), { picks: ['{d02ae323}', '{d12ae4b6}', '{d22ae649}'].map(tag => !r.item_tags_raw.includes(tag)) }])),
  });
  put('cross/excerpts/stages/s13-community-stage-sheet-excerpt.json', { records: [{ name_en: 'Free', raw_stage_cells: ['2-1', '3-2', '4-2'] }] });
  put('research/report.zh-CN.md', '| 黑色玫瑰之徽 | 不再于 2-1 提供。 |\n| 黑色玫瑰之冕 | 重新启用，但不于 2-1 提供。 |');
  function run() {
    const out = join(root, 'report.txt');
    const p = runAudit(['--root', root, '--data', join(root, 'research/data/augments-14.24.json'), '--crossversion', join(root, 'cross'), '-o', out], root);
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
    ['TFT11_Augment_Epoch', 'restricted'], ['TFT11_Augment_FineVintage', 'restricted'], ['TFT_Augment_Free', 'explicitly-unrestricted'], ['TFT_Augment_Placebo', 'restricted'],
  ]);
  expect(result.coverage[0].locations[0].enabled).toBe(false);
  expect(result.overrides).toEqual([{apiName:'TFT11_Augment_FineVintage',source:['2-1','3-2','4-2'],expected:['3-2','4-2'],decision:'P-FINE-VINTAGE-STAGE'}]);
  expect(report).toContain('P-FINE-VINTAGE-STAGE');
  expect(report).toContain('【完成】'); expect(report).toContain('【风险】');
  // Reordering object properties/ban arrays changes presentation, not meaning.
  f.table.TFT11_Augment_Epoch.reverse(); f.saveTable();
  const reordered = f.run(); expect(reordered.status).toBe(0); expect(reordered.result.canonical.equal).toBe(true);
});


it('normalizes explicit unrestricted rows while still rejecting a missing required ban', () => {
  const f = fixture();
  f.table.TFT_Augment_Free = []; f.saveTable();
  const unrestricted = f.run();
  expect(unrestricted.status).toBe(0); expect(unrestricted.result.canonical.equal).toBe(true);
  expect(unrestricted.result.coverage).toContainEqual(expect.objectContaining({ apiName: 'TFT_Augment_Free', status: 'explicitly-unrestricted' }));
  f.table.TFT11_Augment_Epoch = []; f.saveTable();
  const missing = f.run();
  expect(missing.status).toBe(1);
  expect(missing.result.errors).toContainEqual(expect.objectContaining({ code: 'TABLE_MISMATCH', apiName: 'TFT11_Augment_Epoch', expected: ['3-2', '4-2'] }));
});

it('rejects a wrong override table or a change in its underlying source tags', () => {
  const f = fixture();
  f.table.TFT11_Augment_FineVintage = ['2-1', '3-2', '4-2']; f.saveTable();
  let result = f.run();
  expect(result.status).toBe(1);
  expect(result.result.errors).toContainEqual(expect.objectContaining({code:'TABLE_MISMATCH',apiName:'TFT11_Augment_FineVintage',expected:['3-2','4-2']}));
  f.table.TFT11_Augment_FineVintage = ['3-2', '4-2']; f.saveTable();
  f.rows.find(r => r.apiName === 'TFT11_Augment_FineVintage')!.item_tags_raw = ['{d12ae4b6}', '{d22ae649}']; f.saveRows();
  result = f.run();
  expect(result.status).toBe(1);
  expect(result.result.errors).toContainEqual(expect.objectContaining({code:'OVERRIDE_SOURCE_MISMATCH',apiName:'TFT11_Augment_FineVintage'}));
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

it('excludes companion equipment tables by file role while retaining augment inventories that import ItemDefinition', () => {
  const f = fixture();
  for (const batch of ['future', 'other']) {
    f.put(f.content + `augment-pool-${batch}-items.ts`, `
      import type { ItemDefinition } from '../strategy-types';
      export const ITEMS: Readonly<Record<string, ItemDefinition>> = freezeContent({
        ordinary: { apiName: 'Equipment_${batch}', kind: 'completed' },
        augmentLikeName: { apiName: 'TFT_Augment_Equipment_${batch}', kind: 'completed' },
      });
    `);
  }
  f.put(f.content + 'augment-pool-mixed.ts', `
    import type { ChoiceDefinition, ItemDefinition } from '../strategy-types';
    export const AUGMENTS = freezeContent({ free: { apiName: 'TFT_Augment_Free', tier: 'silver' } });
  `);
  const { status, result } = f.run();
  expect(status).toBe(0); expect(result.errors).toEqual([]);
  expect(result.summary.poolAugments).toBe(4);
  expect(result.coverage.map((r: { apiName: string }) => r.apiName)).toEqual([
    'TFT11_Augment_Epoch', 'TFT11_Augment_FineVintage', 'TFT_Augment_Free', 'TFT_Augment_Placebo',
  ]);
  expect(result.coverage.find((r: { apiName: string }) => r.apiName === 'TFT_Augment_Free').locations).toContainEqual({
    file: f.content + 'augment-pool-mixed.ts', line: 3, enabled: true,
  });
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

// Characterize findings, not a waiver: keep the three table/source differences
// and intentional user overrides visible.
// Synthetic tests above always run on CI without the external research bundle.
it.skipIf(!existsSync(research) || !existsSync(join(crossversion, 'raw/common/14.24-map22.bin.json')))('audits the actual 14.24 archive and reports the exact unresolved discrepancies', () => {
  const root = mkdtempSync(join(tmpdir(), 'stage-bans-archive-')); dirs.push(root);
  const p = runAudit([], root);
  expect(p.error).toBeUndefined(); expect(p.stderr).toBe(''); expect(p.status).toBe(1);
  const r = JSON.parse(p.stdout);
  // Batch 5 adds augment inventory and bans; companion equipment is excluded.
  expect(r.summary).toEqual({ sourceRows: 312, poolAugments: 270, shippedRows: 221, regeneratedRows: 221, unrestricted: 76, errors: 3, crossVersionDifferences: 8, communityDifferences: 2 });
  expect(r.errors.map((e: { code: string; apiName: string; expected: string[] }) => [e.code, e.apiName, e.expected])).toEqual([
    ['TABLE_MISMATCH', 'TFT13_Augment_Formswapper', ['2-1']],
    ['TABLE_MISMATCH', 'TFT13_TeamupAugment_BloodBrothers', ['2-1', '4-2']],
    ['TABLE_MISMATCH', 'TFT_Augment_TableScraps', ['2-1', '3-2', '4-2']],
  ]);
  expect(r.overrides).toContainEqual({apiName:'TFT11_Augment_FineVintage',source:['2-1','3-2','4-2'],expected:['3-2','4-2'],decision:'P-FINE-VINTAGE-STAGE'});
  expect(r.errors.map((e: {apiName:string})=>e.apiName)).not.toContain('TFT13_Augment_Cabal');
  expect(r.errors.map((e: {apiName:string})=>e.apiName)).not.toContain('TFT13_Augment_AGoldenFind');
  expect(r.errors.find((e: { apiName: string }) => e.apiName === 'TFT_Augment_TableScraps').actual).toEqual(['3-2', '4-2']);
  expect(JSON.parse(r.canonical.shipped)).toMatchObject({ TFT13_Augment_Academy: ['4-2'], TFT13_Augment_Cabal: ['2-1', '4-2'],
    TFT11_Augment_FineVintage: ['3-2', '4-2'], TFT_Augment_TableScraps: ['3-2', '4-2'],
    TFT13_Augment_Ambusher: ['4-2'], TFT_Augment_HallOfMirrors: ['2-1', '3-2', '4-2'] });
  expect(r.overrides).toContainEqual({apiName:'TFT13_Augment_Ambusher',source:[],expected:['4-2'],decision:'P-LOOT-EXPLOSION-STAGE'});
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

// Run from any directory: node /path/to/scripts/audit-augment-icons.mjs
// JSON goes to stdout; the Chinese summary goes to stderr. No files or URLs are written/fetched.
// Example: node scripts/audit-augment-icons.mjs > artifacts/augment-icons.json
// Optional runtime source: --ui-assets /path/to/ui-assets.json (read-only, no URL requests).
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

const { values } = parseArgs({ options: { 'ui-assets': { type: 'string' } } });
if (values['ui-assets'] === '') throw new Error('--ui-assets requires a nonempty local file path');
const uiAssetsFile = values['ui-assets'] === undefined ? null : resolve(values['ui-assets']);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const definitionFile = 'src/simulation/content/augments.ts';
const mappingFile = 'src/presentation/s13-augment-asset-manifest.ts';

// Load the actual exports (including all spread-in batches), rather than matching
// source text or filtering the offer pool. This is an in-memory TS bundle, not a Vite build.
const bundled = await build({
  stdin: {
    contents: `export { AUGMENT_DEFINITIONS } from './${definitionFile}';\nexport { S13_AUGMENT_ASSETS } from './${mappingFile}';`,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
});
const { AUGMENT_DEFINITIONS, S13_AUGMENT_ASSETS } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);
const ids = Object.keys(AUGMENT_DEFINITIONS).sort();
const idSet = new Set(ids);
const publicAssets = resolve(root, 'public/assets');

// Mirror registerRootUiAssets in src/presentation/s13-assets.ts: only augment
// entries with root-contained paths count, and the last accepted duplicate wins.
// These paths belong to the deployed root, NOT public/assets; do not stat/fetch them.
const rootMappings = [];
if (uiAssetsFile) {
  const manifest = JSON.parse(await readFile(uiAssetsFile, 'utf8'));
  if (!Array.isArray(manifest?.assets)) throw new Error('ui-assets.json must contain an assets array');
  for (const [index, entry] of manifest.assets.entries()) {
    if (entry?.kind !== 'augment') continue;
    const { id, path } = entry;
    const accepted = typeof id === 'string' && typeof path === 'string'
      && /^[\w-]+(\/[\w.-]+)*$/.test(path) && !path.split('/').includes('..');
    rootMappings.push({ index, id: id ?? null, path: path ?? null, accepted,
      reason: accepted ? null : 'invalid-id-or-root-path', exists: null });
  }
}
const rootById = new Map();
for (const row of rootMappings) if (row.accepted) {
  const rows = rootById.get(row.id) ?? [];
  rows.push(row); rootById.set(row.id, rows);
}

async function inspectMapping(asset, index) {
  const { id, path, source } = asset;
  if (typeof id !== 'string' || typeof path !== 'string' || !path)
    throw new Error(`Invalid icon mapping at index ${index}`);
  // `source` is download provenance, NOT the frontend URL; never probe it.
  // Absolute URLs and the test-server /assets3d namespace are remote-only.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path) || /^\/?assets3d(?:\/|$)/.test(path))
    return { index, id, path, source, kind: 'remote', url: path, exists: null };
  // /assets/s13/... and assets/s13/... both refer to public/assets locally.
  const pathname = decodeURIComponent(path.split(/[?#]/, 1)[0]).replace(/^\//, '');
  const file = resolve(root, 'public', pathname);
  if (!file.startsWith(publicAssets + sep))
    throw new Error(`Icon mapping outside public/assets: ${id}: ${path}`);
  let exists;
  try { exists = (await stat(file)).isFile(); }
  catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    exists = false;
  }
  return { index, id, path, source, kind: 'local', localPath: `public/${pathname}`, exists };
}

const mappings = await Promise.all(S13_AUGMENT_ASSETS.map(inspectMapping));
const byId = new Map();
for (const row of mappings) {
  const rows = byId.get(row.id) ?? [];
  rows.push(row); byId.set(row.id, rows);
}
// Report duplicate IDs as well as shared target paths/source URLs. Sharing an
// icon may be intentional (e.g. tiers); this audit does not call it an error.
function duplicateGroups(key) {
  const groups = new Map();
  for (const row of mappings) {
    const value = row[key];
    if (!value) continue;
    const group = groups.get(value) ?? [];
    group.push(row); groups.set(value, group);
  }
  return [...groups].filter(([, rows]) => rows.length > 1)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([value, rows]) => ({ [key]: value, ids: [...new Set(rows.map(row => row.id))].sort(), mappingIndices: rows.map(row => row.index) }));
}
const augments = ids.map(id => ({
  id, name: AUGMENT_DEFINITIONS[id].name,
  iconSource: byId.has(id) ? '打包' : rootById.has(id) ? '素材根' : '两者都无',
  rootMappingIndices: (rootById.get(id) ?? []).map(row => row.index),
  rootPaths: (rootById.get(id) ?? []).map(row => row.path),
  effectiveRootMappingIndex: rootById.get(id)?.at(-1).index ?? null,
  mappingIndices: (byId.get(id) ?? []).map(row => row.index),
  // augmentIconUrl uses Array.find: a later duplicate cannot rescue its first row.
  effectiveMappingIndex: byId.get(id)?.[0].index ?? null,
}));
const missingMappingIds = ids.filter(id => !byId.has(id));
const missingBothIds = augments.filter(row => row.iconSource === '两者都无').map(row => row.id);
const missingFiles = mappings.filter(row => idSet.has(row.id) && row.kind === 'local' && !row.exists);
const missingFileIds = [...new Set(missingFiles.map(row => row.id))].sort();
const remoteUrls = mappings.filter(row => row.kind === 'remote').map(({ id, url }) => ({ id, url }));
const duplicateMappings = { byId: duplicateGroups('id'), byPath: duplicateGroups('path'), bySource: duplicateGroups('source') };
const orphanMappingIds = [...byId.keys()].filter(id => !idSet.has(id)).sort();
const summary = {
  totalAugments: ids.length, mappingEntries: mappings.length,
  mappedAugments: ids.length - missingMappingIds.length,
  missingMappings: missingMappingIds.length, missingFiles: missingFiles.length,
  localFilesFound: mappings.filter(row => row.kind === 'local' && row.exists).length,
  remoteMappings: remoteUrls.length,
  duplicateIds: duplicateMappings.byId.length, sharedPaths: duplicateMappings.byPath.length,
  sharedSources: duplicateMappings.bySource.length, orphanMappingIds: orphanMappingIds.length,
  rootMappingEntries: rootMappings.length,
  acceptedRootMappings: rootMappings.filter(row => row.accepted).length,
  ignoredRootMappings: rootMappings.filter(row => !row.accepted).length,
  rootFallbackAugments: augments.filter(row => row.iconSource === '素材根').length,
  missingBoth: missingBothIds.length,
};
const report = {
  schemaVersion: 1, definitionFile, mappingFile, uiAssetsFile, networkRequests: false,
  notes: [
    '全量枚举 AUGMENT_DEFINITIONS，不按启用状态、层级或批次过滤（包括 D5）。',
    '仅核查映射目标是否为本地普通文件，不校验图片内容、哈希或远程可用性。',
    '绝对 URL、协议相对 URL 和 /assets3d/ 仅列清单；/assets/s13/ 按 public/assets/s13/ 核查。source 仅为下载来源。',
    'iconSource 按运行时优先级标注：打包优先，其次素材根，最后两者都无；打包文件缺失仍另报，不自动回退。',
    '素材根只计 kind:augment 且通过 registerRootUiAssets 路径校验的条目；同 ID 最后一个有效条目生效。path 原样列出，不核查部署文件。',
    uiAssetsFile ? '已读取指定的本地 ui-assets.json；两者都无表示打包清单和该素材根清单均无有效条目。' : '未提供 --ui-assets；两者都无仅指本次输入，不能据此判定测试服缺图。',
    '重复来源或路径可能是有意共享图标，不自动判错。发现缺项仍成功退出，读取或解析失败才失败退出。',
  ],
  summary, missingMappingIds, missingBothIds, missingFileIds, missingFiles,
  duplicateMappings, remoteUrls, orphanMappingIds, augments, mappings, rootMappings,
};
console.log(JSON.stringify(report, null, 2));
const list = values => values.length ? values.join('、') : '无';
console.error([
  `强化图标审计：全部 ${summary.totalAugments} 个强化，${summary.mappingEntries} 条静态图标映射。`,
  `缺映射 ${summary.missingMappings} 个 ID：${list(missingMappingIds)}`,
  `素材根清单：${uiAssetsFile ?? '未提供（不能判定测试服缺图）'}；强化条目 ${summary.rootMappingEntries} 条，有效 ${summary.acceptedRootMappings} 条，忽略 ${summary.ignoredRootMappings} 条。`,
  `来源=打包 ${summary.mappedAugments} 个，来源=素材根 ${summary.rootFallbackAugments} 个，来源=两者都无 ${summary.missingBoth} 个：${list(missingBothIds)}`,
  ...augments.map(row => `${row.id} 来源=${row.iconSource}；素材根 path=${list(row.rootPaths)}`),
  ...rootMappings.map(row => `素材根条目[${row.index}]：${row.id} → ${row.path}（${row.accepted ? '有效' : '忽略：' + row.reason}；未发网络请求）`),
  `映射到不存在文件 ${summary.missingFiles} 条，涉及 ${missingFileIds.length} 个 ID：${list(missingFileIds)}`,
  ...missingFiles.map(row => `缺文件：${row.id} → ${row.localPath}`),
  `重复映射：ID ${summary.duplicateIds} 组、路径 ${summary.sharedPaths} 组、来源 URL ${summary.sharedSources} 组（共享不一定是错误）。`,
  ...Object.entries(duplicateMappings).flatMap(([key, groups]) => groups.map(group => `重复 ${key}：${group.id ?? group.path ?? group.source} → ${list(group.ids)}`)),
  `远程映射 ${summary.remoteMappings} 条（未发网络请求）：`,
  ...remoteUrls.map(row => `${row.id} → ${row.url}`),
  '范围：核查打包本地文件及已提供素材根清单；素材根文件与远程 URL 可用性未验证，未发网络请求。',
].join('\n'));

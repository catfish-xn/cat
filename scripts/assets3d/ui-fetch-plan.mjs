// Stage planner by default; networking is opt-in and consumes a frozen allowlist.
import { readFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunksForRange } from './rman.mjs';
import { fetchChunks, selectChunks } from './fetch-chunks.mjs';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { parseBin, binField, binIs } from './bin.mjs';
import { scanLocal, loadPatch, readDictionary, UiSource, PATCH_SHA, VERSION, LOCALES, json, cliArguments } from './ui-source.mjs';

const atlas = new Set(['tft_hud_texture_atlas', 'tft_hud_buyxp_icon_atlas', 'tft_hud_stagetracker_atlas',
  'tfthealthbaratlas', 'tft_traits_texture_atlas', 'tft_augment_atlas_pc', 'tft_armory_atlas_pc',
  'tft_unitinfo_texture_atlas', 'tft_combatstates_atlas', 'tft_elimination_texture_atlas']);
export const canonicalUiPath = path => path.replace(/\.tft_[^.]+(?=\.[^./]+$)/g, '').replace(/\.(png|dds)$/, '.tex');
export function seedPath(path, locale = 'zh_CN') {
  path = canonicalUiPath(path);
  if (path === `data/menu/fontconfig_${locale.toLowerCase()}.txt` || path === 'data/tftteamplanner/characters.bin'
    || path === 'data/menu/hud/tftdynamicmenutext.ini') return true;
  if (/^assets\/ux\/fonts\/(beaufortforlol-(bold|regular)|spiegel-(regular|semibold))\.otf$/.test(path)) return true;
  if (['data/menu/textures/tft_winstreak_atlas.tex', 'data/menu/textures/tooltip_atlas.tex'].includes(path)) return true;
  if (path.startsWith('assets/ux/tft/') && atlas.has(basename(path, '.tex')) && path.endsWith('.tex')) return true;
  if (/^assets\/ux\/tft\/hud\/(tft_scoreboard_localplayerframe|unitshop\/tft_emptyshop|unitshop\/tft_shopcard_rarity[45]_(default|hover|clicked)|itemtracker\/tft_itemframe_(active|hover|inactive|pressed|selected))\.tex$/.test(path)) return true;
  if (/^assets\/ux\/tft\/tft_(unitshop_lock(enabled|disabled)_clicked|button_augment_(default|hover|clicked))\.tex$/.test(path)) return true;
  if (/^assets\/ux\/tft\/armory\/tft_set13\/(crime\/tft_crime_(frame|.*button.*)|goop\/frame)\.tex$/.test(path)) return true;
  return path === 'assets/ux/tft/mograph/sets/set13/augmentcard/set13_augmentcard_spine.atlas';
}
export function dictionaryPath(path, locale) {
  return seedPath(path, locale) || path.endsWith('.subchunktoc') || path.startsWith('assets/ux/fonts/')
    || /^assets\/characters\/tft13_[^/]+\/skins\/base\/images\//.test(path)
    || path.startsWith('assets/ux/tft/championsplashes/') || path.startsWith('assets/ux/tft/mograph/sets/set13/');
}
/** Only source-referenced dependencies; teamplanner thumbnails are never guessed
 * to be PC shop art. Project mappings attach the existing definition IDs.
 */
export function referencedPaths(path, bytes, shopCharacters) {
  if (path === 'data/tftteamplanner/characters.bin') {
    const doc = parseBin(bytes), refs = [], byHash = new Map(doc.entries.map(e => [e.hash, e]));
    for (const character of doc.entries.filter(e => binIs(e, 'TFTCharacterRecord') && /^tft13_/i.test(binField(e, 'mCharacterName') ?? ''))) {
      // Field names verified against the local binfields dictionary. BaseCost
      // excludes props/summons; PcSplashPath is the source's explicit PC art link.
      const sourceName = binField(character, 'mCharacterName');
      if (shopCharacters && !shopCharacters.has(sourceName.toLowerCase())) continue;
      const shop = byHash.get(binField(character, 'mShopData')?.hash), cost = binField(shop, 'BaseCost');
      const ref = binField(shop, 'PcSplashPath');
      if (Number.isInteger(cost) && cost >= 1 && cost <= 6 && typeof ref === 'string' && /\.(tex|png|dds)$/i.test(ref))
        refs.push({ path: ref.toLowerCase(), character: binField(character, 'mCharacterName'), cost, sourceField: 'mShopData.PcSplashPath', ...(shopCharacters ? { definitionId: shopCharacters.get(sourceName.toLowerCase()) } : {}) });
    }
    return refs;
  }
  const text = bytes.toString('utf8'), refs = [];
  if (/fontconfig_/.test(path)) {
    for (const match of text.matchAll(/[a-z0-9_./-]+\.(?:ttf|otf)/gi)) {
      const name = match[0].toLowerCase(); refs.push({ path: name.includes('/') ? name : `assets/ux/fonts/${name}`, localeEvidence: path });
    }
  } else if (path.endsWith('.atlas')) {
    for (const line of text.split(/\r?\n/)) if (/^[\w./-]+\.(png|tex|dds)$/i.test(line.trim())) {
      const name = line.trim().toLowerCase(); refs.push({ path: name.startsWith('assets/') ? name : join(path, '..', name).replaceAll('\\', '/') });
    }
  }
  return refs;
}

export async function planUi({ source, paths, sourceManifest, locale = 'zh_CN', shopCharacters }) {
  if (!LOCALES.includes(locale)) throw new Error('unsupported-locale');
  const wads = [], required = new Map(), targets = new Map(), discovery = [], references = [];
  const addRange = (file, start, size, role) => {
    for (const c of chunksForRange(file, start, size)) {
      if (!required.has(c.id)) required.set(c.id, { ...c, requiredBy: [] });
      const r = required.get(c.id).requiredBy;
      if (!r.some(r => r.wad === file.name && r.role === role)) r.push({ wad: file.name, role });
    }
  };
  const seeds = new Map();
  for (const path of paths.values()) if (seedPath(path, locale)) {
    const key = canonicalUiPath(path); if (!seeds.has(key)) seeds.set(key, []); seeds.get(key).push(path);
  }
  const names = ['DATA/FINAL/UI.wad.client', `DATA/FINAL/UI.${locale}.wad.client`, 'DATA/FINAL/Maps/Shipping/Map22.wad.client'];
  const archives = [];
  for (const name of names) {
    const file = source.manifest.files.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (!file) throw new Error(`missing-rman-wad:${name}`);
    const wad = { name, archiveBytes: file.size, stage: 'header', entries: [], indexChunks: [], chunkIds: [] }; wads.push(wad);
    addRange(file, 0, 272, 'header');
    let indexSize = 272;
    try {
      const head = await source.range(file, 0, 272); indexSize = 272 + head.readUInt32LE(268) * 32;
      addRange(file, 0, indexSize, 'index'); wad.indexBytes = indexSize; wad.stage = 'index';
      const index = await source.index(file); wad.stage = 'entries'; wad.entryCount = index.entries.length;
      archives.push({ file, wad, entries: index.entries, byPath: new Map(index.entries.filter(e => paths.has(e.hash)).map(e => [paths.get(e.hash), e])) });
    } catch (e) {
      if (!e.message.startsWith('missing-local-chunk:')) throw e;
      wad.pending = e.message;
    }
    wad.indexChunks = chunksForRange(file, 0, indexSize).map(c => c.id);
  }
  for (const [canonical, candidates] of seeds) {
    const path = candidates.find(p => archives.some(a => a.byPath.has(p))) ?? canonical;
    targets.set(path, { path, canonical, role: 'seed' });
  }
  const processed = new Set();
  // New references can add further entries, but never fetches. Re-plan after the
  // external executor has fetched precisely the current stage's frozen chunks.
  for (const [path, target] of targets) {
    let a = archives.find(a => a.byPath.has(path));
    let actualPath = path;
    if (!a && target.role === 'source-reference') {
      const matches = archives.flatMap(archive => [...archive.byPath.keys()].filter(p => canonicalUiPath(p) === canonicalUiPath(path)).map(p => ({ archive, path: p })));
      const unique = [...new Set(matches.map(m => m.path))];
      if (unique.length === 1) { a = matches[0].archive; actualPath = unique[0]; }
      else if (unique.length > 1) { target.status = 'ambiguous-source-reference'; continue; }
    }
    if (actualPath !== path) {
      target.requestedPath = path; target.path = actualPath;
      for (const r of references) if (r.path === path) r.resolvedPath = actualPath;
    }
    if (!a) { target.status = wads.some(w => w.stage !== 'entries') ? 'index-pending' : 'not-in-selected-wads'; continue; }
    const entry = a.byPath.get(actualPath), selected = { ...entry, path: actualPath, role: target.role };
    target.wad = a.file.name; target.hash = entry.hash;
    const entries = [selected];
    if (entry.type === 4) {
      const tocs = a.entries.filter(e => paths.get(e.hash)?.endsWith('.subchunktoc'));
      if (tocs.length !== 1 || tocs[0].type === 4) throw new Error('wad-subchunk-toc-required');
      entries.push({ ...tocs[0], path: paths.get(tocs[0].hash), role: 'subchunk-toc' });
    }
    for (const e of entries) {
      const key = `${a.file.name}:${e.hash}`;
      if (!processed.has(key)) {
        processed.add(key); a.wad.entries.push(e); addRange(a.file, e.offset, e.compressedSize, e.role === 'subchunk-toc' ? e.role : path);
      }
    }
    const covered = chunksForRange(a.file, entry.offset, entry.compressedSize);
    const locals = await Promise.all(covered.map(c => source.locate(c, a.file)));
    target.local = locals.filter(Boolean); target.missingChunks = covered.filter((_, i) => !locals[i]).map(c => c.id);
    target.status = target.missingChunks.length ? 'chunk-missing' : 'local';
    if (path.endsWith('.atlas') || path.includes('fontconfig_') || path === 'data/tftteamplanner/characters.bin') {
      try {
        const bytes = await source.extract(a.file, entry, a.entries, paths), refs = referencedPaths(path, bytes, shopCharacters);
        discovery.push({ path, status: refs.length ? 'resolved' : 'no-reference-found', references: refs.length });
        for (const ref of refs) {
          references.push({ ...ref, from: path });
          if (!targets.has(ref.path)) targets.set(ref.path, { path: ref.path, role: 'source-reference' });
        }
      } catch (e) {
        if (!e.message.startsWith('missing-local-chunk:')) throw e;
        discovery.push({ path, status: 'pending', reason: e.message });
      }
    }
  }
  const chunks = [];
  for (const c of required.values()) {
    const file = source.manifest.files.find(f => f.name === c.requiredBy[0].wad);
    chunks.push({ ...c, local: await source.locate(c, file) });
  }
  chunks.sort((a, b) => a.id.localeCompare(b.id));
  for (const w of wads) w.chunkIds = chunks.filter(c => c.requiredBy.some(r => r.wad === w.name)).map(c => c.id);
  const missing = chunks.filter(c => !c.local);
  return { schemaVersion: 1, kind: 'ui-fetch-plan', sourceVersion: VERSION, sourceManifest, locale,
    policy: 'Frozen stage allowlist. Verified local blocks/WAD ranges are reused read-only. No whole-WAD download, gap ranges, implicit fetch, guessed shop portraits or font locale claims.',
    complete: wads.every(w => w.stage === 'entries') && missing.length === 0 && discovery.every(d => d.status === 'resolved') && [...targets.values()].every(t => t.status === 'local'),
    wads, targets: [...targets.values()], references, discovery, chunks,
    totals: { targets: targets.size, selectedEntries: wads.reduce((s, w) => s + w.entries.length, 0), chunks: chunks.length,
      localChunks: chunks.length - missing.length, missingChunks: missing.length, downloadBytes: missing.reduce((n, c) => n + c.size, 0) },
    limitations: ['Unknown WAD indexes and unread source references have no invented byte estimate. Re-plan after each fetched stage.',
      'Atlas rectangles, nine-slices, UI states and Chinese glyph coverage require source/manual verification; extraction does not imply visual integration.'] };
}

// Read the existing project mappings, rather than maintaining another hero list.
// These imports run only in the offline CLI, outside both browser entry bundles.
export async function repositoryShopCharacters() {
  await import('./runtime.mjs');
  const [{ SHOP_CATALOG }, { S13_ASSETS }, { G23_HERO_IDS }, { CHAMPION_PORTRAIT_KEYS }] = await Promise.all([
    import('../../src/simulation/match-rules.ts'), import('../../src/presentation/s13-asset-manifest.ts'),
    import('../../src/presentation/g23-display.ts'), import('../../src/presentation/s13-assets.ts')]);
  const byId = new Map(S13_ASSETS.filter(a => a.kind === 'champion').map(a => [a.id, a.apiName]));
  for (const [id, name] of Object.entries({ ...G23_HERO_IDS, ...CHAMPION_PORTRAIT_KEYS })) byId.set(id, name);
  const result = new Map();
  for (const id of SHOP_CATALOG) {
    const name = byId.get(id); if (!name) throw new Error(`project-shop-character-unmapped:${id}`);
    if (result.has(name.toLowerCase())) throw new Error('project-shop-character-ambiguous');
    result.set(name.toLowerCase(), id);
  }
  return result;
}

export function planMarkdown(plan, inventory) {
  const missing = plan.chunks.filter(c => !c.local);
  const downloads = [
    '# UI 下载清单（本地文件，不提交）', '',
    `固定版本 ${plan.sourceVersion}；RMAN SHA-256 ${plan.sourceManifest.sha256}。`,
    `当前阶段缺 ${missing.length} 块，共 ${plan.totals.downloadBytes} 压缩字节。后续未读索引/引用不计入此数。`,
    '仅以下块可下载；bundle 偏移采用 [start,end)；各条目的块可能共享，以下已全局去重。', '',
    '| 块 ID | bundle ID | start | end | 字节 | WAD / 用途 |', '| --- | --- | ---: | ---: | ---: | --- |',
    ...missing.map(c => `| ${c.id} | ${c.bundleId} | ${c.offset} | ${c.offset + c.size} | ${c.size} | ${c.requiredBy.map(r => `${r.wad}: ${r.role}`).join('<br>')} |`),
    '', '语言包/atlas 定义取回后重新生成计划；不预估尚未读到的后续块。', ''
  ].join('\n');
  const findings = [
    '# UI 本地查找结果（本地文件，不提交）', '',
    `扫描根 ${inventory.roots.join(', ')}；${inventory.directories} 个可读目录、${inventory.files} 个文件、${Object.keys(inventory.chunks).length} 个不同块 ID。`,
    `不可读/断链 ${inventory.errors.length} 项见 local-inventory.json；排除虚拟文件系统和 Git 元数据。`,
    `RMAN: ${plan.sourceManifest.path}`, `字典: ${plan.sourceDictionary.join(', ')}`, '',
    'local 表示完整 payload 覆盖块通过校验；chunk-missing 表示仍缺部分/全部；index-pending 表示包归属尚不能确认。', '',
    '| 目标 | 本地状态 | WAD | 已验证的本地块路径 | 缺块 |', '| --- | --- | --- | --- | --- |',
    ...plan.targets.map(t => `| ${t.path} | ${t.status} | ${t.wad ?? '待索引确认'} | ${(t.local ?? []).map(l => l.path).join('<br>') || '无已验证完整来源'} | ${(t.missingChunks ?? []).join(', ')} |`),
    '', '完整安装 WAD 候选:', ...inventory.wads.map(p => `- ${p}`), '',
    '散装候选（未获得相同版本来源证明，不据此认定可提取）:', ...inventory.loose.map(p => `- ${p}`), ''
  ].join('\n');
  return { downloads, findings };
}

export async function makeUiPlan({ scanRoots, manifestPath, dictionary, locale = 'zh_CN', out = 'assets3d-local/ui-plan', dryRun = false } = {}) {
  await safeOutputPath(out, { directory: true });
  const inventory = await scanLocal(scanRoots), patch = await loadPatch(inventory, manifestPath);
  // Identical dictionaries are common across old clones; one complete dictionary
  // suffices; WAD membership, not dictionary age, proves version. Override supported.
  const dictionaries = dictionary ? [resolve(dictionary)] : inventory.dictionaries.slice(0, 1);
  if (!dictionaries.length) throw new Error('local-path-dictionary-not-found');
  const paths = await readDictionary(dictionaries, p => dictionaryPath(p, locale));
  const shopCharacters = await repositoryShopCharacters();
  const source = new UiSource(patch.manifest, inventory), plan = await planUi({ source, paths, ...patch, locale, shopCharacters });
  plan.sourceDictionary = dictionaries;
  if (!dryRun) {
    await writeOutputFileAtomic(join(out, 'local-inventory.json'), json({ ...inventory, invalidSelectedSources: source.invalid }), { force: true });
    await writeOutputFileAtomic(join(out, 'fetch-plan.json'), json(plan), { force: true });
    const markdown = planMarkdown(plan, inventory);
    await writeOutputFileAtomic(join(out, 'DOWNLOADS.md'), markdown.downloads, { force: true });
    await writeOutputFileAtomic(join(out, 'LOCAL_FINDINGS.md'), markdown.findings, { force: true });
  }
  return plan;
}

export async function fetchUiPlan({ planPath = 'assets3d-local/ui-plan/fetch-plan.json', scanRoots, manifestPath,
  out = 'assets3d-local/ui-cache', dryRun = false, maxBytes, fetchFn } = {}) {
  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  if (plan.kind !== 'ui-fetch-plan' || plan.sourceVersion !== VERSION || plan.sourceManifest?.sha256 !== PATCH_SHA) throw new Error('invalid-ui-plan');
  const inventory = await scanLocal(scanRoots), patch = await loadPatch(inventory, manifestPath ?? plan.sourceManifest.path);
  return fetchUiChunks({ plan, source: new UiSource(patch.manifest, inventory), out, dryRun, maxBytes, fetchFn });
}
export async function fetchUiChunks({ plan, source, out = 'assets3d-local/ui-cache', dryRun = false, maxBytes, fetchFn }) {
  const chunks = selectChunks(plan, source.manifest), missing = [], reused = [];
  for (const c of chunks) {
    const file = source.manifest.files.find(f => f.chunks.some(k => k.id === c.id));
    const local = await source.locate(file.chunks.find(k => k.id === c.id), file);
    if (local) reused.push({ id: c.id, ...local }); else missing.push(c);
  }
  const report = await fetchChunks({ plan: { ...plan, chunks: missing }, manifest: source.manifest,
    cache: join(out, 'chunks'), out, dryRun, ...(maxBytes === undefined ? {} : { maxBytes }), ...(fetchFn ? { fetchFn } : {}) });
  const result = { ...report, reused, frozenPlanChunks: chunks.length };
  if (!dryRun) await writeOutputFileAtomic(join(out, 'ui-fetch-report.json'), json(result), { force: true });
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = cliArguments(process.argv.slice(2));
    if (options.fetch) {
      const report = await fetchUiPlan(options); console.log(json(report)); if (report.status === 'failed') process.exitCode = 1;
    } else console.log(json(await makeUiPlan(options)));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}

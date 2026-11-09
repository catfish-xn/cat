import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBin } from './bin.mjs';
import { animationClips, canonicalAsset, clipRangeFor, selectAnimations, skinBindings, sourceName } from './bin-bindings.mjs';
import { decodeAnm } from './animation.mjs';
import { readGlb } from './glb.mjs';
import { inspectSkl } from './inspect-source.mjs';
import { loadUnitMap } from './local-config.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { contracts } from './runtime.mjs';
import { withinRoot } from './safe-path.mjs';

function readGlbDocument(bytes) {
  try {
    return readGlb(bytes).document;
  } catch (error) {
    if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67
      || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(16) !== 0x4e4f534a) throw error;
    const jsonLength = bytes.readUInt32LE(12);
    if (20 + jsonLength > bytes.length) throw error;
    return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  }
}

async function walkFiles(root, dir = root) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkFiles(root, full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function castClipsFor(modelEntry = {}) {
  const names = new Set();
  const add = value => {
    if (typeof value === 'string' && value) names.add(sourceName(value));
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string' && item) names.add(sourceName(item));
    }
  };
  const addSequence = seq => {
    if (!seq || typeof seq !== 'object') return;
    for (const stage of ['in', 'hold', 'main', 'out']) add(seq[stage]);
  };
  add(modelEntry.animations?.cast);
  addSequence(modelEntry.castSequence);
  const variants = modelEntry.castVariants;
  if (variants && typeof variants === 'object') {
    for (const key of ['star3', 'hero', 'front', 'back']) addSequence(variants[key]);
    add(variants.rotate);
    if (variants.branch && typeof variants.branch === 'object') {
      for (const seq of Object.values(variants.branch)) addSequence(seq);
    }
  }
  return names;
}

function referencedBy(modelEntry, clipName) {
  const target = sourceName(clipName);
  const matches = value => typeof value === 'string' && sourceName(value) === target;
  const refs = [];
  for (const [action, name] of Object.entries(modelEntry.animations ?? {})) {
    if (matches(name)) refs.push(action);
  }
  const checkSequence = (prefix, seq) => {
    if (!seq || typeof seq !== 'object') return;
    for (const [stage, value] of Object.entries(seq)) {
      if (matches(value) || (Array.isArray(value) && value.some(matches))) {
        refs.push(`${prefix}.${stage}`);
      }
    }
  };
  checkSequence('castSequence', modelEntry.castSequence);
  const variants = modelEntry.castVariants;
  if (variants && typeof variants === 'object') {
    for (const key of ['star3', 'hero', 'front', 'back']) {
      if (variants[key]) checkSequence(`castVariants.${key}`, variants[key]);
    }
    if (Array.isArray(variants.rotate) && variants.rotate.some(matches)) {
      refs.push('castVariants.rotate');
    }
    if (variants.branch && typeof variants.branch === 'object') {
      for (const [branch, seq] of Object.entries(variants.branch)) {
        checkSequence(`castVariants.branch.${branch}`, seq);
      }
    }
  }
  return refs;
}

export async function stageClipRanges({ assets, extracted, out }) {
  if (!assets || !extracted || !out) {
    throw new Error('usage: node scripts/assets3d/stage-clip-ranges.mjs --assets <assets-root> --extracted <extracted-root> --out <out-manifest>');
  }
  const assetsRoot = resolve(assets);
  const extractedRoot = resolve(extracted);
  const outPath = resolve(out);
  const manifestPath = join(assetsRoot, 'manifest.json');
  if (outPath === manifestPath) throw new Error('stage-clip-ranges-out-overlaps-input-manifest');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const outputManifest = structuredClone(manifest);

  let unitMap = null;
  try { unitMap = await loadUnitMap(); } catch {}

  const allExtractedFiles = await walkFiles(extractedRoot);
  const byLower = new Map();
  const byCanonical = new Map();
  for (const full of allExtractedFiles) {
    const rel = full.slice(extractedRoot.length + 1).replaceAll('\\', '/');
    byLower.set(rel.toLowerCase(), full);
    byCanonical.set(canonicalAsset(rel), full);
  }
  const resolveExtracted = path => {
    if (!path) return null;
    const norm = path.replaceAll('\\', '/').toLowerCase();
    return byLower.get(norm) ?? byCanonical.get(canonicalAsset(norm)) ?? null;
  };

  const charsDir = join(extractedRoot, 'data/characters');
  let charDirs = [];
  try {
    charDirs = (await readdir(charsDir, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort();
  } catch {}

  const charGraphs = new Map();
  for (const dir of charDirs) {
    const skin0 = resolveExtracted(`data/characters/${dir}/skins/skin0.bin`);
    if (!skin0) continue;
    const docs = [parseBin(await readFile(skin0))];
    for (const extra of [`data/characters/${dir}/skins/root.bin`, `characters/${dir}`]) {
      const f = resolveExtracted(extra);
      if (f) docs.push(parseBin(await readFile(f)));
    }
    let binding;
    try { binding = skinBindings(docs, []); } catch { continue; }
    const graphPaths = [...new Set(docs.flatMap(d => d.linked).filter(p => /\/animations\/.*\.bin$/i.test(p)))];
    const graphDocs = [...docs];
    let missingBin = false;
    for (const gp of graphPaths) {
      const f = resolveExtracted(gp);
      if (!f) { missingBin = true; break; }
      graphDocs.push(parseBin(await readFile(f)));
    }
    if (missingBin) continue;
    const graphEntries = graphDocs.flatMap(d => d.entries).filter(e => e.hash === binding.animationGraphHash);
    if (graphEntries.length !== 1) continue;
    const clips = animationClips([{ entries: graphEntries, patches: [] }]);
    const sklFile = resolveExtracted(binding.skeleton);
    let joints = '';
    if (sklFile) {
      try { joints = inspectSkl(await readFile(sklFile)).joints.map(j => j.name).join(','); } catch {}
    }
    const clipSet = new Set(clips.filter(c => c.atomic && c.path).map(c => sourceName(c.path)));
    charGraphs.set(dir.toLowerCase(), { dir, clips, joints, clipSet });
  }

  const rows = [];
  const skippedClips = [];
  const skipped = [];

  for (const [id, entry] of Object.entries(outputManifest.models ?? {})) {
    const glbPath = withinRoot(assetsRoot, resolve(assetsRoot, entry.path), 'unsafe-model-path');
    let doc;
    try {
      doc = readGlbDocument(await readFile(glbPath));
    } catch (error) {
      skipped.push({ id, reason: `glb-read-failed:${error.message}` });
      continue;
    }
    const glbClips = (doc.animations ?? []).map(a => a.name).filter(Boolean);
    if (!glbClips.length) {
      skipped.push({ id, reason: 'no-glb-animations' });
      continue;
    }

    const mappedSource = unitMap?.[id]?.sourceName?.toLowerCase();
    let graphInfo = (mappedSource && charGraphs.get(mappedSource))
      ?? charGraphs.get(`tft13_${id.toLowerCase()}`)
      ?? charGraphs.get(`tft_${id.toLowerCase()}`)
      ?? charGraphs.get(id.toLowerCase());

    if (!graphInfo) {
      const glbJoints = (doc.skins?.[0]?.joints ?? []).map(i => doc.nodes?.[i]?.name ?? '').join(',');
      const candidates = [...charGraphs.values()].filter(c =>
        c.joints && c.joints === glbJoints && glbClips.every(name => c.clipSet.has(name.toLowerCase())));
      if (candidates.length === 1) graphInfo = candidates[0];
    }

    if (!graphInfo) {
      skipped.push({ id, reason: 'missing-animation-graph-in-extracted' });
      continue;
    }

    const decisions = unitMap?.$animationRules
      ? selectAnimations(graphInfo.clips, unitMap.$animationRules, unitMap[id]?.animations).decisions
      : {};

    const castClips = castClipsFor(entry);
    const clipRanges = {};
    for (const clipName of glbClips) {
      const lowerName = clipName.toLowerCase();
      const graphHashes = Object.values(decisions)
        .filter(d => d.path && sourceName(d.path) === lowerName)
        .flatMap(d => d.graphHashes ?? []);
      const range = clipRangeFor(graphInfo.clips, lowerName, graphHashes.length ? graphHashes : undefined);
      if (!range) continue;
      const refs = referencedBy(entry, clipName);
      if (!castClips.has(sourceName(lowerName))) {
        const candidates = range.candidates ?? graphInfo.clips
          .filter(c => c.atomic && c.path && sourceName(c.path) === lowerName
            && (c.startFrame ?? null) === range.startFrame && (c.endFrame ?? null) === range.endFrame)
          .map(c => ({
            hash: typeof c.hash === 'number' ? c.hash.toString(16) : String(c.hash ?? ''),
            startFrame: c.startFrame ?? null,
            endFrame: c.endFrame ?? null,
          }));
        skippedClips.push({
          id,
          clipName,
          reason: 'non-cast-action',
          startFrame: range.startFrame ?? null,
          endFrame: range.endFrame ?? null,
          candidates: candidates.length ? candidates : [{ hash: '—', startFrame: range.startFrame ?? null, endFrame: range.endFrame ?? null }],
          refs,
        });
        continue;
      }
      if (range.skip) {
        skippedClips.push({
          id,
          clipName,
          reason: range.skip,
          candidates: range.candidates,
          refs,
        });
        continue;
      }
      const clipPath = graphInfo.clips.find(c => c.atomic && c.path && sourceName(c.path) === lowerName)?.path;
      const anmFile = resolveExtracted(clipPath);
      if (!anmFile) {
        skipped.push({ id, reason: `missing-anm-file:${clipPath}` });
        continue;
      }
      let decoded = null;
      try { decoded = decodeAnm(await readFile(anmFile)); } catch {}
      const fps = decoded?.fps > 0 ? decoded.fps : 30;
      if (range.endFrame === null && !(decoded?.duration > 0)) {
        skippedClips.push({
          id,
          clipName,
          reason: 'missing-anm-duration',
          candidates: [{ hash: '—', startFrame: range.startFrame, endFrame: range.endFrame }],
          refs,
        });
        continue;
      }
      const duration = decoded?.duration ?? 0;
      const start = Math.max(0, (range.startFrame ?? 0) / fps);
      const end = range.endFrame !== null ? range.endFrame / fps : duration;
      if (!(start >= 0 && start < end)) continue;
      const nonCastRefs = refs.filter(r => r !== 'cast' && !r.startsWith('castSequence.') && !r.startsWith('castVariants.'));
      clipRanges[clipName] = [start, end];
      rows.push({
        id,
        sourceDir: graphInfo.dir,
        clipName,
        anmDuration: duration,
        fps,
        startFrame: range.startFrame,
        endFrame: range.endFrame,
        start,
        end,
        refs,
        ...(nonCastRefs.length ? { sharedNonCast: nonCastRefs } : {}),
      });
    }

    delete entry.clipRanges;
    if (Object.keys(clipRanges).length > 0) {
      entry.clipRanges = clipRanges;
    }
  }

  const { assertManifest } = await contracts();
  assertManifest(outputManifest);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(outputManifest, null, 2)}\n`, 'utf8');

  const lines = [
    '# Manifest clipRanges 部署报告',
    '',
    `- 模型总数：${Object.keys(outputManifest.models ?? {}).length}`,
    `- 写入 clipRanges 的模型数：${Object.values(outputManifest.models ?? {}).filter(m => m.clipRanges).length}`,
    `- 裁剪动作片段总数：${rows.length}`,
    `- 跳过片段数：${skippedClips.length}`,
    `- 跳过模型数：${skipped.length}`,
    '',
    '## 裁剪片段明细',
    '',
    '| 英雄 | 片段名 | anm 时长 (s) | FPS | StartFrame | EndFrame | 裁后秒数区间 | 引用动作 |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...rows.map(r => `| ${r.id} | \`${r.clipName}\` | ${r.anmDuration.toFixed(4)} | ${ Number.isInteger(Math.round(r.fps * 1000) / 1000) ? Math.round(r.fps) : r.fps.toFixed(4) } | ${r.startFrame ?? '—'} | ${r.endFrame ?? '—'} | \`[${r.start.toFixed(4)}, ${r.end.toFixed(4)}]\` (${r.startFrame ?? 0}/${Math.round(r.fps)}..${r.endFrame !== null ? `${r.endFrame}/${Math.round(r.fps)}` : `${r.anmDuration.toFixed(4)}s`}) | ${r.refs.length ? r.refs.join(', ') : '—'}${r.sharedNonCast ? ' (施法优先)' : ''} |`),
    '',
    '## 跳过片段',
    '',
    '| 英雄 | 片段名 | 原因 | 候选 hash 与范围 | 引用动作 |',
    '| --- | --- | --- | --- | --- |',
    ...skippedClips.map(s => `| ${s.id} | \`${s.clipName}\` | \`${s.reason}\` | ${s.candidates.map(c => `\`${c.hash}: [${c.startFrame ?? 'null'}, ${c.endFrame ?? 'null'}]\``).join(', ') || '—'} | ${s.refs.length ? s.refs.join(', ') : '—'} |`),
    '',
    '## 跳过模型与原因',
    '',
    '| 模型 ID | 原因 |',
    '| --- | --- |',
    ...skipped.map(s => `| ${s.id} | \`${s.reason}\` |`),
    '',
  ];
  return { manifest: outputManifest, rows, skippedClips, skipped, markdown: lines.join('\n') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = argumentsFor(process.argv.slice(2), ['--assets', '--extracted', '--out']);
  const result = await stageClipRanges(args);
  process.stdout.write(result.markdown);
}

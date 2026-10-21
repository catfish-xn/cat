// Offline scale extraction. Callers select the skin; root defaults are not a second multiplier.
import { parseBin, binField, binIs } from './bin.mjs';
import { canonicalAsset } from './bin-bindings.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from './runtime.mjs';
import { safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';

export function extractUnitScale(documents, { skinEntryHash, meshPath, multipliers = [] } = {}) {
  if (!Array.isArray(documents) || !documents.length) throw new Error('missing-scale-source');
  if (documents.some(d => d.patches?.length)) throw new Error('unsupported-scale-bin-patches');
  const candidates = documents.flatMap(d => d.entries).filter(e =>
    (binIs(e, 'SkinCharacterDataProperties') || binIs(e, 'TftSkinCharacterDataProperties'))
    && binField(e, 'skinMeshProperties')
    && (skinEntryHash === undefined || e.hash === skinEntryHash)
    && (meshPath === undefined || canonicalAsset(binField(binField(e, 'skinMeshProperties'), 'simpleSkin') ?? '') === canonicalAsset(meshPath)));
  if (candidates.length !== 1) throw new Error(candidates.length ? 'ambiguous-scale-skin' : 'missing-scale-skin');
  const mesh = binField(candidates[0], 'skinMeshProperties'), value = binField(mesh, 'skinScale');
  const skinScale = value === undefined ? 1 : value;
  const valid = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!valid(skinScale)) throw new Error('invalid-skin-scale');
  let unitScale = skinScale;
  const sources = [value === undefined ? 'skinMeshProperties.skinScale:default=1' : 'skinMeshProperties.skinScale'];
  // Only explicitly established model multipliers. Selection dimensions are not multipliers.
  for (const m of multipliers) {
    if (!m || typeof m.field !== 'string' || !m.field.trim() || !valid(m.value)) throw new Error('invalid-scale-multiplier');
    unitScale *= m.value; sources.push(m.field);
  }
  if (!valid(unitScale)) throw new Error('invalid-unit-scale-product');
  return { unitScale, skinScale, source: value === undefined ? 'official-default' : 'official', sources };
}
export function extractUnitScaleBin(bytes, selector) { return extractUnitScale([parseBin(bytes)], selector); }

/** Copy-on-write and validate against the application's actual manifest contract. */
export function applyUnitScales(manifest, rows, assertManifest) {
  assertManifest(manifest);
  const result = structuredClone(manifest), seen = new Set();
  for (const { ids, ...scale } of rows) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('missing-scale-ids');
    if (typeof scale.unitScale !== 'number' || !Number.isFinite(scale.unitScale)) throw new Error('invalid-unit-scale');
    for (const id of ids) {
      if (!Object.hasOwn(result.models, id) || seen.has(id)) throw new Error('unknown-or-duplicate-scale-id');
      seen.add(id); result.models[id].unitScale = scale.unitScale;
    }
  }
  assertManifest(result); return result;
}

/** Local JSON job: { manifestPath, outputManifest, selections: [{ ids, skinBin, ...selector }] }.
 * Missing/unreadable input stops the job; it is never relabelled an official default.
 */
export async function writeUnitScaleManifest(job) {
  const output = await safeOutputPath(job.outputManifest);
  withinRoot(await safeOutputPath('assets3d-local', { directory: true }), output, 'unit-scale-output-local-only');
  if (resolve(job.manifestPath) === output) throw new Error('unit-scale-output-overlaps-input');
  const manifest = JSON.parse(await readFile(job.manifestPath, 'utf8')), rows = [];
  for (const { ids, skinBin, ...selector } of job.selections) {
    rows.push({ ids, ...extractUnitScaleBin(await readFile(skinBin), selector) });
  }
  const { assertManifest } = await contracts();
  const scaled = applyUnitScales(manifest, rows, assertManifest);
  await writeOutputFileAtomic(output, JSON.stringify(scaled, null, 2) + '\n');
  return rows;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('usage: node scripts/assets3d/unit-scale.mjs <local-job.json>');
  const rows = await writeUnitScaleManifest(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify({ units: rows.flatMap(r => r.ids).length, officialDefaults: rows.filter(r => r.source === 'official-default').flatMap(r => r.ids) }));
}

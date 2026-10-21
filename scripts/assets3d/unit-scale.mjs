// Offline scale extraction. Callers select the skin; root defaults are not a second multiplier.
import { parseBin, binField, binIs, fnv1a } from './bin.mjs';
import { canonicalAsset } from './bin-bindings.mjs';
import { link, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from './runtime.mjs';
import { safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';

function checkedFields(object, reason) {
  const uint32 = n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
  if (!object || typeof object !== 'object' || !uint32(object.type)
    || !Array.isArray(object.fields)) throw new Error(reason);
  const seen = new Set();
  for (const field of object.fields) {
    if (!field || !uint32(field.hash) || !Number.isInteger(field.type)
      || !(field.type >= 0 && field.type <= 18 || field.type >= 0x80 && field.type <= 0x87)
      || !Object.hasOwn(field, 'value')) throw new Error(reason);
    if (seen.has(field.hash)) throw new Error('duplicate-bin-field');
    seen.add(field.hash);
  }
  return object.fields;
}

function checkedMesh(entry) {
  const fields = checkedFields(entry, 'invalid-scale-skin');
  const meshField = fields.find(f => f.hash === fnv1a('skinMeshProperties'));
  const mesh = meshField?.value;
  if (![0x82, 0x83].includes(meshField?.type) || !binIs(mesh, 'SkinMeshDataProperties'))
    throw new Error('invalid-skin-mesh');
  const meshFields = checkedFields(mesh, 'invalid-skin-mesh');
  const simpleSkin = meshFields.find(f => f.hash === fnv1a('simpleSkin'));
  if (simpleSkin && (simpleSkin.type !== 16 || typeof simpleSkin.value !== 'string'))
    throw new Error('invalid-skin-mesh-path');
  const scale = meshFields.find(f => f.hash === fnv1a('skinScale'));
  if (scale && (scale.type !== 10 || typeof scale.value !== 'number'
    || !Number.isFinite(scale.value) || scale.value <= 0)) throw new Error('invalid-skin-scale');
  return mesh;
}

export function extractUnitScale(documents, { skinEntryHash, meshPath, multipliers = [] } = {}) {
  if (!Array.isArray(documents) || !documents.length) throw new Error('missing-scale-source');
  if (documents.some(d => !d || !Array.isArray(d.entries))) throw new Error('invalid-scale-source');
  if (documents.some(d => d.patches?.length)) throw new Error('unsupported-scale-bin-patches');
  const candidates = documents.flatMap(d => d.entries).filter(e =>
    (binIs(e, 'SkinCharacterDataProperties') || binIs(e, 'TftSkinCharacterDataProperties'))
    && (skinEntryHash === undefined || e.hash === skinEntryHash))
    .map(checkedMesh)
    .filter(mesh => meshPath === undefined || canonicalAsset(binField(mesh, 'simpleSkin') ?? '') === canonicalAsset(meshPath));
  if (candidates.length !== 1) throw new Error(candidates.length ? 'ambiguous-scale-skin' : 'missing-scale-skin');
  const value = binField(candidates[0], 'skinScale');
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
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeOutputFile(temporary, JSON.stringify(scaled, null, 2) + '\n');
    // Same-directory hard links publish the complete file and fail if the target
    // exists, including when it appeared after safeOutputPath's check.
    await link(await safeOutputPath(temporary, { force: true }), await safeOutputPath(output));
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  return rows;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('usage: node scripts/assets3d/unit-scale.mjs <local-job.json>');
  const rows = await writeUnitScaleManifest(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify({ units: rows.flatMap(r => r.ids).length, officialDefaults: rows.filter(r => r.source === 'official-default').flatMap(r => r.ids) }));
}

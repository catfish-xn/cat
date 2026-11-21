// Offline champion light (contracts.ts ChampionLighting): the board's light grid sampled under its hex cells, and each
// selected skin's selfIllumination. Output stays in the local asset root; nothing here carries client values.
import { parseBin, binField, binIs, fnv1a } from './bin.mjs';
import { selectSkinMesh } from './unit-scale.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from './runtime.mjs';
import { safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';

const CHAMP_TIERS = 'Shaders/SkinnedMesh/TFT_ChampTiers';
const FACES = 6, HEADER = 32;

/** Light grid v3: u32 version, header size, width, height; f32 world extent x, z (two further header floats unused);
 * then width × height cells of six RGBA8 colours (+X, −X, +Y, −Y, +Z, −Z of the board's source space), row-major in z. */
export function parseLightGrid(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < HEADER) throw new Error('invalid-light-grid');
  const version = bytes.readUInt32LE(0), header = bytes.readUInt32LE(4), width = bytes.readUInt32LE(8), height = bytes.readUInt32LE(12);
  const extentX = bytes.readFloatLE(16), extentZ = bytes.readFloatLE(20);
  if (version !== 3 || header !== HEADER || !(width > 0 && width <= 1024 && height > 0 && height <= 1024)
    || !(extentX > 0) || !(extentZ > 0) || bytes.length !== HEADER + width * height * FACES * 4) throw new Error('invalid-light-grid');
  return { width, height, extentX, extentZ, bytes };
}

/** Bilinear colours (0..1) at a source point, cell centres at (i + ½) × cell size, clamped at the edges. */
export function sampleLightGrid(grid, x, z) {
  const gx = x / (grid.extentX / grid.width) - 0.5, gz = z / (grid.extentZ / grid.height) - 0.5;
  const x0 = Math.floor(gx), z0 = Math.floor(gz), fx = gx - x0, fz = gz - z0;
  const at = (cx, cz, face, channel) => {
    const ix = Math.min(grid.width - 1, Math.max(0, cx)), iz = Math.min(grid.height - 1, Math.max(0, cz));
    return grid.bytes[HEADER + ((iz * grid.width + ix) * FACES + face) * 4 + channel] / 255;
  };
  return Array.from({ length: FACES }, (_, face) => [0, 1, 2].map(c =>
    at(x0, z0, face, c) * (1 - fx) * (1 - fz) + at(x0 + 1, z0, face, c) * fx * (1 - fz)
    + at(x0, z0 + 1, face, c) * (1 - fx) * fz + at(x0 + 1, z0 + 1, face, c) * fx * fz));
}

const median = values => { const s = [...values].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/**
 * One cube for the board: the per-face, per-channel median over its hex cell centres (reference grid of the
 * alignment), re-keyed to world axes. World = offset + scale × glb with the glb's source X already reflected, so a world
 * axis is the source axis times sign(scale) (and −1 on X when reflected).
 */
export function boardAmbientCube(grid, alignment, { columns = 7, rows = 8 } = {}) {
  const { radius, origin } = alignment.target, [sx, , sz] = alignment.scale, [ox, , oz] = alignment.offset;
  const reflect = alignment.reflectX ? -1 : 1, samples = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const wx = origin.x + Math.sqrt(3) * radius * (col + (row % 2) / 2), wz = origin.y + 1.5 * radius * row;
    samples.push(sampleLightGrid(grid, reflect * (wx - ox) / sx, (wz - oz) / sz));
  }
  const source = Array.from({ length: FACES }, (_, face) => [0, 1, 2].map(c => median(samples.map(s => s[face][c]))));
  const flipX = Math.sign(sx) * reflect < 0, flipZ = Math.sign(sz) < 0;
  return [source[flipX ? 1 : 0], source[flipX ? 0 : 1], source[2], source[3], source[flipZ ? 5 : 4], source[flipZ ? 4 : 5]];
}

/** The skin's selfIllumination when its material is the champion tier shader; null for any other material. */
export function extractChampionSelfIllumination(skinDocuments, characterDocuments, selector = {}) {
  const mesh = selectSkinMesh(skinDocuments, selector);
  const link = binField(mesh, 'material');
  const hash = typeof link === 'string' ? fnv1a(link) : link?.hash;
  const material = characterDocuments.flatMap(d => d.entries).find(e => e.hash === hash && binIs(e, 'StaticMaterialDef'));
  const shader = (binField(material, 'techniques') ?? []).flatMap(t => binField(t, 'passes') ?? []).map(p => binField(p, 'shader'))[0];
  const shaderHash = typeof shader === 'string' ? fnv1a(shader) : shader?.hash;
  if (!material || shaderHash !== fnv1a(CHAMP_TIERS)) return null;
  const value = binField(mesh, 'selfIllumination') ?? 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('invalid-self-illumination');
  return value;
}

/** Copy-on-write; validated against the application's manifest and lighting contracts. */
export function applyChampionLighting(manifest, { board, lightingPath, rows }, assertManifest) {
  assertManifest(manifest);
  const result = structuredClone(manifest);
  if (!result.boards || !Object.hasOwn(result.boards, board)) throw new Error('unknown-lighting-board');
  result.boards[board].lighting = { path: lightingPath };
  const seen = new Set();
  for (const { ids, selfIllumination } of rows) {
    for (const id of ids) {
      if (!Object.hasOwn(result.models, id) || seen.has(id)) throw new Error('unknown-or-duplicate-lighting-id');
      seen.add(id);
      if (selfIllumination === null) delete result.models[id].selfIllumination;
      else result.models[id].selfIllumination = selfIllumination;
    }
  }
  assertManifest(result); return result;
}

/**
 * Local JSON job: { manifestPath, outputManifest, outputLighting, lightingPath, board, lightGrid, scales: { ambient, self },
 * selections: [{ ids, skinBin, characterBin, ...selector }] }. Scales come from a calibration against client footage.
 */
export async function writeChampionLighting(job) {
  const local = await safeOutputPath('assets3d-local', { directory: true });
  const outputManifest = withinRoot(local, await safeOutputPath(job.outputManifest, { force: true }), 'lighting-output-local-only');
  const outputLighting = withinRoot(local, await safeOutputPath(job.outputLighting, { force: true }), 'lighting-output-local-only');
  if (resolve(job.manifestPath) === outputManifest) throw new Error('lighting-output-overlaps-input');
  const { assertManifest, assertChampionLighting } = await contracts();
  const manifest = JSON.parse(await readFile(job.manifestPath, 'utf8'));
  assertManifest(manifest);
  const entry = manifest.boards?.[job.board];
  if (!entry) throw new Error('unknown-lighting-board');
  const lighting = { schemaVersion: 1, ambientCube: boardAmbientCube(parseLightGrid(await readFile(job.lightGrid)), entry.alignment, entry.grid),
    ambientScale: job.scales?.ambient, selfScale: job.scales?.self };
  assertChampionLighting(lighting);
  const rows = [], characters = new Map();
  for (const { ids, skinBin, characterBin, ...selector } of job.selections) {
    if (!characters.has(characterBin)) characters.set(characterBin, [parseBin(await readFile(characterBin))]);
    rows.push({ ids, selfIllumination: extractChampionSelfIllumination([parseBin(await readFile(skinBin))], characters.get(characterBin), selector) });
  }
  const result = applyChampionLighting(manifest, { board: job.board, lightingPath: job.lightingPath, rows }, assertManifest);
  await writeOutputFileAtomic(outputLighting, JSON.stringify(lighting, null, 2) + '\n', { force: true });
  await writeOutputFileAtomic(outputManifest, JSON.stringify(result, null, 2) + '\n', { force: true });
  return rows;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('usage: node scripts/assets3d/champion-lighting.mjs <local-job.json>');
  const rows = await writeChampionLighting(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(JSON.stringify({ lit: rows.filter(r => r.selfIllumination !== null).flatMap(r => r.ids).length,
    other: rows.filter(r => r.selfIllumination === null).flatMap(r => r.ids) }));
}

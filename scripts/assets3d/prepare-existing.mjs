// Import existing, locally extracted 14.24 trial assets without executing legacy tools.
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, join, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { embedDiffuse, readGlb, summarizeGlb } from './glb.mjs';
import { verifySource } from './verify-source.mjs';
import { safeInputPath, safeOutputPath, writeOutputFile } from './safe-path.mjs';

export const CLIPS = {
  jinx: { idle: 'tft13_jinx_idle1', move: 'tft13_jinx_minigun_run', attack: 'tft13_jinx_minigun_attack1', cast: 'tft13_jinx_spell_deathrocket', death: 'jinx_minigun_death' },
  vi: { idle: 'vi_idle1', move: 'vi_run1', attack: 'vi_attack1', cast: 'vi_spell4_hit', death: 'vi_death' },
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function outside(root, candidate) {
  const path = relative(root, candidate);
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}
async function inputFile(root, path) { return readFile(await safeInputPath(root, join(root, path))); }
export async function prepareExisting(source, output, heroes = ['jinx', 'vi'], { force = false } = {}) {
  const sourceRoot = await realpath(source), out = await safeOutputPath(output, { directory: true });
  if (!outside(sourceRoot, out)) throw new Error('output-must-not-modify-source');
  if (!heroes.length || heroes.some(id => !Object.hasOwn(CLIPS, id)) || new Set(heroes).size !== heroes.length) throw new Error('invalid-hero-selection');
  const sourceVerification = await verifySource(sourceRoot, heroes);
  const manifest = { schemaVersion: 1, models: {}, effects: {}, files: {} };
  const report = { sourceVersion: sourceVerification.version, sourceVerification, mode: 'existing-rigged-glb', units: {}, limitations: [
    'Uses previously converted GLB; this command does not claim to decode raw ANM.',
    'Particle normalization and raw conversion are separate pipeline steps.',
    'No browser or visual acceptance is implied by binary preservation checks.',
  ] };
  // Validate every input before writing any result.
  const prepared = [];
  for (const id of heroes) {
    const glb = await inputFile(sourceRoot, `public/assets/${id}/rigged.glb`);
    const png = await inputFile(sourceRoot, `public/assets/${id}/diffuse.png`);
    const before = readGlb(glb), summary = summarizeGlb(glb);
    for (const state of Object.keys(CLIPS[id])) if (!summary.animations.includes(state)) throw new Error(`missing-animation:${id}:${state}`);
    if (!summary.bones) throw new Error(`missing-skeleton:${id}`);
    const result = embedDiffuse(glb, png), after = readGlb(result);
    if (!after.binary.subarray(0, before.binary.length).equals(before.binary)) throw new Error('geometry-animation-bytes-changed');
    for (const field of ['skins', 'animations', 'nodes', 'accessors', 'meshes']) {
      if (JSON.stringify(before.document[field]) !== JSON.stringify(after.document[field])) throw new Error(`changed-${field}`);
    }
    const path = `models/${id}/model.glb`;
    manifest.models[id] = { path, animations: Object.fromEntries(Object.keys(CLIPS[id]).map(state => [state, state])) };
    manifest.files[path] = { bytes: result.length, sha256: hash(result) };
    report.units[id] = { ...summarizeGlb(result), sourceGlbSha256: hash(glb), sourcePngSha256: hash(png),
      outputSha256: hash(result), animationSources: CLIPS[id], preservedBinaryBytes: before.binary.length };
    prepared.push({ path, result });
  }
  // Preflight all destinations: a late collision must not partially overwrite a prior run.
  for (const [name, data] of [['manifest.json', manifest], ['preparation-report.json', report]]) {
    prepared.push({ path: name, result: `${JSON.stringify(data, null, 2)}\n` });
  }
  for (const { path } of prepared) {
    const dest = await safeOutputPath(join(out, path), { force });
    if (!outside(sourceRoot, dest)) throw new Error('output-must-not-modify-source');
  }
  for (const { path, result } of prepared) await writeOutputFile(join(out, path), result, { force });
  return { manifest, report };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), source = args[args.indexOf('--source') + 1];
  const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'assets3d-local/prepared';
  if (!args.includes('--source') || !source || source.startsWith('--') || !output || output.startsWith('--')) throw new Error('usage: --source <trial-directory> [--output <assets3d-local/directory>] [--force]');
  const result = await prepareExisting(source, output, undefined, { force: args.includes('--force') });
  console.log(JSON.stringify(result.report, null, 2));
}

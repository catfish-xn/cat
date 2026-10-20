// Offline-only batch: reads existing reports/cache; writes only an independent real root.
import { readFile, lstat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
export async function loadBindingTables() {
 const tables = {};
 for (const name of await readdir(new URL('./fx-bindings/', import.meta.url))) {
  if (!name.endsWith('.mjs') || name.startsWith('batch')) continue;
  tables[name.slice(0,-4)] = (await import(new URL('./fx-bindings/' + name, import.meta.url))).default;
 }
 return tables;
}
import { textureAlphaLookup } from './texture-alpha.mjs';
import { convertParticles } from './particles.mjs';
import { writeParticleEffects } from './build.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { contracts } from './runtime.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { readGlb } from './glb.mjs';

const json = v => `${JSON.stringify(v, null, 2)}\n`;
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');

export async function batchOutputRoot(out) {
  const leaf = resolve(out).split(/[/\\]/).at(-1);
  if (!/^fx-batch[a-z0-9-]+$/.test(leaf) || resolve(out) !== resolve('assets3d-local', leaf)) throw new Error('batch-output-only');
  for (const p of ['assets3d-local', out]) {
    try { if ((await lstat(p)).isSymbolicLink()) throw new Error('batch-root-must-be-real-directory'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const output = await safeOutputPath(out, { directory: true });
  return withinRoot(resolve('assets3d-local'), output, 'batch-output-only');
}

export function batchActionBindings(manifest, rows, bones, tables) {
  const actionEffects = {}, playback = {}, unavailable = [];
  for (const [unit, table] of Object.entries(tables)) {
    actionEffects[unit] = { attack: [], cast: [] };
    for (const [system, reason] of table.unavailable) unavailable.push({ unit, system, reason });
    for (const action of ['attack', 'cast']) for (const spec of table[action]) {
      if (!['start', 'travel', 'impact'].includes(spec.phase)) throw new Error('invalid-binding-phase');
      if (spec.bone && !bones[unit].includes(spec.bone)) throw new Error(`missing-binding-bone:${unit}:${spec.bone}`);
      if (!['source', 'target', 'projectile'].includes(spec.anchor)) throw new Error('invalid-binding-anchor');
      if (!Number.isFinite(spec.delay) || spec.delay < 0 || !Number.isFinite(spec.maxDuration) || spec.maxDuration <= 0) throw new Error('invalid-binding-timing');
      const exact = spec.system.startsWith('TFT13_') ? spec.system : null;
      const row = spec.system === '@shared-hit' ? rows.global.find(r => r.sourcePath.endsWith('/TFT_Global_BA_Hit'))
        : rows[unit].find(r => exact ? r.sourcePath.split('/').at(-1) === exact : r.sourcePath.endsWith(`_Base_${spec.system}`));
      if (!row?.path) { unavailable.push({ unit, action, system: spec.system, phase: spec.phase, reason: row?.reason ?? 'missing-system' }); continue; }
      if (!manifest.effects[row.effectId]) throw new Error('dangling-batch-binding');
      actionEffects[unit][action].push(row.effectId);
      const { system, ...placement } = spec;
      const value = { status: 'approximated', convention: 'explicit-preview-stage-timing-and-placement', ...placement };
      if (playback[row.effectId] && JSON.stringify(playback[row.effectId]) !== JSON.stringify(value)) throw new Error('conflicting-effect-playback');
      playback[row.effectId] = value;
    }
  }
  return { schemaVersion: 1, status: 'approximated', convention: 'explicit-preview-stage-timing-and-placement',
    actionEffects, playback, unavailable, notes: Object.fromEntries(Object.entries(tables).filter(([, t]) => t.note).map(([u, t]) => [u, t.note])) };
}

export async function fxBatch({ units = '', out = 'assets3d-local/fx-batch-preview', force = false } = {}) {
  const tables = await loadBindingTables();
  const selected = units.split(',');
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(u => !Object.hasOwn(tables, u))) throw new Error('unsupported-batch-units');
  const output = await batchOutputRoot(out);
  const write = (p, b) => writeOutputFile(join(output, p), b, { force });
  const input = async (root, p) => readFile(await safeInputPath(resolve(root), resolve(root, p)));
  const { assertManifest, parseParticleDocument } = await contracts();
  const manifest = { schemaVersion: 1, models: {}, effects: {} }, rows = {}, bones = {}, counts = {};
  const models = await read('assets3d-local/all-anim/manifest.json');
  const extraction = await read('assets3d-local/trial/local/extraction.json');
  const records = new Map(extraction.files.map(r => [canonical(r.path), r]));
  await write('batch-status.json', json({ ready: false }));
  for (const id of selected) {
    let root;
    for (const b of ['batch-cost12', 'batch-cost345']) {
      const p = resolve('assets3d-local/out', b, 'units', id);
      try { await lstat(p); root = p; break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    if (!root) throw new Error(`missing-local-unit:${id}`);
    const report = JSON.parse((await input(root, 'build-report.json')).toString());
    const prior = report.units[id].particles, source = {}, prefix = `units/${id}/`;
    for (const s of prior.systems) source[s.sourcePath] = JSON.parse((await input(root, s.reportPath)).toString()).originalFields;
    const textures = new Map(report.textures.filter(t => t.status === 'converted').map(t => [canonical(t.source), prefix + t.path]));
    const meshes = new Map(prior.meshes.filter(m => m.status === 'converted').map(m => [m.source, prefix + m.path]));
    const meshReasons = new Map(prior.meshes.filter(m => m.status !== 'converted').map(m => [m.source, m.reason]));
    const textureAlpha = await textureAlphaLookup(report.textures, p => input(root, p));
    const converted = convertParticles(source, p => textures.get(canonical(p)), parseParticleDocument,
      { particleMode: 'approximate', textureAlpha, approximateLinger: true, meshPath: p => meshes.get(p), meshReasons });
    const used = new Set(converted.systems.flatMap(s => s.document?.emitters.flatMap(e => [e.texture, e.mesh].filter(Boolean)) ?? []));
    for (const path of used) {
      const mesh = prior.meshes.find(m => prefix + m.path === path);
      if (!mesh) { await write(path, await input(root, path.slice(prefix.length))); continue; }
      const r = records.get(canonical(mesh.source));
      if (!r) throw new Error('missing-mesh-cache-record');
      const bytes = await input('assets3d-local/trial/local/extracted', r.path);
      if (bytes.length !== r.bytes || createHash('sha256').update(bytes).digest('hex') !== r.sha256) throw new Error('source-hash-mismatch');
      await write(path, convertParticleMesh(bytes, r.path.slice(r.path.lastIndexOf('.'))).glb);
    }
    const result = await writeParticleEffects(id, converted, {}, {
      write: async (p, b) => { if (!p.endsWith('.report.json')) parseParticleDocument(JSON.parse(b)); await write(p, b); },
      remove: async p => { try { await unlink(await safeOutputPath(join(output, p), { force: true })); }
        catch (e) { if (e.code !== 'ENOENT') throw e; } },
    });
    rows[id] = result.systems; counts[id] = converted.counts; Object.assign(manifest.effects, result.effects);
    const model = models.models[id], bytes = await input('assets3d-local/all-anim', model.path);
    const gltf = readGlb(bytes).document;
    bones[id] = [...new Set(gltf.skins.flatMap(s => s.joints.map(i => gltf.nodes[i].name)))];
    await write(model.path, bytes); manifest.models[id] = model;
  }
  // Reuse the already converted local shared hit, without invoking global extraction or networking.
  const trial = await read('assets3d-local/fx-trial/manifest.json');
  const sharedId = 'global_tft_global_ba_hit', shared = trial.effects[sharedId];
  rows.global = [];
  if (shared) {
    const bytes = await input('assets3d-local/fx-trial', shared.path), doc = parseParticleDocument(JSON.parse(bytes));
    for (const path of new Set(doc.emitters.flatMap(e => [e.texture, e.mesh].filter(Boolean)))) await write(path, await input('assets3d-local/fx-trial', path));
    await write(shared.path, bytes); manifest.effects[sharedId] = shared;
    rows.global.push({ effectId: sharedId, path: shared.path, sourcePath: 'shared/TFT_Global_BA_Hit' });
  }
  const bindings = batchActionBindings(manifest, rows, bones, Object.fromEntries(selected.map(u => [u, tables[u]])));
  manifest.actionEffects = bindings.actionEffects; assertManifest(manifest);
  await write('action-bindings.json', json(bindings));
  await write('bones.json', json(bones)); await write('systems.json', json(rows));
  await write('manifest.json', json(manifest));
  await writeOutputFile(join(output, 'batch-status.json'), json({ ready: true, particleMode: 'approximate', counts, effectDocuments: Object.keys(manifest.effects).length,
    models: 'Byte copies from all-anim; originals untouched.', shared: 'Existing local fx-trial shared hit byte copy; originals untouched.', shellConnected: false }), { force: true });
  return { units: selected, counts, unavailable: bindings.unavailable };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await fxBatch(argumentsFor(process.argv.slice(2), ['--units', '--out']))));
}

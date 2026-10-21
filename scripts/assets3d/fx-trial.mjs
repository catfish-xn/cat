import { createHash } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import jinxBindings from './fx-bindings/jinx.mjs';
import viBindings from './fx-bindings/vi.mjs';
import { writeParticleEffects } from './build.mjs';
import { textureAlphaLookup, pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { convertParticles } from './particles.mjs';
import { contracts } from './runtime.mjs';
import { compareParticleSources } from './particle-bin.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { particleMode } from './particle-approximate.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { refreshMeshes } from './rebuild-mesh-cache.mjs';
import { globalVfx } from './global-vfx.mjs';
import { decodeTexture, encodePng } from './texture.mjs';

const json = v => `${JSON.stringify(v, null, 2)}\n`;
const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const sum = (target, counts) => { for (const [k, n] of Object.entries(counts)) target[k] = (target[k] ?? 0) + n; };

/** No source semantics inferred: enumerate concrete values with emitter provenance. */
export function fieldEvidence(system) {
  const fields = {};
  for (const [list, emitters] of Object.entries(system).filter(([k]) => /^(complex|simple)EmitterDefinitionData$/.test(k))) {
    for (const [index, emitter] of emitters.entries()) for (const [field, value] of Object.entries(emitter)) {
      const values = fields[field] ??= [];
      let row = values.find(v => JSON.stringify(v.value) === JSON.stringify(value));
      if (!row) { row = { value, emitters: [] }; values.push(row); }
      row.emitters.push({ list, index, name: emitter.emitterName ?? '' });
    }
  }
  return fields;
}

export function spellEvidence(source) {
  const resolvers = Object.entries(source).filter(([, v]) => v.__type === 'ResourceResolver');
  const resourceMap = Object.assign({}, ...resolvers.map(([, v]) => v.resourceMap));
  const spells = Object.entries(source).filter(([, v]) => v.__type === 'SpellObject').map(([path, v]) => ({
    path, script: v.mScriptName, animation: v.mSpell?.mAnimationName ?? null,
    effects: Object.entries(v.mSpell ?? {}).filter(([k]) => /EffectKey$/.test(k)).map(([field, key]) => ({
      field, key, system: resourceMap[key] ?? null,
      available: !!resourceMap[key] && source[resourceMap[key]]?.__type === 'VfxSystemDefinitionData',
    })),
    missile: v.mSpell?.mMissileSpec ?? null,
  }));
  return { resolvers: resolvers.map(([path]) => path), resourceMap, spells };
}

/** Reuses prior source inventories/resources, recalculates every emitter. Does
 * not modify any batch root, rerun models, or count approximations as exact. */
export async function recountParticles(write, parseParticleDocument, { particleMode: mode = 'approximate' } = {}) {
  particleMode(mode);
  const totals = { systems: 0, emitters: 0, mapped: 0, approximated: 0, skipped: 0, rejected: 0 };
  const strictTotals = { systems: 0, emitters: 0, mapped: 0, approximated: 0, skipped: 0, rejected: 0 };
  const units = {}, reasonsByStatus = { approximated: {}, skipped: {}, rejected: {} };
  for (const batch of ['batch-cost12', 'batch-cost345']) {
    const batchRoot = resolve('assets3d-local/out', batch);
    const previous = await read(await safeInputPath(batchRoot, join(batchRoot, 'build-report.json')));
    for (const id of Object.keys(previous.units)) {
      if (Object.hasOwn(units, id)) throw new Error('duplicate-recount-unit');
      const root = join(batchRoot, 'units', id);
      const report = await read(await safeInputPath(root, join(root, 'build-report.json'))), prior = report.units[id].particles;
      const source = {};
      for (const system of prior.systems) {
        const sidecar = await read(await safeInputPath(root, join(root, system.reportPath)));
        source[system.sourcePath] = sidecar.originalFields;
      }
      const textures = new Map(report.textures.filter(t => t.status === 'converted').map(t => [canonical(t.source), t.path]));
      const meshes = new Map(prior.meshes.filter(m => m.status === 'converted').map(m => [m.source, m.path]));
      const meshReasons = new Map(prior.meshes.filter(m => m.status !== 'converted').map(m => [m.source, m.reason]));
      const textureAlpha = mode === 'strict' ? undefined : await textureAlphaLookup(report.textures,
        async p => readFile(await safeInputPath(root, join(root, p))));
      const converted = convertParticles(source, p => textures.get(canonical(p)), parseParticleDocument,
        { textureAlpha, meshPath: p => meshes.get(p), meshReasons, approximateLinger: true, particleMode: mode });
      if (prior.emitters !== converted.emitters || prior.systemCount !== converted.systems.length) throw new Error('recount-inventory-mismatch');
      const counts = { systems: converted.systems.length, emitters: converted.emitters, ...converted.counts };
      if (counts.mapped + counts.approximated + counts.skipped + counts.rejected !== counts.emitters) throw new Error('recount-partition-mismatch');
      units[id] = counts; sum(totals, counts);
      for (const status of Object.keys(reasonsByStatus)) sum(reasonsByStatus[status], converted.reasonsByStatus[status]);
      const strict = mode === 'strict' ? converted : convertParticles(source, p => textures.get(canonical(p)), parseParticleDocument,
        { meshPath: p => meshes.get(p), meshReasons, approximateLinger: true, particleMode: 'strict' });
      sum(strictTotals, { systems: strict.systems.length, emitters: strict.emitters, ...strict.counts });
      const detail = { id, input: `${root}/build-report.json`, particleMode: mode, counts, strictCounts: strict.counts, reasonsByStatus: converted.reasonsByStatus,
        systems: converted.systems.map(s => ({ sourcePath: s.sourcePath, writable: !!s.document, systemGaps: s.systemGaps,
          strictReport: strict.systems.find(t => t.sourcePath === s.sourcePath).report,
          report: s.report, ...(id === 'jinx' || id === 'vi' ? { fieldEvidence: fieldEvidence(s.originalFields) } : {}) })) };
      if (id === 'jinx' || id === 'vi') {
        const referencePath = `assets3d-local/source-json/${id}.json`, referenceBytes = await readFile(referencePath);
        const reference = JSON.parse(referenceBytes.toString('utf8'));
        detail.reference = { path: referencePath, sha256: createHash('sha256').update(referenceBytes).digest('hex'),
          comparison: compareParticleSources(source, reference) };
        if (!detail.reference.comparison.matched) throw new Error('source-json-mismatch');
        detail.spellEvidence = spellEvidence(reference);
      }
      await write(`recount/${id}.json`, json(detail));
    }
  }
  if (Object.keys(units).length !== 60) throw new Error('expected-60-unit-inventory');
  const summary = { particleMode: mode, policy: 'Explicit per-field preview conventions. Strict comparison retains round-one linger opt-in. Resource conversion decisions reused from read-only batch reports; no source/batch mutations.',
    units, totals, strictTotals, reasonsByStatus };
  await write('recount/summary.json', json(summary));
  return summary;
}

/** Explicit preview staging, not inferred spell timing. Root cast selects R/Q;
 * W/E/R alternatives can be passed to createActionEffectResolver as bindings. */
export function trialActionBindings(manifest, systemRows, sharedRows = []) {
  const actionEffects = { jinx: { attack: [], cast: [] }, vi: { attack: [], cast: [] } };
  const variants = { W: { jinx: { cast: [] } }, E: { jinx: { cast: [] } }, R: { jinx: { cast: [] } },
    Q: { vi: { cast: [] } } };
  const playback = {}, unavailable = [];
  const select = (unit, suffix, target, phase, anchor, bone, delay = 0, maxDuration = 1) => {
    const row = systemRows[unit].find(r => r.sourcePath.endsWith(`_Base_${suffix}`));
    if (!row?.path) { unavailable.push({ unit, system: suffix, phase, reason: row?.reason ?? 'missing-system' }); return; }
    if (!manifest.effects[row.effectId]) throw new Error('dangling-trial-binding');
    target.push(row.effectId);
    playback[row.effectId] = { status: 'approximated', convention: 'explicit-preview-stage-timing-and-placement', phase, anchor,
      ...(bone ? { bone } : {}), delay, maxDuration };
  };
  for (const [unit, rows] of Object.entries({ jinx: jinxBindings, vi: viBindings })) {
    // Keep the legacy strict output shape while sharing the per-unit tables.
    for (const spec of rows.attack.filter(s => s.system !== '@shared-hit'))
      select(unit, spec.system, actionEffects[unit].attack, spec.phase, spec.anchor, spec.bone, spec.delay, spec.maxDuration);
    for (const [variant, actions] of Object.entries(rows.variants)) for (const spec of actions.cast)
      select(unit, spec.system, variants[variant][unit].cast, spec.phase, spec.anchor, spec.bone, spec.delay, spec.maxDuration);
  }
  actionEffects.jinx.cast = [...variants.R.jinx.cast]; actionEffects.vi.cast = [...variants.Q.vi.cast];
  const missingShared = [], unboundShared = [];
  for (const key of ['TFT_Global_BA_Hit', 'TFT_Global_BA_Crit']) {
    const row = sharedRows.find(r => r.sourcePath.toLowerCase().includes(key.toLowerCase()));
    // ActionState has attack but no crit discriminator. Export the Crit effect
    // for inspection, without inventing a crit event or binding it to attack.
    if (key === 'TFT_Global_BA_Crit') unboundShared.push({ unit: 'vi', key,
      effectId: row?.path ? row.effectId : null, reason: 'action-state-has-no-crit-discriminator' });
    if (!row?.path) { missingShared.push(key); continue; }
    if (!manifest.effects[row.effectId]) throw new Error('dangling-trial-binding');
    if (key === 'TFT_Global_BA_Crit') continue;
    actionEffects.vi.attack.push(row.effectId);
    playback[row.effectId] = { status: 'approximated', convention: 'shared-basic-attack-target-preview-delay',
      phase: 'impact', anchor: 'target', delay: 0.35, maxDuration: 0.5 };
  }
  return { schemaVersion: 1, status: 'approximated', convention: 'Medium-only-muzzle; default-Jinx-R-Vi-Q; explicit-child-substitution; stage-delays-are-preview-values-not-gameplay',
    actionEffects, variants, playback, unavailable, missingShared, unboundShared };
}

export async function fxTrial({ units = 'jinx,vi', out = units === 'jinx,vi' ? 'assets3d-local/fx-trial' : 'assets3d-local/fx-batch1', source = 'assets3d-local/trial/local', force = false,
  particleMode: mode = 'approximate' } = {}) {
  particleMode(mode);
  if (units !== 'jinx,vi') {
    if (mode !== 'approximate') throw new Error('batch1-requires-approximate-mode');
    return (await import('./fx-batch1.mjs')).fxBatch1({ units, out, force });
  }
  const output = await safeOutputPath(out, { directory: true });
  withinRoot(await safeOutputPath('assets3d-local/fx-trial', { directory: true }), output, 'fx-trial-output-only');
  const write = (p, bytes) => writeOutputFile(join(output, p), bytes, { force });
  await write('trial-status.json', json({ modelBuildReady: false, particleMode: mode, phase: 'building' }));
  const { assertManifest, parseParticleDocument } = await contracts();
  const manifest = { schemaVersion: 1, models: {}, effects: {} }, systemRows = {};
  const extraction = await read(await safeInputPath(resolve(source), resolve(source, 'extraction.json')));
  const sourceRecords = new Map(extraction.files.map(r => [canonical(r.path), r]));
  const copy = async (root, path, target) => write(target, await readFile(await safeInputPath(root, join(root, path))));
  for (const id of ['jinx', 'vi']) {
    const root = resolve('assets3d-local/out/batch-cost345/units', id), prefix = `units/${id}/`;
    const previous = await read(await safeInputPath(root, join(root, 'build-report.json')));
    const priorManifest = await read(await safeInputPath(root, join(root, 'manifest.json')));
    const prior = previous.units[id].particles, particleSource = {};
    for (const system of prior.systems) particleSource[system.sourcePath] = (await read(await safeInputPath(root, join(root, system.reportPath)))).originalFields;
    const textures = new Map(previous.textures.filter(t => t.status === 'converted').map(t => [canonical(t.source), `${prefix}${t.path}`]));
    await refreshMeshes(prior.meshes, sourceRecords, source);
    const meshes = new Map(prior.meshes.filter(m => m.status === 'converted').map(m => [m.source, `${prefix}${m.path}`]));
    const meshReasons = new Map(prior.meshes.filter(m => m.status !== 'converted').map(m => [m.source, m.reason]));
    const textureAlpha = mode === 'strict' ? undefined : await textureAlphaLookup(previous.textures,
      async p => readFile(await safeInputPath(root, join(root, p))));
    const converted = convertParticles(particleSource, p => textures.get(canonical(p)), parseParticleDocument,
      { particleMode: mode, textureAlpha, approximateLinger: true, meshPath: p => meshes.get(p), meshReasons });
    // Every document is validated by convertParticles, again here before ANY
    // particle/resource write, and at the actual payload write boundary below.
    for (const s of converted.systems) if (s.document) parseParticleDocument(s.document);
    const usedTextures = new Set(converted.systems.flatMap(s => s.document?.emitters.map(e => e.texture).filter(Boolean) ?? []));
    for (const path of usedTextures) await copy(root, path.slice(prefix.length), path);
    const usedMeshes = new Set(converted.systems.flatMap(s => s.document?.emitters.map(e => e.mesh).filter(Boolean) ?? []));
    for (const path of usedMeshes) {
      // Round-one reports include converted-but-unwritten meshes. Rebuild only
      // those from verified read-only cache records, never rerun character models.
      const priorMesh = prior.meshes.find(m => `${prefix}${m.path}` === path), r = sourceRecords.get(canonical(priorMesh.source));
      if (!r) throw new Error('missing-mesh-cache-record');
      const bytes = await readFile(await safeInputPath(resolve(source, 'extracted'), resolve(source, 'extracted', r.path)));
      if (bytes.length !== r.bytes || createHash('sha256').update(bytes).digest('hex') !== r.sha256) throw new Error('source-hash-mismatch');
      await write(path, convertParticleMesh(bytes, r.path.slice(r.path.lastIndexOf('.'))).glb);
    }
    const result = await writeParticleEffects(id, converted, {}, {
      write: async (p, bytes) => { if (p.endsWith('.json') && !p.endsWith('.report.json')) parseParticleDocument(JSON.parse(bytes)); await write(p, bytes); },
      remove: async p => { try { await unlink(await safeOutputPath(join(output, p), { force: true })); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
    });
    Object.assign(manifest.effects, result.effects); systemRows[id] = result.systems;
    const model = priorManifest.models[id]; await copy(root, model.path, `${prefix}${model.path}`);
    manifest.models[id] = { ...model, path: `${prefix}${model.path}` };
  }
  const global = await globalVfx({ source, force });
  const globalTextures = new Map(), globalAlphas = new Map(), textureConversions = [];
  for (const f of global.report.files.filter(f => /\.(tex|dds)$/i.test(f.path))) {
    const bytes = await readFile(await safeInputPath(resolve('assets3d-local/global-vfx/extracted'), resolve('assets3d-local/global-vfx/extracted', f.path)));
    try {
      const png = encodePng(decodeTexture(bytes)), path = `global/textures/${f.path.replace(/\.(tex|dds)$/i, '.png')}`;
      await write(path, png); globalTextures.set(canonical(f.path), path); globalAlphas.set(canonical(f.path), pngHasEffectiveAlpha(png));
      textureConversions.push({ source: f.path, status: 'converted', path });
    } catch (error) {
      global.report.failures.push({ path: f.path, stage: 'texture-convert', reason: error.message });
      textureConversions.push({ source: f.path, status: 'rejected', reason: error.message });
    }
  }
  const shared = convertParticles(global.systems, p => globalTextures.get(canonical(p)), parseParticleDocument, { particleMode: mode, textureAlpha: p => p ? globalAlphas.get(canonical(p)) : undefined, approximateLinger: true });
  const sharedOutput = await writeParticleEffects('global', shared, {}, {
    write: async (p, bytes) => { if (!p.endsWith('.report.json')) parseParticleDocument(JSON.parse(bytes)); await write(p, bytes); },
    remove: async p => { try { await unlink(await safeOutputPath(join(output, p), { force: true })); } catch (e) { if (e.code !== 'ENOENT') throw e; } },
  });
  Object.assign(manifest.effects, sharedOutput.effects);
  await write('global-vfx-status.json', json({ ...global.report, counts: shared.counts, textureConversions,
    systems: sharedOutput.systems.map(row => {
      const system = shared.systems.find(s => s.sourcePath === row.sourcePath);
      return { ...row, emitters: system.report.map(r => ({ sourcePath: r.sourcePath,
        name: r.originalFields.emitterName, status: r.status, reason: r.reason })) };
    }) }));
  const bindings = trialActionBindings(manifest, systemRows, sharedOutput.systems);
  manifest.actionEffects = bindings.actionEffects;
  // Validate every alternative action table through the real manifest contract.
  for (const variant of Object.values(bindings.variants)) assertManifest({ ...manifest, actionEffects: variant });
  assertManifest(manifest);
  await write('action-bindings.json', json(bindings));
  const summary = await recountParticles(write, parseParticleDocument, { particleMode: mode });
  await write('manifest.json', json(manifest));
  await write('trial-status.json', json({ modelBuildReady: true, particleMode: mode, particleDocumentsValidated: true, shellConnected: false,
    effectDocuments: Object.keys(manifest.effects).length, counts: summary.totals,
    globalVfx: { found: global.report.found, downloadBytes: global.report.downloadBytes, report: '../global-vfx/report.json' },
    blockers: [...(bindings.missingShared.includes('TFT_Global_BA_Hit') ? ['vi-shared-basic-attack-hit-system-unavailable'] : []),
      'shell-has-no-particle-wiring'] }));
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = argumentsFor(process.argv.slice(2), ['--units', '--out', '--source', '--mode', '--particle-mode']);
  if (args['particle-mode'] !== undefined) { args.particleMode = particleMode(args['particle-mode']); delete args['particle-mode']; }
  if (args.mode !== undefined && args.mode !== 'recount' && args.mode !== 'build') throw new Error('invalid-fx-trial-mode');
  const result = args.mode === 'recount'
    ? await recountParticles((p, b) => writeOutputFile(join(args.out ?? 'assets3d-local/fx-trial', p), b, { force: args.force }), (await contracts()).parseParticleDocument, args)
    : await fxTrial(args);
  console.log(JSON.stringify(result.totals ?? result));
}

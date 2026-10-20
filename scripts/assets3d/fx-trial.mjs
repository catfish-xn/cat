import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from './build.mjs';
import { convertParticles } from './particles.mjs';
import { contracts } from './runtime.mjs';
import { compareParticleSources } from './particle-bin.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';

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
export async function recountParticles(write, parseParticleDocument) {
  const totals = { systems: 0, emitters: 0, mapped: 0, approximated: 0, skipped: 0, rejected: 0 };
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
      const converted = convertParticles(source, p => textures.get(canonical(p)), parseParticleDocument,
        { meshPath: p => meshes.get(p), meshReasons, approximateLinger: true });
      if (prior.emitters !== converted.emitters || prior.systemCount !== converted.systems.length) throw new Error('recount-inventory-mismatch');
      const counts = { systems: converted.systems.length, emitters: converted.emitters, ...converted.counts };
      if (counts.mapped + counts.approximated + counts.skipped + counts.rejected !== counts.emitters) throw new Error('recount-partition-mismatch');
      units[id] = counts; sum(totals, counts);
      for (const status of Object.keys(reasonsByStatus)) sum(reasonsByStatus[status], converted.reasonsByStatus[status]);
      const detail = { id, input: `${root}/build-report.json`, counts, reasonsByStatus: converted.reasonsByStatus,
        systems: converted.systems.map(s => ({ sourcePath: s.sourcePath, writable: !!s.document, systemGaps: s.systemGaps,
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
  const summary = { policy: 'Only scalar linger tails may be omitted, explicitly approximated. Other unknown fields remain rejected. Resource conversion decisions are reused from read-only batch reports.',
    units, totals, reasonsByStatus };
  await write('recount/summary.json', json(summary));
  return summary;
}

export async function fxTrial({ out = 'assets3d-local/fx-trial', source = 'assets3d-local/trial/local', force = false } = {}) {
  const output = await safeOutputPath(out, { directory: true });
  withinRoot(await safeOutputPath('assets3d-local/fx-trial', { directory: true }), output, 'fx-trial-output-only');
  const write = (p, bytes) => writeOutputFile(join(output, p), bytes, { force });
  const { assertManifest, parseParticleDocument } = await contracts();
  // Re-conversions always use a dedicated child; no shared batch/all mutations.
  const result = await build({ units: 'jinx,vi', source, out: join(output, 'converted'), batch: true, approximateLinger: true, force });
  const manifest = await read(join(output, 'converted/manifest.json'));
  for (const model of Object.values(manifest.models)) model.path = `converted/${model.path}`;
  for (const [id, entry] of Object.entries(manifest.effects)) {
    const doc = parseParticleDocument(await read(join(output, 'converted', entry.path)));
    for (const e of doc.emitters) {
      if (e.texture) e.texture = `converted/${e.texture}`;
      if (e.mesh) e.mesh = `converted/${e.mesh}`;
    }
    parseParticleDocument(doc);
    entry.path = `effects/${id}.json`;
    await write(entry.path, json(doc));
  }
  // Suggestions stay in build-report until phase, placement and variant are
  // explicitly selected. In particular, never play every W/E/R or BA range.
  manifest.actionEffects = { jinx: {}, vi: {} };
  assertManifest(manifest);
  await write('manifest.json', json(manifest));
  const summary = await recountParticles(write, parseParticleDocument);
  await write('trial-status.json', json({ modelBuildReady: result.ready, visibleEffectsReady: false,
    effectDocuments: Object.keys(manifest.effects).length, counts: summary.totals,
    blockers: ['unverified-source-system-flags-and-render-semantics', 'vi-shared-basic-attack-hit-system-not-in-inventory', 'shell-has-no-particle-wiring'] }));
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = argumentsFor(process.argv.slice(2), ['--out', '--source', '--mode']);
  if (args.mode !== undefined && args.mode !== 'recount' && args.mode !== 'build') throw new Error('invalid-fx-trial-mode');
  const result = args.mode === 'recount'
    ? await recountParticles(async () => {}, (await contracts()).parseParticleDocument)
    : await fxTrial(args);
  console.log(JSON.stringify(result.totals));
}

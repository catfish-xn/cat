import { loadUnitMap } from './local-config.mjs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { unitDefinitions, selectUnits } from './runtime.mjs';
export { selectUnits } from './runtime.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

export const ACTIONS = ['idle', 'move', 'attack', 'cast', 'hit', 'death'];
async function artifactBytes(root, directory = root) {
  let bytes = 0;
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  for (const entry of entries) {
    const path = await safeInputPath(root, join(directory, entry.name));
    if (entry.isDirectory()) bytes += await artifactBytes(root, path);
    else bytes += (await stat(path)).size;
  }
  return bytes;
}
/** Sequential units have isolated output roots and failures. No network or subprocess. */
export async function buildAll({ units = 'all', cost, source = 'assets3d-local/trial/local',
  out = 'assets3d-local/out/batch', force = false, definitions, map, buildUnit = build } = {}) {
  definitions ??= await unitDefinitions();
  map ??= await loadUnitMap();
  const selected = selectUnits(definitions, units, cost), output = await safeOutputPath(out, { directory: true });
  const rel = relative(resolve(source), output);
  if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))) throw new Error('output-overlaps-source');
  const path = join(output, 'build-report.json');
  await safeOutputPath(path, { force });
  const report = { schemaVersion: 1, ready: false, phase: 'building', cost: cost ?? (units === 'all' ? '1,2,3,4,5' : '1,2,3,4,5,6'),
    policy: 'Success means conversion/structural checks passed; source BIN action mapping and initial materials are resolved; source JSON and independent reference coverage remain explicit. Each units/<id>/manifest.json uses that unit directory as its asset root.',
    mapping: { mapped: 0, missing: [] }, units: {}, totals: { success: 0, failed: 0, missing: 0, artifactBytes: 0 } };
  const writeReport = () => writeOutputFileAtomic(path, `${JSON.stringify(report, null, 2)}\n`, { force: true });
  await writeReport();
  for (const id of selected) {
    const config = map[id];
    const entry = { cost: definitions[id].cost, sourceName: config?.sourceName ?? null, status: 'failed', reason: null,
      vertices: null, bones: null, animations: { clips: [], mapped: {}, missing: [...ACTIONS] }, textures: null,
      materialTextureMappings: null, particles: { available: false, mapped: null, skipped: null, rejected: null }, artifactBytes: 0 };
    report.units[id] = entry;
    if (!config || config.missing || !config.sourceName || !config.mesh || !config.skeleton) {
      entry.status = 'missing'; entry.reason = config?.missingReason ?? 'missing-unit-map';
      report.mapping.missing.push(id); report.totals.missing++;
      await writeReport(); continue;
    }
    report.mapping.mapped++;
    try {
      const result = await buildUnit({ units: id, source, out: join(output, 'units', id), force, batch: true, map });
      const unit = result.units[id];
      entry.vertices = unit.vertices; entry.bones = unit.bones;
      const clips = unit.animations.map(a => a.name);
      const mapped = Object.fromEntries(Object.entries(unit.actionMapping ?? config.animations ?? {}).filter(([, name]) => clips.includes(name)));
      entry.animations = { clips, mapped, missing: ACTIONS.filter(action => !mapped[action]) };
      entry.textures = unit.textures; entry.materialTextureMappings = unit.materialTextureMappings;
      entry.particles = { available: unit.particles.available, reason: unit.particles.reason,
        ...(unit.particles.available ? unit.particles.counts : { mapped: null, skipped: null, rejected: null }),
        complete: unit.particles.complete, systems: unit.particles.systemCount, emitters: unit.particles.emitters,
        byReason: unit.particles.byReason, reasonsByStatus: unit.particles.reasonsByStatus, input: unit.particles.input };
      entry.actionEffects = result.actionEffects?.[id] ?? {};
      entry.reference = unit.comparison;
      entry.actionDecisions = unit.actionDecisions; entry.bindings = unit.bindings; entry.step2Mapping = unit.step2Mapping;
      entry.artifactBytes = result.totals.outBytes;
      entry.status = result.ready ? 'success' : 'failed';
      entry.reason = result.ready ? null : 'conversion-verification-failed';
    } catch (error) {
      entry.reason = error.message;
      try { entry.artifactBytes = await artifactBytes(await safeOutputPath(join(output, 'units', id), { directory: true })); }
      catch (sizeError) { entry.artifactBytes = null; entry.artifactBytesReason = sizeError.message; }
    }
    report.totals[entry.status]++;
    report.totals.artifactBytes += entry.artifactBytes ?? 0;
    await writeReport();
  }
  report.phase = 'complete';
  report.particleTotals = { systems: 0, emitters: 0, mapped: 0, skipped: 0, rejected: 0,
    availableUnits: 0, completeUnits: 0, reasonsByStatus: { skipped: {}, rejected: {} } };
  for (const { particles } of Object.values(report.units)) {
    if (particles.available) report.particleTotals.availableUnits++;
    if (particles.complete) report.particleTotals.completeUnits++;
    for (const key of ['systems', 'emitters', 'mapped', 'skipped', 'rejected']) report.particleTotals[key] += particles[key] ?? 0;
    for (const status of ['skipped', 'rejected']) for (const [reason, count] of Object.entries(particles.reasonsByStatus?.[status] ?? {}))
      report.particleTotals.reasonsByStatus[status][reason] = (report.particleTotals.reasonsByStatus[status][reason] ?? 0) + count;
  }
  report.ready = selected.length > 0 && report.totals.failed === 0 && report.totals.missing === 0;
  await writeReport();
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await buildAll(argumentsFor(process.argv.slice(2), ['--units', '--cost', '--source', '--out']));
    console.log(JSON.stringify({ ready: report.ready, mapping: report.mapping, totals: report.totals }));
    if (!report.ready) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

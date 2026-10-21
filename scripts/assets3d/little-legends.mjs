import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman } from './rman.mjs';
import { offlineArchiveReader } from './global-vfx.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';
import { canonicalAsset, animationClips } from './bin-bindings.mjs';
import { parseBin, fnv1a } from './bin.mjs';
import { buildNonChampionModel } from './neutrals.mjs';
import { PET_ACTION_RULES, extrasExtractPath } from './tft-extras.mjs';
import { LEGEND_CANDIDATES, LEGEND_SUPPLEMENT } from './little-legends-plan.mjs';
import { contracts } from './runtime.mjs';
import { mergeManifests } from './merge-manifests.mjs';
import { argumentsFor } from './plan-fetch.mjs';

const json = v => JSON.stringify(v, null, 2) + '\n';
export const LEGEND_ACTION_RULES = {
  ...PET_ACTION_RULES,
  cast: { aliases: ['Cast', 'Spell1', 'Spell'], tokens: ['cast', 'spell'] },
  hit: { aliases: ['Hurt', 'Damage', 'Damaged'], tokens: ['hurt', 'damage', 'damaged'] },
  run: { aliases: ['Run', 'Run1'], tokens: ['run', 'run1'], excludeTokens: ['to', 'in', 'out', 'fast', 'verient', 'variant'] },
  grab: { aliases: ['Grab', 'Grab1', 'Pickup', 'PickUp'], tokens: ['grab', 'grab1', 'pickup'] },
  celebrate: { aliases: ['Celebrate', 'Victory', 'Dance'], tokens: ['celebrate', 'victory', 'dance_loop', 'dance'], excludeTokens: ['to', 'in', 'out'] },
};
export const REQUIRED_LEGEND_ACTIONS = ['idle', 'move', 'hit', 'celebrate'];
/** Whole terminal clip names avoid transition/variant token ambiguities. Only
 * references present in the admitted graph can be selected. No invented clips. */
export function legendExplicitActions(clips) {
  const names = [...new Set(clips.filter(c => c.atomic && c.path).map(c => canonicalAsset(c.path).split('/').at(-1).replace(/\.anm$/, '')))];
  const priorities = { idle: ['idle1', 'idle_base', 'idle'], run: ['run', 'run_ufo'],
    cast: ['cast', 'cast_spell', 'spell'], celebrate: ['celebrate', 'dance_loop', 'idle_dance', 'dance'] };
  const explicit = {};
  for (const [action, suffixes] of Object.entries(priorities)) for (const suffix of suffixes) {
    const hits = names.filter(n => n === suffix || n.endsWith('_' + suffix))
      .filter(n => !/(?:^|_)(?:to|in|out|into|variant|verient)(?:_|$)/.test(n));
    if (hits.length === 1) { explicit[action] = hits[0]; break; }
  }
  if (explicit.run) explicit.move = explicit.run;
  // Prefer the graph's Spell1 binding over legacy recovery/alternate copies.
  // Do not override it with a filename shared by different source paths.
  if (clips.some(c => c.hash === fnv1a('Spell1') && c.atomic && c.path)) delete explicit.cast;
  return explicit;
}
export function verifyLegendManifest(manifest, ids, clipNames) {
  if (Object.keys(manifest.models).sort().join() !== [...ids].sort().join()) throw new Error('legend-model-keys');
  for (const id of ids) {
    const map = manifest.models[id].animations;
    for (const action of REQUIRED_LEGEND_ACTIONS) if (!map[action]) throw new Error(`legend-missing-action:${id}:${action}`);
    for (const clip of Object.values(map)) if (!clipNames[id].includes(clip)) throw new Error(`legend-missing-clip:${id}:${clip}`);
  }
}
export async function buildLittleLegends({ source, out = 'assets3d-local/little-legends', force = false } = {}) {
  if (!source) throw new Error('explicit-cache-source-required');
  const root = resolve(source), output = await safeOutputPath(out, { directory: true });
  withinRoot(resolve('assets3d-local/little-legends'), output);
  const write = (p, b) => writeOutputFileAtomic(join(output, p), b, { force });
  const input = p => safeInputPath(root, join(root, p)).then(readFile);
  const plan = JSON.parse(await readFile(join(output, 'legends-plan.json'), 'utf8'));
  if (plan.chunks.length || !plan.dependencyClosureKnown) throw new Error('legend-dependencies-not-ready');
  const reader = offlineArchiveReader({ manifest: readRman(await input('14.24.manifest')), plan,
    readChunk: id => input(`chunks/${id}.zst`), write: (p, b) => write(extrasExtractPath(p), b) });
  const paths = new Map(plan.wads.flatMap(w => w.entries.map(e => [canonicalAsset(e.path), { ...e, wad: w.name }])));
  const loaded = new Map();
  async function load(p) {
    const key = canonicalAsset(p);
    if (!loaded.has(key)) {
      const e = paths.get(key); if (!e) throw new Error(`unplanned-legend-resource:${p}`);
      loaded.set(key, await reader.extract(e));
    }
    return loaded.get(key);
  }
  const { assertManifest } = await contracts(), models = [], failures = [];
  for (const config of [...LEGEND_CANDIDATES, LEGEND_SUPPLEMENT]) {
    try {
      const prefix = `data/characters/${config.sourceName}`;
      const skin = plan.defaultSkins.find(s => s.id === config.id)?.skin;
      const initial = [skin, `${prefix}/themes/base/tier1.bin`, `${prefix}/themes/base/root.bin`, `characters/${config.sourceName}`].filter(p => p && paths.has(p));
      const graph = parseBin(await load(`${prefix}/animations/base.bin`));
      const configWithIds = { ...config, ids: [config.id], height: 46,
        animations: legendExplicitActions(animationClips([graph])) };
      const built = await buildNonChampionModel(configWithIds, { load, assertManifest, initial,
        rules: LEGEND_ACTION_RULES, requiredActions: REQUIRED_LEGEND_ACTIONS, keepAllClips: false });
      const unitRoot = config.outputRoot ? `${config.outputRoot}/build/units/${config.id}` : `build/units/${config.id}`;
      for (const model of Object.values(built.manifest.models)) await write(`${unitRoot}/${model.path}`, built.result.glb);
      await write(`${unitRoot}/manifest.json`, json(built.manifest));
      const row = { id: config.id, ids: [config.id], label: config.label, sourceName: config.sourceName, bytes: built.result.glb.length,
        sha256: createHash('sha256').update(built.result.glb).digest('hex'),
        suggestedHeight: 46, suggestedScale: 46 / built.result.report.bbox.height, ...built.result.report,
        actions: built.animation.mapped, decisions: built.animation.decisions, textures: built.textureReports, bindings: built.binding };
      models.push(row); console.log(JSON.stringify({ id: row.id, bytes: row.bytes, actions: row.actions, unavailable: Object.fromEntries(Object.entries(row.decisions).filter(([,v]) => v.reason)) }));
    } catch (e) { failures.push({ id: config.id, reason: e.message }); console.error(config.id, e.stack); }
  }
  const report = { ready: failures.length === 0, models, failures };
  if (!report.ready) { await write('build-report.json', json(report)); return report; }
  for (const sub of ['', `${LEGEND_SUPPLEMENT.outputRoot}/`]) {
    const digest = createHash('sha256').update(json(models.filter(m => sub ? m.id === LEGEND_SUPPLEMENT.id : m.id !== LEGEND_SUPPLEMENT.id).map(m => m.sha256))).digest('hex').slice(0, 16);
    const runtime = `${sub}runtime-${digest}`;
    const ids = sub ? [LEGEND_SUPPLEMENT.id] : LEGEND_CANDIDATES.map(c => c.id);
    const merge = await mergeManifests({ from: ids.map(id => join(output, sub, 'build/units', id)), out: join(output, runtime) });
    if (!merge.ready) throw new Error('legend-merge-not-ready');
    const cache = JSON.parse(await readFile(join(output, runtime, 'precache.json'), 'utf8'));
    for (const p of [...cache.files.map(f => f.path), 'manifest.json', 'precache.json', 'merge-report.json'])
      await write(`${sub}runtime/${p}`, await readFile(join(output, runtime, p)));
  }
  await write('build-report.json', json(report));
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildLittleLegends(argumentsFor(process.argv.slice(2), ['--source', '--out']));
  if (!report.ready) process.exitCode = 1;
}

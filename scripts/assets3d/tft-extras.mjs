import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFileAtomic } from './safe-path.mjs';
import { canonicalAsset } from './bin-bindings.mjs';
import { buildNonChampionModel } from './neutrals.mjs';
import { NEUTRAL_ACTION_RULES } from './neutral-config.mjs';
import { parseBin, binField, binIs, fnv1a } from './bin.mjs';
import { particleSourcesFromBins } from './particle-bin.mjs';
import { convertParticles } from './particles.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { contracts } from './runtime.mjs';
import { mergeManifests } from './merge-manifests.mjs';
import { argumentsFor } from './plan-fetch.mjs';

const json = v => JSON.stringify(v, null, 2) + '\n';
const sha = b => createHash('sha256').update(b).digest('hex');
export const PET_CONFIG = { sourceName: 'pettftavatar', ids: ['little-legend-default'], height: 46,
  animations: { idle: 'idle', cast: 'cast' } };
export const PET_ACTION_RULES = { ...NEUTRAL_ACTION_RULES,
  move: { aliases: ['Run', 'Move'], tokens: ['run', 'move'] },
  cast: { aliases: ['Cast', 'Spell'], tokens: ['cast', 'spell'] },
  hit: { aliases: ['Hurt', 'Damage'], tokens: ['hurt', 'damage'] } };
// Archive names can exceed Windows' per-component limit; retain provenance in
// sourceFiles while storing extracted bytes under a content-independent path hash.
export const extrasExtractPath = p => p.startsWith('extracted/') ? `extracted/by-path/${sha(Buffer.from(p))}.bin` : p;

/** Explicit bounded idle preview policy; only change already accepted emitters.
 * Single particles marked -1 are held, unbounded continuous emitters keep emitting.
 * Rejected source fields remain rejected. This is not an engine-equivalence claim. */
export function sustainPrismaticIdle(system) {
  if (!system.document) throw new Error('missing-prismatic-idle');
  let index = 0;
  for (const row of system.report) {
    if (!['mapped', 'approximated'].includes(row.status)) continue;
    const e = system.document.emitters[index++], source = row.originalFields;
    const handling = [];
    if (source.isSingleParticle && source.particleLifetime?.constantValue === -1) {
      e.lifetime = 3600; handling.push('hold-single-particle-until-host-disposes');
    }
    if (!source.isSingleParticle && (source.lifetime === undefined || source.lifetime === -1)) {
      e.emission.loop = true; delete e.emission.duration; handling.push('continuous-idle-until-host-disposes');
    }
    if (handling.length) row.approximations = [...(row.approximations ?? []), { field: 'idle-playback', handling }];
  }
  if (index !== system.document.emitters.length) throw new Error('prismatic-emitter-report-mismatch');
  system.document.limits.maxDuration = 3600;
}
export const SPECIAL_ORB_EFFECTS = [
  ...['Warband', 'Crime'].map(name => ({ id: `orb-${name.toLowerCase()}`, system: `TFT13_${name}_LootOrb`, phase: 'start', anchor: 'source', role: 'idle' })),
  // No dedicated orb-open system in the admitted map/set13 index. Explicit
  // visual fallbacks, not an assertion about the original game's trigger.
  { id: 'orb-warband-open', system: 'TFT_RewardBoxOpen_Gold', phase: 'impact', anchor: 'target', role: 'open', approximation: 'generic-gold-open; no-dedicated-source-system' },
  { id: 'orb-crime-open', system: 'TFT_RewardBoxOpen_Silver', phase: 'impact', anchor: 'target', role: 'open', approximation: 'generic-silver-open; no-dedicated-source-system' },
  { id: 'orb-warband-reward-queued', system: 'TFT13_Warband_RewardQueued', phase: 'travel', anchor: 'projectile', role: 'reward-queued' },
  { id: 'orb-warband-cashout', system: 'TFT13_Warband_CashoutCeremony', phase: 'impact', anchor: 'target', role: 'cashout' },
  { id: 'orb-warband-stack', system: 'TFT13_Warband_PropStackCeremony', phase: 'impact', anchor: 'target', role: 'stack-ceremony' },
  { id: 'orb-crime-spawn', system: 'TFT13_Crime_Prop_Spawn', phase: 'start', anchor: 'source', role: 'spawn' },
  { id: 'orb-crime-cashout', system: 'TFT13_Crime_Prop_CashoutTrigger', phase: 'impact', anchor: 'target', role: 'cashout' },
  ...['Low', 'Medium', 'High', 'Full'].map(name => ({ id: `orb-crime-prop-${name.toLowerCase()}`, system: `TFT13_Crime_Prop_${name}`, phase: 'start', anchor: 'source', role: 'prop-idle' })),
];
export const EXTRA_EFFECTS = [
  ...['Bronze', 'Silver', 'Gold'].flatMap((tier, i) => {
    const id = ['gray', 'blue', 'gold'][i];
    return [
      { id: `orb-${id}`, system: `TFT_MysteryBox${tier}`, phase: 'start', anchor: 'source', role: 'idle' },
      { id: `orb-${id}-child`, system: `TFT_MysteryBox${tier}_Child`, phase: 'start', anchor: 'source', role: 'idle-child' },
      { id: `orb-${id}-open`, system: `TFT_RewardBoxOpen_${tier}`, phase: 'impact', anchor: 'target', role: 'open' },
    ];
  }),
  { id: 'orb-prismatic', system: 'TFT_Item_LootOrb_Prismatic', phase: 'start', anchor: 'source', role: 'idle' },
  { id: 'orb-prismatic-idle', system: 'TFT_Item_LootOrb_Prismatic_Idle', phase: 'start', anchor: 'source', role: 'idle' },
  ...SPECIAL_ORB_EFFECTS,
  { id: 'player-damage-mis', system: 'TFT_PlayerDamageMis_Avatar', phase: 'travel', anchor: 'projectile', role: 'travel' },
  { id: 'player-damage-mis1', system: 'TFT_PlayerDamageMis1', phase: 'travel', anchor: 'projectile', role: 'travel' },
  { id: 'player-damage-tar', system: 'TFT_PlayerDamageTar', phase: 'impact', anchor: 'target', role: 'impact' },
  { id: 'player-damage-child', system: 'TFT_PlayerDamage_Child', phase: 'impact', anchor: 'target', role: 'impact-child' },
];
/** Host timing conventions, never simulation rules or automatic child spawning. */
export function extrasBindings(manifest, specs = EXTRA_EFFECTS) {
  const playback = {};
  for (const s of specs) {
    if (!['start', 'travel', 'impact'].includes(s.phase)) throw new Error('invalid-extra-phase');
    if (!['source', 'target', 'projectile'].includes(s.anchor)) throw new Error('invalid-extra-anchor');
    if (!manifest.effects?.[s.id]) throw new Error('missing-extra-effect');
    if (playback[s.id]) throw new Error('duplicate-extra-effect');
    playback[s.id] = { phase: s.phase, anchor: s.anchor, role: s.role, delay: 0,
      maxDuration: s.id.startsWith('orb-prismatic') || ['orb-warband', 'orb-crime'].includes(s.id) ? 3600 : s.role.includes('idle') ? 30 : s.phase === 'travel' ? 1 : 3,
      ...(s.approximation ? { approximation: s.approximation } : {}) };
  }
  return { schemaVersion: 1, status: 'approximated', playback };
}

/** Only static single-child wrappers are composed. Dynamic child emitters remain
 * explicit omissions; applying their spawn rates again would invent semantics. */
export function composeStaticChildren(systems, doc) {
  const resolutions = new Map();
  for (const e of doc.entries) if (binIs(e, 'ResourceResolver'))
    for (const [key, target] of binField(e, 'resourceMap')?.entries ?? []) {
      const h = typeof key === 'string' ? fnv1a(key) : key.hash;
      const values = resolutions.get(h) ?? new Set(); values.add(target.hash); resolutions.set(h, values);
    }
  const hashes = new Map(doc.entries.filter(e => binIs(e, 'VfxSystemDefinitionData')).map(e => [e.hash, e]));
  const byHash = new Map();
  for (const [h, e] of hashes) {
    const row = systems.find(s => s.sourcePath === binField(e, 'particlePath'));
    if (row) { byHash.set(h, row); byHash.set(fnv1a(binField(e, 'particleName') ?? ''), row); }
  }
  const result = [];
  for (const row of systems) {
    if (row.document) continue;
    const emitters = row.originalFields.complexEmitterDefinitionData ?? [];
    if (emitters.length !== 1 || !emitters[0].isSingleParticle) continue;
    const e = emitters[0], children = e.childParticleSetDefinition?.childrenIdentifiers;
    if (children?.length !== 1) continue;
    const key = children[0].effectKey.hash, targets = resolutions.get(key);
    if (targets && targets.size !== 1) throw new Error('ambiguous-extra-child');
    const child = byHash.get(targets ? [...targets][0] : key);
    if (!child?.document) throw new Error('unresolved-extra-child');
    const offset = e.EmitterPosition?.constantValue ?? [0, 0, 0];
    if (offset.length !== 3 || !offset.every(Number.isFinite)) throw new Error('invalid-extra-child-offset');
    row.document = structuredClone(child.document);
    for (const emitter of row.document.emitters) emitter.position = (emitter.position ?? [0, 0, 0]).map((v, i) => v + offset[i] * (i === 0 ? -1 : 1));
    row.composition = { child: child.sourcePath, mode: 'static-anchor-single-child', omitted: ['parent-angular-motion', 'parent-engine-flags', 'sound'] };
    delete row.reason; result.push({ parent: row.sourcePath, ...row.composition });
  }
  return result;
}

export async function buildTftExtras({ source = 'assets3d-local/trial/local', out = 'assets3d-local/tft-extras', force = false } = {}) {
  const root = resolve(source), output = await safeOutputPath(out, { directory: true });
  withinRoot(resolve('assets3d-local/tft-extras'), output, 'tft-extras-output-only');
  const write = (p, b) => writeOutputFileAtomic(join(output, p), b, { force });
  const input = p => safeInputPath(root, join(root, p)).then(readFile);
  const planRoot = resolve('assets3d-local/out');
  const baseline = JSON.parse(await readFile(await safeInputPath(planRoot, join(planRoot, 'extra-plan.json')), 'utf8'));
  const raw = await input('14.24.manifest');
  if (sha(raw) !== baseline.sourceManifest.sha256) throw new Error('plan-manifest-sha256-mismatch');
  const plan = { wads: [] }, reader = offlineArchiveReader({ manifest: readRman(raw), plan, readChunk: id => input(`chunks/${id}.zst`), write: (p, b) => write(extrasExtractPath(p), b) });
  const wad = 'DATA/FINAL/Maps/Shipping/Map22.wad.client', archive = await reader.archive(wad);
  const hashes = new Set(archive.index.map(e => e.hash)), named = [];
  for await (const line of createInterface({ input: createReadStream(await safeInputPath(root, join(root, 'hashes/hashes.game.txt'))), crlfDelay: Infinity }))
    if (hashes.has(line.slice(0, 16))) named.push({ hash: line.slice(0, 16), path: line.slice(17).toLowerCase(), wad });
  plan.wads.push({ name: wad, entries: named });
  const paths = new Map(named.map(e => [canonicalAsset(e.path), e])), loaded = new Map();
  const load = async p => {
    const key = canonicalAsset(p); if (!loaded.has(key)) {
      const e = paths.get(key); if (!e) throw new Error(`missing-extra-resource:${p}`);
      loaded.set(key, await reader.extract(e));
    } return loaded.get(key);
  };
  const { assertManifest, parseParticleDocument } = await contracts();
  const report = { ready: false, sourceVersion: baseline.version, models: [], failures: [], systems: [] };
  await write('build-report.json', json(report));
  const build = 'build/units/extras', manifest = { schemaVersion: 1, models: {}, effects: {} };
  // Preflight all binding links and graph clips, even when the first mesh is
  // absent, so the report distinguishes observed candidates from verified bindings.
  const petBins = ['data/characters/pettftavatar/themes/base/tier1.bin', 'data/characters/pettftavatar/themes/base/root.bin', 'data/characters/pettftavatar/animations/base.bin'];
  const petRequests = new Set(petBins), petDocs = [];
  for (const p of petBins) {
    const d = parseBin(await load(p)); petDocs.push(d);
    for (const link of d.linked) petRequests.add(link);
  }
  const petStack = petDocs.flatMap(d => d.entries);
  while (petStack.length) {
    const v = petStack.pop();
    if (typeof v === 'string' && /\.(skn|skl|anm|tex|dds)$/i.test(v)) petRequests.add(v);
    else if (v && typeof v === 'object') petStack.push(...Object.values(v));
  }
  report.petDependencies = [];
  for (const p of petRequests) try { await load(p); }
  catch (error) { report.petDependencies.push({ path: p, reason: error.message }); }
  try {
    const pet = await buildNonChampionModel(PET_CONFIG, { load, assertManifest, rules: PET_ACTION_RULES, requiredActions: ['idle'],
      initial: [...petBins, ...petDocs.flatMap(d => d.linked)] });
    Object.assign(manifest.models, pet.manifest.models);
    for (const m of Object.values(pet.manifest.models)) await write(`${build}/${m.path}`, pet.result.glb);
    report.models.push({ ids: PET_CONFIG.ids, ...pet.result.report, actionMapping: pet.animation.mapped,
      actionDecisions: pet.animation.decisions, clips: Object.keys(pet.files), suggestedHeight: PET_CONFIG.height,
      suggestedScale: PET_CONFIG.height / pet.result.report.bbox.height, textures: pet.textureReports, structure: pet.structure });
  } catch (error) { report.failures.push({ stage: 'little-legend', reason: error.message }); }
  const mapDoc = parseGlobalVfxBin(await load('data/maps/shipping/map22/map22.bin'));
  const all = particleSourcesFromBins([mapDoc]);
  const selected = {};
  for (const spec of EXTRA_EFFECTS) {
    const hits = Object.entries(all).filter(([p]) => p.split('/').at(-1) === spec.system);
    if (hits.length !== 1) throw new Error(`missing-or-ambiguous-extra-system:${spec.system}`);
    selected[hits[0][0]] = hits[0][1];
  }
  const refs = new Set(), stack = Object.values(selected);
  while (stack.length) {
    const v = stack.pop(); if (typeof v === 'string' && /\.(tex|dds|scb|sco)$/i.test(v)) refs.add(v);
    else if (v && typeof v === 'object') stack.push(...Object.values(v));
  }
  const textures = new Map(), alpha = new Map(), meshes = new Map(), bounds = new Map(), meshReasons = new Map();
  for (const ref of refs) try {
    const bytes = await load(ref), key = canonicalAsset(ref), id = sha(Buffer.from(key)).slice(0, 20);
    if (/\.(tex|dds)$/i.test(ref)) {
      const path = `textures/extras/${id}.png`, png = encodePng(decodeTexture(bytes));
      await write(`${build}/${path}`, png); textures.set(key, path); alpha.set(key, pngHasEffectiveAlpha(png));
    } else {
      const path = `meshes/extras/${id}.glb`, mesh = convertParticleMesh(bytes, ref.slice(ref.lastIndexOf('.')));
      const glb = readGlb(mesh.glb), positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
      bounds.set(key, [0, 1, 2].map(i => Math.max(...positions.map(p => p[i])) - Math.min(...positions.map(p => p[i]))));
      await write(`${build}/${path}`, mesh.glb); meshes.set(key, path);
    }
  } catch (error) { report.failures.push({ stage: 'fx-resource', path: ref, reason: error.message }); meshReasons.set(ref, error.message); }
  const converted = convertParticles(selected, p => textures.get(canonicalAsset(p)), parseParticleDocument,
    { particleMode: 'approximate', approximateLinger: true, textureAlpha: p => alpha.get(canonicalAsset(p)),
      meshPath: p => meshes.get(canonicalAsset(p)), meshBounds: p => bounds.get(canonicalAsset(p)), meshReasons });
  // These wrapper systems have one static child anchor. Resolve the actual BIN
  // resource key; omit parent angular velocity explicitly under preview policy.
  sustainPrismaticIdle(converted.systems.find(s => s.sourcePath.endsWith('/TFT_Item_LootOrb_Prismatic_Idle')));
  for (const name of ['TFT13_Warband_LootOrb', 'TFT13_Crime_LootOrb'])
    sustainPrismaticIdle(converted.systems.find(s => s.sourcePath.endsWith('/' + name)));
  const composition = composeStaticChildren(converted.systems, mapDoc);
  report.childComposition = composition;
  for (const spec of EXTRA_EFFECTS) {
    const s = converted.systems.find(s => s.sourcePath.endsWith('/' + spec.system));
    if (s.document) { parseParticleDocument(s.document); const path = `effects/extras/${spec.id}.json`; await write(`${build}/${path}`, json(s.document)); manifest.effects[spec.id] = { path }; }
    report.systems.push({ id: spec.id, ...s });
  }
  assertManifest(manifest);
  await write(`${build}/manifest.json`, json(manifest));
  await writeOutputFileAtomic(join(output, 'build-report.json'), json({ ...report, counts: converted.counts, missingChunks: [...reader.missing.values()] }), { force: true });
  const bindings = extrasBindings(manifest, EXTRA_EFFECTS.filter(s => manifest.effects[s.id]));
  await write('action-bindings.json', json(bindings));
  await write('size-report.json', json({ results: [] }));
  const runtime = join(output, 'runtime', sha(Buffer.from(json(manifest) + json(reader.files))).slice(0, 16));
  const merge = await mergeManifests({ from: [join(output, 'build')], out: runtime });
  if (!merge.ready) throw new Error('tft-extras-merge-not-ready');
  const precache = JSON.parse(await readFile(join(runtime, 'precache.json'), 'utf8'));
  for (const p of [...precache.files.map(f => f.path), 'manifest.json', 'precache.json', 'merge-report.json']) await write(p, await readFile(await safeInputPath(runtime, join(runtime, p))));
  Object.assign(report, { ready: !report.failures.length && report.models.length > 0 && Object.keys(manifest.effects).length === EXTRA_EFFECTS.length, merge, counts: converted.counts, sourceFiles: reader.files, missingChunks: [...reader.missing.values()],
    petDependencyStatus: report.models.length ? 'bound-model-and-animation-closure-converted' : 'closure-incomplete',
    effectsReady: Object.keys(manifest.effects).length === EXTRA_EFFECTS.length });
  await writeOutputFileAtomic(join(output, 'build-report.json'), json(report), { force: true });
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await buildTftExtras(argumentsFor(process.argv.slice(2), ['--source', '--out']));
  console.log(JSON.stringify({ ready: r.ready, models: r.models.length, effects: r.systems.length, failures: r.failures, missingChunks: r.missingChunks.map(c => c.id) }));
  if (!r.ready) process.exitCode = 1;
}

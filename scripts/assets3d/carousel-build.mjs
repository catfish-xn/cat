import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readRman } from './rman.mjs';
import { offlineArchiveReader, parseGlobalVfxBin } from './global-vfx.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { binField, binIs } from './bin.mjs';
import { canonicalAsset } from './bin-bindings.mjs';
import { stringsIn, planCarousel } from './carousel.mjs';
import { readCarouselGeometry, carouselRangeGlb } from './carousel-geometry.mjs';
import { particleSourcesFromBins } from './particle-bin.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { convertParticles } from './particles.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { readGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
import { contracts } from './runtime.mjs';
import { mergeManifests } from './merge-manifests.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
export function carouselModelId(material) {
  const tail = material.split('/').at(-1).replace(/^Set13_Carousel_/i, '').replace(/_MAT$/i, '');
  if (!/^[a-z0-9_]+$/i.test(tail)) throw new Error('invalid-carousel-material-name');
  return 'carousel-' + tail.toLowerCase().replaceAll('_', '-');
}
export function carouselEffectId(path) {
  const name = path.split('/').at(-1).replace(/^TFT_/i, '');
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error('invalid-carousel-effect-name');
  return 'carousel-' + name.toLowerCase().replaceAll('_', '-');
}
/** Choose by the material's sampler semantic, never by a filename substring. */
export function carouselDiffuse(material) {
  const samplers = binField(material, 'samplerValues') ?? [];
  const values = samplers.map(s => ({ semantic: s.fields?.find(f => f.hash === 48757580)?.value,
    path: binField(s, 'textureName') }));
  const diffuse = values.find(s => /^Diffuse_?Texture$/i.test(s.semantic))
    ?? values.find(s => /^Top_Texture$/i.test(s.semantic))
    ?? values.find(s => /^ScrollingA_Texture$/i.test(s.semantic));
  if (!diffuse?.path) throw new Error('missing-carousel-diffuse');
  return { ...diffuse, omittedSamplers: values.filter(s => s !== diffuse) };
}

export async function buildCarousel({ source = 'assets3d-local/trial/local', discover = true, planName = 'carousel-plan-4.json' } = {}) {
  const root = resolve(source), output = await safeOutputPath('assets3d-local/carousel', { directory: true });
  if (discover) {
    const discovery = await planCarousel({ source, planName });
    if (discovery.chunks) return { ready: false, stopped: 'missing-chunks', ...discovery };
    if (discovery.failures.length) throw new Error('carousel-discovery-incomplete');
  }
  const write = (p, bytes) => writeOutputFileAtomic(join(output, p), bytes, { force: true });
  const input = p => safeInputPath(root, join(root, p)).then(readFile);
  if (!/^carousel-plan(?:-\d+)?\.json$/.test(planName)) throw new Error('invalid-carousel-plan-name');
  const plan = JSON.parse(await readFile(join(output, planName), 'utf8'));
  const inventory = JSON.parse(await readFile(join(output, 'inventory.json'), 'utf8'));
  const raw = await input('14.24.manifest');
  if (sha(raw) !== plan.sourceManifest.sha256) throw new Error('carousel-source-mismatch');
  const reader = offlineArchiveReader({ manifest: readRman(raw), plan, readChunk: id => input(`chunks/${id}.zst`), write: async () => {} });
  const resources = new Map();
  for (const row of inventory.entries) resources.set(canonicalAsset(row.path), row);
  const loaded = new Map();
  async function load(p) {
    const key = canonicalAsset(p); if (!loaded.has(key)) {
      const row = resources.get(key); if (!row) throw new Error('unplanned-carousel-resource:' + p);
      const bytes = await reader.extract(row); loaded.set(key, bytes);
      await write(`extracted/${sha(Buffer.from(key))}.bin`, bytes);
    } return loaded.get(key);
  }
  // Preflight the entire discovered closure before producing runtime assets.
  for (const row of inventory.entries) await load(row.path);
  const documents = JSON.parse(await readFile(join(output, 'scene-objects.json'), 'utf8'));
  const materials = documents.find(d => d.path.endsWith('/carousel_set13.materials.bin'));
  const geometry = readCarouselGeometry(await load('data/maps/mapgeometry/map22/carousel_set13.mapgeo'));
  const manifest = { schemaVersion: 1, models: {}, effects: {} }, build = 'build/units/carousel';
  const report = { ready: false, version: plan.version, offline: true, models: [], systems: [], particleMeshes: [], failures: [],
    geometry: { source: 'carousel_set13.mapgeo', meshTableEnd: geometry.meshTableEnd, ignoredSpatialBytes: geometry.ignoredSpatialBytes },
    coordinatePolicy: { sourceOrigin: [7500, 0, 7500], reflectX: true, scale: .44, cell: 62.4 },
    variants: { selected: 'standard-set13', excluded: ['memorybudget-empty-v13', 'set13-tmo-regional-variant'] } };
  await write('build-report.json', json(report));
  for (const mesh of geometry.meshes) for (const range of mesh.ranges) {
    const material = materials.entries.find(m => binIs(m, 'StaticMaterialDef') && binField(m, 'name') === range.material);
    if (!material) throw new Error('unresolved-carousel-material:' + range.material);
    let diffuse;
    // Skybox uses a diffuse sampler with a shader-specific name.
    try { diffuse = carouselDiffuse(material); }
    catch (error) { report.failures.push({ stage: 'material', material: range.material, reason: error.message }); continue; }
    const png = encodePng(decodeTexture(await load(diffuse.path))), id = carouselModelId(range.material);
    if (manifest.models[id]) throw new Error('duplicate-carousel-model');
    const opacity = id.includes('glassdome') ? .15 : id.includes('reflectionplane') ? .15 : 1;
    const result = carouselRangeGlb(mesh, range, png, { opacity });
    const path = `models/${id}/model.glb`; await write(`${build}/${path}`, result.glb); manifest.models[id] = { path };
    report.models.push({ id, material: range.material, meshId: mesh.id, ...diffuse, opacity, ...result.bounds,
      sizeCells: result.bounds.max.map((v, i) => (v - result.bounds.min[i]) * .44 / 62.4), triangles: result.triangles,
      sourceMatrix: mesh.matrix, sourceBbox: mesh.bbox, baked: mesh.baked, approximation: 'unlit-diffuse; no baked-lightmap, normal, fog, reflection, parallax or shader animation' });
  }
  const sourceMap = parseGlobalVfxBin(await load('data/maps/shipping/map22/map22.bin'));
  sourceMap.entries = documents.find(d => d.path.endsWith('/map22.bin')).entries;
  const sourceSystems = particleSourcesFromBins([sourceMap]);
  const refs = new Set(stringsIn(sourceSystems).filter(s => /\.(tex|dds|scb|sco)$/i.test(s)));
  const textures = new Map(), alpha = new Map(), meshes = new Map(), bounds = new Map(), meshReasons = new Map();
  for (const ref of refs) {
    const key = canonicalAsset(ref), id = sha(Buffer.from(key)).slice(0, 20), bytes = await load(ref);
    if (/\.(tex|dds)$/i.test(ref)) {
      const png = encodePng(decodeTexture(bytes)), path = `textures/carousel/${id}.png`;
      await write(`${build}/${path}`, png); textures.set(key, path); alpha.set(key, pngHasEffectiveAlpha(png));
    } else try {
      const converted = convertParticleMesh(bytes, ref.slice(ref.lastIndexOf('.'))), path = `meshes/carousel/${id}.glb`;
      const glb = readGlb(converted.glb), positions = glb.document.meshes.flatMap(m => m.primitives.flatMap(p => readAccessor(glb, p.attributes.POSITION)));
      bounds.set(key, [0, 1, 2].map(i => Math.max(...positions.map(p => p[i])) - Math.min(...positions.map(p => p[i]))));
      await write(`${build}/${path}`, converted.glb); meshes.set(key, path);
      report.particleMeshes.push({ source: ref, path, status: 'converted', ...converted.report });
    } catch (error) {
      meshReasons.set(ref, error.message); report.failures.push({ stage: 'particle-mesh', path: ref, reason: error.message });
      report.particleMeshes.push({ source: ref, status: 'skipped', reason: error.message });
    }
  }
  const { assertManifest, parseParticleDocument } = await contracts();
  const converted = convertParticles(sourceSystems, p => textures.get(canonicalAsset(p)), parseParticleDocument,
    { particleMode: 'approximate', approximateLinger: true, textureAlpha: p => alpha.get(canonicalAsset(p)),
      meshPath: p => meshes.get(canonicalAsset(p)), meshBounds: p => bounds.get(canonicalAsset(p)), meshReasons });
  for (const system of converted.systems) {
    const id = carouselEffectId(system.sourcePath);
    if (system.document) {
      parseParticleDocument(system.document); const path = `effects/carousel/${id}.json`;
      if (manifest.effects[id]) throw new Error('duplicate-carousel-effect');
      await write(`${build}/${path}`, json(system.document)); manifest.effects[id] = { path };
    }
    report.systems.push({ id, ...system });
  }
  assertManifest(manifest); await write(`${build}/manifest.json`, json(manifest));
  const runtime = join(output, 'runtime', sha(Buffer.from(json(manifest) + json(reader.files))).slice(0, 16));
  const merge = await mergeManifests({ from: [join(output, 'build')], out: runtime });
  if (!merge.ready) throw new Error('carousel-merge-not-ready');
  const precache = JSON.parse(await readFile(join(runtime, 'precache.json'), 'utf8'));
  for (const p of [...precache.files.map(f => f.path), 'manifest.json', 'precache.json', 'merge-report.json'])
    await write(p, await readFile(await safeInputPath(runtime, join(runtime, p))));
  // Unsupported emitters are a reported approximation, not invented geometry.
  Object.assign(report, { ready: report.models.length === geometry.meshes.reduce((n, m) => n + m.ranges.length, 0) && !report.failures.length,
    runtimeReady: merge.ready, sourceClosureReady: reader.missing.size === 0,
    omittedSystems: report.systems.filter(s => !s.document).map(s => ({ id: s.id, reason: s.reason,
      emitterReasons: [...new Set(s.report.map(e => e.reason).filter(Boolean))] })),
    counts: converted.counts, merge, sourceFiles: reader.files, missingChunks: [...reader.missing.values()] });
  await write('build-report.json', json(report));
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await buildCarousel(); console.log(JSON.stringify({ ready: r.ready, stopped: r.stopped, models: r.models?.length, systems: r.systems?.length, failures: r.failures, counts: r.counts }));
  if (!r.ready) process.exitCode = 1;
}

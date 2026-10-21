import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Document } from '@gltf-transform/core';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
// @ts-expect-error Offline Node tooling.
import { selectDance, celebrateEntry, applyScales, checkPortraitSource, verifiedSource, verifyRoot, prepareV19, finalizeV19, readSources, validateSources, FAMILY_IDS, TRAIT_ICONS, PORTRAITS } from '../scripts/assets3d/v19-assets.mjs';
// @ts-expect-error Offline Node tooling.
import { runtimeModelJson, buildAssetRoot } from '../scripts/assets3d/build-asset-root.mjs';
// @ts-expect-error Offline Node tooling.
import { compressionIO } from '../scripts/assets3d/compress.mjs';
// @ts-expect-error Synthetic GLB encoder.
import { writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Output boundary helper.
import { withinRoot } from '../scripts/assets3d/safe-path.mjs';
import { assertManifest } from '../src/rendering3d/contracts';
import { FAMILY_REUNION_POLICY } from '../src/simulation/family-reunion';
import { SIX_COST_TRAITS, SIX_COST_UNITS } from '../src/simulation/content/v19-six-cost';

// The Windows sandbox denies realpath of a user-profile ancestor. Virtualize only
// those outside-workspace ancestors after lstat confirms a plain directory.
// Fixture paths, symlinks, ignore checks, staging and all pipeline code stay real.
const ancestorShim = vi.hoisted(() => ({ active: false }));
vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  const path = await import('node:path');
  return { ...fs, realpath: async (p: string) => {
    try { return await fs.realpath(p); }
    catch (e) {
      if (!ancestorShim.active || (e as NodeJS.ErrnoException).code !== 'EPERM'
        || !path.resolve(process.cwd()).startsWith(path.resolve(p) + path.sep)) throw e;
      const info = await fs.lstat(p);
      if (!info.isDirectory() || info.isSymbolicLink()) throw e;
      return path.resolve(p);
    }
  } };
});

const temporary: string[] = [];
beforeEach(() => { ancestorShim.active = true; });
const hash = (x: Buffer) => createHash('sha256').update(x).digest('hex');
const syntheticSources = () => ({ schemaVersion: 1,
  portraits: Object.fromEntries(Object.keys(PORTRAITS).map(id => [id, { requested: `synthetic/${id}-requested.tex`, evolved: `synthetic/${id}-alternate.tex` }])),
  traits: Object.fromEntries(Object.keys(TRAIT_ICONS).map(id => [id, { source: `synthetic/${id}.tex` }])),
});
async function put(root: string, path: string, data: Buffer | object | string) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data));
}
const readJson = async (root: string, path: string) => JSON.parse(await readFile(join(root, path), 'utf8'));
async function snapshot(root: string) {
  const files: Record<string, string> = {};
  async function walk(dir: string) {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path); else files[path] = hash(await readFile(join(root, path)));
    }
  }
  await walk(''); return files;
}
async function fixture() {
  await mkdir(resolve('assets3d-local'), { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/v19-synthetic-')); temporary.push(root); return root;
}
afterEach(async () => {
  ancestorShim.active = false;
  for (const root of temporary.splice(0)) {
    withinRoot(resolve('assets3d-local'), root);
    expect(root).not.toBe(resolve('assets3d-local'));
    await rm(root, { recursive: true, force: true });
  }
});

describe('v19 explicit mappings', () => {
  it('covers the actual family policy, six-cost ids and new trait ids', () => {
    expect(FAMILY_IDS).toEqual(FAMILY_REUNION_POLICY.members);
    expect(Object.keys(PORTRAITS).sort()).toEqual(Object.keys(SIX_COST_UNITS).sort());
    expect(Object.keys(TRAIT_ICONS).sort()).toEqual(['sisters', ...Object.keys(SIX_COST_TRAITS)].sort());
    expect(TRAIT_ICONS['banished-mage'].apiName).toBe('TFT13_MissMageTrait');
  });
  it('prefers a loop and rejects ambiguous or absent dances instead of inventing actions', () => {
    expect(selectDance({ dance: 'a', dance_loop: 'b', dance_out: 'c' })).toEqual({ clip: 'dance_loop', path: 'b' });
    expect(selectDance({ synthetic_dance: 'a' })).toEqual({ clip: 'synthetic_dance', path: 'a' });
    expect(selectDance({ 'dance.synthetic': 'a' })).toEqual({ clip: 'dance.synthetic', path: 'a' });
    expect(selectDance({ regulardance: 'a' })).toEqual({ clip: 'regulardance', path: 'a' });
    expect(selectDance({ dance_in: 'a', dance_out: 'b', taunt: 'c', idle_dancing: 'd' })).toMatchObject({ clip: null, reason: 'no-dance-in-source-index' });
    expect(selectDance({ first_dance: 'a', second_dance: 'b' })).toMatchObject({ clip: null, reason: 'ambiguous-dance' });
  });
  it('adds only celebrate and retains scales, variants and prior action mappings', () => {
    const base = { path: 'models/synthetic.glb', unitScale: 2, animations: { idle: 'rest', cast: 'spell' }, castSequence: { main: 'spell' }, castVariants: { star3: { main: 'spell' } } };
    const before = structuredClone(base), result = celebrateEntry(base, 'dance', ['rest', 'spell', 'dance']);
    expect(result).toEqual({ ...base, animations: { ...base.animations, celebrate: 'dance' } });
    assertManifest({ schemaVersion: 1, models: { synthetic: result } });
    result.animations.idle = 'changed'; expect(base).toEqual(before);
    expect(() => celebrateEntry(base, 'missing', ['rest'])).toThrow('missing-celebrate-clip');
  });
  it('transfers scale metadata without restoring old meshes or hit/death aliases', () => {
    const manifest = { schemaVersion: 1, models: { synthetic: { path: 'rebuilt/model.glb', animations: { death: 'fall', celebrate: 'dance' } } }, boards: { synthetic: { alignment: 'unchanged' } } };
    const scales = { models: { synthetic: { path: 'old/model.glb', unitScale: 2, animations: { hit: 'fall' } } } };
    const result = applyScales(manifest, scales);
    expect(result.models.synthetic).toEqual({ ...manifest.models.synthetic, unitScale: 2 });
    expect(result.boards).toEqual(manifest.boards);
    expect(manifest.models.synthetic).not.toHaveProperty('unitScale');
    expect(() => applyScales(manifest, { models: { absent: { unitScale: 2 } } })).toThrow('missing-scaled-model');
    expect(() => applyScales(manifest, { models: { synthetic: { unitScale: -1 } } })).toThrow('invalid-unit-scale');
  });
  it('accepts only the exact configured source for each selected portrait mode', () => {
    const config = syntheticSources();
    const ui = (id: string, source: string, requestedSource = config.portraits.warwick.requested) => ({ assets: [{ kind: 'champion', id, source, requestedSource }] });
    const requested = ui('warwick', config.portraits.warwick.requested), evolved = ui('warwick', config.portraits.warwick.evolved);
    expect(() => checkPortraitSource(requested, config)).not.toThrow();
    expect(() => checkPortraitSource(evolved, config)).toThrow('portrait-source-mismatch');
    expect(() => checkPortraitSource(evolved, config, 'evolved')).not.toThrow();
    expect(() => checkPortraitSource(requested, config, 'evolved')).toThrow('portrait-source-mismatch');
    expect(() => checkPortraitSource(requested, config, 'guess')).toThrow('invalid-portrait-source');
    for (const mode of ['requested', 'evolved'] as const) for (const source of [
      'synthetic/other.tex', 'synthetic/other_evolved.tex', config.portraits.viktor[mode], config.portraits.warwick[mode].toUpperCase(),
    ]) expect(() => checkPortraitSource(ui('warwick', source), config, mode)).toThrow('portrait-source-mismatch');
    expect(() => checkPortraitSource(ui('unknown', 'synthetic/other.tex'), config)).toThrow('portrait-source-mismatch');
    expect(() => checkPortraitSource(ui('warwick', config.portraits.warwick.requested, 'forged'), config)).toThrow('portrait-source-mismatch');
    const withoutAlternate = { ...config, portraits: { ...config.portraits, warwick: { requested: config.portraits.warwick.requested } } };
    expect(() => checkPortraitSource(evolved, withoutAlternate, 'evolved')).toThrow('undeclared-portrait-source');
  });
});

it('requires a complete local source schema and reports a missing config before creating output', async () => {
  const root = await fixture(), sources = join(root, 'missing.json'), out = join(root, 'out');
  await expect(readSources(sources)).rejects.toThrow('missing-v19-sources-config');
  await expect(prepareV19({ sources, out })).rejects.toThrow('docs/ASSETS3D_V19_FINISH.md');
  await expect(stat(out)).rejects.toMatchObject({ code: 'ENOENT' });
  const config = syntheticSources(); await put(root, 'sources.json', config);
  expect(await readSources(join(root, 'sources.json'))).toEqual(config);
  for (const invalid of [{ ...config, schemaVersion: 2 }, { ...config, traits: {} }, { ...config, portraits: {} },
    { ...config, portraits: { ...config.portraits, warwick: { requested: '../outside.tex' } } },
    { ...config, portraits: { ...config.portraits, warwick: { ...config.portraits.warwick, candidates: ['synthetic/guess.tex'] } } },
  ]) expect(() => validateSources(invalid)).toThrow();
});

async function pipelineFixture() {
  const root = await fixture(), config = syntheticSources(), sources = join(root, 'sources.json');
  await put(root, 'sources.json', config);
  const doc = new Document(), buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer);
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', positions));
  const node = doc.createNode('synthetic').setMesh(mesh); doc.createScene().addChild(node);
  for (const name of ['rest', 'spell', 'fall', 'dance_loop']) {
    const times = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(buffer);
    const values = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0, 1, 0])).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(times).setOutput(values);
    doc.createAnimation(name).addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler));
  }
  const glb = Buffer.from(await (await compressionIO()).writeBinary(doc));
  const entry = { path: 'model.glb', animations: { idle: 'rest', cast: 'spell', death: 'fall' },
    castSequence: { in: 'rest', main: 'spell' }, castVariants: { star3: { main: 'spell' }, rotate: ['spell'] } };
  const models = Object.fromEntries([...new Set<string>([...FAMILY_IDS, ...Object.keys(PORTRAITS)])].map(id => [id, structuredClone(entry)]));
  const normal = join(root, 'normal'), rebuilt = join(root, 'rebuilt'), scales = join(root, 'scales'), board = join(root, 'board');
  const base = join(root, 'base'), fx = join(root, 'fx'), cache = join(root, 'cache');
  await put(normal, 'manifest.json', { schemaVersion: 1, models }); await put(normal, 'model.glb', glb);
  const six = Object.fromEntries(Object.keys(PORTRAITS).map(id => [id, { ...entry, unitScale: 1.1 }]));
  await put(rebuilt, 'manifest.json', { schemaVersion: 1, models: six }); await put(rebuilt, 'model.glb', glb);
  await put(scales, 'manifest.json', { models: Object.fromEntries([...Object.keys(models), 'untouched'].map(id => [id, { path: 'obsolete.glb', unitScale: 1.5 }])) });
  const alignment = { scale: [1, 1, 1], offset: [7, 0, 0], target: { radius: 34, origin: { x: 0, y: 0 } }, bench: [[1, 2, 3]] };
  const boardEntry = { alignment, grid: { columns: 7, rows: 8 } };
  const particle = { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [] };
  await put(board, 'manifest.json', { schemaVersion: 1,
    models: { 'board-default': { path: 'board.glb' }, untouched: { path: 'obsolete.glb' } },
    effects: { 'board-default-glow': { path: 'glow.json' }, unrelated: { path: 'obsolete.json' } }, boards: { 'board-default': boardEntry } });
  await put(board, 'board.glb', glb); await put(board, 'glow.json', particle);
  await put(base, 'manifest.json', { schemaVersion: 1, models: { ...models, untouched: { ...entry, unitScale: 0.5 }, 'board-default': { path: 'model.glb' } },
    effects: { 'base-fx': { path: 'base.json' }, 'six-fx': { path: 'old.json' } },
    actionEffects: { untouched: { cast: ['base-fx'] } }, boards: { 'board-default': { ...boardEntry, alignment: { ...alignment, offset: [0, 0, 0] } } } });
  await put(base, 'model.glb', glb); await put(base, 'base.json', particle); await put(base, 'old.json', particle);
  const bindings = { playback: { 'base-fx': { delay: 2 } }, variants: { star3: { untouched: { cast: ['base-fx'] } } },
    notes: { untouched: 'keep synthetic note' }, unavailable: [{ unit: 'untouched', reason: 'synthetic unavailable' }] };
  await put(base, 'action-bindings.json', bindings);
  await put(fx, 'manifest.json', { schemaVersion: 1, models: { warwick: entry }, effects: { 'six-fx': { path: 'new.json' } }, actionEffects: { warwick: { cast: ['six-fx'] } } });
  await put(fx, 'new.json', particle); await put(fx, 'model.glb', glb);
  const unitMap: Record<string, object> = Object.fromEntries(FAMILY_IDS.map((id: string) => [id, { animationFiles: { taunt: 'unused' } }]));
  unitMap.vander = { base: 'synthetic/donor', mesh: 'mesh.skn', skeleton: 'rig.skl', animationFiles: { dance_loop: 'dance.anm' } };
  unitMap.warwick = { base: 'synthetic/absent', mesh: 'mesh.skn', skeleton: 'rig.skl', animationFiles: { dance_loop: 'dance.anm' } };
  // Minimal offline TEX payload, not an image from the archive.
  const tex = Buffer.alloc(20); tex.write('TEX\0'); tex.writeUInt16LE(4, 4); tex.writeUInt16LE(4, 6); tex[8] = 1; tex[9] = 10;
  const payloads = new Map<string, Buffer>([
    ...Object.values(config.portraits).flatMap(p => [[p.requested, tex], [p.evolved, tex]] as [string, Buffer][]),
    ...Object.values(config.traits).map(t => [t.source, tex] as [string, Buffer]),
    ...['mesh.skn', 'rig.skl', 'dance.anm'].map(p => [`synthetic/donor/${p}`, Buffer.from('synthetic verified donor')] as [string, Buffer]),
  ]);
  for (const [path, bytes] of payloads) await put(cache, `extracted/${path}`, bytes);
  await put(cache, 'extraction.json', { version: '14.24.6442327', files: [...payloads].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })) });
  return { root, sources, config, base, fx, scales, boardEntry, bindings, entry, glb, unitMap,
    prepare: { sources, source: cache, sixSource: cache, base: normal, rebuilt, scales, board, out: join(root, 'additions') } };
}

it('runs synthetic prepare and four-layer finalize, preserving metadata, fallbacks, UI and packed bytes', async () => {
  const f = await pipelineFixture(), additions = f.prepare.out;
  const report = await prepareV19(f.prepare, { unitMap: f.unitMap });
  expect(report.dances).toMatchObject([{ id: 'vander', clip: 'dance_loop', preservation: { wholeGlbEqual: true } }]);
  expect(report.fallbacks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'violet', reason: 'no-dance-in-source-index' }),
    expect.objectContaining({ id: 'warwick', reason: 'missing-local-source' }),
  ]));
  const prepared = await readJson(join(additions, 'models'), 'manifest.json');
  expect(prepared.models.vander).toEqual({ ...f.entry, path: 'models/vander/model.glb', unitScale: 1.5, animations: { ...f.entry.animations, celebrate: 'dance_loop' } });
  expect(prepared.models.warwick.animations).not.toHaveProperty('celebrate');
  expect(prepared.models.violet.animations).not.toHaveProperty('celebrate');
  expect(prepared.models.warwick.animations).not.toHaveProperty('hit');
  expect(prepared.models.warwick.castVariants).toEqual(f.entry.castVariants);
  expect(report.ui.assets).toHaveLength(7); expect(report.ui.unavailable).toEqual([]);
  expect(await readFile(join(additions, 'models/models/vander/model.glb'))).toEqual(f.glb);
  const out = join(f.root, 'final');
  const result = await finalizeV19({ additions, base: f.base, fx: f.fx, scales: f.scales, sources: f.sources, out });
  expect(result).toMatchObject({ ready: true }); expect(result.packs).toBeGreaterThan(0);
  expect(await verifyRoot(out, { packed: true })).toEqual(result);
  const raw = `${out}-uncompressed`, manifest = await readJson(raw, 'manifest.json');
  expect(Object.keys(manifest.models)).toHaveLength(10);
  expect(manifest.models.vander.path).toBe('roots/3/models/vander/model.glb');
  expect(manifest.models['board-default'].path).toBe('roots/1/board.glb');
  expect(manifest.models.untouched).toEqual({ ...f.entry, path: 'roots/0/model.glb', unitScale: 1.5 });
  expect(manifest.models.warwick.castVariants).toEqual(f.entry.castVariants);
  expect(manifest.models.vander.animations.celebrate).toBe('dance_loop');
  expect(manifest.models.warwick.animations).not.toHaveProperty('celebrate');
  expect(manifest.boards['board-default']).toEqual(f.boardEntry);
  expect(manifest.effects).toEqual({ 'base-fx': { path: 'roots/0/base.json' }, 'six-fx': { path: 'roots/2/new.json' }, 'board-default-glow': { path: 'roots/1/glow.json' } });
  expect(manifest.actionEffects).toEqual({ untouched: { cast: ['base-fx'] }, warwick: { cast: ['six-fx'] } });
  const bindings = await readJson(out, 'action-bindings.json');
  for (const key of ['playback', 'variants', 'notes', 'unavailable']) expect(bindings[key]).toEqual(f.bindings[key as keyof typeof f.bindings]);
  const compressed = await readJson(out, 'manifest.json');
  expect(compressed.boards).toEqual(manifest.boards);
  expect(compressed.models.untouched.castSequence).toEqual(f.entry.castSequence);
  expect(await readJson(out, 'ui-assets.json')).toEqual(report.ui);
  // The ordinary (uncompressed) GLBs must remain byte-for-byte through the merger.
  for (const m of Object.values(manifest.models) as { path: string }[]) expect(await readFile(join(raw, m.path))).toEqual(f.glb);
  const before = await snapshot(f.root);
  await expect(prepareV19(f.prepare, { unitMap: f.unitMap })).rejects.toThrow('output-exists-use-new-directory');
  await expect(finalizeV19({ additions, base: f.base, fx: f.fx, scales: f.scales, sources: f.sources, out })).rejects.toThrow('output-exists-use-new-directory');
  await expect(buildAssetRoot({ roots: [f.base, join(additions, 'board'), f.fx, join(additions, 'models')], out: raw })).rejects.toThrow('output-exists-use-force');
  expect(await snapshot(f.root)).toEqual(before);
});

it('prepare never falls back to an unselected portrait source and finalize rejects forged sources before writing', async () => {
  const f = await pipelineFixture();
  const cache = f.prepare.source;
  const receipts = await readJson(cache, 'extraction.json');
  receipts.files = receipts.files.filter((r: { path: string }) => !Object.values(f.config.portraits).some(p => p.requested === r.path));
  await put(cache, 'extraction.json', receipts);
  const requested = await prepareV19(f.prepare, { unitMap: f.unitMap });
  expect(requested.ui.assets.every((a: { kind: string }) => a.kind === 'trait')).toBe(true);
  expect(requested.ui.unavailable.filter((a: { kind: string }) => a.kind === 'champion')).toHaveLength(3);
  const additions = join(f.root, 'evolved-additions');
  const evolved = await prepareV19({ ...f.prepare, out: additions, portraitSource: 'evolved' }, { unitMap: f.unitMap });
  expect(evolved.ui.assets.filter((a: { kind: string }) => a.kind === 'champion').map((a: { source: string }) => a.source))
    .toEqual(Object.values(f.config.portraits).map(p => p.evolved));
  const out = join(f.root, 'final'), options = { additions, base: f.base, fx: f.fx, scales: f.scales, sources: f.sources, out };
  await expect(finalizeV19(options)).rejects.toThrow('portrait-source-mismatch');
  for (const alternate of ['synthetic/unapproved.tex', 'synthetic/unapproved_evolved.tex', f.config.portraits.viktor.evolved]) {
    const forged = structuredClone(evolved.ui); forged.assets[0].source = alternate;
    await put(join(additions, 'ui'), 'ui-assets.json', forged);
    await expect(finalizeV19({ ...options, portraitSource: 'evolved' })).rejects.toThrow('portrait-source-mismatch');
  }
  await expect(stat(out)).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(stat(`${out}-uncompressed`)).rejects.toMatchObject({ code: 'ENOENT' });
  await put(join(additions, 'ui'), 'ui-assets.json', evolved.ui);
  await mkdir(out); await put(out, 'keep.txt', 'unchanged');
  const before = await snapshot(f.root);
  await expect(finalizeV19({ ...options, portraitSource: 'evolved' })).rejects.toThrow('output-exists-use-new-directory');
  expect(await snapshot(f.root)).toEqual(before);
  await expect(stat(`${out}-uncompressed`)).rejects.toMatchObject({ code: 'ENOENT' });
  const rawBlocked = join(f.root, 'raw-blocked');
  await put(`${rawBlocked}-uncompressed`, 'keep.txt', 'preserve intermediate output');
  const beforeRaw = await snapshot(f.root);
  await expect(finalizeV19({ ...options, out: rawBlocked, portraitSource: 'evolved' })).rejects.toThrow('output-exists-use-new-directory');
  expect(await snapshot(f.root)).toEqual(beforeRaw);
  await expect(stat(rawBlocked)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await finalizeV19({ ...options, out: join(f.root, 'accepted'), portraitSource: 'evolved' })).toMatchObject({ ready: true });
});

it('rejects altered extracted source bytes and version mismatches; missing records stay missing', async () => {
  const root = await fixture(), path = 'assets/synthetic.tex', bytes = Buffer.from('synthetic');
  await mkdir(join(root, 'extracted/assets'), { recursive: true });
  await writeFile(join(root, 'extracted', path), bytes);
  const records = { version: '14.24.6442327', files: [{ path, bytes: bytes.length, sha256: hash(bytes) }] };
  await writeFile(join(root, 'extraction.json'), JSON.stringify(records));
  expect((await verifiedSource([root], path)).bytes).toEqual(bytes);
  expect(await verifiedSource([root], 'assets/missing.tex')).toBeNull();
  await writeFile(join(root, 'extracted', path), Buffer.from('tampered!'));
  await expect(verifiedSource([root], path)).rejects.toThrow('source-hash-mismatch');
  await writeFile(join(root, 'extraction.json'), JSON.stringify({ ...records, version: 'different' }));
  await expect(verifiedSource([root], path)).rejects.toThrow('source-version-mismatch');
});

it('validates compressed GLBs with virtual meshopt buffers without changing bytes', async () => {
  const doc = new Document(), buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer);
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', positions));
  doc.createScene().addChild(doc.createNode().setMesh(mesh));
  await MeshoptEncoder.ready;
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const io = await compressionIO(), bytes = Buffer.from(await io.writeBinary(doc)), before = Buffer.from(bytes);
  const json = await runtimeModelJson(bytes);
  expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
  expect(json.buffers.length).toBeGreaterThan(1);
  expect(bytes).toEqual(before);
  await expect(runtimeModelJson(bytes.subarray(0, 20))).rejects.toThrow();
  const external = writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }, { byteLength: 4, uri: 'https://invalid.example/buffer.bin' }] }, Buffer.alloc(0));
  await expect(runtimeModelJson(external)).rejects.toThrow(/external buffers|merge-requires-self-contained-glb/);
});

it('checks model clips, UI hashes, indexed bytes and complete pack slices', async () => {
  const root = await fixture();
  const glb = writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }], animations: [{ name: 'dance', channels: [], samplers: [] }] }, Buffer.alloc(0));
  const icon = Buffer.from('synthetic-icon');
  const ui = Buffer.from(JSON.stringify({ schemaVersion: 1, assets: [{ id: 'synthetic', kind: 'champion', path: 'icon.png', bytes: icon.length, sha256: hash(icon) }] }));
  const files = new Map<string, Buffer>([['model.glb', glb], ['icon.png', icon], ['ui-assets.json', ui]]);
  const manifest = { schemaVersion: 1, models: { synthetic: { path: 'model.glb', animations: { celebrate: 'dance' } } } };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  const index = { schemaVersion: 1, files: [...files].map(([path, b]) => ({ path, bytes: b.length, sha256: hash(b) })) };
  await writeFile(join(root, 'precache.json'), JSON.stringify(index));
  for (const [path, bytes] of files) await writeFile(join(root, path), bytes);
  const packed = Buffer.concat([...files.values()]); let offset = 0;
  const entries = index.files.map(f => { const entry = { ...f, offset }; offset += f.bytes; return entry; });
  const packs = { schemaVersion: 1, packs: [{ name: 'synthetic', path: 'pack.bin', bytes: packed.length, sha256: hash(packed), files: entries }] };
  await writeFile(join(root, 'pack.bin'), packed);
  await writeFile(join(root, 'packs.json'), JSON.stringify(packs));
  expect(await verifyRoot(root, { packed: true })).toMatchObject({ ready: true, files: 3, packs: 1 });
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ ...manifest, models: { synthetic: { path: 'model.glb', animations: { celebrate: 'missing' } } } }));
  await expect(verifyRoot(root)).rejects.toThrow('missing-model-clip');
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  const broken = structuredClone(packs); broken.packs[0].files[1].offset++;
  await writeFile(join(root, 'packs.json'), JSON.stringify(broken));
  await expect(verifyRoot(root, { packed: true })).rejects.toThrow('pack-slice-mismatch');
  await writeFile(join(root, 'packs.json'), JSON.stringify(packs));
  await writeFile(join(root, 'icon.png'), 'altered');
  await expect(verifyRoot(root)).rejects.toThrow('payload-hash-mismatch');
  expect(JSON.parse(await readFile(join(root, 'precache.json'), 'utf8'))).toEqual(index);
});

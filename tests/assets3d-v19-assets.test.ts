import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Document } from '@gltf-transform/core';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
// @ts-expect-error Offline Node tooling.
import { selectDance, celebrateEntry, applyScales, checkPortraitSource, verifiedSource, verifyRoot, FAMILY_IDS, TRAIT_ICONS, PORTRAITS } from '../scripts/assets3d/v19-assets.mjs';
// @ts-expect-error Offline Node tooling.
import { runtimeModelJson } from '../scripts/assets3d/build-asset-root.mjs';
// @ts-expect-error Offline Node tooling.
import { compressionIO } from '../scripts/assets3d/compress.mjs';
// @ts-expect-error Synthetic GLB encoder.
import { writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Output boundary helper.
import { withinRoot } from '../scripts/assets3d/safe-path.mjs';
import { assertManifest } from '../src/rendering3d/contracts';
import { FAMILY_REUNION_POLICY } from '../src/simulation/family-reunion';
import { SIX_COST_TRAITS, SIX_COST_UNITS } from '../src/simulation/content/v19-six-cost';

const temporary: string[] = [];
const hash = (x: Buffer) => createHash('sha256').update(x).digest('hex');
async function fixture() {
  await mkdir(resolve('assets3d-local'), { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/v19-synthetic-')); temporary.push(root); return root;
}
afterEach(async () => {
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
  it('requires an explicit source selection for alternate Evolved portraits', () => {
    const ui = { assets: [{ kind: 'champion', source: 'synthetic_square.tft_set13_evolved.tex' }] };
    expect(() => checkPortraitSource(ui)).toThrow('requested-portrait-source-unavailable');
    expect(() => checkPortraitSource(ui, 'evolved')).not.toThrow();
    expect(() => checkPortraitSource(ui, 'guess')).toThrow('invalid-portrait-source');
    expect(() => checkPortraitSource({ assets: [{ kind: 'champion', source: 'synthetic_square.tft_set13.tex' }] })).not.toThrow();
  });
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

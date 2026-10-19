import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
// @ts-expect-error Pure Node utility.
import { buildAll, selectUnits } from '../scripts/assets3d/build-all.mjs';
// @ts-expect-error Pure Node utility.
import { unitDefinitions } from '../scripts/assets3d/runtime.mjs';
// @ts-expect-error Pure Node utility.
import { withinRoot, writeOutputFile } from '../scripts/assets3d/safe-path.mjs';
// @ts-expect-error Pure Node utility.
import { extractFromChunks } from '../scripts/assets3d/extract-from-chunks.mjs';
// @ts-expect-error Pure Node utility.
import { readWadIndex } from '../scripts/assets3d/wad.mjs';
// @ts-expect-error Pure Node utility.
import { riotChunkId } from '../scripts/assets3d/chunk-hash.mjs';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    withinRoot(resolve('assets3d-local'), root);
    expect(root).not.toBe(resolve('assets3d-local'));
    await rm(root, { recursive: true, force: true });
  }
});
async function output() {
  await mkdir('assets3d-local', { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/batch-test-')); roots.push(root); return root;
}
const definitions = { bad: { cost: 1 }, good: { cost: 2 }, unknown: { cost: 3 }, expensive: { cost: 5 } };
const config = { sourceName: 'tft13_synthetic', base: 'assets/characters/tft13_synthetic/skins/base', mesh: 'toy.skn',
  skeleton: 'toy.skl', animations: { idle: 'idle1' } };
function success(id: string) {
  return { ready: true, units: { [id]: { vertices: 3, bones: 1, animations: [{ name: 'idle1' }], textures: 2,
    materialTextureMappings: 1, particles: { available: true, counts: { mapped: 1, skipped: 2, rejected: 3 } },
    comparison: { available: false } } }, totals: { outBytes: 123 } };
}
// One triangle, one joint and a two-frame ANM. No game data or reference GLB.
function rawFixtures() {
  const mesh = Buffer.alloc(314);
  mesh.writeUInt32LE(0x00112233); mesh.writeUInt16LE(4, 4); mesh.writeUInt32LE(1, 8); mesh.write('Body', 12);
  for (const offset of [80, 88, 96, 100]) mesh.writeUInt32LE(3, offset);
  mesh.writeUInt32LE(52, 104);
  [0, 1, 2].forEach((v, i) => mesh.writeUInt16LE(v, 152 + i * 2));
  [[1, 3, 1], [3, 3, 1], [1, 5, 1]].forEach((p, i) => {
    const at = 158 + i * 52;
    p.forEach((v, k) => mesh.writeFloatLE(v, at + k * 4));
    mesh.writeFloatLE(1, at + 16); mesh.writeFloatLE(1, at + 36);
  });
  const rig = Buffer.alloc(171);
  rig.writeUInt32LE(rig.length); rig.writeUInt32LE(0x22fd4fc3, 4); rig.writeUInt16LE(1, 14);
  rig.writeUInt32LE(1, 16); rig.writeInt32LE(64, 20); rig.writeInt32LE(164, 28);
  rig.writeInt16LE(-1, 68); rig.writeUInt32LE(123, 72);
  [1, 3, 1, 1, 1, 1, 0, 0, 0, 1, -1, -3, -1, 1, 1, 1, 0, 0, 0, 1]
    .forEach((v, i) => rig.writeFloatLE(v, 80 + i * 4));
  rig.writeInt32LE(6, 160); rig.write('root\0', 166);
  const anm = Buffer.alloc(134);
  anm.write('r3d2anmd'); anm.writeUInt32LE(5, 8); anm.writeUInt32LE(1, 28);
  anm.writeUInt32LE(2, 32); anm.writeFloatLE(0.5, 36);
  for (const [at, v] of [[40, 106], [52, 64], [56, 100], [60, 110]]) anm.writeUInt32LE(v, at);
  [1, 1, 1, 1, 3, 1, 2, 4, 1].forEach((v, i) => anm.writeFloatLE(v, 76 + i * 4));
  anm.writeUIntLE(3 * 2 ** 45 + 16383 * 2 ** 30 + 16383 * 2 ** 15 + 16383, 112, 6);
  anm.writeUInt32LE(123, 118); anm.writeUInt16LE(1, 122); anm.writeUInt16LE(2, 128);
  const texture = Buffer.alloc(20);
  texture.write('TEX\0'); texture.writeUInt16LE(4, 4); texture.writeUInt16LE(4, 6); texture[8] = 1; texture[9] = 10;
  return { mesh, rig, anm, texture };
}
describe('isolated per-unit batch build', () => {
  it('builds a real unit pipeline using only synthetic files, with absent JSON/reference explicitly reported', async () => {
    const root = await output(), source = join(root, 'trial/local');
    const map = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.json', import.meta.url), 'utf8'));
    const config = map.vi, f = rawFixtures();
    const raw = new Map<string, Buffer>([[`${config.base}/${config.mesh}`, f.mesh], [`${config.base}/${config.skeleton}`, f.rig],
      [`${config.base}/${config.textures.Body}`, f.texture]]);
    for (const path of Object.values(config.animationFiles) as string[]) raw.set(`${config.base}/${path}`, f.anm);
    const uint = (n: number, width = 4) => { const b = Buffer.alloc(width); b.writeUIntLE(n, 0, width); return b; };
    const hash = (name: string) => { let h = 0x811c9dc5; for (const c of Buffer.from(name.toLowerCase())) h = Math.imul(h ^ c, 0x01000193) >>> 0; return h; };
    const text = (name: string) => Buffer.concat([uint(Buffer.byteLength(name), 2), Buffer.from(name)]);
    const block = (b: Buffer) => Buffer.concat([uint(b.length), b]);
    const field = (name: string, type: number, bytes: Buffer) => Buffer.concat([uint(hash(name)), uint(type, 1), bytes]);
    const fields = (...b: Buffer[]) => Buffer.concat([uint(b.length, 2), ...b]);
    const embed = (name: string, ...b: Buffer[]) => Buffer.concat([uint(hash(name)), block(fields(...b))]);
    const graphName = 'Characters/TFT13_Vi/Animations/Skin0', graphPath = 'data/characters/tft13_vi/animations/skin0.bin';
    const prop = (type: string, name: string, body: Buffer, linked: string[] = []) => Buffer.concat([Buffer.from('PROP'), uint(3), uint(linked.length),
      ...linked.map(text), uint(1), uint(hash(type)), block(Buffer.concat([uint(hash(name)), body]))]);
    raw.set('data/characters/tft13_vi/skins/skin0.bin', prop('TftSkinCharacterDataProperties', 'skin', fields(
      field('skinMeshProperties', 0x83, embed('SkinMeshDataProperties',
        field('simpleSkin', 16, text(`${config.base}/${config.mesh}`)), field('skeleton', 16, text(`${config.base}/${config.skeleton}`)),
        field('texture', 16, text(`${config.base}/${config.textures.Body}`)))),
      field('skinAnimationProperties', 0x83, embed('SkinAnimationProperties', field('animationGraphData', 0x84, uint(hash(graphName)))))
    ), [graphPath]));
    const pairs = Object.entries(config.animations).map(([alias, name]) => Buffer.concat([uint(hash(alias)), embed('AtomicClipData',
      field('mAnimationResourceData', 0x83, embed('AnimationResourceData', field('mAnimationFilePath', 16, text(`${config.base}/${config.animationFiles[name as string]}`)))))]));
    raw.set(graphPath, prop('AnimationGraphData', graphName, fields(field('mClipDataMap', 0x86,
      Buffer.concat([uint(17, 1), uint(0x82, 1), block(Buffer.concat([uint(pairs.length), ...pairs]))])))));
    const wadName = 'DATA/synthetic.wad.client', wad = Buffer.alloc(272 + raw.size * 32 + [...raw.values()].reduce((n, b) => n + b.length, 0));
    wad.write('RW'); wad[2] = 3; wad[3] = 4; wad.writeUInt32LE(raw.size, 268);
    let offset = 272 + raw.size * 32, index = 0;
    for (const bytes of raw.values()) {
      const at = 272 + index * 32; wad.writeBigUInt64LE(BigInt(++index), at);
      wad.writeUInt32LE(offset, at + 8); wad.writeUInt32LE(bytes.length, at + 12); wad.writeUInt32LE(bytes.length, at + 16);
      bytes.copy(wad, offset); offset += bytes.length;
    }
    const packed = zstdCompressSync(wad), id = riotChunkId(wad);
    const chunks = [{ id, bundleId: '0000000000000001', fileOffset: 0, offset: 0, size: packed.length, targetSize: wad.length }];
    await writeOutputFile(join(source, 'chunks', `${id}.zst`), packed);
    const entries = readWadIndex(wad).map((e: object, i: number) => ({ ...e, wad: wadName, path: [...raw.keys()][i] }));
    const extraction = await extractFromChunks({ source, out: join(root, 'extract-out'), units: 'vi',
      manifest: { files: [{ name: wadName, size: wad.length, chunks }] },
      plan: { units: { vi: { cost: 4, entries } }, wads: [{ name: wadName, entries }] } });
    expect(extraction.status).toBe('complete');
    const result = await buildAll({ units: 'vi', source, out: join(root, 'out') });
    expect(result.units.vi).toMatchObject({ status: 'success', vertices: 3, bones: 1, textures: 1,
      particles: { available: false, reason: 'missing-source-json', mapped: null },
      reference: { available: false, reason: 'missing-reference-glb' } });
    expect(result.units.vi.animations.missing).toEqual(['hit']);
    expect(result.units.vi.artifactBytes).toBeGreaterThan(100);
  });
  it('continues after one failure, reports missing mappings, and preserves per-unit metrics', async () => {
    const out = await output();
    const buildUnit = vi.fn(async ({ units, out }: { units: string; out: string }) => {
      expect(out).toContain(join('units', units));
      if (units === 'bad') throw new Error('synthetic-bad-mesh');
      return success(units);
    });
    const result = await buildAll({ out, definitions, map: { bad: config, good: config, expensive: config }, buildUnit });
    expect(result.units.bad).toMatchObject({ status: 'failed', reason: 'synthetic-bad-mesh' });
    expect(result.units.good).toMatchObject({ status: 'success', vertices: 3, bones: 1, textures: 2,
      particles: { mapped: 1, skipped: 2, rejected: 3 }, artifactBytes: 123 });
    expect(result.units.good.animations.missing).toEqual(['move', 'attack', 'cast', 'hit', 'death']);
    expect(result.units.unknown).toMatchObject({ status: 'missing', reason: 'missing-unit-map' });
    expect(result.totals).toEqual({ success: 2, failed: 1, missing: 1, artifactBytes: 246 });
    expect(result.mapping).toEqual({ mapped: 3, missing: ['unknown'] });
    expect(result.phase).toBe('complete'); expect(result.ready).toBe(false);
    expect(JSON.parse(await readFile(join(out, 'build-report.json'), 'utf8'))).toEqual(result);
    expect(buildUnit).toHaveBeenCalledTimes(3);
  });
  it('filters costs before building and reports an explicit missing marker without invoking build', async () => {
    const buildUnit = vi.fn(async ({ units }: { units: string }) => success(units));
    const result = await buildAll({ out: await output(), definitions, cost: '1,2',
      map: { bad: { missing: true, missingReason: 'missing-resource-name' }, good: config }, buildUnit });
    expect(Object.keys(result.units)).toEqual(['bad', 'good']);
    expect(result.units.bad.reason).toBe('missing-resource-name');
    expect(buildUnit).toHaveBeenCalledTimes(1);
    expect(selectUnits(definitions, 'all', '3,4,5')).toEqual(['unknown', 'expensive']);
    expect(() => selectUnits(definitions, 'all', '1,0')).toThrow('invalid-cost-filter');
    expect(() => selectUnits(definitions, 'guessed')).toThrow('invalid-unit-selection');
  });
  it('uses exactly the 60 domain keys, and checked-in mapping only contains names/path rules', async () => {
    const definitions = await unitDefinitions();
    const map = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.json', import.meta.url), 'utf8'));
    expect(Object.keys(definitions)).toHaveLength(60);
    const { $animationRules: rules, ...unitMap } = map;
    expect(Object.keys(unitMap).sort()).toEqual(Object.keys(definitions).sort());
    expect(Object.keys(rules)).toEqual(['idle', 'move', 'attack', 'cast', 'hit', 'death']);
    expect(selectUnits(definitions, 'all', '1,2')).toHaveLength(27);
    for (const value of Object.values(unitMap) as Array<{ missing?: boolean; base: string; mesh: string; skeleton: string; sourceName: string }>) {
      if (value.missing) continue;
      expect(value.base).toBe('assets/characters/' + value.sourceName + '/skins/base');
      expect(value.mesh).toMatch(/\.skn$/); expect(value.skeleton).toMatch(/\.skl$/);
      expect(JSON.stringify(value)).not.toMatch(/https?:|data:|\.\.\//);
    }
  });
  it('rejects escaped output before invoking a builder', async () => {
    const buildUnit = vi.fn();
    await expect(buildAll({ out: 'src/forbidden', definitions, map: {}, buildUnit })).rejects.toThrow('unsafe-output-path');
    expect(buildUnit).not.toHaveBeenCalled();
  });
});

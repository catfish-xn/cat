import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error Pure Node utility.
import { extractUnitScale, extractUnitScaleBin, applyUnitScales, writeUnitScaleManifest } from '../scripts/assets3d/unit-scale.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
import { assertManifest } from '../src/rendering3d/contracts';
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const block = (b: Buffer) => Buffer.concat([u32(b.length), b]);
const obj = (name: string, values: Record<string, unknown>) => ({ type: fnv1a(name), fields: Object.entries(values).map(([name, value]) => ({
  hash: fnv1a(name), type: typeof value === 'number' ? 10 : typeof value === 'string' ? 16 : 0x83, value,
})) });
const skin = (value: unknown = 1, hash = 1) => ({ ...obj('SkinCharacterDataProperties', { skinMeshProperties: obj('SkinMeshDataProperties', value === undefined ? {} : { skinScale: value }) }), hash });
const doc = (...entries: unknown[]) => ({ entries, patches: [] });
const manifest = { schemaVersion: 1, models: { tiny: { path: 'tiny.glb', animations: { idle: 'idle' } } } };
const floatField = (value: number) => {
  const float = Buffer.alloc(4); float.writeFloatLE(value);
  return Buffer.concat([u32(fnv1a('skinScale')), Buffer.from([10]), float]);
};
const binaryEntry = (fields: Buffer[]) => {
  const entry = Buffer.concat([u32(1), u16(fields.length), ...fields]);
  return Buffer.concat([Buffer.from('PROP'), u32(3), u32(0), u32(1), u32(fnv1a('SkinCharacterDataProperties')), block(entry)]);
};
const binarySkin = (fields = [floatField(0.75)], meshType = fnv1a('SkinMeshDataProperties'), lengthDelta = 0) => {
  const body = Buffer.concat([u16(fields.length), ...fields]);
  const mesh = Buffer.concat([u32(meshType), u32(body.length + lengthDelta), body]);
  return binaryEntry([Buffer.concat([u32(fnv1a('skinMeshProperties')), Buffer.from([0x83]), mesh])]);
};
// Every file in these fixtures is generated here; no local asset jobs are used.
async function withJob(run: (job: { manifestPath: string; outputManifest: string; selections: { ids: string[]; skinBin: string }[] }, directory: string) => Promise<void>) {
  const local = fileURLToPath(new URL('../assets3d-local/', import.meta.url));
  await mkdir(local, { recursive: true });
  const directory = await mkdtemp(join(local, 'unit-scale-test-'));
  try {
    const manifestPath = join(directory, 'input.json'), skinBin = join(directory, 'synthetic.bin');
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(skinBin, binarySkin());
    await run({ manifestPath, outputManifest: join(directory, 'output.json'), selections: [{ ids: ['tiny'], skinBin }] }, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
describe('offline official unit scale', () => {
  it('reads a float from a synthetic binary PROP', () => {
    const bytes = binarySkin();
    expect(extractUnitScaleBin(bytes)).toMatchObject({ unitScale: 0.75, source: 'official' });
    expect(() => extractUnitScaleBin(bytes.subarray(0, -1))).toThrow();
  });
  it('uses official default one only for an absent field in a readable skin', () => {
    const s = { ...obj('TftSkinCharacterDataProperties', { skinMeshProperties: obj('SkinMeshDataProperties', {}) }), hash: 1 };
    expect(extractUnitScale([doc(s)])).toMatchObject({ unitScale: 1, source: 'official-default' });
    expect(extractUnitScaleBin(binarySkin([]))).toMatchObject({ unitScale: 1, source: 'official-default' });
    expect(() => extractUnitScale([])).toThrow('missing-scale-source');
    expect(() => extractUnitScale([doc()])).toThrow('missing-scale-skin');
  });
  it('rejects malformed meshes, unresolved links and wrong field types instead of defaulting', () => {
    for (const type of [7, 0x84]) {
      const bytes = binaryEntry([Buffer.concat([u32(fnv1a('skinMeshProperties')), Buffer.from([type]), u32(7)])]);
      expect(() => extractUnitScaleBin(bytes)).toThrow('invalid-skin-mesh');
    }
    for (const [type, value] of [
      [7, 7], [0x84, { kind: 'link', hash: 1 }], [16, 'mesh'], [0x82, null],
      [0x83, obj('WrongMesh', {})], [0x83, { type: fnv1a('SkinMeshDataProperties'), fields: null }],
      [0x83, {}], [7, obj('SkinMeshDataProperties', {})],
    ] as const) {
      const s = skin(); s.fields[0] = { hash: fnv1a('skinMeshProperties'), type, value };
      expect(() => extractUnitScale([doc(s)])).toThrow('invalid-skin-mesh');
      expect(() => extractUnitScale([doc(s)], { meshPath: 'synthetic.skn' })).toThrow('invalid-skin-mesh');
    }
    expect(() => extractUnitScale([doc({ ...skin(), fields: [] })])).toThrow('invalid-skin-mesh');
    expect(() => extractUnitScaleBin(binarySkin([], fnv1a('WrongMesh')))).toThrow('invalid-skin-mesh');
    for (const field of [
      { hash: fnv1a('skinScale'), type: 7, value: 1 },
      { hash: fnv1a('skinScale'), type: 10, value: undefined },
    ]) {
      const mesh = obj('SkinMeshDataProperties', {}); mesh.fields.push(field);
      expect(() => extractUnitScale([doc({ ...skin(), fields: [{ hash: fnv1a('skinMeshProperties'), type: 0x83, value: mesh }] })])).toThrow('invalid-skin-scale');
    }
    const wrongPath = obj('SkinMeshDataProperties', { simpleSkin: 7 });
    expect(() => extractUnitScale([doc({ ...skin(), fields: [{ hash: fnv1a('skinMeshProperties'), type: 0x83, value: wrongPath }] })])).toThrow('invalid-skin-mesh-path');
  });
  it('rejects duplicate field hashes and internal block length overruns', () => {
    expect(() => extractUnitScaleBin(binarySkin([floatField(0.75), floatField(0.5)]))).toThrow('duplicate-bin-field');
    for (const lengthDelta of [-1, 1]) expect(() => extractUnitScaleBin(binarySkin(undefined, undefined, lengthDelta))).toThrow('bin-truncated');
    const s = skin(); s.fields.push(s.fields[0]);
    expect(() => extractUnitScale([doc(s)])).toThrow('duplicate-bin-field');
    const mesh = obj('SkinMeshDataProperties', { skinScale: 1 }); mesh.fields.push(mesh.fields[0]);
    expect(() => extractUnitScale([doc({ ...skin(), fields: [{ hash: fnv1a('skinMeshProperties'), type: 0x83, value: mesh }] })])).toThrow('duplicate-bin-field');
  });
  it('rejects ambiguity and explicitly selects a skin without multiplying root defaults', () => {
    expect(() => extractUnitScale([doc(skin(0.8), skin(1.2, 2))])).toThrow('ambiguous-scale-skin');
    expect(extractUnitScale([doc(skin(0.8), skin(1.2, 2))], { skinEntryHash: 1 }).unitScale).toBe(0.8);
    expect(() => extractUnitScale([doc(skin())], { skinEntryHash: 2 })).toThrow('missing-scale-skin');
    expect(() => extractUnitScale([{ ...doc(skin()), patches: [{}] }])).toThrow('unsupported-scale-bin-patches');
  });
  it('rejects invalid fields and explicitly composes established multipliers', () => {
    for (const v of [null, '1', 0, -1, NaN, Infinity, [1, 1, 1]]) expect(() => extractUnitScale([doc(skin(v))])).toThrow('invalid-skin-scale');
    expect(extractUnitScale([doc(skin(0.5))], { multipliers: [{ field: 'CharacterRecord.modelScale', value: 2 }] }).unitScale).toBe(1);
    expect(() => extractUnitScale([doc(skin())], { multipliers: [{ field: '', value: 2 }] })).toThrow('invalid-scale-multiplier');
  });
  it('preserves the input manifest and uses the real #369 schema boundaries', () => {
    const scaled = applyUnitScales(manifest, [{ ids: ['tiny'], unitScale: 0.75 }], assertManifest);
    expect(scaled.models.tiny).toEqual({ ...manifest.models.tiny, unitScale: 0.75 });
    expect(manifest.models.tiny).not.toHaveProperty('unitScale');
    for (const v of [undefined, 0.199, 3.001, NaN, Infinity, '1', null]) expect(() => applyUnitScales(manifest, [{ ids: ['tiny'], unitScale: v }], assertManifest)).toThrow('invalid-unit-scale');
    for (const v of [0.2, 3]) expect(() => applyUnitScales(manifest, [{ ids: ['tiny'], unitScale: v }], assertManifest)).not.toThrow();
    expect(() => applyUnitScales(manifest, [{ ids: ['unknown'], unitScale: 1 }], assertManifest)).toThrow('unknown-or-duplicate-scale-id');
    expect(() => applyUnitScales(manifest, [{ ids: ['tiny', 'tiny'], unitScale: 1 }], assertManifest)).toThrow('unknown-or-duplicate-scale-id');
  });
  it('writes a validated manifest only beneath assets3d-local and refuses existing targets', async () => {
    await withJob(async (job, directory) => {
      const rows = await writeUnitScaleManifest(job);
      expect(rows).toMatchObject([{ ids: ['tiny'], unitScale: 0.75, source: 'official' }]);
      const output = await readFile(job.outputManifest, 'utf8');
      expect(JSON.parse(output)).toEqual(applyUnitScales(manifest, rows, assertManifest));
      await expect(writeUnitScaleManifest(job)).rejects.toThrow('output-exists-use-force');
      expect(await readFile(job.outputManifest, 'utf8')).toBe(output);
      expect(JSON.parse(await readFile(job.manifestPath, 'utf8'))).toEqual(manifest);
      for (const outputManifest of ['artifacts/unit-scale-forbidden.json', 'assets3d-local/../unit-scale-forbidden.json', 'assets3d-local']) {
        await expect(writeUnitScaleManifest({ ...job, outputManifest })).rejects.toThrow('unsafe-output-path');
      }
      expect((await readdir(directory)).sort()).toEqual(['input.json', 'output.json', 'synthetic.bin']);
    });
  });
  it('allows exactly one concurrent publication without overwriting the winner', async () => {
    await withJob(async (job, directory) => {
      const otherBin = join(directory, 'other-synthetic.bin');
      await writeFile(otherBin, binarySkin([floatField(0.5)]));
      const jobs = [job, { ...job, selections: [{ ids: ['tiny'], skinBin: otherBin }] }];
      const results = await Promise.allSettled(jobs.map(j => writeUnitScaleManifest(j)));
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
      const winner = results.find(r => r.status === 'fulfilled');
      if (winner?.status !== 'fulfilled') throw new Error('missing-winner');
      expect(JSON.parse(await readFile(job.outputManifest, 'utf8')).models.tiny.unitScale).toBe(winner.value[0].unitScale);
      expect((await readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false);
    });
  });
  it('fails unreadable or malformed inputs without publishing an output', async () => {
    await withJob(async (job, directory) => {
      await expect(writeUnitScaleManifest({ ...job, manifestPath: join(directory, 'missing.json') })).rejects.toThrow('ENOENT');
      await expect(writeUnitScaleManifest({ ...job, selections: [{ ids: ['tiny'], skinBin: join(directory, 'missing.bin') }] })).rejects.toThrow('ENOENT');
      await writeFile(job.selections[0].skinBin, binarySkin([], fnv1a('WrongMesh')));
      await expect(writeUnitScaleManifest(job)).rejects.toThrow('invalid-skin-mesh');
      await expect(readFile(job.outputManifest)).rejects.toThrow('ENOENT');
      expect((await readdir(directory)).sort()).toEqual(['input.json', 'synthetic.bin']);
    });
  });
});

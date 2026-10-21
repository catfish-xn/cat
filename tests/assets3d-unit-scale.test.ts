import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node utility.
import { extractUnitScale, extractUnitScaleBin, applyUnitScales } from '../scripts/assets3d/unit-scale.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
import { assertManifest } from '../src/rendering3d/contracts';
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const block = (b: Buffer) => Buffer.concat([u32(b.length), b]);
const obj = (name: string, values: Record<string, unknown>) => ({ type: fnv1a(name), fields: Object.entries(values).map(([name, value]) => ({ hash: fnv1a(name), value })) });
const skin = (value: unknown = 1, hash = 1) => ({ ...obj('SkinCharacterDataProperties', { skinMeshProperties: obj('SkinMeshDataProperties', value === undefined ? {} : { skinScale: value }) }), hash });
const doc = (...entries: unknown[]) => ({ entries, patches: [] });
const manifest = { schemaVersion: 1, models: { tiny: { path: 'tiny.glb', animations: { idle: 'idle' } } } };
describe('offline official unit scale', () => {
  it('reads a float from a synthetic binary PROP', () => {
    const float = Buffer.alloc(4); float.writeFloatLE(0.75);
    const field = Buffer.concat([u32(fnv1a('skinScale')), Buffer.from([10]), float]);
    const mesh = Buffer.concat([u32(fnv1a('SkinMeshDataProperties')), block(Buffer.concat([u16(1), field]))]);
    const entry = Buffer.concat([u32(1), u16(1), u32(fnv1a('skinMeshProperties')), Buffer.from([0x83]), mesh]);
    const bytes = Buffer.concat([Buffer.from('PROP'), u32(3), u32(0), u32(1), u32(fnv1a('SkinCharacterDataProperties')), block(entry)]);
    expect(extractUnitScaleBin(bytes)).toMatchObject({ unitScale: 0.75, source: 'official' });
    expect(() => extractUnitScaleBin(bytes.subarray(0, -1))).toThrow();
  });
  it('uses official default one only for an absent field in a readable skin', () => {
    const s = { ...obj('TftSkinCharacterDataProperties', { skinMeshProperties: obj('Mesh', {}) }), hash: 1 };
    expect(extractUnitScale([doc(s)])).toMatchObject({ unitScale: 1, source: 'official-default' });
    expect(() => extractUnitScale([])).toThrow('missing-scale-source');
    expect(() => extractUnitScale([doc()])).toThrow('missing-scale-skin');
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
});

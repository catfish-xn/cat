import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node tooling.
import { castModelEntry, appendCastClip } from '../scripts/assets3d/cast-picks.mjs';
// @ts-expect-error Pure Node tooling.
import { writeGlb, readGlb } from '../scripts/assets3d/glb.mjs';

import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Pure Node tooling.
import { mergeFxManifestEntries } from '../scripts/assets3d/merge-fx-roots.mjs';

const base = { schemaVersion: 1 as const, models: {
  alpha: { path: 'models/alpha/model.glb', animations: { idle: 'rest', move: 'walk', attack: 'hit', death: 'fall' } },
  beta: { path: 'models/beta/model.glb', animations: { cast: 'existing' } },
}, effects: { spark: { path: 'effects/spark.json' } }, actionEffects: { alpha: { attack: ['spark'] } } };
const pick = { clip: 'synthetic_cast', basis: 'Short displacement.', confidence: 'low' };
const clips = ['rest', 'walk', 'hit', 'fall', 'synthetic_cast'];

describe('cast picks ordinary manifest (synthetic names only)', () => {
  it('retains complete model data and evidence without mutating inputs', () => {
    const snapshot = structuredClone(base), saved = structuredClone(pick);
    const entry = castModelEntry(base.models.alpha, pick, clips);
    expect(entry).toEqual({ ...base.models.alpha,
      animations: { ...base.models.alpha.animations, cast: pick.clip },
      approximated: true, basis: pick.basis, confidence: 'low' });
    expect(() => assertManifest({ schemaVersion: 1, models: { alpha: entry } })).not.toThrow();
    expect(base).toEqual(snapshot);
    expect(pick).toEqual(saved);
    entry.animations.idle = 'changed';
    expect(base.models.alpha.animations.idle).toBe('rest');
  });
  it('uses the existing last-root-wins merge while preserving other models and effects', () => {
    const entry = castModelEntry(base.models.alpha, pick, clips);
    const root = { schemaVersion: 1, models: { alpha: entry } };
    const merged = mergeFxManifestEntries([{ manifest: base }, { manifest: root }]);
    expect(() => assertManifest(merged.manifest)).not.toThrow();
    expect(Object.keys(merged.manifest.models)).toEqual(['alpha', 'beta']);
    expect(merged.manifest.models.alpha).toEqual({ ...entry, path: 'roots/1/models/alpha/model.glb' });
    expect(merged.manifest.models.beta.animations).toEqual(base.models.beta.animations);
    expect(merged.manifest.effects.spark.path).toBe('roots/0/effects/spark.json');
    expect(merged.manifest.actionEffects).toEqual(base.actionEffects);
    expect(merged.owners.models.alpha).toBe(1);
  });
  it('rejects missing clips, basic-action reuse, existing casts and missing evidence', () => {
    expect(() => castModelEntry(base.models.alpha, pick, [])).toThrow('missing-cast-clip');
    for (const name of ['rest', 'walk', 'hit', 'fall']) {
      expect(() => castModelEntry(base.models.alpha, { ...pick, clip: name }, clips)).toThrow('duplicate-basic-action');
    }
    expect(() => castModelEntry(base.models.beta, pick, clips)).toThrow('cast-already-present');
    for (const invalid of [{ ...pick, basis: ' ' }, { ...pick, confidence: 'unknown' }]) {
      expect(() => castModelEntry(base.models.alpha, invalid, clips)).toThrow('invalid-cast-evidence');
    }
  });
});

function model(name: string, nodeName = 'bone') {
  const binary = Buffer.alloc(16); binary.writeFloatLE(1, 4); binary.writeFloatLE(3, 12);
  return writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 16 }], nodes: [{ name: nodeName }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 8 }],
    accessors: [0, 1].map(bufferView => ({ bufferView, componentType: 5126, count: 2, type: 'SCALAR' })),
    animations: [{ name, channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }], samplers: [{ input: 0, output: 1 }] }],
  }, binary);
}
describe('cast clip transfer', () => {
  it('appends donor animation accessors without changing prior bytes or channels', () => {
    const a = model('rest'), b = model('spell_dash'), before = readGlb(a);
    const after = readGlb(appendCastClip(a, b, 'spell_dash'));
    expect(after.binary.subarray(0, before.binary.length)).toEqual(before.binary);
    expect(after.document.animations[0]).toEqual(before.document.animations[0]);
    expect(after.document.animations[1].samplers[0]).toEqual({ input: 2, output: 3 });
    expect(after.document.animations[1].channels[0].target).toEqual({ node: 0, path: 'translation' });
    expect(after.document.accessors[2].bufferView).toBe(2);
    expect(after.document.bufferViews[2].byteOffset).toBe(16);
    expect(() => appendCastClip(a, model('spell_dash', 'other'), 'spell_dash')).toThrow('cast-rig-mismatch');
    expect(() => appendCastClip(a, b, 'absent')).toThrow('missing-donor-clip');
    expect(() => appendCastClip(a, b, 'rest')).toThrow('cast-clip-already-present');
  });
});

import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline Node utility.
import { legendExplicitActions, LEGEND_ACTION_RULES, verifyLegendManifest } from '../scripts/assets3d/little-legends.mjs';
// @ts-expect-error Offline Node utility.
import { selectAnimations } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Offline Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Offline Node utility.
import { contracts } from '../scripts/assets3d/runtime.mjs';
// @ts-expect-error Offline Node utility.
import { writeGlb, readGlb } from '../scripts/assets3d/glb.mjs';

const clip = (alias: string, name: string) => ({ hash: fnv1a(alias), atomic: true, flags: 0, path: `assets/sprout/${name}.anm` });
const clips = [clip('Idle1', 'sprout_idle1'), clip('Run', 'sprout_run'), clip('Hurt', 'sprout_hurt'),
  clip('Celebrate', 'sprout_celebrate'), clip('Grab', 'sprout_grab'), clip('Transition', 'sprout_run_to_idle')];
const manifest = (mapping: Record<string, string>) => ({ schemaVersion: 1,
  models: { 'little-legend-sprout': { path: 'models/little-legend-sprout/model.glb', animations: mapping } }, effects: {} });
// Program-generated triangle with a translation animation for each fake clip.
function tinyModel(names: string[]) {
  const values = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  return writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: values.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 8 },
      { buffer: 0, byteOffset: 44, byteLength: 24 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 2, componentType: 5126, count: 2, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    animations: names.map(name => ({ name, samplers: [{ input: 1, output: 2 }],
      channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] })) }, Buffer.from(values.buffer));
}

describe('synthetic companion action contract', () => {
  it('maps required actions, real run and grab to clips present in the graph', () => {
    const selected = selectAnimations(clips, LEGEND_ACTION_RULES, legendExplicitActions(clips));
    expect(selected.mapped).toMatchObject({ idle: 'sprout_idle1', move: 'sprout_run', run: 'sprout_run',
      grab: 'sprout_grab', hit: 'sprout_hurt', celebrate: 'sprout_celebrate' });
    const m = manifest(selected.mapped);
    const model = readGlb(tinyModel(Object.keys(selected.files)));
    expect(model.document.meshes[0].primitives).toHaveLength(1);
    expect(() => verifyLegendManifest(m, ['little-legend-sprout'], {
      'little-legend-sprout': model.document.animations.map((a: { name: string }) => a.name) })).not.toThrow();
    expect(() => verifyLegendManifest(m, ['little-legend-pebble'], {})).toThrow('legend-model-keys');
    expect(() => verifyLegendManifest(m, ['little-legend-sprout'], { 'little-legend-sprout': [] })).toThrow('legend-missing-clip');
  });
  it('does not fabricate grab when absent and rejects missing mandatory actions', () => {
    const selected = selectAnimations(clips.filter(c => c.hash !== fnv1a('Grab')), LEGEND_ACTION_RULES, legendExplicitActions(clips));
    expect(selected.mapped.grab).toBeUndefined();
    expect(selected.decisions.grab.sourceStatus).toBe('no-source-action');
    delete selected.mapped.hit;
    expect(() => verifyLegendManifest(manifest(selected.mapped), ['little-legend-sprout'], {})).toThrow('legend-missing-action');
  });
  it('resolves a real spell alias over same-named alternate clips', () => {
    const spell = [clip('Spell1', 'sprout_spell'), { ...clip('Recovery', 'sprout_spell'), path: 'assets/pebble/sprout_spell.anm' }];
    const selected = selectAnimations(spell, LEGEND_ACTION_RULES, legendExplicitActions(spell));
    expect(selected.decisions.cast.path).toBe('assets/sprout/sprout_spell.anm');
  });
  it('accepts the legend action keys in the shared manifest contract, rejecting unknown keys and empty clip names', async () => {
    const { assertManifest } = await contracts();
    const m = manifest({ idle: 'sprout_idle', run: 'sprout_run', grab: 'sprout_grab', celebrate: 'sprout_dance' });
    const before = structuredClone(m);
    expect(() => assertManifest(m)).not.toThrow();
    expect(m).toEqual(before);
    expect(() => assertManifest(manifest({ unknown: 'sprout_idle' }))).toThrow('invalid-animation-map');
    expect(() => assertManifest(manifest({ grab: '' }))).toThrow('invalid-animation-map');
  });
});

import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline Node inventory utility.
import { fieldEvidence, spellEvidence } from '../scripts/assets3d/fx-trial.mjs';

describe('offline source evidence without inferred effects', () => {
  it('keeps concrete field values and emitter provenance from both source lists', () => {
    expect(fieldEvidence({ complexEmitterDefinitionData: [{ emitterName: 'one', particleLinger: 0.5 },
      { emitterName: 'two', particleLinger: 0.5 }], simpleEmitterDefinitionData: [{ emitterName: 'three', particleLinger: -1 }] }).particleLinger)
      .toEqual([{ value: 0.5, emitters: [{ list: 'complexEmitterDefinitionData', index: 0, name: 'one' },
        { list: 'complexEmitterDefinitionData', index: 1, name: 'two' }] },
      { value: -1, emitters: [{ list: 'simpleEmitterDefinitionData', index: 0, name: 'three' }] }]);
  });
  it('resolves actual spell keys and retains unavailable shared hit resources', () => {
    const source = { resolver: { __type: 'ResourceResolver', resourceMap: { rocket: 'system' } },
      system: { __type: 'VfxSystemDefinitionData' }, spell: { __type: 'SpellObject', mScriptName: 'test',
        mSpell: { mMissileEffectKey: 'rocket', mHitEffectKey: 'global-hit', mAnimationName: 'cast' } } };
    expect(spellEvidence(source).spells[0]).toMatchObject({ script: 'test', animation: 'cast', effects: [
      { field: 'mMissileEffectKey', key: 'rocket', system: 'system', available: true },
      { field: 'mHitEffectKey', key: 'global-hit', system: null, available: false },
    ] });
  });
});

import { describe, expect, it } from 'vitest';
import type { VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import { mapConvertedEvents } from '../src/rendering/three-mode/vfx-ltk/converted-events';
import { num, struct } from './vfx-ltk-synthetic';
const str = (value: string): VfxValue => ({ type: 'string', value });
const list = (...items: VfxValue[]): VfxValue => ({ type: 'container', items });
const hash = (name: string): VfxValue => ({ type: 'hash', hash: nameHash(name), name });
const meta = (name: string, fields: Record<string, VfxValue>) => ({ class: name, root: struct(name, fields) });
const reference = struct('VfxSystemDefinitionData', {});
if (reference.type === 'struct') reference.object = { entry: '0x12345678', name: 'synthetic' };
const systems = { '12345678': 'systems/test.json' };
function metadata() {
  return [
    meta('ResourceResolver', { resourceMap: { type: 'map', entries: [{ key: 'Synthetic_Cast', value: reference }] } }),
    meta('TFTCharacterRecord', { spellNames: list(str('SyntheticSpell')), basicAttack: struct('AttackSlotData', { mAttackName: str('SyntheticBasicAttack') }) }),
    meta('SpellObject', { mScriptName: str('SyntheticSpell'), mSpell: struct('SpellDataResource', { mAnimationName: str('Spell'), mCastEffectKey: hash('Synthetic_Cast'), castFrame: num(6) }) }),
    meta('SpellObject', { mScriptName: str('SyntheticBasicAttack'), mSpell: struct('SpellDataResource', { mHitEffectKey: hash('TFT_Global_BA_Hit'), castFrame: num(9), mHitBoneName: str('CHEST') }) }),
    meta('SpellObject', { mScriptName: str('SyntheticUnobservedSubspell'), mSpell: struct('SpellDataResource', { mCastEffectKey: hash('Synthetic_Cast') }) }),
    meta('AnimationGraphData', { mClipDataMap: { type: 'map', entries: [{ key: 'Spell', value: struct('AtomicClipData', {
      mEventDataMap: list(struct('ParticleEventData', { mEffectKey: hash('Synthetic_Cast'), mStartFrame: num(3), mEndFrame: num(12),
        mParticleEventDataPairList: list(struct('ParticleEventDataPair', { mBoneName: str('RIGHT_HAND') })) })),
    }) }, { key: 'Recall', value: struct('ParticleEventData', { mEffectKey: hash('Synthetic_Cast'), mStartFrame: num(0) }) }] } }),
  ];
}
describe('generic converted BIN event timelines', () => {
  it('uses record spell slots, resolver IDs and matching animation events, preserving bones and frames', () => {
    const mapped = mapConvertedEvents('lux', metadata(), { ...systems, '0f2af66b': 'hit.json' });
    expect(mapped.cues.filter(c => c.action === 'cast')).toEqual([
      { system: '12345678', action: 'cast', event: 'cast-start', delay: .2, duration: 1.5, bone: undefined },
      { system: '12345678', action: 'cast', event: 'cast-start', delay: .1, duration: 1.3, bone: 'RIGHT_HAND', stopAfter: .3 },
    ]);
    expect(mapped.cues.find(c => c.action === 'attack')).toMatchObject({ system: '0f2af66b', event: 'hit', delay: .3, bone: 'CHEST' });
    expect(mapped.events.find(e => e.label === 'Recall')?.action).toBeUndefined();
    expect(mapped.events.find(e => e.label === 'SyntheticUnobservedSubspell')?.action).toBeUndefined();
  });
  it('keeps the entire affected action on fallback when one selected event is unresolved', () => {
    const mapped = mapConvertedEvents('lux', metadata(), systems);
    expect(mapped.cues.some(c => c.action === 'attack')).toBe(false);
    expect(mapped.cues.filter(c => c.action === 'cast')).toHaveLength(2);
    expect(mapped.diagnostics).toContain('attack:unresolved-events:1');
  });
});

import { mapLegacyTimeline } from '../src/rendering/three-mode/vfx-ltk/converted-events';
it('reuses exact existing script-driven display bindings and keeps incomplete actions on fallback', () => {
  const inventory = [{ id: 'cast-id', name: 'Characters/Test/Particles/TFT13_Test_Cast' }, { id: 'hit-id', name: 'TFT_Global_BA_Hit' }];
  const bindings = { actionEffects: { test: { cast: ['test_tft13_test_cast'], attack: ['global_tft_global_ba_hit'] } }, playback: {
    test_tft13_test_cast: { anchor: 'source', delay: .2, maxDuration: 1, bone: 'Hand' },
    global_tft_global_ba_hit: { anchor: 'target', delay: .3, maxDuration: .5 },
  } };
  expect(mapLegacyTimeline('test', inventory, bindings).cues).toEqual([
    { system: 'cast-id', action: 'cast', event: 'cast-start', delay: .2, duration: 1, bone: 'Hand' },
    { system: 'hit-id', action: 'attack', event: 'hit', delay: .3, duration: .5, bone: undefined },
  ]);
  bindings.actionEffects.test.cast.push('test_missing');
  const missing = mapLegacyTimeline('test', inventory, bindings);
  expect(missing.cues.some(c => c.action === 'cast')).toBe(false);
  expect(missing.cues.some(c => c.action === 'attack')).toBe(true);
  expect(missing.diagnostics).toContain('cast:unmapped-binding:test_missing');
});

it('keeps renderer-specific procedural staging and fixed-direction exclusions on legacy', () => {
  const bindings = { actionEffects: { singed: { cast: ['singed_tft13_singed_base_w_ally_buf'] } }, playback: {
    singed_tft13_singed_base_w_ally_buf: { anchor: 'target', delay: 0, maxDuration: 1 },
  } };
  const mapped = mapLegacyTimeline('singed', [{ id: 'fx', name: 'TFT13_Singed_Base_W_Ally_Buf' }], bindings);
  expect(mapped.cues).toEqual([]); expect(mapped.diagnostics).toContain('cast:requires-host-staging');
});

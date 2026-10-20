import { describe, expect, it } from 'vitest';
import { assertManifest, parseActionEffects, type AssetManifest } from '../src/rendering3d/contracts';
import { createActionEffectResolver } from '../src/rendering3d/action-effects';

const manifest = (): AssetManifest => ({ schemaVersion: 1, models: { toy: { path: 'models/toy.glb' } },
  effects: { flash: { path: 'effects/flash.json' }, smoke: { path: 'effects/smoke.json' } } });

describe('explicit action effect bindings', () => {
  it('resolves manifest bindings without guessing from names and returns isolated snapshots', () => {
    const m = manifest(); m.actionEffects = { toy: { attack: ['flash'], cast: ['smoke', 'flash'] } };
    assertManifest(m);
    const resolve = createActionEffectResolver(m);
    m.actionEffects.toy.attack = []; m.effects!.flash.path = 'changed.json';
    expect(resolve('toy', 'attack')).toEqual([{ id: 'flash', path: 'effects/flash.json' }]);
    expect(resolve('toy', 'cast').map(e => e.id)).toEqual(['smoke', 'flash']);
    const first = resolve('toy', 'attack'); first[0].path = 'mutated';
    expect(resolve('toy', 'attack')[0].path).toBe('effects/flash.json');
    expect(resolve('missing', 'attack')).toEqual([]); expect(resolve('toy', 'idle')).toEqual([]);
  });
  it('accepts deliberately selected sidecar bindings; absent bindings play nothing', () => {
    expect(createActionEffectResolver(manifest())('toy', 'attack')).toEqual([]);
    expect(createActionEffectResolver(manifest(), { toy: { attack: ['flash'] } })('toy', 'attack')[0].id).toBe('flash');
  });
  it.each([null, [], 1, { missing: {} }, { toy: [] }, { toy: null }, { toy: { typo: [] } },
    { toy: { attack: 'flash' } }, { toy: { attack: ['missing'] } }, { toy: { attack: ['flash', 'flash'] } },
    { toy: { attack: [null] } }, { toy: { attack: new Array(1) } }, { toy: { attack: Array(65).fill('flash') } },
    JSON.parse('{"__proto__":{"attack":["flash"]}}'), { toy: { attack: ['constructor'] } }])('rejects invalid or dangling bindings %j', bindings => {
    expect(() => parseActionEffects(bindings, manifest())).toThrow('invalid-action-effects');
    expect(() => assertManifest({ ...manifest(), actionEffects: bindings })).toThrow('invalid-action-effects');
  });
  it('validates referenced payload paths and does not traverse inherited unit names', () => {
    expect(createActionEffectResolver(manifest())('constructor', 'attack')).toEqual([]);
    expect(() => createActionEffectResolver({ ...manifest(), effects: { flash: { path: '../escape.json' } } })).toThrow('invalid-asset-path');
  });
});

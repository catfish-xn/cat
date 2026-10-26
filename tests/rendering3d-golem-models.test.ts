import { expect, it } from 'vitest';
import { ModelCache, type AssetManifest } from '../src/rendering3d';
import { registerGolemModels } from '../src/rendering/three-mode/summon-models';
import { Group } from 'three';

it.each(['trainer-golem', 'augment-golem', 'TFT_BlueGolem'])('reuses %s with its path, scale and animation metadata', async id => {
  const entry = { path: 'models/golem/model.glb', unitScale: 0.8, animations: { idle: 'idle1', cast: 'spell1' } };
  const manifest: AssetManifest = { schemaVersion: 1, models: { [id]: entry } };
  const urls: string[] = [];
  const cache = new ModelCache(manifest, 'https://assets.test/', async url => {
    urls.push(url); return { scene: new Group(), animations: [] };
  });
  registerGolemModels(cache.manifest);
  for (const alias of ['trainer-golem', 'augment-golem']) {
    expect(cache.manifest.models[alias]).toEqual(entry);
    const lease = await cache.load(alias);
    expect(lease.placeholder).toBe(false); expect(lease.animationNames.cast).toBe('spell1'); lease.release();
  }
  expect(urls).toEqual(['https://assets.test/models/golem/model.glb', 'https://assets.test/models/golem/model.glb']);
  expect(Object.keys(manifest.models)).toEqual([id]); // source document is untouched
  cache.dispose();
});

it('keeps explicit models and leaves a root without a golem unchanged', () => {
  const manifest: AssetManifest = { schemaVersion: 1, models: { 'pve-krug': { path: 'krug.glb' } } };
  registerGolemModels(manifest);
  expect(Object.keys(manifest.models)).toEqual(['pve-krug']);
  manifest.models['trainer-golem'] = { path: 'trainer.glb' };
  manifest.models['augment-golem'] = { path: 'augment.glb' };
  registerGolemModels(manifest);
  expect(manifest.models['augment-golem'].path).toBe('augment.glb');
});

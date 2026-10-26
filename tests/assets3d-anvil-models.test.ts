import { expect, it } from 'vitest';
// @ts-expect-error offline script has no declaration file
import { ANVILS, mergeAnvilDelta } from '../scripts/assets3d/anvil-models.mjs';

function fixture() {
  const base = {
    manifest: { schemaVersion: 1, models: { hero: { path: 'old.glb' } }, effects: { hit: { path: 'hit.json' } }, boards: { board: { preserved: true } } },
    precache: { schemaVersion: 1, files: [{ path: 'old.glb', bytes: 1, sha256: 'old-hash' }, { path: 'ui-assets.json', bytes: 1, sha256: 'stale-ui-hash' }] },
    ui: { schemaVersion: 1, patch: '14.24', assets: [{ kind: 'augment', id: 'old', path: 'old.png' }] },
  };
  const manifest = { models: Object.fromEntries(ANVILS.map(({ id }: { id: string }) => [id, { path: `anvils/models/${id}.glb`, animations: { idle: 'idle' }, unitScale: 1.1 }])) };
  const ui = { assets: ANVILS.map(({ id }: { id: string }) => ({ kind: 'champion', id, path: `anvils/icons/${id}.png` })) };
  const payloads = new Map<string, Buffer>([...Object.values(manifest.models).map((m: any) => m.path), ...ui.assets.map((a: any) => a.path)].map(path => [path, Buffer.from(path)]));
  return { base, added: { manifest, ui }, payloads };
}
it('preserves all unrelated metadata and payload hashes, indexes both own models/icons, and is deterministic/idempotent', () => {
  const { base, added, payloads } = fixture(), before = structuredClone(base);
  const merged = mergeAnvilDelta(base, added, payloads);
  expect(base).toEqual(before);
  expect(merged.manifest.models.hero).toEqual(base.manifest.models.hero);
  expect(merged.manifest.effects).toEqual(base.manifest.effects);
  expect(merged.manifest.boards).toEqual(base.manifest.boards);
  expect(merged.ui.assets[0]).toEqual(base.ui.assets[0]);
  expect(merged.precache.files.find((f: any) => f.path === 'old.glb')).toEqual(base.precache.files[0]);
  expect(merged.precache.files).toHaveLength(6);
  expect(merged.precache.files.find((f: any) => f.path === 'ui-assets.json').bytes).toBe(Buffer.byteLength(JSON.stringify(merged.ui, null, 2) + '\n'));
  expect(merged.precache.files.map((f: any) => f.path)).toEqual([...merged.precache.files.map((f: any) => f.path)].sort());
  for (const { id } of ANVILS) {
    expect(merged.manifest.models[id].animations).toEqual({ idle: 'idle' });
    expect(merged.manifest.models[id].unitScale).toBe(1.1);
    expect(merged.ui.assets.filter((a: any) => a.id === id)).toHaveLength(1);
  }
  expect(mergeAnvilDelta(merged, added, payloads)).toEqual(merged);
  expect(mergeAnvilDelta(base, added, payloads)).toEqual(merged);
});
it('fails closed for missing model, icon, bytes and unsafe paths', () => {
  const { base, added, payloads } = fixture();
  const missing = structuredClone(added); delete missing.manifest.models[ANVILS[0].id];
  expect(() => mergeAnvilDelta(base, missing, payloads)).toThrow('missing-anvil-entry');
  const noIcon = structuredClone(added); noIcon.ui.assets = [];
  expect(() => mergeAnvilDelta(base, noIcon, payloads)).toThrow('missing-anvil-entry');
  expect(() => mergeAnvilDelta(base, added, new Map())).toThrow('missing-anvil-payload');
  const unsafe = structuredClone(added); unsafe.manifest.models[ANVILS[0].id].path = 'anvils/../old.glb';
  expect(() => mergeAnvilDelta(base, unsafe, payloads)).toThrow('unsafe-anvil-path');
});
it('refuses changing a base payload which may already be included in packs', () => {
  const { base, added, payloads } = fixture();
  const merged = mergeAnvilDelta(base, added, payloads);
  payloads.set(added.manifest.models[ANVILS[0].id].path, Buffer.from('different'));
  expect(() => mergeAnvilDelta(merged, added, payloads)).toThrow('base-payload-conflict');
});

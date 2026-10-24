import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S13_ASSETS } from '../../src/presentation/s13-asset-manifest';
import { g23ChampionAssets } from '../../src/presentation/g23-display';
import { neutralPortraitAssets } from '../../src/presentation/s13-neutral-assets';
import { traitDisplayName } from '../../src/presentation/hero-identity';

// Reserved domain and invented paths only; every fetch is intercepted, including defaults.
const ROOT = 'https://ui-assets.invalid/synthetic/root/';
const HERO = 'synthetic-champion';
const TRAIT = 'synthetic-trait';
let assets: typeof import('../../src/presentation/s13-assets');

beforeEach(async () => {
  vi.resetModules(); // The production registry and one-shot promise are module-local.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('unexpected-fetch'); }));
  assets = await import('../../src/presentation/s13-assets');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function sceneStub() {
  const scene = {
    textures: { exists: vi.fn(() => false) },
    load: { image: vi.fn(), once: vi.fn(), start: vi.fn() },
    sys: { isActive: vi.fn(() => true) },
  };
  return { scene: scene as unknown as Phaser.Scene, load: scene.load };
}
const entry = (path: unknown, id = HERO, kind: unknown = 'champion') => ({ kind, id, path });
const response = (manifest: unknown) => new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } });

describe('root UI manifest path containment', () => {
  it.each([
    '../escape.png', 'icons/../../escape.png', 'icons/../escape.png', 'icons/..',
    '%2e%2e/escape.png', '%2E%2E/escape.png', 'icons/%2e%2e/escape.png',
    'icons/.%2e/escape.png', '%252e%252e/escape.png', 'icons%2f..%2fescape.png',
    '..\\escape.png', 'icons\\..\\escape.png', '\\\\host.invalid\\escape.png',
    'http://host.invalid/escape.png', 'https://host.invalid/escape.png', '//host.invalid/escape.png',
    'data:image/png;base64,AAAA', 'javascript:alert(1)', 'blob:https://host.invalid/synthetic',
    '/escape.png', '/synthetic/root/escape.png', 'C:/escape.png',
    'icons/hero.png?outside=1', 'icons/hero.png#fragment', 'icons/hero.png%3foutside=1',
    'icons/hero.png%23fragment', 'icons/hero.png\u0000', 'icons/\n../escape.png',
    'icons/\uFF0E\uFF0E/escape.png', 'icons/\u2024\u2024/escape.png',
    'icons\uFF0F..\uFF0Fescape.png', 'icons/caf\u00e9.png', 'icons/cafe\u0301.png',
    'icons/\u212A.png', 'icons/\uFEFF../escape.png', '',
  ])('rejects %j without discarding adjacent valid entries', path => {
    assets.registerRootUiAssets(ROOT, { assets: [
      entry('icons/before.png', 'synthetic-before'), entry(path), entry('icons/after.png', 'synthetic-after'),
    ] });
    expect(assets.s13AssetUrl('champion', HERO)).toBeNull();
    expect(assets.s13AssetUrl('champion', 'synthetic-before')).toBe(`${ROOT}icons/before.png`);
    expect(assets.s13AssetUrl('champion', 'synthetic-after')).toBe(`${ROOT}icons/after.png`);
    const { scene, load } = sceneStub();
    assets.loadS13Portraits(scene, vi.fn());
    expect(load.image.mock.calls.some(([key]) => key === assets.championTextureKey(HERO))).toBe(false);
  });

  it('registers safe champion/trait paths, exposes DOM URLs and preloads champion textures', () => {
    assets.registerRootUiAssets(ROOT, { assets: [entry('icons/hero-1.png'), entry('icons/trait_1.png', TRAIT, 'trait')] });
    expect(assets.s13AssetUrl('champion', HERO)).toBe(`${ROOT}icons/hero-1.png`);
    expect(assets.heroPortraitHtml(HERO, 34, 'fallback')).toContain(`src="${ROOT}icons/hero-1.png"`);
    expect(assets.s13IconHtml('trait', TRAIT, 18, 'trait-icon')).toContain(`src="${ROOT}icons/trait_1.png"`);
    const { scene, load } = sceneStub();
    assets.loadS13Portraits(scene, vi.fn());
    expect(load.image).toHaveBeenCalledWith(assets.championTextureKey(HERO), `${ROOT}icons/hero-1.png`);
    expect(load.image.mock.calls.some(([key]) => key === assets.championTextureKey(TRAIT))).toBe(false);
  });

  it('registers augment icons for ids the bundle lacks, keeps bundled icons and never preloads them as portraits', async () => {
    const display = await import('../../src/presentation/augment-display');
    await (await import('../../src/presentation/augment-text-loader')).loadAugmentText();
    const { S13_AUGMENT_ASSETS } = await import('../../src/presentation/s13-augment-asset-manifest');
    const bundled = S13_AUGMENT_ASSETS[0]!.id;
    expect(display.augmentIconUrl('synthetic-augment')).toBeNull();
    expect(display.augmentIconOrBadgeHtml('synthetic-augment', 20)).toContain('augment-badge');
    assets.registerRootUiAssets(ROOT, { assets: [entry('icons/aug.png', 'synthetic-augment', 'augment'), entry('icons/aug-bundled.png', bundled, 'augment')] });
    expect(display.augmentIconUrl('synthetic-augment')).toBe(`${ROOT}icons/aug.png`);
    expect(display.augmentIconOrBadgeHtml('synthetic-augment', 20)).toContain(`src="${ROOT}icons/aug.png"`);
    expect(display.augmentIconUrl(bundled)).not.toContain(ROOT);
    expect(assets.s13AssetUrl('champion', 'synthetic-augment')).toBeNull();
    const { scene, load } = sceneStub();
    assets.loadS13Portraits(scene, vi.fn());
    expect(load.image.mock.calls.some(([key]) => key === assets.championTextureKey('synthetic-augment'))).toBe(false);
  });

  it('does not replace an earlier valid entry with a rejected duplicate or register item entries', () => {
    assets.registerRootUiAssets(ROOT, { assets: [entry('icons/hero.png'), entry('../escape.png'), entry('icons/item.png', 'synthetic-item', 'item')] });
    expect(assets.s13AssetUrl('champion', HERO)).toBe(`${ROOT}icons/hero.png`);
    expect(assets.s13AssetUrl('item', 'synthetic-item')).toBeNull();
  });
});

describe('root UI manifest failure isolation', () => {
  it.each([null, false, 42, 'text', [], {}, { assets: null }, { assets: {} }, { assets: 'wrong' }])(
    'quietly ignores malformed manifest %j', async manifest => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(manifest));
      const warn = vi.spyOn(console, 'warn'), error = vi.spyOn(console, 'error');
      await expect(assets.loadRootUiAssets(ROOT, fetcher)).resolves.toBeUndefined();
      expect(assets.s13AssetUrl('champion', HERO)).toBeNull();
      expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
    },
  );

  it('skips wrong entry types and field types while preserving valid entries on both sides', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ assets: [
      entry('icons/hero.png'), null, false, 1, 'text', [], {},
      { kind: 'champion', id: 7, path: 'icons/wrong-id.png' },
      { kind: 'champion', id: 'synthetic-bad-path', path: 7 },
      { kind: ['champion'], id: 'synthetic-bad-kind', path: 'icons/wrong-kind.png' },
      { kind: 'trait', path: 'icons/no-id.png' },
      entry(null, 'synthetic-null'), entry(['icons/list.png'], 'synthetic-list'),
      entry('icons/trait.png', TRAIT, 'trait'),
    ] }));
    await expect(assets.loadRootUiAssets(ROOT, fetcher)).resolves.toBeUndefined();
    expect(assets.s13AssetUrl('champion', HERO)).toBe(`${ROOT}icons/hero.png`);
    expect(assets.s13AssetUrl('trait', TRAIT)).toBe(`${ROOT}icons/trait.png`);
    for (const id of ['synthetic-bad-path', 'synthetic-bad-kind', 'synthetic-null', 'synthetic-list'])
      expect(assets.s13AssetUrl('champion', id)).toBeNull();
  });

  it.each(['missing', '404', 'non-json', 'json-rejected', 'aborted'] as const)('quietly falls back after %s', async failure => {
    const json = vi.fn(async () => { throw new SyntaxError('synthetic-json-failure'); });
    const fetcher = vi.fn<typeof fetch>();
    if (failure === 'missing') fetcher.mockRejectedValue(new TypeError('synthetic-offline'));
    if (failure === 'aborted') fetcher.mockRejectedValue(new DOMException('synthetic-timeout', 'AbortError'));
    if (failure === '404') fetcher.mockResolvedValue({ ok: false, json } as unknown as Response);
    if (failure === 'non-json') fetcher.mockResolvedValue(new Response('<synthetic-html>'));
    if (failure === 'json-rejected') fetcher.mockResolvedValue({ ok: true, json } as unknown as Response);
    const warn = vi.spyOn(console, 'warn'), error = vi.spyOn(console, 'error');
    await expect(assets.loadRootUiAssets(ROOT, fetcher)).resolves.toBeUndefined();
    if (failure === '404') expect(json).not.toHaveBeenCalled();
    expect(assets.heroPortraitHtml(HERO, 34, 'synthetic-fallback')).toBe('synthetic-fallback');
    expect(assets.s13IconHtml('trait', TRAIT, 18, 'trait-icon')).toBe('');
    const { scene, load } = sceneStub();
    assets.loadS13Portraits(scene, vi.fn());
    expect(load.start).toHaveBeenCalledOnce(); // Bundled portraits can still load.
    expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });

  it('requests the side manifest once across concurrent calls', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ assets: [entry('icons/hero.png')] }));
    await Promise.all([assets.loadRootUiAssets(ROOT, fetcher), assets.loadRootUiAssets(ROOT, fetcher)]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(`${ROOT}ui-assets.json`);
    expect(assets.s13AssetUrl('champion', HERO)).toBe(`${ROOT}icons/hero.png`);
  });

  // These are ordinary regression assertions, intentionally red until the production timeout is fixed.
  // Exhaust all scheduled timers instead of prescribing a new product-specific timeout duration.
  it.each(['fetch', 'body'] as const)('releases bundled portrait loading when %s never settles', async stage => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      let rejectPending!: (reason: unknown) => void;
      const pending = new Promise<never>((_resolve, reject) => { rejectPending = reject; });
      init?.signal?.addEventListener('abort', () => rejectPending(new DOMException('synthetic-abort', 'AbortError')), { once: true });
      return stage === 'fetch' ? pending : Promise.resolve({ ok: true, json: () => pending } as unknown as Response);
    });
    const { scene, load } = sceneStub();
    let settled = false;
    void assets.loadRootUiAssets(ROOT, fetcher).then(() => {
      settled = true;
      assets.loadS13Portraits(scene, vi.fn()); // Same dependency as BoardScene's idle callback.
    });
    await vi.runAllTimersAsync();
    expect(settled, 'a hung optional manifest must have a finite fallback deadline').toBe(true);
    expect(load.start).toHaveBeenCalledOnce();
  });
});

describe('public 2D without a root', () => {
  it('keeps text labels for the four traits without icons', async () => {
    await assets.loadRootUiAssets(null);
    for (const [id, label] of [['sisters', '姐妹'], ['blood-hunter', '祖安怒兽'], ['machine-herald', '机械先驱'], ['banished-mage', '放逐法师']]) {
      expect(assets.s13AssetUrl('trait', id)).toBeNull();
      expect(assets.s13IconHtml('trait', id, 18, 'trait-icon')).toBe('');
      expect(traitDisplayName(id)).toBe(label);
    }
  });

  it('does not fetch or latch the manifest promise; a later configured root can load', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ assets: [entry('icons/hero.png')] }));
    await assets.loadRootUiAssets(null, fetcher);
    await assets.loadRootUiAssets(null);
    expect(fetcher).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(assets.s13AssetUrl('champion', HERO)).toBeNull();
    await assets.loadRootUiAssets(ROOT, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(assets.s13AssetUrl('champion', HERO)).toBe(`${ROOT}icons/hero.png`);
  });

  it('preserves every bundled URL and the multiplayer portrait preload list', async () => {
    const base = import.meta.env.BASE_URL;
    await assets.loadRootUiAssets(null);
    for (const asset of S13_ASSETS)
      expect(assets.s13AssetUrl(asset.kind, asset.id), `${asset.kind}:${asset.id}`).toBe(`${base}${asset.path}`);
    const portraits = [...S13_ASSETS.filter(asset => asset.kind === 'champion'), ...g23ChampionAssets(), ...neutralPortraitAssets()];
    for (const portrait of portraits)
      expect(assets.s13AssetUrl('champion', portrait.id), portrait.id).toBe(`${base}${portrait.path}`);
    const { scene, load } = sceneStub();
    assets.loadS13Portraits(scene, vi.fn());
    expect(load.image.mock.calls).toEqual(portraits.map(asset => [assets.championTextureKey(asset.id), `${base}${asset.path}`]));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    for (const id of ['warwick', 'viktor', 'mel']) {
      expect(assets.s13AssetUrl('champion', id)).toBeNull();
      expect(assets.heroPortraitHtml(id, 34, 'synthetic-fallback')).toBe('synthetic-fallback');
    }
  });
});

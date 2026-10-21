/**
 * Local Riot S13 (14.24) icons, used under Riot's policy for free non-commercial fan
 * projects. Only files listed in the generated manifest are referenced; everything has a
 * code-drawn fallback (hero emblem / text), so missing assets never block play.
 */
import type Phaser from 'phaser';
import { S13_ASSETS, type S13Asset } from './s13-asset-manifest';
import { heroEmblemSvg } from './hero-identity';
import { g23ChampionAssets, g23IconUrl } from './g23-display';
import { neutralPortrait, neutralPortraitAssets, neutralPortraitPath } from './s13-neutral-assets';

const BASE = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const index = new Map<string, S13Asset>(S13_ASSETS.map(asset => [`${asset.kind}:${asset.id}`, asset]));

/**
 * Portraits and trait icons the 3D asset root carries beside its models (`<root>/ui-assets.json`, v19 six-costs), by
 * `kind:id` → absolute URL. Read once when a root is configured; anything it lacks keeps the bundled file or the fallback.
 */
const rootAssets = new Map<string, string>();
let rootManifest: Promise<void> | null = null;
export function loadRootUiAssets(base: string | null, fetcher: typeof fetch = (...args) => fetch(...args)): Promise<void> {
  if (!base) return Promise.resolve();
  // Optional: a request or body that hangs is aborted after 3 s (and given up on even if the fetcher ignores the signal),
  // so the bundled portraits still load.
  return rootManifest ??= new Promise<void>(resolve => {
    const abort = new AbortController(), timer = setTimeout(() => { abort.abort(); resolve(); }, 3000);
    fetcher(new URL('ui-assets.json', base).href, { signal: abort.signal }).then(response => response.ok ? response.json() : null)
      .then(manifest => { if (!abort.signal.aborted) registerRootUiAssets(base, manifest); }, () => undefined)
      .finally(() => { clearTimeout(timer); resolve(); });
  });
}
/** Registers the manifest's champion/trait entries whose path stays inside the root; anything else is ignored. */
export function registerRootUiAssets(base: string, manifest: unknown): void {
  const assets = (manifest as { assets?: unknown } | null)?.assets;
  if (!Array.isArray(assets)) return;
  for (const entry of assets as { kind?: unknown; id?: unknown; path?: unknown }[]) {
    if ((entry?.kind !== 'champion' && entry?.kind !== 'trait') || typeof entry.id !== 'string' || typeof entry.path !== 'string'
      || !/^[\w-]+(\/[\w.-]+)*$/.test(entry.path) || entry.path.split('/').includes('..')) continue;
    rootAssets.set(`${entry.kind}:${entry.id}`, new URL(entry.path, base).href);
  }
}

export function s13AssetUrl(kind: S13Asset['kind'], id: string): string | null {
  const asset = index.get(`${kind}:${id}`);
  if (asset) return `${BASE}${asset.path}`;
  const root = rootAssets.get(`${kind}:${id}`);
  if (root) return root;
  const neutral = kind === 'champion' ? neutralPortrait(id) : undefined;
  // G2-3 icons live in their own manifest keyed by apiName (s13-g23-manifest.ts); monsters in s13-neutral-assets.ts.
  return neutral ? `${BASE}${neutralPortraitPath(neutral)}` : g23IconUrl(kind, id);
}
/** Every portrait by content id: the generated manifest, G2-3 heroes/summons present in content, neutral monsters, then the asset root's. */
const championAssets = (): readonly { readonly id: string; readonly url: string }[] => [
  ...[...S13_ASSETS.filter(asset => asset.kind === 'champion'), ...g23ChampionAssets(), ...neutralPortraitAssets()].map(asset => ({ id: asset.id, url: `${BASE}${asset.path}` })),
  ...[...rootAssets].filter(([key]) => key.startsWith('champion:')).map(([key, url]) => ({ id: key.slice('champion:'.length), url })),
];
export const championTextureKey = (id: string) => `s13-champion-${id}`;
export const championPortraitKey = (id: string) => `s13-champion-round-${id}`;

/**
 * Loads champion portraits after the scene is interactive (never blocks first input), then
 * calls `ready` once. Code-drawn emblems show until then; a failed file simply keeps its emblem.
 */
export function loadS13Portraits(scene: Phaser.Scene, ready: () => void): void {
  let queued = 0;
  for (const asset of championAssets()) if (!scene.textures.exists(championTextureKey(asset.id))) {
    scene.load.image(championTextureKey(asset.id), asset.url); queued++;
  }
  if (!queued) { ready(); return; }
  scene.load.once('complete', () => { if (scene.sys.isActive()) ready(); });
  scene.load.start();
}

/** Once per game: circle-clipped portrait textures so pieces need no per-token masks. */
export function buildPortraitTextures(scene: Phaser.Scene, size = 108): void {
  for (const asset of championAssets()) {
    const source = championTextureKey(asset.id), target = championPortraitKey(asset.id);
    if (!scene.textures.exists(source) || scene.textures.exists(target)) continue;
    const texture = scene.textures.createCanvas(target, size, size);
    if (!texture) continue;
    const context = texture.getContext(), image = scene.textures.get(source).getSourceImage() as CanvasImageSource & { width: number; height: number };
    context.save(); context.beginPath(); context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); context.clip();
    // HUD square icons are already face-centred; draw them whole inside the circle.
    const side = Math.min(image.width, image.height);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
    context.restore(); texture.refresh();
  }
}

/** DOM portrait chip: official icon when bundled, else the given fallback markup. */
/**
 * Rules id → 14.24 client character key where the two differ or the portrait is not bundled (v19 six-costs; Mel's client
 * name is MissMage). Their portraits come from the asset root's ui-assets.json under the rules id; without one,
 * heroPortraitHtml draws the code emblem in their place.
 */
export const CHAMPION_PORTRAIT_KEYS: Readonly<Record<string, string>> = Object.freeze({ warwick: 'tft13_warwick', viktor: 'tft13_viktor', mel: 'tft13_missmage' });
export function heroPortraitHtml(definitionId: string, size: number, fallback: string): string {
  const url = s13AssetUrl('champion', definitionId);
  return url ? `<img class="hero-portrait" data-hero="${definitionId}" src="${url}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async">` : fallback;
}

/** Repo trait ids → S13 client apiNames (the client keeps internal names for some classes). */
export const TRAIT_API_NAMES: Readonly<Record<string, string>> = Object.freeze({
  sentinel: 'TFT13_Titan', artillerist: 'TFT13_Martialist', sniper: 'TFT13_Sniper', watcher: 'TFT13_Watcher', sorcerer: 'TFT13_Sorcerer',
});
/** Small inline icon markup for DOM labels; empty string when the asset is not bundled. */
export function s13IconHtml(kind: 'trait' | 'item', id: string, size: number, className: string): string {
  const url = s13AssetUrl(kind, kind === 'trait' ? TRAIT_API_NAMES[id] ?? id : id);
  return url ? `<img class="${className}" src="${url}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async">` : '';
}

/**
 * A bundled icon that fails to load at runtime (bad deploy, blocked file) falls back once:
 * hero portraits become the code-drawn emblem at the same size, tool icons their one-glyph mark,
 * item/trait icons are removed so their text label remains. Image error events do not bubble, so listen in capture phase.
 */
export function installImageFallback(root: Document = document): () => void {
  const onError = (event: Event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.fallback) return;
    image.dataset.fallback = 'true';
    if (image.classList.contains('hero-portrait') && image.dataset.hero) {
      const holder = root.createElement('span'); holder.className = 'hero-fallback';
      holder.innerHTML = heroEmblemSvg(image.dataset.hero, Number(image.getAttribute('width')) || 34);
      image.replaceWith(holder);
    } else if (image.classList.contains('consumable-icon') && image.dataset.glyph) {
      const mark = root.createElement('span'); mark.className = 'consumable-mark'; mark.setAttribute('aria-hidden', 'true');
      mark.textContent = image.dataset.glyph; image.replaceWith(mark);
    } else if (image.classList.contains('item-icon') || image.classList.contains('trait-icon') || image.classList.contains('augment-icon')) image.remove();
  };
  root.addEventListener('error', onError, true);
  return () => root.removeEventListener('error', onError, true);
}

export const itemTextureKey = (id: string) => `s13-item-${id}`;
/** Item icons for the board pieces, loaded on first use; callbacks queued per scene until the file arrives. */
const itemRequests = new WeakMap<Phaser.Scene, Map<string, (() => void)[]>>();
export function requestItemTexture(scene: Phaser.Scene, id: string, ready: () => void): void {
  const key = itemTextureKey(id), url = s13AssetUrl('item', id);
  if (scene.textures.exists(key)) { ready(); return; }
  if (!url) return;
  let pending = itemRequests.get(scene);
  if (!pending) { pending = new Map(); itemRequests.set(scene, pending); }
  const waiting = pending.get(key);
  if (waiting) { waiting.push(ready); return; }
  pending.set(key, [ready]);
  scene.load.image(key, url);
  scene.load.once(`filecomplete-image-${key}`, () => { const callbacks = pending.get(key) ?? []; pending.delete(key); if (scene.sys.isActive()) for (const callback of callbacks) callback(); });
  if (!scene.load.isLoading()) scene.load.start();
}

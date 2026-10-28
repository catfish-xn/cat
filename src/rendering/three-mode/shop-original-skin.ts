/** Decorates existing shop nodes; it never constructs cards, changes labels or handles commands. */
import { createUiImages, readUiManifest, type UiImageDecoder } from './ui-original-assets';

const CARD = '.shop-dock .shop-card[data-unit-def][data-cost]';
const SCOPE = 'body:has(> .render3d-layer) .shop-dock .shop-card';
const STYLE = `
${SCOPE}[data-original-shop-art] .shop-emblem { background: var(--shop-original-art) center / cover no-repeat; }
${SCOPE}[data-original-shop-art] .shop-emblem > * { visibility: hidden; }
${SCOPE}[data-original-shop-art] .shop-emblem::after { display: none; }
${SCOPE}[data-original-shop-frame] { border: 0; border-radius: 0; box-shadow: none; grid-template-rows: minmax(0, 1fr) 24%; }
${SCOPE}[data-original-shop-frame]::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: var(--shop-original-frame) center / 100% 100% no-repeat; }
${SCOPE}[data-original-shop-frame]:not(:disabled):is(:hover, :focus-visible)::before { background-image: var(--shop-original-hover, var(--shop-original-frame)); }
${SCOPE}[data-original-shop-frame] .shop-emblem { bottom: 24%; }
${SCOPE}[data-original-shop-frame] .shop-name { position: relative; z-index: 2; display: flex; align-items: center; background: none; border: 0; line-height: normal; }
${SCOPE}[data-original-shop-frame] .shop-trait { z-index: 2; }
${SCOPE}[data-original-shop-coin] .shop-cost::before { background: var(--shop-original-coin) center / contain no-repeat; border-radius: 0; box-shadow: none; }
`;
const PROPERTIES = ['--shop-original-art', '--shop-original-frame', '--shop-original-hover', '--shop-original-coin'] as const;
const ATTRIBUTES = ['data-original-shop-art', 'data-original-shop-frame', 'data-original-shop-coin'] as const;

/**
 * Runtime sprite IDs: shop.card.<cost>, optionally states.hover -> another sprite ID; shop.coin.
 * Only reviewed local manifest entries enable frames/bands; no atlas coordinates ship in JS.
 * Missing six-cost/empty/state art keeps the existing decoration. Loading is demand-driven.
 */
export function installShopOriginalSkin(assetBase: string | null, read?: (path: string) => Promise<Blob>, decoder?: UiImageDecoder): { dispose(): void } {
  const noop = { dispose() {} };
  if (!assetBase || typeof document === 'undefined' || !document.body || !document.head
    || typeof document.querySelectorAll !== 'function' || typeof MutationObserver === 'undefined') return noop;
  const controller = new AbortController();
  let closed = false, observer: MutationObserver | null = null, style: HTMLStyleElement | null = null;
  let images: ReturnType<typeof createUiImages> | null = null;
  const tracked = new Map<HTMLElement, { identity: string; restore(): void }>();
  const restoreAll = () => { for (const entry of tracked.values()) entry.restore(); tracked.clear(); };
  const readBlob = read ?? (async (path: string) => {
    const response = await fetch(`${assetBase}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error('ui-http');
    return response.blob();
  });
  // Sidecar refresh is independent of the model manifest/cache. It never delays mount or match start.
  void (async () => {
    const response = await fetch(`${assetBase}ui/manifest.json`, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) return;
    const manifest = readUiManifest(await response.json());
    if (closed) return;
    images = createUiImages(manifest, readBlob, decoder);
    style = document.createElement('style'); style.dataset.owner = 'render3d-shop-original'; style.textContent = STYLE;
    document.head.append(style);
    const refresh = () => {
      if (closed) return;
      const cards = new Set(Array.from(document.querySelectorAll<HTMLElement>(CARD)));
      for (const [card, previous] of tracked) {
        if (!cards.has(card) || previous.identity !== `${card.dataset.unitDef}:${card.dataset.cost}`) {
          previous.restore(); tracked.delete(card);
        }
      }
      for (const card of cards) {
        if (tracked.has(card)) continue;
        const definitionId = card.dataset.unitDef!, cost = card.dataset.cost!;
        const properties = PROPERTIES.map(key => [key, card.style.getPropertyValue(key), card.style.getPropertyPriority(key)] as const);
        const attributes = ATTRIBUTES.map(key => [key, card.getAttribute(key)] as const);
        const entry = { identity: `${definitionId}:${cost}`, restore() {
          for (const [key, value, priority] of properties) { if (value) card.style.setProperty(key, value, priority); else card.style.removeProperty(key); }
          for (const [key, value] of attributes) { if (value === null) card.removeAttribute(key); else card.setAttribute(key, value); }
        } };
        tracked.set(card, entry);
        const current = () => !closed && tracked.get(card) === entry
          && card.dataset.unitDef === definitionId && card.dataset.cost === cost;
        void images!.art(definitionId).then(image => {
          if (!image || !current()) return;
          card.style.setProperty('--shop-original-art', `url("${image.url}")`); card.setAttribute('data-original-shop-art', '');
        });
        void images!.sprite('shop.coin').then(image => {
          if (!image || !current()) return;
          card.style.setProperty('--shop-original-coin', `url("${image.url}")`); card.setAttribute('data-original-shop-coin', '');
        });
        const spriteId = `shop.card.${cost}`;
        void images!.sprite(spriteId).then(image => {
          if (!image || !current()) return;
          card.style.setProperty('--shop-original-frame', `url("${image.url}")`); card.setAttribute('data-original-shop-frame', '');
        });
        const hover = manifest.sprites.get(spriteId)?.states.hover;
        if (hover) void images!.sprite(hover).then(image => {
          if (image && current()) card.style.setProperty('--shop-original-hover', `url("${image.url}")`);
        });
      }
    };
    observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-unit-def', 'data-cost'] });
    refresh();
  })().catch(() => { /* Optional sidecar, CORS/schema failure: keep the current shop. */ });
  return { dispose() {
    if (closed) return;
    closed = true; controller.abort(); observer?.disconnect(); restoreAll(); style?.remove(); images?.dispose();
  } };
}

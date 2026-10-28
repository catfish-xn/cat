import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installShopOriginalSkin } from '../src/rendering/three-mode/shop-original-skin';
import type { UiImageDecoder } from '../src/rendering/three-mode/ui-original-assets';

const blob = new Blob(['synthetic']);
const manifest = () => ({ schemaVersion: 1, sourceVersion: '14.24.6442327',
  textures: { t: { path: 'textures/synthetic.png', width: 32, height: 16, bytes: blob.size, sha256: createHash('sha256').update('synthetic').digest('hex') } },
  shopArt: { first: { texture: 't' } }, sprites: { 'shop.card.1': { texture: 't', rect: [0, 0, 16, 16], states: { hover: 'hover' } }, hover: { texture: 't', rect: [16, 0, 16, 16] } } });
class Node {
  dataset: Record<string, string> = { unitDef: 'first', cost: '1' };
  attributes = new Map<string, string>(); properties = new Map<string, [string, string]>();
  textContent = '购买英雄，1 金币'; disabled = false; inert = false; removed = false;
  style = {
    getPropertyValue: (key: string) => this.properties.get(key)?.[0] ?? '',
    getPropertyPriority: (key: string) => this.properties.get(key)?.[1] ?? '',
    setProperty: (key: string, value: string, priority = '') => { this.properties.set(key, [value, priority]); },
    removeProperty: (key: string) => { this.properties.delete(key); },
  };
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  removeAttribute(key: string) { this.attributes.delete(key); }
  remove() { this.removed = true; }
}
let cards: Node[], styles: Node[], change: () => void, disconnect: ReturnType<typeof vi.fn>, decode: UiImageDecoder;
let skin: ReturnType<typeof installShopOriginalSkin> | undefined;
const flush = async () => { await vi.waitFor(() => expect(styles.length).toBe(1)); await new Promise(resolve => setTimeout(resolve, 10)); };
beforeEach(() => {
  cards = [new Node()]; styles = []; disconnect = vi.fn(); change = () => {};
  vi.stubGlobal('document', { body: {}, head: { append: (style: Node) => styles.push(style) },
    querySelectorAll: () => cards, createElement: () => new Node() });
  vi.stubGlobal('MutationObserver', class { constructor(callback: () => void) { change = callback; } observe() {} disconnect = disconnect; });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => manifest(), blob: async () => blob })));
  decode = { decode: vi.fn(async () => ({ url: 'blob:art', width: 32, height: 16 })),
    crop: vi.fn(async (_, rect) => ({ url: `blob:frame-${rect[0]}`, width: 16, height: 16 })), revoke: vi.fn() };
});
afterEach(() => { skin?.dispose(); skin = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('3D shop skin on the existing DOM', () => {
  it('does nothing with no root or a non-browser document', () => {
    skin = installShopOriginalSkin(null); expect(fetch).not.toHaveBeenCalled(); expect(styles).toEqual([]);
    vi.stubGlobal('document', {}); installShopOriginalSkin('https://assets.test/'); expect(fetch).not.toHaveBeenCalled();
  });
  it('installs art, frame/band and hover only after decoding, preserving commands and accessible content', async () => {
    cards[0].disabled = true; cards[0].inert = true;
    const read = vi.fn(async () => blob);
    skin = installShopOriginalSkin('https://assets.test/', read, decode); await flush();
    expect(fetch).toHaveBeenCalledWith('https://assets.test/ui/manifest.json', expect.objectContaining({ cache: 'no-cache' }));
    expect(read).toHaveBeenCalledExactlyOnceWith('ui/textures/synthetic.png');
    expect(cards[0].getAttribute('data-original-shop-art')).toBe(''); expect(cards[0].getAttribute('data-original-shop-frame')).toBe('');
    expect(cards[0].style.getPropertyValue('--shop-original-hover')).toContain('blob:frame-16');
    expect(cards[0].textContent).toBe('购买英雄，1 金币'); expect(cards[0].disabled).toBe(true); expect(cards[0].inert).toBe(true);
    expect(styles[0].textContent).toContain('body:has(> .render3d-layer)'); expect(styles[0].textContent).toContain('pointer-events: none');
    const old = cards[0]; cards = [new Node()]; change();
    await vi.waitFor(() => expect(cards[0].getAttribute('data-original-shop-art')).toBe(''));
    expect(old.properties.size).toBe(0); expect(old.attributes.size).toBe(0); expect(decode.decode).toHaveBeenCalledTimes(1);
    skin.dispose(); expect(styles[0].removed).toBe(true); expect(cards[0].attributes.size).toBe(0); expect(disconnect).toHaveBeenCalledOnce();
  });
  it('replaces the coin independently when its reviewed region is ready', async () => {
    const raw = manifest();
    const withCoin = { ...raw, sprites: { ...raw.sprites, 'shop.coin': { texture: 't', rect: [4, 0, 8, 8] } } };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => withCoin } as Response);
    skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode); await flush();
    expect(cards[0].getAttribute('data-original-shop-coin')).toBe('');
    expect(cards[0].style.getPropertyValue('--shop-original-coin')).toContain('blob:frame-4');
    skin.dispose(); expect(cards[0].attributes.size).toBe(0); expect(decode.revoke).toHaveBeenCalledWith('blob:frame-4');
  });
  it('restores previous inline properties and releases ownership across repeated mounts', async () => {
    cards[0].style.setProperty('--shop-original-art', 'old', 'important'); cards[0].setAttribute('data-original-shop-art', 'old');
    skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode); await flush(); skin.dispose();
    expect(cards[0].style.getPropertyValue('--shop-original-art')).toBe('old');
    expect(cards[0].style.getPropertyPriority('--shop-original-art')).toBe('important'); expect(cards[0].getAttribute('data-original-shop-art')).toBe('old');
    styles = []; skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode); await flush(); skin.dispose();
    expect(decode.revoke).toHaveBeenCalledTimes(6);
  });
  it.each(['http', 'schema'] as const)('keeps the fallback when the sidecar has a %s failure', async reason => {
    vi.mocked(fetch).mockResolvedValue({ ok: reason !== 'http', json: async () => ({ schemaVersion: 9 }) } as Response);
    skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(styles).toEqual([]); expect(cards[0].attributes.size).toBe(0);
  });
  it('keeps frame and portrait fallbacks independently; six-cost frames stay untouched', async () => {
    cards[0].dataset.cost = '6';
    skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode); await flush();
    expect(cards[0].getAttribute('data-original-shop-art')).toBe(''); expect(cards[0].getAttribute('data-original-shop-frame')).toBeNull();
    cards[0].dataset.unitDef = 'missing'; cards[0].dataset.cost = '1'; change();
    await vi.waitFor(() => expect(cards[0].getAttribute('data-original-shop-frame')).toBe(''));
    expect(cards[0].getAttribute('data-original-shop-art')).toBeNull();
  });
  it('keeps all existing decoration on image read/decode failure', async () => {
    vi.mocked(decode.decode).mockRejectedValue(new Error('bad image'));
    skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode); await flush();
    expect(cards[0].attributes.size).toBe(0); expect(cards[0].properties.size).toBe(0);
  });
  it('does not paint a reused card from a late request for its previous hero', async () => {
    let finish!: (value: Blob) => void;
    skin = installShopOriginalSkin('https://assets.test/', () => new Promise(done => { finish = done; }), decode); await flush();
    cards[0].dataset.unitDef = 'missing'; cards[0].dataset.cost = '6'; change(); finish(blob);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(cards[0].attributes.size).toBe(0); expect(cards[0].properties.size).toBe(0);
  });
  it('cannot install a late sidecar after disposal', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => new Promise(done => { finish = done; }) } as Response);
    skin = installShopOriginalSkin('https://assets.test/', async () => blob, decode);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function')); skin.dispose(); finish(manifest());
    await new Promise(resolve => setTimeout(resolve, 10)); expect(styles).toEqual([]); expect(decode.decode).not.toHaveBeenCalled();
  });
});

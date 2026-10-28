import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { readUiManifest } from '../src/rendering3d/ui-assets';
import { startOriginalUi, type UiPlatform } from '../src/rendering/three-mode/ui-original-assets';

const data = 'synthetic-ui';
const file = { path: 'textures/test.png', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
const manifest = () => ({ schemaVersion: 1, sourceVersion: '14.24.6442327',
  textures: { atlas: { ...file, width: 64, height: 32 } },
  sprites: { 'hud.panel': { texture: 'atlas', rect: [0, 0, 24, 16], slice: [2, 3, 2, 3] },
    'health.hp-player': { texture: 'atlas', rect: [24, 0, 24, 8] } },
  fonts: { title: { ...file, path: 'fonts/title.otf', sourcePath: 'assets/ux/fonts/beaufortforlol-bold.otf', coverageVerified: false } },
});
function platform() {
  const imageDispose = vi.fn(), spriteDispose = vi.fn(), fontDispose = vi.fn(), css = { set: vi.fn(), dispose: vi.fn() };
  const p: UiPlatform = {
    image: vi.fn(async () => ({ source: {} as CanvasImageSource, dispose: imageDispose })),
    crop: vi.fn(async (_source, rect, slice) => ({ source: {} as CanvasImageSource, url: `blob:synthetic-${rect[0]}`, width: rect[2], height: rect[3], slice, dispose: spriteDispose })),
    font: vi.fn(() => ({ ready: Promise.resolve('Render3dBeaufort'), dispose: fontDispose })),
    style: vi.fn(() => css),
  };
  return { p, imageDispose, spriteDispose, fontDispose, css };
}
const read = (m: unknown = manifest()) => vi.fn(async (path: string) => new Blob([path.endsWith('manifest.json') ? JSON.stringify(m) : data]));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('optional 3D UI sidecar', () => {
  it('rejects unsafe paths and rectangles individually, without losing valid siblings or Latin fonts', () => {
    const m = manifest();
    Object.assign(m.textures, { escape: { ...file, path: '../unsafe.png', width: 8, height: 8 } });
    Object.assign(m.sprites, {
      overflow: { texture: 'atlas', rect: [60, 0, 8, 8] },
      badSlice: { texture: 'atlas', rect: [0, 0, 8, 8], slice: [4, 0, 4, 0] },
      fractional: { texture: 'atlas', rect: [0.5, 0, 8, 8] },
    });
    const parsed = readUiManifest(m);
    expect([...parsed.textures.keys()]).toEqual(['atlas']);
    expect([...parsed.sprites.keys()]).toEqual(['hud.panel', 'health.hp-player']);
    expect(parsed.fonts).toMatchObject([{ role: 'title', weight: '700' }]);
    expect(parsed.issues).toHaveLength(4);
    expect(() => readUiManifest({ ...m, sourceVersion: 'future-version' })).toThrow('ui-manifest-version');
  });

  it('does nothing without a root; a missing sidecar never throws or installs styles', async () => {
    const { p, css } = platform(), fetch = read();
    const none = startOriginalUi(null, fetch, p); await none.ready; none.dispose();
    expect(fetch).not.toHaveBeenCalled();
    const missing = startOriginalUi('https://assets.test/', async () => { throw new Error('http-404'); }, p);
    await expect(missing.ready).resolves.toBeUndefined();
    expect(missing.issues).toContain('ui:http-404'); expect(css.set).not.toHaveBeenCalled(); missing.dispose();
  });

  it('shares one atlas read/decode, crops only verified regions, and removes owned styles and resources once', async () => {
    const { p, css, imageDispose, spriteDispose, fontDispose } = platform(), fetch = read();
    const ui = startOriginalUi('https://assets.test/root/', fetch, p), notify = vi.fn(); ui.subscribe(notify);
    await ui.ready;
    expect(fetch.mock.calls.map(([path]) => path).filter(path => path.endsWith('.png'))).toEqual(['ui/textures/test.png']);
    expect(p.image).toHaveBeenCalledTimes(1); expect(p.crop).toHaveBeenCalledTimes(2); expect(imageDispose).toHaveBeenCalledTimes(1);
    expect(ui.sprite('health.hp-player')?.width).toBe(24);
    const rules = css.set.mock.calls.at(-1)![0] as string;
    expect(rules).toContain('body:has(.render3d-layer) .shop-dock{'); expect(rules).toContain('border-image-slice:2 3 2 3 fill');
    expect(rules).toContain('Render3dBeaufort,system-ui,sans-serif');
    expect(rules).not.toContain('.hud-gold{'); // an unavailable element keeps its entire original style
    expect(rules).not.toContain('.seat-bar'); // no hidden player bar is revealed
    expect(ui.issues).toContain('hud.gold:region-unverified'); expect(notify).toHaveBeenCalled();
    ui.dispose(); ui.dispose(); expect(css.dispose).toHaveBeenCalledTimes(1); expect(spriteDispose).toHaveBeenCalledTimes(2);
    expect(fontDispose).toHaveBeenCalledTimes(1); expect(ui.sprite('hud.panel')).toBeUndefined();
  });

  it('keeps a readable frame when fonts fail, and fonts when an atlas cannot decode', async () => {
    const a = platform(); a.p.font = () => ({ ready: Promise.reject(new Error('font-decode')), dispose() {} });
    const frames = startOriginalUi('https://assets.test/', read(), a.p); await frames.ready;
    expect(frames.sprite('hud.panel')).toBeDefined(); expect(frames.font('title')).toBe('system-ui');
    expect(a.css.set.mock.calls.at(-1)![0]).not.toContain('font-family:'); frames.dispose();
    const b = platform(); b.p.image = async () => { throw new Error('image-decode'); };
    const fonts = startOriginalUi('https://assets.test/', read(), b.p); await fonts.ready;
    expect(fonts.sprite('hud.panel')).toBeUndefined(); expect(fonts.font('title')).toBe('Render3dBeaufort'); fonts.dispose();
  });

  it('rejects stale bytes before decoding or loading a font', async () => {
    const { p } = platform(), m = manifest();
    const ui = startOriginalUi('https://assets.test/', async path => new Blob([path.endsWith('.json') ? JSON.stringify(m) : 'bad']), p);
    await ui.ready; expect(p.image).not.toHaveBeenCalled(); expect(p.font).not.toHaveBeenCalled();
    expect(ui.issues.some(issue => issue.endsWith(':byte-length'))).toBe(true); ui.dispose();
  });

  it('rejects an equal-length stale file by content hash', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const { p } = platform(), m = manifest();
    const ui = startOriginalUi('https://assets.test/', async path => new Blob([path.endsWith('.json') ? JSON.stringify(m) : data.toUpperCase()]), p);
    await ui.ready; expect(p.image).not.toHaveBeenCalled(); expect(p.font).not.toHaveBeenCalled();
    expect(ui.issues.some(issue => issue.endsWith(':sha256'))).toBe(true); ui.dispose();
  });

  it('does not install a font or image arriving after dispose, and frees the late crop', async () => {
    const a = platform(); let finish!: () => void;
    a.p.crop = async (_source, rect) => { await new Promise<void>(resolve => { finish = resolve; });
      return { source: {} as CanvasImageSource, url: 'blob:late', width: rect[2], height: rect[3], dispose: a.spriteDispose }; };
    const m = manifest(); delete (m.sprites as Partial<typeof m.sprites>)['health.hp-player']; m.fonts = {} as typeof m.fonts;
    const ui = startOriginalUi('https://assets.test/', read(m), a.p);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function')); ui.dispose(); finish(); await ui.ready;
    expect(a.css.set).not.toHaveBeenCalled(); expect(a.spriteDispose).toHaveBeenCalledTimes(1); expect(a.imageDispose).toHaveBeenCalledTimes(1);
  });

  it('loads FontFace by blob address, limits it to Latin, and reference-counts faces across mounts', async () => {
    const faces = new Set(), add = vi.fn(face => faces.add(face)), remove = vi.fn(face => faces.delete(face));
    const styles: { textContent: string; dataset: object; remove: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal('document', { fonts: { add, delete: remove }, head: { append() {} },
      createElement: () => { const s = { textContent: '', dataset: {}, remove: vi.fn() }; styles.push(s); return s; } });
    const construct = vi.fn();
    vi.stubGlobal('FontFace', class { constructor(...args: unknown[]) { construct(...args); } async load() { return this; } });
    const m = manifest(); m.sprites = {} as typeof m.sprites;
    const a = startOriginalUi('https://assets.test/', read(m)), b = startOriginalUi('https://assets.test/', read(m));
    await Promise.all([a.ready, b.ready]);
    expect(construct).toHaveBeenCalledTimes(1);
    expect(construct.mock.calls[0]).toEqual(['Render3dBeaufort', expect.stringContaining('url("blob:'), { weight: '700', style: 'normal', unicodeRange: 'U+0000-024F' }]);
    expect(faces.size).toBe(1); a.dispose(); expect(remove).not.toHaveBeenCalled(); expect(faces.size).toBe(1);
    b.dispose(); expect(remove).toHaveBeenCalledTimes(1); expect(faces.size).toBe(0);
    expect(styles.every(style => style.remove.mock.calls.length === 1)).toBe(true);
  });

  it('never registers a font that finishes loading after its final owner leaves 3D', async () => {
    let finish!: () => void;
    const add = vi.fn(), remove = vi.fn(), revoke = vi.spyOn(URL, 'revokeObjectURL');
    vi.stubGlobal('document', { fonts: { add, delete: remove }, head: { append() {} },
      createElement: () => ({ textContent: '', dataset: {}, remove() {} }) });
    vi.stubGlobal('FontFace', class { load() { return new Promise<void>(resolve => { finish = resolve; }); } });
    const m = manifest(); m.sprites = {} as typeof m.sprites;
    const ui = startOriginalUi('https://assets.test/', read(m));
    await vi.waitFor(() => expect(finish).toBeTypeOf('function')); ui.dispose(); finish(); await ui.ready;
    expect(add).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledTimes(1);
  });
});

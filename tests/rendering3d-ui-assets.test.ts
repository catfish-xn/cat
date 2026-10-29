import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readUiManifest } from '../src/rendering3d/ui-assets';
import { startOriginalUi, type ReadyUiSprite, type UiPlatform } from '../src/rendering/three-mode/ui-original-assets';
import { originalHudRules } from '../src/rendering/three-mode/hud-style';

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
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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
    expect(css.set).toHaveBeenCalledTimes(1); expect(notify).toHaveBeenCalledTimes(1);
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

  it('reports unavailable SHA-256 once per mount while retaining byte checks and usable assets', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });
    const { p } = platform(), ui = startOriginalUi('https://assets.test/', read(), p);
    await ui.ready;
    expect(ui.issues.filter(issue => issue === 'sha256-unavailable')).toHaveLength(1);
    expect(p.image).toHaveBeenCalledTimes(1); expect(p.font).toHaveBeenCalledTimes(1);
    expect(ui.sprite('hud.panel')).toBeDefined(); ui.dispose();
    const stale = platform();
    const bad = startOriginalUi('https://assets.test/', async path => new Blob([path.endsWith('.json') ? JSON.stringify(manifest()) : 'bad']), stale.p);
    await bad.ready;
    expect(stale.p.image).not.toHaveBeenCalled(); expect(stale.p.font).not.toHaveBeenCalled();
    expect(bad.issues.some(issue => issue.endsWith(':byte-length'))).toBe(true); bad.dispose();
  });

  it('clears native read deadlines after success and publishes the complete skin once', async () => {
    vi.useFakeTimers(); vi.stubGlobal('crypto', undefined);
    const signals: AbortSignal[] = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return { ok: true, blob: async () => new Blob([url.endsWith('.json') ? JSON.stringify(manifest()) : data]) };
    });
    vi.stubGlobal('fetch', fetch);
    const { p, css } = platform(), ui = startOriginalUi('https://assets.test/root/', undefined, p), notify = vi.fn();
    ui.subscribe(notify);
    await vi.advanceTimersByTimeAsync(0); await ui.ready;
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://assets.test/root/ui/manifest.json', 'https://assets.test/root/ui/textures/test.png', 'https://assets.test/root/ui/fonts/title.otf',
    ]);
    expect(fetch.mock.calls.every(([, init]) => init.cache === 'no-cache')).toBe(true);
    expect(css.set).toHaveBeenCalledTimes(1); expect(notify).toHaveBeenCalledTimes(1);
    expect(css.set.mock.calls[0][0]).toContain('Render3dBeaufort,system-ui,sans-serif');
    expect(ui.sprite('hud.panel')).toBeDefined(); expect(ui.sprite('health.hp-player')).toBeDefined();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(signals.every(signal => !signal.aborted)).toBe(true); ui.dispose();
  });

  it.each([
    ['manifest.json', 'headers'], ['manifest.json', 'body'],
    ['test.png', 'headers'], ['test.png', 'body'],
    ['title.otf', 'headers'], ['title.otf', 'body'],
  ])('settles ready and aborts a native %s read stalled at %s after 10 seconds', async (target, stage) => {
    vi.useFakeTimers(); vi.stubGlobal('crypto', undefined);
    let signal!: AbortSignal;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith(target)) {
        signal = init.signal as AbortSignal;
        if (stage === 'headers') return new Promise(() => {}); // Deliberately ignores abort.
        return { ok: true, blob: () => new Promise(() => {}) };
      }
      return { ok: true, blob: async () => new Blob([url.endsWith('.json') ? JSON.stringify(manifest()) : data]) };
    }));
    const { p } = platform(), ui = startOriginalUi('https://assets.test/', undefined, p);
    let settled = false; void ui.ready.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(9_999); expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await expect(ui.ready).resolves.toBeUndefined();
    expect(settled).toBe(true); expect(signal.aborted).toBe(true);
    expect(ui.issues.some(issue => issue.endsWith(':read-timeout'))).toBe(true);
    expect(vi.getTimerCount()).toBe(0); ui.dispose();
  });

  it.each(['manifest', 'assets'])('aborts pending native %s reads on dispose and settles ready without waiting for fetch', async stage => {
    vi.useFakeTimers(); vi.stubGlobal('crypto', undefined);
    const pending: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (stage === 'assets' && url.endsWith('.json')) return { ok: true, blob: async () => new Blob([JSON.stringify(manifest())]) };
      pending.push(init.signal as AbortSignal);
      return { ok: true, blob: () => new Promise(() => {}) };
    }));
    const { p, css } = platform(), ui = startOriginalUi('https://assets.test/', undefined, p), notify = vi.fn();
    ui.subscribe(notify); await vi.advanceTimersByTimeAsync(0);
    expect(pending).toHaveLength(stage === 'assets' ? 2 : 1);
    expect(pending.every(signal => !signal.aborted)).toBe(true);
    ui.dispose(); ui.dispose(); await expect(ui.ready).resolves.toBeUndefined();
    expect(pending.every(signal => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0); expect(ui.issues).not.toContain('ui:ui-disposed');
    expect(p.image).not.toHaveBeenCalled(); expect(p.font).not.toHaveBeenCalled();
    expect(css.set).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });

  it('drops a queued skin update if disposed before its microtask runs', async () => {
    let flush!: () => void;
    vi.stubGlobal('queueMicrotask', (callback: () => void) => { flush = callback; });
    const { p, css } = platform(), ui = startOriginalUi('https://assets.test/', read(), p), notify = vi.fn();
    ui.subscribe(notify); await ui.ready;
    expect(flush).toBeTypeOf('function'); expect(css.set).not.toHaveBeenCalled();
    ui.dispose(); flush(); expect(css.set).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });

  it('clips XP against the full track, gives offline gold a separate fixed icon, and enables sliced borders', () => {
    const sprite = { source: {} as CanvasImageSource, url: 'blob:synthetic', width: 64, height: 8, dispose() {} };
    const rules = originalHudRules(new Map<string, ReadyUiSprite>([
      ['hud.panel', { ...sprite, slice: [2, 3, 2, 3] as const }], ['hud.level', { ...sprite, slice: [1, 1, 1, 1] as const }],
      ['hud.xp-fill', sprite], ['hud.gold-icon', sprite],
    ]), new Map());
    expect(rules).toContain('border-style:solid;border-image-source:');
    expect(rules).toContain('.hud-xp-bar{container-type:inline-size;}');
    expect(rules).toContain('.hud-xp-fill{border-image:none;background:url("blob:synthetic") left center / 100cqw 100% no-repeat;');
    expect(rules).toContain('body:not([data-online]):has(.render3d-layer) .shop-dock .hud-gold .hud-label{');
    expect(rules).not.toContain('body[data-online]:has(.render3d-layer) .shop-dock .hud-gold .hud-label{');
    expect(rules).toContain('width:auto;height:auto;overflow:visible;color:inherit;background:none;');
    expect(rules).toContain('.hud-label::before{content:"";display:inline-block;flex:0 0 13px;width:13px;height:13px;background:url("blob:synthetic") center / contain no-repeat;}');
    expect(rules).not.toContain(';color:transparent;'); expect(rules).not.toContain('content:none');
  });

  it('paints the shop nine-slice without changing its existing border or box dimensions', () => {
    const rules = originalHudRules(new Map<string, ReadyUiSprite>([
      ['hud.panel', { source: {} as CanvasImageSource, url: 'blob:panel', width: 24, height: 16,
        slice: [2, 3, 2, 3], dispose() {} }],
    ]), new Map());
    const panel = rules.match(/^body:has\(\.render3d-layer\) \.shop-dock\{([^}]+)\}$/)?.[1];
    expect(panel).toBeDefined();
    expect(panel).toContain('border-image-source:url("blob:panel");');
    expect(panel).toContain('border-image-slice:2 3 2 3 fill;');
    expect(panel).toContain('border-image-width:2px 3px 2px 3px;');
    // A border-style would turn the offline initial medium border into 3px.
    // Leave both the offline zero border and the online 1px border untouched.
    expect(panel).not.toMatch(/(?:^|;)(?:border(?:-(?:style|width|top|right|bottom|left)(?:-(?:style|width))?)?|(?:min-|max-)?(?:width|height)|box-sizing|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?):/);
  });

  it('leaves online coin styling untouched and limits both offline label and fixed icon to offline mode', () => {
    const rules = originalHudRules(new Map<string, ReadyUiSprite>([
      ['hud.gold-icon', { source: {} as CanvasImageSource, url: 'blob:coin', width: 64, height: 8, dispose() {} }],
    ]), new Map());
    const selectors = [...rules.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match => match[1].trim());
    const label = 'body:not([data-online]):has(.render3d-layer) .shop-dock .hud-gold .hud-label';
    expect(selectors).toEqual([label, `${label}::before`]);
    expect(rules).toContain('width:auto;height:auto;overflow:visible;color:inherit;');
    expect(rules).toContain('flex:0 0 13px;width:13px;height:13px;background:url("blob:coin") center / contain no-repeat;');
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

  it('keeps Chinese and punctuation out of all three Latin faces and preserves the existing Chinese fallback stack', async () => {
    const styles: { textContent: string; dataset: object; remove(): void }[] = [];
    vi.stubGlobal('document', { fonts: { add() {}, delete() {} }, head: { append() {} },
      createElement: () => { const style = { textContent: '', dataset: {}, remove() {} }; styles.push(style); return style; } });
    const construct = vi.fn();
    vi.stubGlobal('FontFace', class { constructor(...args: unknown[]) { construct(...args); } async load() { return this; } });
    const names = ['beaufortforlol-bold.otf', 'beaufortforlol-regular.otf', 'spiegel-regular.otf'];
    const m = { ...manifest(), sprites: {}, fonts: Object.fromEntries(names.map(name => [name,
      { ...file, path: `fonts/${name}`, sourcePath: `assets/ux/fonts/${name}`, coverageVerified: false }])) };
    const ui = startOriginalUi('https://assets.test/', read(m));
    try {
      await ui.ready;
      expect(construct).toHaveBeenCalledTimes(3);
      expect(construct.mock.calls.map(([family, , desc]) => [family, desc.weight]).sort()).toEqual([
        ['Render3dBeaufort', '400'], ['Render3dBeaufort', '700'], ['Render3dSpiegel', '400'],
      ]);
      const chinese = [...'金币等级经验人口刷新出售锁定阶段战斗羁绊装备强化淘汰排名帮助全屏音效匹配，。'];
      for (const [, , desc] of construct.mock.calls) {
        const range = /^U\+([\dA-F]+)-([\dA-F]+)$/i.exec(desc.unicodeRange);
        expect(range).not.toBeNull();
        const [first, last] = range!.slice(1).map(n => parseInt(n, 16));
        const covered = (code: number) => code >= first && code <= last;
        expect([...'Gold 123'].every(c => covered(c.codePointAt(0)!))).toBe(true);
        expect([...chinese.map(c => c.codePointAt(0)!), 0x3400, 0x9fff, 0x20000].some(covered)).toBe(false);
      }
      const baseline = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
      const fallback = /^:root\s*\{[^}]*font-family:\s*([^;]+);/.exec(baseline)![1].replace(/\s+/g, '');
      const stacks = styles.flatMap(s => [...s.textContent.matchAll(/font-family:([^;]+);/g)].map(m => m[1].split(',')));
      expect(stacks.map(s => s[0]).sort()).toEqual(['Render3dBeaufort', 'Render3dSpiegel']);
      for (const stack of stacks) expect(stack.slice(1).join(',')).toBe(fallback);
    } finally { ui.dispose(); }
  });
});
